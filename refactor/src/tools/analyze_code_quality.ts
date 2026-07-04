/**
 * Tool: analyze_code_quality
 *
 * Runs data-only heuristic quality analysis over PR patches. No LLM calls.
 */

import { AnalysisService } from '../services/analysis.js';
import type { GitHubService } from '../services/github.js';
import type { ToolResult, ToolServices } from '../types/index.js';
import { registerTool } from './registry.js';
import { errorResult, jsonResult, resolvePR } from './shared.js';

export function registerAnalyzeCodeQuality(): void {
  registerTool({
    definition: {
      name: 'analyze_code_quality',
      description:
        'Analyze code quality metrics for changed files including complexity, maintainability, technical debt, issues, and suggestions.',
      inputSchema: {
        type: 'object',
        properties: {
          pr_url: { type: 'string', description: 'GitHub PR URL.' },
          file_paths: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional subset of changed file paths to analyze.',
          },
        },
        required: ['pr_url'],
      },
    },
    handler: async (args: Record<string, unknown>, services: ToolServices): Promise<ToolResult> => {
      const prUrl = args.pr_url as string | undefined;
      if (!prUrl) return errorResult('pr_url is required for analyze_code_quality.');

      const resolved = await resolvePR(services, prUrl);
      if ('content' in resolved && 'isError' in resolved) return resolved as ToolResult;
      const { github } = resolved as { github: GitHubService };

      try {
        const details = await github.getPRDetails(prUrl);
        const filePaths = Array.isArray(args.file_paths) ? (args.file_paths as string[]) : null;
        return jsonResult(new AnalysisService().analyzeCodeQuality(details, filePaths));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  });
}
