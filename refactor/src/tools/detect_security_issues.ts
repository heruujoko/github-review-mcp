/**
 * Tool: detect_security_issues
 *
 * Runs data-only regex-based security scanning over added PR patch lines.
 */

import { AnalysisService } from '../services/analysis.js';
import type { GitHubService } from '../services/github.js';
import type { ToolResult, ToolServices } from '../types/index.js';
import { registerTool } from './registry.js';
import { errorResult, jsonResult, resolvePR } from './shared.js';

export function registerDetectSecurityIssues(): void {
  registerTool({
    definition: {
      name: 'detect_security_issues',
      description:
        'Detect potential security issues in PR patches using data-only regex heuristics (secrets, SQL injection, XSS, eval, insecure randomness).',
      inputSchema: {
        type: 'object',
        properties: { pr_url: { type: 'string', description: 'GitHub PR URL.' } },
        required: ['pr_url'],
      },
    },
    handler: async (args: Record<string, unknown>, services: ToolServices): Promise<ToolResult> => {
      const prUrl = args.pr_url as string | undefined;
      if (!prUrl) return errorResult('pr_url is required for detect_security_issues.');

      const resolved = await resolvePR(services, prUrl);
      if ('content' in resolved && 'isError' in resolved) return resolved as ToolResult;
      const { github } = resolved as { github: GitHubService };

      try {
        const details = await github.getPRDetails(prUrl);
        return jsonResult(new AnalysisService().detectSecurityIssues(details));
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  });
}
