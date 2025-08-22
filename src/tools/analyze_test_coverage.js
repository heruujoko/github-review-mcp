/**
 * Analyze test coverage for changed code and suggest testing improvements
 */

export const analyzeTestCoverageToolDefinition = {
  name: 'analyze_test_coverage',
  description: 'Analyze test coverage for changed code and suggest testing improvements.',
  inputSchema: {
    type: 'object',
    properties: {
      pr_url: {
        type: 'string',
        description: 'GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)',
      },
    },
    required: ['pr_url'],
  },
};

export async function handleAnalyzeTestCoverage(github, analysis, args) {
  const { pr_url } = args;

  if (!pr_url) {
    throw new Error('PR URL is required');
  }

  const prDetails = await github.getPRDetails(pr_url);
  const analysisResult = await analysis.analyzeTestCoverage(prDetails);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            analysis_type: 'test_coverage',
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
