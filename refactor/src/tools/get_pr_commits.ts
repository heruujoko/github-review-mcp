/**
 * Tool: get_pr_commits
 *
 * Returns the list of commits in a pull request (sha, message, author, date).
 */

import { registerTool } from './registry.js';
import { errorResult, jsonResult, resolvePR } from './shared.js';
import type { GitHubService } from '../services/github.js';
import type { ToolServices, ToolResult } from '../types/index.js';

export function registerGetPRCommits(): void {
  registerTool({
    definition: {
      name: 'get_pr_commits',
      description:
        'Get the list of commits in a pull request (sha, message, author, date).',
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
      const prUrl = args.pr_url as string | undefined;
      if (!prUrl) return errorResult('pr_url is required for get_pr_commits.');

      const resolved = await resolvePR(services, prUrl);
      if ('content' in resolved && 'isError' in resolved) return resolved;
      const { github } = resolved as { github: GitHubService };

      try {
        const commits = await github.getPRCommits(prUrl);
        return jsonResult({ pr_url: prUrl, total_commits: commits.length, commits });
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  });
}
