/**
 * Detect anti-patterns, best practices violations, and architectural issues in code changes
 */

export const detectCodePatternsToolDefinition = {
  name: 'detect_code_patterns',
  description: 'Detect anti-patterns, best practices violations, and architectural issues in code changes.',
  inputSchema: {
    type: 'object',
    properties: {
      pr_url: {
        type: 'string',
        description: 'GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)',
      },
      language: {
        type: 'string',
        description: 'Programming language to focus pattern detection on (auto-detected if not provided)',
      },
    },
    required: ['pr_url'],
  },
};

export async function handleDetectCodePatterns(github, analysis, args) {
  const { pr_url, language = null } = args;

  if (!pr_url) {
    throw new Error('PR URL is required');
  }

  const prDetails = await github.getPRDetails(pr_url);
  const analysisResult = await analysis.detectCodePatterns(prDetails, language);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            analysis_type: 'pattern_detection',
            pr_url,
            ...analysisResult,
          },
          null,
          2
        ),
      },
    ],
  };
}
