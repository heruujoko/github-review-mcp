/**
 * Tool: get_repo_info
 *
 * Returns repository metadata: language breakdown, primary language, and
 * README content (decoded).
 */

import { registerTool } from './registry.js';
import {
  buildGitHub,
  enforceAllowlist,
  errorResult,
  jsonResult,
} from './shared.js';
import type { ToolServices, ToolResult } from '../types/index.js';

export function registerGetRepoInfo(): void {
  registerTool({
    definition: {
      name: 'get_repo_info',
      description:
        'Get repository metadata: language breakdown, primary language, and README content.',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner.' },
          repo: { type: 'string', description: 'Repository name.' },
        },
        required: ['owner', 'repo'],
      },
    },
    handler: async (
      args: Record<string, unknown>,
      services: ToolServices,
    ): Promise<ToolResult> => {
      const owner = args.owner as string | undefined;
      const repo = args.repo as string | undefined;

      if (!owner || !repo) {
        return errorResult('owner and repo are required for get_repo_info.');
      }

      const denied = enforceAllowlist(services, owner, repo);
      if (denied) return denied;

      try {
        const github = await buildGitHub(services, owner, repo);
        const info = await github.getRepoInfo(owner, repo);
        return jsonResult(info);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  });
}
