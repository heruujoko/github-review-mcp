/**
 * Tool: post_pr_review
 *
 * Posts a review on a pull request: a top-level body, a review event
 * (APPROVE / REQUEST_CHANGES / COMMENT), and optional inline line comments.
 */

import { registerTool } from './registry.js';
import { errorResult, jsonResult, resolvePR } from './shared.js';
import type { GitHubService } from '../services/github.js';
import type {
  ToolServices,
  ToolResult,
  InlineComment,
  ReviewInput,
} from '../types/index.js';

const VALID_EVENTS = new Set(['APPROVE', 'REQUEST_CHANGES', 'COMMENT']);

export function registerPostPRReview(): void {
  registerTool({
    definition: {
      name: 'post_pr_review',
      description:
        'Post a review on a pull request: a top-level body, a review event (APPROVE / REQUEST_CHANGES / COMMENT), and optional inline line comments.',
      inputSchema: {
        type: 'object',
        properties: {
          pr_url: {
            type: 'string',
            description:
              'GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)',
          },
          body: { type: 'string', description: 'Review summary body (Markdown).' },
          event: {
            type: 'string',
            enum: ['APPROVE', 'REQUEST_CHANGES', 'COMMENT'],
            description: 'Review event type (default: COMMENT).',
          },
          comments: {
            type: 'array',
            description: 'Optional inline line-specific comments.',
            items: {
              type: 'object',
              properties: {
                path: { type: 'string' },
                line: { type: 'number' },
                body: { type: 'string' },
                side: { type: 'string', enum: ['LEFT', 'RIGHT'] },
                start_line: { type: 'number' },
              },
              required: ['path', 'line', 'body'],
            },
          },
        },
        required: ['pr_url', 'body'],
      },
    },
    handler: async (
      args: Record<string, unknown>,
      services: ToolServices,
    ): Promise<ToolResult> => {
      const prUrl = args.pr_url as string | undefined;
      const body = args.body as string | undefined;
      const event = (args.event as string | undefined) ?? 'COMMENT';
      const rawComments = (args.comments as InlineComment[] | undefined) ?? [];

      if (!prUrl) return errorResult('pr_url is required for post_pr_review.');
      if (!body) return errorResult('body is required for post_pr_review.');
      if (!VALID_EVENTS.has(event)) {
        return errorResult(
          `Invalid event '${event}'. Must be one of APPROVE, REQUEST_CHANGES, COMMENT.`,
        );
      }

      const resolved = await resolvePR(services, prUrl);
      if ('content' in resolved && 'isError' in resolved) return resolved;
      const { pr, github } = resolved as {
        pr: { owner: string; repo: string; pull_number: number };
        github: GitHubService;
      };

      const comments: InlineComment[] = rawComments.map((c) => ({
        path: c.path,
        line: c.line,
        body: c.body,
        side: c.side,
        start_line: c.start_line,
      }));

      const review: ReviewInput = {
        body,
        event: event as ReviewInput['event'],
        comments,
      };

      try {
        const result = await github.createReview(
          pr.owner,
          pr.repo,
          pr.pull_number,
          review,
        );
        return jsonResult(result);
      } catch (err) {
        return errorResult((err as Error).message);
      }
    },
  });
}
