/**
 * Tool: analyze_test_coverage
 *
 * Runs data-only heuristic test coverage analysis over PR changed files.
 */

import { AnalysisService } from '../services/analysis.js';
import type { GitHubService } from '../services/github.js';
import type { ToolResult, ToolServices } from '../types/index.js';
import { registerTool } from './registry.js';
import { errorResult, jsonResult, resolvePR } from './shared.js';

export function registerAnalyzeTestCoverage(): void {
  registerTool({
    definition: {
      name: 'analyze_test_coverage',
      description:
        'Estimate test coverage for PR changes by comparing changed test files to changed production files.',
      inputSchema: {
        type: 'object',
        properties: { pr_url: { type: 'string', description: 'GitHub PR URL.' } },
        required: ['pr_url'],
      },
    },
    handler: async (args: Record<string, unknown>, services: ToolServices): Promise<ToolResult> => {
      const prUrl = args.pr_url as string | undefined;
      if (!prUrl) return errorResult('pr_url is required for analyze_test_coverage.');

      const resolved = await resolvePR(services, prUrl);
      if ('content' in resolved && 'isError' in resolved) return resolved as ToolResult;
      const { github } = resolved as { github: GitHubService };

      try {
        const details = await github.getPRDetails(prUrl);
        return jsonResult(new AnalysisService().analyzeTestCoverage(details));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  });
}
