/**
 * GitHubService — typed Octokit wrapper implementing `IGitHubService`.
 *
 * All methods accept either a pre-resolved PR URL or separate (owner, repo)
 * arguments. The service never concerns itself with authentication; the
 * caller passes an installation-scoped Octokit at construction time.
 */

import type {
  IGitHubService,
  PRRef,
  PRDetails,
  PRFile,
  PRCommit,
  ExistingReview,
  DiffRange,
  ReviewInput,
  ReviewResult,
  RepoInfo,
} from '../types/index.js';

/**
 * Minimal structural type for the Octokit slice we use. We avoid importing
 * the full `@octokit/rest` types here so the service stays independent of
 * transport specifics and easily mockable in tests.
 */
interface OctokitSlice {
  paginate?<T, P extends object>(
    method: (params: P) => Promise<{ data: T[] }>,
    params: P,
  ): Promise<T[]>;
  rest: {
    pulls: {
      get(params: { owner: string; repo: string; pull_number: number }): Promise<{
        data: PRDataRaw;
      }>;
      listFiles(params: {
        owner: string;
        repo: string;
        pull_number: number;
        per_page?: number;
      }): Promise<{ data: PRFileRaw[] }>;
      listCommits(params: {
        owner: string;
        repo: string;
        pull_number: number;
        per_page?: number;
      }): Promise<{ data: PRCommitRaw[] }>;
      listReviews(params: {
        owner: string;
        repo: string;
        pull_number: number;
      }): Promise<{ data: ReviewRaw[] }>;
      createReview(params: {
        owner: string;
        repo: string;
        pull_number: number;
        body?: string;
        event?: string;
        comments?: unknown[];
      }): Promise<{ data: { id: number; html_url?: string } }>;
    };
    repos: {
      getContent(params: {
        owner: string;
        repo: string;
        path: string;
        ref?: string;
      }): Promise<{
        data:
          | { type: string; content?: string; encoding?: string }
          | Array<unknown>;
      }>;
      compareCommits(params: {
        owner: string;
        repo: string;
        base: string;
        head: string;
      }): Promise<{
        data: {
          total_commits: number;
          files?: DiffFileRaw[];
        };
      }>;
      listLanguages(params: {
        owner: string;
        repo: string;
      }): Promise<{ data: Record<string, number> }>;
      getReadme(params: {
        owner: string;
        repo: string;
      }): Promise<{
        data: { content?: string; encoding?: string };
      }>;
    };
  };
}

interface PRDataRaw {
  id: number;
  number: number;
  title?: string;
  body?: string | null;
  state?: string;
  user?: { login?: string } | null;
  created_at?: string;
  updated_at?: string;
  base?: { ref?: string };
  head?: { ref?: string };
  mergeable?: boolean | null;
  additions?: number;
  deletions?: number;
  changed_files?: number;
}

interface PRFileRaw {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  blob_url?: string;
}

interface PRCommitRaw {
  sha: string;
  commit: {
    message?: string;
    author?: { name?: string; date?: string } | null;
  };
}

interface ReviewRaw {
  id: number;
  user?: { login?: string } | null;
  state?: string;
  body?: string | null;
  submitted_at?: string | null;
}

interface DiffFileRaw {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  blob_url?: string;
}

const PR_URL_RE =
  /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:[/?#].*)?$/i;

/** Default page size for paginated PR listings; capped at GitHub's max. */
const LIST_PER_PAGE = 100;

async function paginatePRList<T>(
  octokit: OctokitSlice,
  method: (params: never) => Promise<{ data: T[] }>,
  params: Record<string, unknown>,
): Promise<T[]> {
  const requestParams = { ...params, per_page: LIST_PER_PAGE };
  const request = method as (params: Record<string, unknown>) => Promise<{ data: T[] }>;
  if (octokit.paginate) {
    return octokit.paginate(request, requestParams);
  }

  const firstPage = await request(requestParams);
  return firstPage.data;
}

export class GitHubService implements IGitHubService {
  constructor(private readonly octokit: OctokitSlice) {}

  parsePRURL(url: string): PRRef {
    const m = PR_URL_RE.exec(url.trim());
    if (!m) {
      throw new Error(`Invalid GitHub pull-request URL: ${url}`);
    }
    return {
      owner: m[1],
      repo: m[2],
      pull_number: parseInt(m[3], 10),
    };
  }

  async getPRDetails(pr_url: string): Promise<PRDetails> {
    const { owner, repo, pull_number } = this.parsePRURL(pr_url);
    const api = this.octokit.rest;

    const prRes = await api.pulls.get({ owner, repo, pull_number });
    const pr = prRes.data;
    const files = await paginatePRList<PRFileRaw>(
      this.octokit,
      api.pulls.listFiles,
      { owner, repo, pull_number },
    );
    const commits = await paginatePRList<PRCommitRaw>(
      this.octokit,
      api.pulls.listCommits,
      { owner, repo, pull_number },
    );
    const reviews = await paginatePRList<ReviewRaw>(
      this.octokit,
      api.pulls.listReviews,
      { owner, repo, pull_number },
    );

    return {
      pr: {
        id: pr.id,
        number: pr.number,
        title: pr.title ?? '',
        body: pr.body ?? null,
        state: pr.state ?? 'open',
        author: pr.user?.login ?? '',
        created_at: pr.created_at ?? '',
        updated_at: pr.updated_at ?? '',
        base_branch: pr.base?.ref ?? '',
        head_branch: pr.head?.ref ?? '',
        mergeable: pr.mergeable ?? null,
        additions: pr.additions ?? 0,
        deletions: pr.deletions ?? 0,
        changed_files: pr.changed_files ?? 0,
      },
      files: files.map((f) => toPRFile(f)),
      commits: commits.map(toPRCommit),
      existing_reviews: reviews.map(toExistingReview),
      repository: {
        owner,
        repo,
        full_name: `${owner}/${repo}`,
      },
    };
  }

  async getPRFiles(pr_url: string, include_patch = true): Promise<PRFile[]> {
    const { owner, repo, pull_number } = this.parsePRURL(pr_url);
    const files = await paginatePRList<PRFileRaw>(
      this.octokit,
      this.octokit.rest.pulls.listFiles,
      { owner, repo, pull_number },
    );
    return files.map((f) => toPRFile(f, include_patch));
  }

  async getPRCommits(pr_url: string): Promise<PRCommit[]> {
    const { owner, repo, pull_number } = this.parsePRURL(pr_url);
    const commits = await paginatePRList<PRCommitRaw>(
      this.octokit,
      this.octokit.rest.pulls.listCommits,
      { owner, repo, pull_number },
    );
    return commits.map(toPRCommit);
  }

  async getFileContent(
    owner: string,
    repo: string,
    path: string,
    ref?: string,
  ): Promise<string | null> {
    try {
      const res = await this.octokit.rest.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });
      if (Array.isArray(res.data)) return null;
      const file = res.data;
      if (file.type !== 'file' || file.content == null) return null;
      // GitHub returns content base64-encoded; `encoding` may be absent.
      const text =
        file.encoding === undefined || file.encoding === 'base64'
          ? Buffer.from(file.content, 'base64').toString('utf8')
          : file.content;
      return text;
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 404) return null;
      throw err;
    }
  }

  async getDiffRange(
    owner: string,
    repo: string,
    base_sha: string,
    head_sha: string,
  ): Promise<DiffRange> {
    const res = await this.octokit.rest.repos.compareCommits({
      owner,
      repo,
      base: base_sha,
      head: head_sha,
    });
    const files = res.data.files ?? [];
    return {
      base_sha,
      head_sha,
      total_commits: res.data.total_commits ?? 0,
      total_files: files.length,
      files: files.map((f) => ({
        filename: f.filename,
        status: f.status,
        additions: f.additions,
        deletions: f.deletions,
        changes: f.changes,
        patch: f.patch,
        blob_url: f.blob_url,
      })),
    };
  }

  async createReview(
    owner: string,
    repo: string,
    pull_number: number,
    review: ReviewInput,
  ): Promise<ReviewResult> {
    const event = review.event ?? 'COMMENT';
    const comments = (review.comments ?? []).map((c) => ({
      path: c.path,
      line: c.line,
      body: c.body,
      side: c.side,
      start_line: c.start_line,
      start_side: c.start_side,
    }));
    const res = await this.octokit.rest.pulls.createReview({
      owner,
      repo,
      pull_number,
      body: review.body,
      event,
      comments,
    });
    return {
      success: true,
      review_id: res.data.id,
      review_url: res.data.html_url ?? `https://github.com/${owner}/${repo}/pull/${pull_number}`,
    };
  }

  async getRepoInfo(owner: string, repo: string): Promise<RepoInfo> {
    const langsRes = await this.octokit.rest.repos.listLanguages({ owner, repo });
    const languages = langsRes.data ?? {};
    const primary_language = pickPrimaryLanguage(languages);

    let readme_content: string | null = null;
    let has_readme = false;
    try {
      const readmeRes = await this.octokit.rest.repos.getReadme({ owner, repo });
      const raw = readmeRes.data.content ?? '';
      // GitHub returns content base64-encoded; `encoding` may be absent.
      readme_content =
        readmeRes.data.encoding === undefined ||
        readmeRes.data.encoding === 'base64'
          ? Buffer.from(raw, 'base64').toString('utf8')
          : raw;
      has_readme = true;
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status !== 404) throw err;
    }

    return {
      owner,
      repo,
      full_name: `${owner}/${repo}`,
      languages,
      primary_language,
      has_readme,
      readme_content,
    };
  }
}

function toPRFile(raw: PRFileRaw, include_patch = true): PRFile {
  return {
    filename: raw.filename,
    status: raw.status,
    additions: raw.additions,
    deletions: raw.deletions,
    changes: raw.changes,
    ...(include_patch ? { patch: raw.patch } : {}),
    blob_url: raw.blob_url,
  };
}

function toPRCommit(raw: PRCommitRaw): PRCommit {
  return {
    sha: raw.sha,
    message: raw.commit.message ?? '',
    author: raw.commit.author?.name ?? '',
    date: raw.commit.author?.date ?? '',
  };
}

function toExistingReview(raw: ReviewRaw): ExistingReview {
  return {
    id: raw.id,
    user: raw.user?.login ?? '',
    state: raw.state ?? '',
    body: raw.body ?? null,
    submitted_at: raw.submitted_at ?? null,
  };
}

function pickPrimaryLanguage(languages: Record<string, number>): string {
  const entries = Object.entries(languages);
  if (entries.length === 0) return 'Unknown';
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}