/**
 * Get content of a specific file from a GitHub repository
 */

export const getFileContentToolDefinition = {
  name: 'get_file_content',
  description: 'Get content of a specific file from a GitHub repository',
  inputSchema: {
    type: 'object',
    properties: {
      owner: {
        type: 'string',
        description: 'Repository owner',
      },
      repo: {
        type: 'string',
        description: 'Repository name',
      },
      path: {
        type: 'string',
        description: 'File path in the repository',
      },
      ref: {
        type: 'string',
        description: 'Git reference (branch, tag, or commit SHA)',
        default: 'main',
      },
    },
    required: ['owner', 'repo', 'path'],
  },
};

export async function handleGetFileContent(github, args) {
  const { owner, repo, path, ref = 'main' } = args;

  if (!owner || !repo || !path) {
    throw new Error('Owner, repo, and path are required');
  }

  const content = await github.getFileContent(owner, repo, path, ref);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            owner,
            repo,
            path,
            ref,
            content: content || null,
          },
          null,
          2
        ),
      },
    ],
  };
}
