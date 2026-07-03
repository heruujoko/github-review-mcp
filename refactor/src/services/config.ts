/**
 * Config service: parses environment variables, validates required ones,
 * and masks secrets in debug output (mirroring the legacy `toObject()` masking).
 */
import type { IConfigService } from '../types/index.js';

/** Names of env vars that must never be logged in full. */
const SECRET_KEYS = new Set(['GITHUB_APP_PRIVATE_KEY', 'MCP_API_SECRET']);

/** Default values for optional numeric knobs. */
const DEFAULTS = {
  PORT: 3000,
  MAX_PATCH_SIZE: 2000,
  MAX_FILES_TO_REVIEW: 50,
  REQUEST_TIMEOUT: 30000,
} as const;

function parseIntOrDefault(raw: string | undefined, def: number): number {
  if (raw === undefined || raw === '') return def;
  const n = Number(raw);
  return Number.isFinite(n) ? n : def;
}

function parseAllowlist(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => s.toLowerCase());
}

/**
 * Parses environment configuration for the MCP review server.
 *
 * Throws on the first missing required variable so callers fail fast.
 */
export class ConfigService implements IConfigService {
  readonly githubAppId: string;
  readonly githubAppPrivateKey: string;
  readonly mcpApiSecret: string;
  readonly port: number;
  readonly maxPatchSize: number;
  readonly maxFilesToReview: number;
  readonly requestTimeout: number;
  /** Lowercased `owner/repo` entries; empty = allow all installed repos. */
  private readonly allowlist: string[];

  constructor() {
    const gitHubAppId = process.env.GITHUB_APP_ID;
    const gitHubAppPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY;
    const mcpApiSecret = process.env.MCP_API_SECRET;

    const missing: string[] = [];
    if (!gitHubAppId) missing.push('GITHUB_APP_ID');
    if (!gitHubAppPrivateKey) missing.push('GITHUB_APP_PRIVATE_KEY');
    if (!mcpApiSecret) missing.push('MCP_API_SECRET');
    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }

    this.githubAppId = gitHubAppId as string;
    this.githubAppPrivateKey = gitHubAppPrivateKey as string;
    this.mcpApiSecret = mcpApiSecret as string;
    this.port = parseIntOrDefault(process.env.PORT, DEFAULTS.PORT);
    this.maxPatchSize = parseIntOrDefault(
      process.env.MAX_PATCH_SIZE,
      DEFAULTS.MAX_PATCH_SIZE,
    );
    this.maxFilesToReview = parseIntOrDefault(
      process.env.MAX_FILES_TO_REVIEW,
      DEFAULTS.MAX_FILES_TO_REVIEW,
    );
    this.requestTimeout = parseIntOrDefault(
      process.env.REQUEST_TIMEOUT,
      DEFAULTS.REQUEST_TIMEOUT,
    );
    this.allowlist = parseAllowlist(process.env.REPO_ALLOWLIST);
  }

  /**
   * Returns true when the repo is permitted.
   *
   * An empty allowlist permits all repos where the App is installed; this is
   * enforced elsewhere. With a non-empty allowlist only listed `owner/repo`
   * pairs (case-insensitive) pass.
   */
  isRepoAllowed(owner: string, repo: string): boolean {
    if (this.allowlist.length === 0) return true;
    return this.allowlist.includes(`${owner}/${repo}`.toLowerCase());
  }

  /** Safe-to-log config snapshot with secrets masked. */
  toDebugObject(): Record<string, string | number | boolean | undefined> {
    const dump: Record<string, string | number | boolean | undefined> = {
      GITHUB_APP_ID: this.githubAppId,
      GITHUB_APP_PRIVATE_KEY:
        this.githubAppPrivateKey ? '[SET]' : '[NOT SET]',
      MCP_API_SECRET: this.mcpApiSecret ? '[SET]' : '[NOT SET]',
      REPO_ALLOWLIST:
        this.allowlist.length > 0 ? this.allowlist.join(', ') : '(all)',
      PORT: this.port,
      MAX_PATCH_SIZE: this.maxPatchSize,
      MAX_FILES_TO_REVIEW: this.maxFilesToReview,
      REQUEST_TIMEOUT: this.requestTimeout,
    };
    // Belt and braces: scrub any secret value that slipped in.
    for (const key of Object.keys(dump)) {
      if (SECRET_KEYS.has(key) && typeof dump[key] === 'string') {
        dump[key] = '[SET]';
      }
    }
    return dump;
  }
}