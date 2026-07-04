import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  registerAllTools,
  getTool,
  resetRegistry,
} from './index.js';
import type { ToolServices } from '../types/index.js';

/** Mock GitHubService-like object exposing the methods handlers touch. */
function makeGithubMock(overrides: Partial<{
  getPRDetails: ReturnType<typeof vi.fn>;
  getPRFiles: ReturnType<typeof vi.fn>;
  getPRCommits: ReturnType<typeof vi.fn>;
  getFileContent: ReturnType<typeof vi.fn>;
  getDiffRange: ReturnType<typeof vi.fn>;
  createReview: ReturnType<typeof vi.fn>;
  getRepoInfo: ReturnType<typeof vi.fn>;
  parsePRURL: ReturnType<typeof vi.fn>;
}> = {}) {
  return {
    getPRDetails: overrides.getPRDetails ?? vi.fn(async () => ({ pr: {}, files: [], commits: [], existing_reviews: [], repository: {} })),
    getPRFiles: overrides.getPRFiles ?? vi.fn(async () => []),
    getPRCommits: overrides.getPRCommits ?? vi.fn(async () => []),
    getFileContent: overrides.getFileContent ?? vi.fn(async () => null),
    getDiffRange: overrides.getDiffRange ?? vi.fn(async () => ({ base_sha: 'b', head_sha: 'h', total_commits: 1, total_files: 1, files: [] })),
    createReview: overrides.createReview ?? vi.fn(async () => ({ success: true, review_id: 7, review_url: 'u' })),
    getRepoInfo: overrides.getRepoInfo ?? vi.fn(async () => ({ owner: 'o', repo: 'r', full_name: 'o/r', languages: {}, primary_language: 'None', has_readme: false, readme_content: null })),
    parsePRURL: overrides.parsePRURL ?? vi.fn((u: string) => {
      const m = /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/.exec(u);
      return { owner: m[1], repo: m[2], pull_number: parseInt(m[3], 10) };
    }),
  };
}

const PR_URL = 'https://github.com/octo/repo/pull/42';

function makeServices(githubMock: ReturnType<typeof makeGithubMock>, allowAll = true): ToolServices {
  return {
    config: {
      isRepoAllowed: vi.fn(() => allowAll),
    } as never,
    githubApp: {
      getInstallationOctokit: vi.fn(async () => ({})),
    } as never,
    strategy: {} as never,
    __githubMock: githubMock,
  } as never as ToolServices;
}

// Build services where installation Octokit resolves to `githubMock`.
// We patch `buildGitHub` usage by having github-app return the mock
// directly (handlers wrap octokit via new GitHubService(octokit); pass a mock
// that *is* GitHubService-shaped).
function makeServicesWithMock(githubMock: ReturnType<typeof makeGithubMock>, allowAll = true) {
  const services: ToolServices = {
    config: {
      isRepoAllowed: vi.fn(() => allowAll),
      githubAppId: 'a', githubAppPrivateKey: 'p', mcpApiSecret: 's',
      port: 3000, maxPatchSize: 1000, maxFilesToReview: 100, requestTimeout: 60,
      toDebugObject: () => ({}),
    } as never,
    githubApp: {
      getInstallationOctokit: vi.fn(async () => githubMock),
    } as never,
    strategy: {} as never,
  } as never as ToolServices;
  return services;
}

describe('tool handlers (core delegation)', () => {
  beforeEach(() => {
    resetRegistry();
    registerAllTools();
  });

  it('registers at least 8 core tools', () => {
    const names = ['get_pr_details', 'get_pr_files', 'get_pr_commits', 'get_file_content', 'post_pr_review', 'get_repo_info', 'get_pr_diff_range', 'get_review_strategy'];
    for (const n of names) {
      expect(getTool(n), `expect ${n} registered`).toBeDefined();
    }
  });

  it('get_pr_details enforces allowlist before GitHub call', async () => {
    const mock = makeGithubMock();
    const services = makeServicesWithMock(mock, false);
    const entry = getTool('get_pr_details')!;
    const result = await entry.handler({ pr_url: PR_URL }, services);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/allowlist/i);
    expect(mock.getPRDetails).not.toHaveBeenCalled();
  });

  it('get_pr_details returns JSON payload', async () => {
    const mock = makeGithubMock({
      getPRDetails: vi.fn(async () => ({ pr: { number: 42 }, files: [{filename:'a'}], commits: [], existing_reviews: [], repository: {full_name:'octo/repo'} })),
    });
    const services = makeServicesWithMock(mock);
    const entry = getTool('get_pr_details')!;
    const result = await entry.handler({ pr_url: PR_URL }, services);
    expect(result.isError).toBeUndefined();
    expect(result.content[0].text).toContain('"number": 42');
  });

  it('get_pr_diff_range returns the diff range', async () => {
    const mock = makeGithubMock({
      getDiffRange: vi.fn(async () => ({ base_sha: 'b1', head_sha: 'h1', total_commits: 2, total_files: 3, files: [{filename:'x.js'}] })),
    });
    const services = makeServicesWithMock(mock);
    const entry = getTool('get_pr_diff_range')!;
    const result = await entry.handler({ owner: 'octo', repo: 'repo', base_sha: 'b1', head_sha: 'h1' }, services);
    expect(mock.getDiffRange).toHaveBeenCalledWith('octo', 'repo', 'b1', 'h1');
    expect(result.content[0].text).toContain('"total_commits": 2');
  });

  it('post_pr_review maps inline comments to createReview comments', async () => {
    const mock = makeGithubMock({
      createReview: vi.fn(async () => ({ success: true, review_id: 999, review_url: 'https://gh/r' })),
    });
    const services = makeServicesWithMock(mock);
    const entry = getTool('post_pr_review')!;
    const result = await entry.handler({
      pr_url: PR_URL,
      body: 'LGTM',
      event: 'APPROVE',
      comments: [
        { path: 'a.js', line: 12, body: 'good', side: 'RIGHT', start_line: 8 },
      ],
    }, services);
    expect(result.content[0].text).toContain('"review_id": 999');
    expect(mock.createReview).toHaveBeenCalledWith('octo', 'repo', 42, {
      body: 'LGTM',
      event: 'APPROVE',
      comments: [{ path: 'a.js', line: 12, body: 'good', side: 'RIGHT', start_line: 8 }],
    });
  });

  it('get_file_content rejects missing args', async () => {
    const mock = makeGithubMock();
    const services = makeServicesWithMock(mock);
    const entry = getTool('get_file_content')!;
    const result = await entry.handler({ path: 'a' }, services);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/owner|repo|required/i);
  });

  it('get_review_strategy resolves strategies and emits notice', async () => {
    const strategy = {
      resolveForRepo: vi.fn(async () => ({ strategies: [{name:'security', description:'d', body:'b'}], notice: 'n' })),
    };
    const services = makeServicesWithMock(makeGithubMock());
    services.strategy = strategy as never;
    const entry = getTool('get_review_strategy')!;
    const result = await entry.handler({ pr_url: PR_URL, strategy: 'security' }, services);
    expect(result.content[0].text).toContain('"name": "security"');
    expect(result.content[0].text).toContain('"notice": "n"');
    expect(strategy.resolveForRepo).toHaveBeenCalled();
  });
});