/**
 * Analyze code quality metrics for changed files including complexity, maintainability, and potential issues
 */

export const analyzeCodeQualityToolDefinition = {
  name: 'analyze_code_quality',
  description: 'Analyze code quality metrics for changed files including complexity, maintainability, and potential issues.',
  inputSchema: {
    type: 'object',
    properties: {
      pr_url: {
        type: 'string',
        description: 'GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)',
      },
      file_paths: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional: Specific file paths to analyze. If not provided, analyzes all changed files.',
      },
    },
    required: ['pr_url'],
  },
};

export async function handleAnalyzeCodeQuality(github, analysis, args) {
  const { pr_url, file_paths = null } = args;

  if (!pr_url) {
    throw new Error('PR URL is required');
  }

  const prDetails = await github.getPRDetails(pr_url);
  const analysisResult = await analysis.analyzeCodeQuality(prDetails, file_paths);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            analysis_type: 'code_quality',
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
