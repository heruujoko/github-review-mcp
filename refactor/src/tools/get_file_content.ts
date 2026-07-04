/**
 * Tool: get_file_content
 *
 * Fetches the decoded text content of a file in a repository at an optional
 * git ref. Requires owner + repo + path (no PR URL) so callers can inspect
 * files outside the PR diff.
 */

import { registerTool } from './registry.js';
import {
  buildGitHub,
  enforceAllowlist,
  errorResult,
  jsonResult,
} from './shared.js';
import type { ToolServices, ToolResult } from '../types/index.js';

export function registerGetFileContent(): void {
  registerTool({
    definition: {
      name: 'get_file_content',
      description:
        'Fetch the decoded text content of a file in a repository at an optional git ref.',
      inputSchema: {
        type: 'object',
        properties: {
          owner: { type: 'string', description: 'Repository owner.' },
          repo: { type: 'string', description: 'Repository name.' },
          path: {
            type: 'string',
            description: 'File path relative to the repository root.',
          },
          ref: {
            type: 'string',
            description:
              'Optional git ref (branch, tag, or commit SHA). Defaults to the repo default branch.',
          },
        },
        required: ['owner', 'repo', 'path'],
      },
    },
    handler: async (
      args: Record<string, unknown>,
      services: ToolServices,
    ): Promise<ToolResult> => {
      const owner = args.owner as string | undefined;
      const repo = args.repo as string | undefined;
      const path = args.path as string | undefined;
      const ref = args.ref as string | undefined;

      if (!owner || !repo || !path) {
        return errorResult(
          'owner, repo, and path are required for get_file_content.',
        );
      }

      const denied = enforceAllowlist(services, owner, repo);
      if (denied) return denied;

      try {
        const github = await buildGitHub(services, owner, repo);
        const content = await github.getFileContent(owner, repo, path, ref);
        return jsonResult({
          owner,
          repo,
          path,
          ref: ref ?? null,
          found: content !== null,
          content,
        });
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  });
}
