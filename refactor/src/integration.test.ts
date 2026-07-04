/**
 * End-to-end integration test for the MCP server.
 *
 * Boots the Express app (with mocked services) on a random port and makes
 * raw HTTP POST requests to /mcp, parsing the SSE response. This avoids
 * depending on the SDK's StreamableHTTPClientTransport internals.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import http from 'node:http';
import { createApp } from '../src/app.js';
import { ConfigService } from '../src/services/config.js';
import { GitHubAppAuth } from '../src/auth/github-app.js';
import { StrategyService } from '../src/services/strategy.js';

// ---- Mock services ----

const MOCK_API_SECRET = 'test-secret-123';

function makeMockConfig(): ConfigService {
  return new ConfigService();
}

function makeMockGitHubApp(): GitHubAppAuth {
  return {
    getInstallationOctokit: vi.fn(async () => ({
      rest: {
        pulls: { get: vi.fn(), listFiles: vi.fn(), listCommits: vi.fn(), listReviews: vi.fn(), createReview: vi.fn() },
        repos: { get: vi.fn(), getContent: vi.fn(), listLanguages: vi.fn(), getReadme: vi.fn() },
        compareCommits: vi.fn(),
      },
    })),
    clearCache: vi.fn(),
  } as unknown as GitHubAppAuth;
}

function makeMockStrategy(): StrategyService {
  return {
    getCatalog: vi.fn(() => new Map()),
    resolveForRepo: vi.fn(async (_octokit: any, _owner: string, _repo: string, _requested?: string) => ({
      strategies: [{ name: 'full-review', description: 'Full review', body: 'Review everything.' }],
      notice: 'Using default strategy (full-review).',
    })),
  } as unknown as StrategyService;
}

/** Send a JSON-RPC request to /mcp and return the parsed SSE body. */
async function mcpRequest(
  port: number,
  method: string,
  params: Record<string, unknown> = {},
  apiKey = MOCK_API_SECRET,
): Promise<{ status: number; body: string }> {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method, params });
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port,
      path: '/mcp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        Accept: 'application/json, text/event-stream',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/** Extract the JSON payload from an SSE `event: message` line. */
function parseSseResult(sseBody: string): unknown {
  for (const line of sseBody.split('\n')) {
    if (line.startsWith('data: ')) {
      try {
        const parsed = JSON.parse(line.slice(6));
        return (parsed as any).result;
      } catch {
        // continue
      }
    }
  }
  return null;
}

// ---- Test ----

describe('MCP server integration', () => {
  let app: ReturnType<typeof createApp>;
  let server: http.Server;
  let port: number;

  beforeAll(async () => {
    app = createApp({
      config: makeMockConfig(),
      githubApp: makeMockGitHubApp(),
      strategy: makeMockStrategy(),
      mcpApiSecret: MOCK_API_SECRET,
    });

    await new Promise<void>((resolve) => {
      server = app.app.listen(0, () => {
        port = (server.address() as any).port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('discovers all 14 tools via listTools', async () => {
    const { status, body } = await mcpRequest(port, 'tools/list');
    expect(status).toBe(200);
    const result = parseSseResult(body) as any;
    expect(result).not.toBeNull();
    expect(result.tools).toHaveLength(14);
    const names = result.tools.map((t: any) => t.name);
    expect(names).toContain('get_review_strategy');
    expect(names).toContain('get_pr_details');
    expect(names).toContain('get_pr_files');
    expect(names).toContain('get_pr_commits');
    expect(names).toContain('get_file_content');
    expect(names).toContain('get_repo_info');
    expect(names).toContain('get_pr_diff_range');
    expect(names).toContain('post_pr_review');
    expect(names).toContain('analyze_code_quality');
    expect(names).toContain('analyze_diff_impact');
    expect(names).toContain('analyze_dependencies');
    expect(names).toContain('analyze_test_coverage');
    expect(names).toContain('detect_security_issues');
    expect(names).toContain('detect_code_patterns');
  });

  it('get_review_strategy returns strategy prompt', async () => {
    const { status, body } = await mcpRequest(port, 'tools/call', {
      name: 'get_review_strategy',
      arguments: { owner: 'octo', repo: 'repo' },
    });
    console.log('get_review_strategy status:', status, 'body:', body.substring(0, 500));
    expect(status).toBe(200);
    const result = parseSseResult(body) as any;
    expect(result).not.toBeNull();
    const text = result.content[0].text;
    expect(text).toContain('full-review');
    expect(text).toContain('Using default strategy');
  });

  it('get_pr_details enforces allowlist', async () => {
    const denyConfig = makeMockConfig();
    vi.spyOn(denyConfig, 'isRepoAllowed').mockReturnValue(false);

    const denyApp = createApp({
      config: denyConfig,
      githubApp: makeMockGitHubApp(),
      strategy: makeMockStrategy(),
      mcpApiSecret: MOCK_API_SECRET,
    });

    const denyServer = await new Promise<any>((resolve) => {
      const s = denyApp.app.listen(0, () => resolve(s));
    });
    const denyPort = (denyServer.address() as any).port;

    const { status, body } = await mcpRequest(denyPort, 'tools/call', {
      name: 'get_pr_details',
      arguments: { pr_url: 'https://github.com/octo/repo/pull/42' },
    });
    expect(status).toBe(200);
    const result = parseSseResult(body) as any;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/allowlist/i);

    await new Promise<void>((resolve) => denyServer.close(() => resolve()));
  });

  it('returns error for unknown tool', async () => {
    const { status, body } = await mcpRequest(port, 'tools/call', {
      name: 'nonexistent_tool',
      arguments: {},
    });
    console.log('unknown tool status:', status, 'body:', body.substring(0, 500));
    expect(status).toBe(200);
    const result = parseSseResult(body) as any;
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Unknown tool');
  });

  it('rejects requests without auth header', async () => {
    const { status } = await mcpRequest(port, 'tools/list', {}, 'wrong-key');
    expect(status).toBe(401);
  });
});
