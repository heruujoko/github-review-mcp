/**
 * Tool: detect_code_patterns
 *
 * Runs data-only regex-based pattern/anti-pattern detection over PR patches.
 */

import { AnalysisService } from '../services/analysis.js';
import type { GitHubService } from '../services/github.js';
import type { ToolResult, ToolServices } from '../types/index.js';
import { registerTool } from './registry.js';
import { errorResult, jsonResult, resolvePR } from './shared.js';

export function registerDetectCodePatterns(): void {
  registerTool({
    definition: {
      name: 'detect_code_patterns',
      description:
        'Detect good patterns and anti-patterns in PR patches using data-only regex heuristics.',
      inputSchema: {
        type: 'object',
        properties: {
          pr_url: { type: 'string', description: 'GitHub PR URL.' },
          language: {
            type: 'string',
            description: 'Optional language override used in the result metadata.',
          },
        },
        required: ['pr_url'],
      },
    },
    handler: async (args: Record<string, unknown>, services: ToolServices): Promise<ToolResult> => {
      const prUrl = args.pr_url as string | undefined;
      if (!prUrl) return errorResult('pr_url is required for detect_code_patterns.');
      const language = (args.language as string | undefined) ?? null;

      const resolved = await resolvePR(services, prUrl);
      if ('content' in resolved && 'isError' in resolved) return resolved as ToolResult;
      const { github } = resolved as { github: GitHubService };

      try {
        const details = await github.getPRDetails(prUrl);
        return jsonResult(new AnalysisService().detectCodePatterns(details, language));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  });
}
