/**
 * Scan code changes for potential security vulnerabilities and patterns
 */

export const detectSecurityIssuesToolDefinition = {
  name: 'detect_security_issues',
  description: 'Scan code changes for potential security vulnerabilities and patterns.',
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

export async function handleDetectSecurityIssues(github, analysis, args) {
  const { pr_url } = args;

  if (!pr_url) {
    throw new Error('PR URL is required');
  }

  const prDetails = await github.getPRDetails(pr_url);
  const analysisResult = await analysis.detectSecurityIssues(prDetails);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            analysis_type: 'security_analysis',
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
