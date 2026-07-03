/**
 * Tool: analyze_diff_impact
 *
 * Runs data-only heuristic impact/risk analysis over PR changed files.
 */

import { AnalysisService } from '../services/analysis.js';
import type { GitHubService } from '../services/github.js';
import type { ToolResult, ToolServices } from '../types/index.js';
import { registerTool } from './registry.js';
import { errorResult, jsonResult, resolvePR } from './shared.js';

export function registerAnalyzeDiffImpact(): void {
  registerTool({
    definition: {
      name: 'analyze_diff_impact',
      description:
        'Analyze the impact and risk of PR changes, including configuration/security-sensitive areas and deployment recommendations.',
      inputSchema: {
        type: 'object',
        properties: { pr_url: { type: 'string', description: 'GitHub PR URL.' } },
        required: ['pr_url'],
      },
    },
    handler: async (args: Record<string, unknown>, services: ToolServices): Promise<ToolResult> => {
      const prUrl = args.pr_url as string | undefined;
      if (!prUrl) return errorResult('pr_url is required for analyze_diff_impact.');

      const resolved = await resolvePR(services, prUrl);
      if ('content' in resolved && 'isError' in resolved) return resolved as ToolResult;
      const { github } = resolved as { github: GitHubService };

      try {
        const details = await github.getPRDetails(prUrl);
        return jsonResult(new AnalysisService().analyzeDiffImpact(details));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  });
}
