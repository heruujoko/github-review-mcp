/**
 * GitHub App authentication: mints and caches short-lived installation tokens
 * for `{ owner, repo }`, returning an Octokit-ready token / Octokit instance.
 *
 * Auth uses `@octokit/auth-app`. The App-authorized Octokit (created via
 * `createAppAuth`) is injected so the module is trivially testable with a
 * mock. See `createAppOctokit` for production construction.
 */
import { Octokit } from '@octokit/rest';
import { createAppAuth } from '@octokit/auth-app';
import type { IGitHubAppAuth } from '../types/index.js';

/** Hour before expiry at which we proactively refresh. */
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/** Minimal App-authorized Octokit surface used internally. */
interface AppOctokitLike {
  auth(opts: { type: 'installation'; installationId: number }): Promise<{
    token: string;
    expiresAt: string;
    installationId: number;
  }>;
  rest: {
    apps: {
      getRepoInstallation(params: { owner: string; repo: string }): Promise<{
        data: { id: number };
      }>;
    };
  };
}

interface CachedToken {
  token: string;
  expiresAt: string;
  installationId: number;
}

export interface GitHubAppAuthCtor {
  appId: string;
  privateKey: string;
  /** Inject for tests; otherwise built via `createAppAuth`. */
  appOctokit?: AppOctokitLike;
}

/**
 * Mints installation-scoped tokens and Octokit instances for repositories.
 *
 * Tokens are cached per installation id and refreshed before expiry. The
 * `owner/repo → installationId` lookup is cached per process.
 */
export class GitHubAppAuth implements IGitHubAppAuth {
  private readonly appOctokit: AppOctokitLike;
  private readonly installationByRepo = new Map<string, number>();
  private readonly tokenByInstallation = new Map<number, CachedToken>();

  constructor(deps: GitHubAppAuthCtor) {
    this.appOctokit =
      deps.appOctokit ??
      (createAppOctokit(deps.appId, deps.privateKey) as unknown as AppOctokitLike);
  }

  /**
   * Resolves an installation-scoped token for `{ owner, repo }`, minting or
   * refreshing from cache as needed.
   */
  async getInstallationToken(
    owner: string,
    repo: string,
  ): Promise<CachedToken> {
    const installationId = await this.resolveInstallationId(owner, repo);
    return this.getOrRefreshToken(installationId);
  }

  /** Injects tokens into Octokit instances authenticated as the installation. */
  async getInstallationOctokit(owner: string, repo: string): Promise<Octokit> {
    const { token } = await this.getInstallationToken(owner, repo);
    return new Octokit({ auth: token });
  }

  /** Clears installation-id and token caches (test helper). */
  clearCache(): void {
    this.installationByRepo.clear();
    this.tokenByInstallation.clear();
  }

  private async resolveInstallationId(
    owner: string,
    repo: string,
  ): Promise<number> {
    const key = `${owner}/${repo}`.toLowerCase();
    const cached = this.installationByRepo.get(key);
    if (cached !== undefined) return cached;

    let data: { id: number };
    try {
      ({ data } = await this.appOctokit.rest.apps.getRepoInstallation({
        owner,
        repo,
      }));
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      throw new Error(
        `GitHub installation not found for ${owner}/${repo}` +
          (status ? ` (HTTP ${status})` : '') +
          '. Confirm the GitHub App is installed on this repository.',
      );
    }
    this.installationByRepo.set(key, data.id);
    return data.id;
  }

  private async getOrRefreshToken(
    installationId: number,
  ): Promise<CachedToken> {
    const cached = this.tokenByInstallation.get(installationId);
    if (cached && this.isFresh(cached)) {
      return cached;
    }
    const { token, expiresAt } = await this.appOctokit.auth({
      type: 'installation',
      installationId,
    });
    const value: CachedToken = { token, expiresAt, installationId };
    this.tokenByInstallation.set(installationId, value);
    return value;
  }

  private isFresh(cached: CachedToken): boolean {
    const expiryMs = Date.parse(cached.expiresAt);
    if (!Number.isFinite(expiryMs)) return false;
    return Date.now() < expiryMs - REFRESH_BUFFER_MS;
  }
}

/**
 * Constructs the App-authorized Octokit used by production code. Exposed for
 * test runners that want to mirror the real `createAppAuth` wiring.
 */
export function createAppOctokit(appId: string, privateKey: string): Octokit {
  return new Octokit({
    authStrategy: createAppAuth,
    auth: { appId, privateKey },
  });
}