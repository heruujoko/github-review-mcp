/**
 * Tool: get_pr_files
 *
 * Returns the list of files changed in a pull request, optionally including
 * the unified diff patch for each file.
 */

import { registerTool } from './registry.js';
import { errorResult, jsonResult, resolvePR } from './shared.js';
import type { GitHubService } from '../services/github.js';
import type { ToolServices, ToolResult } from '../types/index.js';

export function registerGetPRFiles(): void {
  registerTool({
    definition: {
      name: 'get_pr_files',
      description:
        'Get the list of files changed in a pull request, optionally including the unified diff patch for each file.',
      inputSchema: {
        type: 'object',
        properties: {
          pr_url: {
            type: 'string',
            description:
              'GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)',
          },
          include_patch: {
            type: 'boolean',
            description:
              'Whether to include the unified diff patch for each file (default: true).',
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
      if (!prUrl) return errorResult('pr_url is required for get_pr_files.');
      const includePatch =
        args.include_patch === undefined ? true : Boolean(args.include_patch);

      const resolved = await resolvePR(services, prUrl);
      if ('content' in resolved && 'isError' in resolved) return resolved;
      const { github } = resolved as { github: GitHubService };

      try {
        const files = await github.getPRFiles(prUrl, includePatch);
        return jsonResult({ pr_url: prUrl, total_files: files.length, files });
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  });
}
