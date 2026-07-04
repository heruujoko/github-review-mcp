/**
 * Tool: get_review_strategy
 *
 * Resolves review strategy prompt(s) for a repository by reading the repo's
 * `.github/review-config.yaml` and intersecting with the local strategy
 * catalog. Returns the matched strategy prompt(s) for the n8n agent to use.
 */

import { registerTool } from './registry.js';
import { errorResult, jsonResult, enforceAllowlist } from './shared.js';
import { GitHubService } from '../services/github.js';
import type { ToolServices, ToolResult } from '../types/index.js';

export function registerGetReviewStrategy(): void {
  registerTool({
    definition: {
      name: 'get_review_strategy',
      description:
        'Resolve review strategy prompt(s) for a repository. Reads .github/review-config.yaml and intersects with the local strategy catalog. Returns the matched strategy prompt(s) for the n8n agent to use.',
      inputSchema: {
        type: 'object',
        properties: {
          pr_url: {
            type: 'string',
            description:
              'GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)',
          },
          owner: {
            type: 'string',
            description: 'Repository owner (alternative to pr_url)',
          },
          repo: {
            type: 'string',
            description: 'Repository name (alternative to pr_url)',
          },
          strategy: {
            type: 'string',
            description:
              'Optional specific strategy name to request. If omitted, returns all strategies allowed by the repo config.',
          },
        },
        required: [],
      },
    },
    handler: async (
      args: Record<string, unknown>,
      services: ToolServices,
    ): Promise<ToolResult> => {
      const prUrl = args.pr_url as string | undefined;
      const owner = args.owner as string | undefined;
      const repo = args.repo as string | undefined;
      const requested = args.strategy as string | undefined;

      let resolvedOwner: string;
      let resolvedRepo: string;

      if (prUrl) {
        try {
          const gh = new GitHubService({} as never);
          const pr = gh.parsePRURL(prUrl);
          resolvedOwner = pr.owner;
          resolvedRepo = pr.repo;
        } catch (err) {
          return errorResult((err as Error).message);
        }
      } else if (owner && repo) {
        resolvedOwner = owner;
        resolvedRepo = repo;
      } else {
        return errorResult(
          'Either pr_url or owner+repo is required for get_review_strategy.',
        );
      }

      const denied = enforceAllowlist(services, resolvedOwner, resolvedRepo);
      if (denied) return denied;

      const octokit = await services.githubApp.getInstallationOctokit(
        resolvedOwner,
        resolvedRepo,
      );

      try {
        const resolved = await services.strategy.resolveForRepo(
          octokit,
          resolvedOwner,
          resolvedRepo,
          requested,
        );
        return jsonResult(resolved);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  });
}
