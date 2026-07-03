import { describe, it, expect, vi } from 'vitest';
import { GitHubAppAuth } from './github-app.js';

/**
 * Builds a mock App-authorized Octokit-like object whose `auth()` returns
 * installation tokens and whose `rest.apps.getRepoInstallation` returns an
 * installation id.
 */
function makeMockAppOctokit(installationId: number) {
  let callCount = 0;
  const callsByInstall: Record<number, number> = {};
  // Track the most recently minted token per installation so caching tests
  // can assert idempotency while expiry tests see a fresh token on remint.
  const lastMintByInstall: Record<number, { token: string; expiresAt: string }> = {};
  const mintFresh = (id: number) => {
    callCount += 1;
    callsByInstall[id] = (callsByInstall[id] ?? 0) + 1;
    const mint = {
      token: `ghs_inst_${id}_v${callsByInstall[id]}`,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
    lastMintByInstall[id] = mint;
    return mint;
  };
  const auth = vi.fn(async (opts: { type: string; installationId?: number }) => {
    if (opts.type !== 'installation' || opts.installationId === undefined) {
      throw new Error(`unexpected auth type: ${opts.type}`);
    }
    const id = opts.installationId;
    const mint = mintFresh(id);
    return { token: mint.token, expiresAt: mint.expiresAt, installationId: id };
  });

  const api = {
    auth,
    rest: {
      apps: {
        getRepoInstallation: vi.fn(async ({ owner, repo }: { owner: string; repo: string }) => ({
          data: { id: installationId, ...(owner ? {} : {}) },
        })),
      },
    },
    getTokenCalls: (id: number) => callsByInstall[id] ?? 0,
  };
  return api;
}

describe('GitHubAppAuth', () => {
  it('mints an installation token and returns an Octokit-ready token', async () => {
    const mock = makeMockAppOctokit(4242);
    const auth = new GitHubAppAuth({
      appId: '111',
      privateKey: 'pk',
      appOctokit: mock as unknown as never,
    });
    const result = await auth.getInstallationToken('octocat', 'Hello-World');
    expect(result.installationId).toBe(4242);
    expect(result.token).toMatch(/^ghs_inst_4242/);
    expect(mock.rest.apps.getRepoInstallation).toHaveBeenCalledWith({
      owner: 'octocat',
      repo: 'Hello-World',
    });
  });

  it('caches the installation id by owner/repo', async () => {
    const mock = makeMockAppOctokit(7);
    const auth = new GitHubAppAuth({
      appId: '1',
      privateKey: 'k',
      appOctokit: mock as unknown as never,
    });
    await auth.getInstallationToken('a', 'b');
    await auth.getInstallationToken('a', 'b');
    expect(mock.rest.apps.getRepoInstallation).toHaveBeenCalledTimes(1);
  });

  it('caches the token within its TTL', async () => {
    const mock = makeMockAppOctokit(9);
    const auth = new GitHubAppAuth({
      appId: '1',
      privateKey: 'k',
      appOctokit: mock as unknown as never,
    });
    await auth.getInstallationToken('a', 'b');
    await auth.getInstallationToken('a', 'b');
    // internal auth() should have minted only once while in TTL
    expect(mock.auth).toHaveBeenCalledTimes(1);
  });

  it('refreshes the token after expiry', async () => {
    const mock = makeMockAppOctokit(13);
    const auth = new GitHubAppAuth({
      appId: '1',
      privateKey: 'k',
      appOctokit: mock as unknown as never,
    });
    const first = await auth.getInstallationToken('a', 'b');
    expect(first.token).toBe('ghs_inst_13_v1');
    // Advance time past expiry
    const originalNow = Date.now;
    Date.now = () => new Date(first.expiresAt).getTime() + 10 * 60 * 1000;
    try {
      const second = await auth.getInstallationToken('a', 'b');
      expect(second.token).not.toBe(first.token);
    } finally {
      Date.now = originalNow;
    }
  });

  it('surfaces a clear error when the installation is not found', async () => {
    const mock = {
      auth: vi.fn(async () => ({ token: 'x', expiresAt: 'x' })),
      rest: {
        apps: {
          getRepoInstallation: vi.fn(async () => {
            const err = new Error('Could not resolve installation');
            (err as Error & { status: number }).status = 404;
            throw err;
          }),
        },
      },
    };
    const auth = new GitHubAppAuth({
      appId: '1',
      privateKey: 'k',
      appOctokit: mock as unknown as never,
    });
    await expect(auth.getInstallationToken('nope', 'nada')).rejects.toThrow(
      /installation/i,
    );
  });

  it('clearCache resets cached tokens', async () => {
    const mock = makeMockAppOctokit(21);
    const auth = new GitHubAppAuth({
      appId: '1',
      privateKey: 'k',
      appOctokit: mock as unknown as never,
    });
    await auth.getInstallationToken('a', 'b');
    auth.clearCache();
    await auth.getInstallationToken('a', 'b');
    expect(mock.auth).toHaveBeenCalledTimes(2);
  });
});