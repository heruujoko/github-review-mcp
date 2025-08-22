/**
 * Get commits in a GitHub Pull Request
 */

export const getPRCommitsToolDefinition = {
  name: 'get_pr_commits',
  description: 'Get commits in a GitHub Pull Request',
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

export async function handleGetPRCommits(github, args) {
  const { pr_url } = args;

  if (!pr_url) {
    throw new Error('PR URL is required');
  }

  const prDetails = await github.getPRDetails(pr_url);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            commits: prDetails.commits,
            total_commits: prDetails.commits.length,
          },
          null,
          2
        ),
      },
    ],
  };
}
