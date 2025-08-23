/**
 * Post a review comment on a GitHub Pull Request
 * BEST PRACTICE: Use get_review_prompts first to ensure comprehensive analysis.
 */

export const postPRReviewToolDefinition = {
  name: 'post_pr_review',
  description: 'Post a review comment on a GitHub Pull Request. BEST PRACTICE: Use get_review_prompts first to ensure comprehensive analysis.',
  inputSchema: {
    type: 'object',
    properties: {
      pr_url: {
        type: 'string',
        description: 'GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)',
      },
      body: {
        type: 'string',
        description: 'Review comment body',
      },
      event: {
        type: 'string',
        description: 'Review event type',
        enum: ['APPROVE', 'REQUEST_CHANGES', 'COMMENT'],
        default: 'COMMENT',
      },
      comments: {
        type: 'array',
        description: 'Line-specific comments',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string' },
            line: { type: 'number' },
            body: { type: 'string' },
          },
          required: ['path', 'line', 'body'],
        },
        default: [],
      },
    },
    required: ['pr_url', 'body'],
  },
};

export async function handlePostPRReview(github, args) {
  const { pr_url, body, event = 'COMMENT', comments = [] } = args;

  if (!pr_url || !body) {
    throw new Error('PR URL and body are required');
  }

  const { owner, repo, pull_number } = github.parsePRUrl(pr_url);

  const result = await github.createReview(owner, repo, pull_number, {
    body,
    event,
    comments,
  });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            success: true,
            review_id: result.id,
            review_url: result.html_url,
          },
          null,
          2
        ),
      },
    ],
  };
}
