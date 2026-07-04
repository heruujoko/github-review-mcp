import { describe, it, expect, vi } from 'vitest';
import { GitHubService } from './github.js';

/** Builds a mock Octokit with controllable responses for the GitHubService surface. */
function makeMockOctokit(overrides: Partial<{
  pr: Record<string, unknown>;
  files: unknown[];
  commits: unknown[];
  reviews: unknown[];
  contentFile: { type: string; content: string; encoding: string };
  contentFns: { (params: unknown): Promise<unknown> };
  compare: Record<string, unknown>;
  reviewCreated: Record<string, unknown>;
  languages: Record<string, number>;
  readme: string | null;
}> = {}) {
  const paginate = vi.fn(async (method: (params: Record<string, unknown>) => Promise<{ data: unknown[] }>, params: Record<string, unknown>) => {
    const res = await method(params);
    return res.data;
  });
  const pulls = {
    get: vi.fn(async () => ({ data: overrides.pr ?? { id: 1, number: 42, title: 'T', body: null, state: 'open', user: { login: 'octocat' }, created_at: '2024-01-01', updated_at: '2024-01-02', base: { ref: 'main' }, head: { ref: 'feat' }, mergeable: true, additions: 5, deletions: 1, changed_files: 2 } })),
    listFiles: vi.fn(async () => ({ data: overrides.files ?? [{ filename: 'a.js', status: 'modified', additions: 2, deletions: 1, changes: 3, patch: '@@ -1,2 +1,3 @@' }] })),
    listCommits: vi.fn(async () => ({ data: overrides.commits ?? [{ sha: 'abc', commit: { message: 'm', author: { name: 'A', date: '2024' } } }] })),
    listReviews: vi.fn(async () => ({ data: overrides.reviews ?? [] })),
    createReview: vi.fn(async () => ({ data: overrides.reviewCreated ?? { id: 999, html_url: 'https://github.com/o/r/pull/42#review-999' } })),
  };
  const repos = {
    getContent: overrides.contentFns
      ? (overrides.contentFns as never)
      : vi.fn(async (params: { path?: string }) => {
          if (params.path === 'missing.txt') {
            const err = new Error('NF');
            (err as Error & { status: number }).status = 404;
            throw err;
          }
          return { data: overrides.contentFile ?? { type: 'file', content: Buffer.from('hello').toString('base64'), encoding: 'base64' } };
        }),
    compareCommits: vi.fn(async () => ({ data: overrides.compare ?? { total_commits: 2, files: [{ filename: 'd.js', status: 'added', additions: 1, deletions: 0, changes: 1, patch: '@@ +1 @@', blob_url: 'u' }] } })),
    listLanguages: vi.fn(async () => ({ data: overrides.languages ?? { JavaScript: 100, TypeScript: 50 } })),
    getReadme: vi.fn(async () => {
      if (overrides.readme === null) {
        const err = new Error('NF');
        (err as Error & { status: number }).status = 404;
        throw err;
      }
      return { data: { content: Buffer.from(overrides.readme ?? '# Readme').toString('base64') } };
    }),
  };
  return { paginate, rest: { pulls, repos } };
}

const PR_URL = 'https://github.com/octocat/Hello-World/pull/42';

describe('GitHubService.parsePRURL', () => {
  it('parses owner, repo, and pull number', () => {
    const svc = new GitHubService(makeMockOctokit() as never);
    expect(svc.parsePRURL(PR_URL)).toEqual({ owner: 'octocat', repo: 'Hello-World', pull_number: 42 });
  });
  it('throws on an invalid URL', () => {
    const svc = new GitHubService(makeMockOctokit() as never);
    expect(() => svc.parsePRURL('https://example.com')).toThrow(/invalid/i);
  });
});

describe('GitHubService.getPRDetails', () => {
  it('assembles PR + files + commits + existing reviews', async () => {
    const mock = makeMockOctokit({
      files: [{ filename: 'a.js', status: 'modified', additions: 2, deletions: 1, changes: 3, patch: 'P', blob_url: 'bu' }],
      commits: [{ sha: 's1', commit: { message: 'fix', author: { name: 'A', date: '2024' } } }],
      reviews: [{ id: 5, user: { login: 'r' }, state: 'COMMENT', body: 'hi', submitted_at: '2024' }],
    });
    const svc = new GitHubService(mock as never);
    const details = await svc.getPRDetails(PR_URL);
    expect(details.pr.number).toBe(42);
    expect(details.files).toHaveLength(1);
    expect(details.commits[0].sha).toBe('s1');
    expect(details.existing_reviews[0].user).toBe('r');
    expect(details.repository.full_name).toBe('octocat/Hello-World');
    expect(mock.paginate).toHaveBeenCalledTimes(3);
    expect(mock.paginate).toHaveBeenCalledWith(mock.rest.pulls.listFiles, { owner: 'octocat', repo: 'Hello-World', pull_number: 42, per_page: 100 });
    expect(mock.paginate).toHaveBeenCalledWith(mock.rest.pulls.listCommits, { owner: 'octocat', repo: 'Hello-World', pull_number: 42, per_page: 100 });
    expect(mock.paginate).toHaveBeenCalledWith(mock.rest.pulls.listReviews, { owner: 'octocat', repo: 'Hello-World', pull_number: 42, per_page: 100 });
  });
});

describe('GitHubService.getPRFiles', () => {
  it('returns files with patches when include_patch is true', async () => {
    const mock = makeMockOctokit({ files: [{ filename: 'a.js', status: 'modified', additions: 1, deletions: 1, changes: 2, patch: '@@ patch @@' }] });
    const svc = new GitHubService(mock as never);
    const files = await svc.getPRFiles(PR_URL, true);
    expect(files[0].patch).toBe('@@ patch @@');
  });
  it('omits patches when include_patch is false', async () => {
    const mock = makeMockOctokit({ files: [{ filename: 'a.js', status: 'modified', additions: 1, deletions: 1, changes: 2, patch: '@@ patch @@' }] });
    const svc = new GitHubService(mock as never);
    const files = await svc.getPRFiles(PR_URL, false);
    expect(files[0].patch).toBeUndefined();
  });
});

describe('GitHubService.getPRCommits', () => {
  it('returns commits for the PR', async () => {
    const mock = makeMockOctokit({ commits: [{ sha: 's1', commit: { message: 'm', author: { name: 'A', date: '2024' } } }] });
    const svc = new GitHubService(mock as never);
    const commits = await svc.getPRCommits(PR_URL);
    expect(commits[0].sha).toBe('s1');
    expect(commits).toHaveLength(1);
  });
});

describe('GitHubService.getFileContent', () => {
  it('decodes base64 file content', async () => {
    const mock = makeMockOctokit();
    const svc = new GitHubService(mock as never);
    const content = await svc.getFileContent('o', 'r', 'path/to/file.txt', 'main');
    expect(content).toBe('hello');
    expect(mock.rest.repos.getContent).toHaveBeenCalledWith({ owner: 'o', repo: 'r', path: 'path/to/file.txt', ref: 'main' });
  });
  it('returns null when the file does not exist', async () => {
    const mock = makeMockOctokit();
    const svc = new GitHubService(mock as never);
    const content = await svc.getFileContent('o', 'r', 'missing.txt');
    expect(content).toBeNull();
  });
});

describe('GitHubService.getDiffRange', () => {
  it('uses the compare API and returns files + counts', async () => {
    const mock = makeMockOctokit({
      compare: { total_commits: 3, files: [{ filename: 'd.js', status: 'added', additions: 1, deletions: 0, changes: 1, patch: '@@ p @@', blob_url: 'bu' }] },
    });
    const svc = new GitHubService(mock as never);
    const diff = await svc.getDiffRange('o', 'r', 'baseSHA', 'headSHA');
    expect(mock.rest.repos.compareCommits).toHaveBeenCalledWith({ owner: 'o', repo: 'r', base: 'baseSHA', head: 'headSHA' });
    expect(diff.base_sha).toBe('baseSHA');
    expect(diff.head_sha).toBe('headSHA');
    expect(diff.total_commits).toBe(3);
    expect(diff.files).toHaveLength(1);
    expect(diff.files[0].filename).toBe('d.js');
  });
});

describe('GitHubService.createReview', () => {
  it('maps inline comments and returns success/id/url', async () => {
    const mock = makeMockOctokit();
    const svc = new GitHubService(mock as never);
    const result = await svc.createReview('o', 'r', 42, {
      body: 'Review body',
      event: 'COMMENT',
      comments: [
        { path: 'a.js', line: 10, body: 'c1', side: 'RIGHT', start_line: 8 },
      ],
    });
    expect(result.success).toBe(true);
    expect(result.review_id).toBe(999);
    expect(result.review_url).toContain('review-999');
    expect(mock.rest.pulls.createReview).toHaveBeenCalledWith({
      owner: 'o',
      repo: 'r',
      pull_number: 42,
      body: 'Review body',
      event: 'COMMENT',
      comments: [{ path: 'a.js', line: 10, body: 'c1', side: 'RIGHT', start_line: 8 }],
    });
  });
  it('defaults event to COMMENT and comments to []', async () => {
    const mock = makeMockOctokit();
    const svc = new GitHubService(mock as never);
    await svc.createReview('o', 'r', 7, { body: 'b' });
    expect(mock.rest.pulls.createReview).toHaveBeenCalledWith({
      owner: 'o', repo: 'r', pull_number: 7, body: 'b', event: 'COMMENT', comments: [],
    });
  });
});

describe('GitHubService.getRepoInfo', () => {
  it('returns languages, primary language, and readme presence', async () => {
    const mock = makeMockOctokit({ languages: { TypeScript: 90, JavaScript: 10 }, readme: '# Readme' });
    const svc = new GitHubService(mock as never);
    const info = await svc.getRepoInfo('o', 'r');
    expect(info.primary_language).toBe('TypeScript');
    expect(info.has_readme).toBe(true);
    expect(info.readme_content).toBe('# Readme');
    expect(info.full_name).toBe('o/r');
  });
  it('handles missing readme', async () => {
    const mock = makeMockOctokit({ readme: null });
    const svc = new GitHubService(mock as never);
    const info = await svc.getRepoInfo('o', 'r');
    expect(info.has_readme).toBe(false);
    expect(info.readme_content).toBeNull();
  });
});