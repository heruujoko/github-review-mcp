/**
 * Get list of files changed in a GitHub Pull Request
 * TIP: Use get_review_prompts first for analysis guidelines.
 */

export const getPRFilesToolDefinition = {
  name: 'get_pr_files',
  description: 'Get list of files changed in a GitHub Pull Request. TIP: Use get_review_prompts first for analysis guidelines.',
  inputSchema: {
    type: 'object',
    properties: {
      pr_url: {
        type: 'string',
        description: 'GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)',
      },
      include_patch: {
        type: 'boolean',
        description: 'Include diff patches for each file',
        default: true,
      },
    },
    required: ['pr_url'],
  },
};

export async function handleGetPRFiles(github, args) {
  const { pr_url, include_patch = true } = args;

  if (!pr_url) {
    throw new Error('PR URL is required');
  }

  const prDetails = await github.getPRDetails(pr_url);
  const files = prDetails.files.map(file => ({
    filename: file.filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes,
    blob_url: file.blob_url,
    ...(include_patch && file.patch ? { patch: file.patch } : {}),
  }));

  const result = {
    reminder: "💡 For thorough code review analysis, make sure to call 'get_review_prompts' for comprehensive guidelines on evaluating these file changes.",
    files,
    total_files: files.length,
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
