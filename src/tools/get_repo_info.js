/**
 * Get repository information including languages and README
 */

export const getRepoInfoToolDefinition = {
  name: 'get_repo_info',
  description: 'Get repository information including languages and README',
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
    },
    required: ['owner', 'repo'],
  },
};

export async function handleGetRepoInfo(github, args) {
  const { owner, repo } = args;

  if (!owner || !repo) {
    throw new Error('Owner and repo are required');
  }

  const [languages, readme] = await Promise.all([
    github.getRepoLanguages(owner, repo),
    github.getRepoREADME(owner, repo),
  ]);

  const primaryLanguage =
    languages && Object.keys(languages).length > 0
      ? Object.entries(languages).sort(([, a], [, b]) => b - a)[0][0]
      : 'Unknown';

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            owner,
            repo,
            full_name: `${owner}/${repo}`,
            languages,
            primary_language: primaryLanguage,
            has_readme: !!readme,
            readme_content: readme,
          },
          null,
          2
        ),
      },
    ],
  };
}
