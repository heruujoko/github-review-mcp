/**
 * Generate specific code improvement suggestions based on best practices and patterns
 */

export const generateSuggestionsToolDefinition = {
  name: 'generate_suggestions',
  description: 'Generate specific code improvement suggestions based on best practices and patterns.',
  inputSchema: {
    type: 'object',
    properties: {
      pr_url: {
        type: 'string',
        description: 'GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)',
      },
      file_path: {
        type: 'string',
        description: 'Specific file to generate suggestions for',
      },
      focus_areas: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['performance', 'security', 'maintainability', 'readability', 'testing'],
        },
        description: 'Specific areas to focus suggestions on',
      },
    },
    required: ['pr_url', 'file_path'],
  },
};

export async function handleGenerateSuggestions(github, analysis, args) {
  const { pr_url, file_path, focus_areas = [] } = args;

  if (!pr_url || !file_path) {
    throw new Error('PR URL and file path are required');
  }

  const prDetails = await github.getPRDetails(pr_url);
  const suggestions = await analysis.generateSuggestions(prDetails, file_path, focus_areas);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            analysis_type: 'code_suggestions',
            pr_url,
            file_path,
            focus_areas,
            ...suggestions,
          },
          null,
          2
        ),
      },
    ],
  };
}
