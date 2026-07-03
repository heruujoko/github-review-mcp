/**
 * Shared helpers used by all tool handlers.
 *
 * Centralizes:
 *  - the repo-allowlist gate (called before ANY GitHub API request);
 *  - construction of a GitHubService bound to the installation Octokit;
 *  - JSON-to-ToolResult formatting.
 */

import { GitHubService } from '../services/github.js';
import type {
  PRRef,
  ToolResult,
  ToolServices,
} from '../types/index.js';

/** Build a ToolResult error envelope. */
export function errorResult(message: string): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

/** Build a ToolResult success envelope around `data`. */
export function jsonResult(data: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * Enforce the repo allowlist. Returns an error result when the repo is not
 * allowed; returns `null` otherwise so callers can early-return.
 */
export function enforceAllowlist(
  services: ToolServices,
  owner: string,
  repo: string,
): ToolResult | null {
  if (!services.config.isRepoAllowed(owner, repo)) {
    return errorResult(
      `Repository '${owner}/${repo}' is not in the allowlist.`,
    );
  }
  return null;
}

/**
 * Construct a GitHubService bound to the installation Octokit for
 * {owner, repo}. Assumes the caller has already enforced the allowlist.
 */
export async function buildGitHub(
  services: ToolServices,
  owner: string,
  repo: string,
): Promise<GitHubService> {
  const octokit = await services.githubApp.getInstallationOctokit(
    owner,
    repo,
  );

  // Unit tests provide a GitHubService-shaped mock directly instead of an
  // Octokit-shaped `{ rest: ... }` object. Accept either shape so handlers stay
  // easy to test while production still wraps real installation Octokit.
  if (octokit && typeof (octokit as { getPRDetails?: unknown }).getPRDetails === 'function') {
    return octokit as GitHubService;
  }

  return new GitHubService(octokit as never);
}

/**
 * Parse a PR URL, enforce the allowlist for the resolved repo, and build
 * a GitHubService. Returns either a `ToolResult` (on parse/allowlist
 * failure) or `{ pr, github }`.
 */
export async function resolvePR(
  services: ToolServices,
  pr_url: string,
): Promise<ToolResult | { pr: PRRef; github: GitHubService }> {
  let pr: PRRef;
  try {
    pr = new GitHubService({} as never).parsePRURL(pr_url);
  } catch (err) {
    return errorResult((err as Error).message);
  }
  const denied = enforceAllowlist(services, pr.owner, pr.repo);
  if (denied) return denied;
  const github = await buildGitHub(services, pr.owner, pr.repo);
  return { pr, github };
}