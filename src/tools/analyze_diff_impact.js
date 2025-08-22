/**
 * Analyze the impact and risk level of code changes in a diff, categorizing changes by type and potential consequences
 */

export const analyzeDiffImpactToolDefinition = {
  name: 'analyze_diff_impact',
  description: 'Analyze the impact and risk level of code changes in a diff, categorizing changes by type and potential consequences.',
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

export async function handleAnalyzeDiffImpact(github, analysis, args) {
  const { pr_url } = args;

  if (!pr_url) {
    throw new Error('PR URL is required');
  }

  const prDetails = await github.getPRDetails(pr_url);
  const analysisResult = await analysis.analyzeDiffImpact(prDetails);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            analysis_type: 'diff_impact',
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
