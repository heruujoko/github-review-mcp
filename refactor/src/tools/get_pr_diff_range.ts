/**
 * Tool: get_pr_diff_range
 *
 * Compares two commit SHAs in a repository and returns the aggregate diff
 * (total commits, total files, per-file patches). Useful for reviewing only
 * the commits pushed since a previous review (incremental review).
 */

import { registerTool } from './registry.js';
import {
  buildGitHub,
  enforceAllowlist,
  errorResult,
  jsonResult,
} from './shared.js';
import type { ToolServices, ToolResult } from '../types/index.js';

export function registerGetPRDiffRange(): void {
  registerTool({
    definition: {
      name: 'get_pr_diff_range',
      description:
        'Compare two commit SHAs in a repository and return the aggregate diff (total commits, total files, per-file patches).',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner.' },
          repo: { type: 'string', description: 'Repository name.' },
          base_sha: {
            type: 'string',
            description: 'Base commit SHA the comparison starts from.',
          },
          head_sha: {
            type: 'string',
            description: 'Head commit SHA the comparison ends at.',
          },
        },
        required: ['owner', 'repo', 'base_sha', 'head_sha'],
      },
    },
    handler: async (
      args: Record<string, unknown>,
      services: ToolServices,
    ): Promise<ToolResult> => {
      const owner = args.owner as string | undefined;
      const repo = args.repo as string | undefined;
      const baseSha = args.base_sha as string | undefined;
      const headSha = args.head_sha as string | undefined;

      if (!owner || !repo || !baseSha || !headSha) {
        return errorResult(
          'owner, repo, base_sha, and head_sha are required for get_pr_diff_range.',
        );
      }

      const denied = enforceAllowlist(services, owner, repo);
      if (denied) return denied;

      try {
        const github = await buildGitHub(services, owner, repo);
        const range = await github.getDiffRange(owner, repo, baseSha, headSha);
        return jsonResult(range);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  });
}
