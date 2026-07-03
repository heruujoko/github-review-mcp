/**
 * Tool: get_pr_details
 *
 * Returns comprehensive PR metadata including title, description, files changed,
 * commits, existing reviews, and repository info.
 */

import { registerTool } from './registry.js';
import { errorResult, jsonResult, resolvePR } from './shared.js';
import type { ToolServices, ToolResult } from '../types/index.js';

export function registerGetPRDetails(): void {
  registerTool({
    definition: {
      name: 'get_pr_details',
      description:
        'Get comprehensive PR metadata including title, description, files changed, commits, existing reviews, and repository info.',
      inputSchema: {
        type: 'object',
        properties: {
          pr_url: {
            type: 'string',
            description:
              'GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)',
          },
        },
        required: ['pr_url'],
      },
    },
    handler: async (
      args: Record<string, unknown>,
      services: ToolServices,
    ): Promise<ToolResult> => {
      const prUrl = args.pr_url as string;
      if (!prUrl) {
        return errorResult('pr_url is required for get_pr_details.');
      }

      const resolved = await resolvePR(services, prUrl);
      if ('content' in resolved && 'isError' in resolved) {
        return resolved as ToolResult;
      }

      const { github } = resolved as { github: import('../services/github.js').GitHubService };
      try {
        const details = await github.getPRDetails(prUrl);
        return jsonResult(details);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  });
}
