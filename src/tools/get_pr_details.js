/**
 * Get detailed information about a GitHub Pull Request
 * TIP: Call get_review_prompts first for comprehensive review guidelines.
 */

export const getPRDetailsToolDefinition = {
  name: 'get_pr_details',
  description: 'Get detailed information about a GitHub Pull Request. TIP: Call get_review_prompts first for comprehensive review guidelines.',
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

export async function handleGetPRDetails(github, args) {
  const { pr_url } = args;

  if (!pr_url) {
    throw new Error('PR URL is required');
  }

  const prDetails = await github.getPRDetails(pr_url);

  const result = {
    reminder: "💡 For comprehensive PR analysis, consider calling 'get_review_prompts' to get detailed review guidelines and best practices.",
    pr_details: prDetails,
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}
