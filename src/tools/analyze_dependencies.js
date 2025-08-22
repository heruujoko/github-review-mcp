/**
 * Analyze dependency changes and their impact, including new packages, version updates, and security implications
 */

export const analyzeDependenciesToolDefinition = {
  name: 'analyze_dependencies',
  description: 'Analyze dependency changes and their impact, including new packages, version updates, and security implications.',
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

export async function handleAnalyzeDependencies(github, analysis, args) {
  const { pr_url } = args;

  if (!pr_url) {
    throw new Error('PR URL is required');
  }

  const prDetails = await github.getPRDetails(pr_url);
  const analysisResult = await analysis.analyzeDependencies(prDetails);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            analysis_type: 'dependency_analysis',
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
