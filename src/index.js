#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import { GitHubService } from './services/github.js';
import { ConfigService } from './services/config.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class GitHubMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'github-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.config = new ConfigService();
    this.github = new GitHubService(this.config.get('GITHUB_TOKEN'));

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_pr_details',
            description: 'Get detailed information about a GitHub Pull Request',
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
          },
          {
            name: 'get_pr_files',
            description: 'Get list of files changed in a GitHub Pull Request',
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
          },
          {
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
          },
          {
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
          },
          {
            name: 'post_pr_review',
            description: 'Post a review comment on a GitHub Pull Request',
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
          },
          {
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
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_pr_details':
            return await this.handleGetPRDetails(args);
          
          case 'get_pr_files':
            return await this.handleGetPRFiles(args);
          
          case 'get_pr_commits':
            return await this.handleGetPRCommits(args);
          
          case 'get_file_content':
            return await this.handleGetFileContent(args);
          
          case 'post_pr_review':
            return await this.handlePostPRReview(args);
          
          case 'get_repo_info':
            return await this.handleGetRepoInfo(args);
          
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error.message}`
        );
      }
    });
  }

  async handleGetPRDetails(args) {
    const { pr_url } = args;
    
    if (!pr_url) {
      throw new Error('PR URL is required');
    }

    const prDetails = await this.github.getPRDetails(pr_url);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(prDetails, null, 2),
        },
      ],
    };
  }

  async handleGetPRFiles(args) {
    const { pr_url, include_patch = true } = args;
    
    if (!pr_url) {
      throw new Error('PR URL is required');
    }

    const prDetails = await this.github.getPRDetails(pr_url);
    const files = prDetails.files.map(file => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      blob_url: file.blob_url,
      ...(include_patch && file.patch ? { patch: file.patch } : {}),
    }));

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ files, total_files: files.length }, null, 2),
        },
      ],
    };
  }

  async handleGetPRCommits(args) {
    const { pr_url } = args;
    
    if (!pr_url) {
      throw new Error('PR URL is required');
    }

    const prDetails = await this.github.getPRDetails(pr_url);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ commits: prDetails.commits, total_commits: prDetails.commits.length }, null, 2),
        },
      ],
    };
  }

  async handleGetFileContent(args) {
    const { owner, repo, path, ref = 'main' } = args;
    
    if (!owner || !repo || !path) {
      throw new Error('Owner, repo, and path are required');
    }

    const content = await this.github.getFileContent(owner, repo, path, ref);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ 
            owner, 
            repo, 
            path, 
            ref,
            content: content || null 
          }, null, 2),
        },
      ],
    };
  }

  async handlePostPRReview(args) {
    const { pr_url, body, event = 'COMMENT', comments = [] } = args;
    
    if (!pr_url || !body) {
      throw new Error('PR URL and body are required');
    }

    const { owner, repo, pull_number } = this.github.parsePRUrl(pr_url);
    
    const result = await this.github.createReview(owner, repo, pull_number, {
      body,
      event,
      comments,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ 
            success: true, 
            review_id: result.id,
            review_url: result.html_url 
          }, null, 2),
        },
      ],
    };
  }

  async handleGetRepoInfo(args) {
    const { owner, repo } = args;
    
    if (!owner || !repo) {
      throw new Error('Owner and repo are required');
    }

    const [languages, readme] = await Promise.all([
      this.github.getRepoLanguages(owner, repo),
      this.github.getRepoREADME(owner, repo),
    ]);

    const primaryLanguage = languages && Object.keys(languages).length > 0 
      ? Object.entries(languages).sort(([,a], [,b]) => b - a)[0][0]
      : 'Unknown';

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            owner,
            repo,
            full_name: `${owner}/${repo}`,
            languages,
            primary_language: primaryLanguage,
            has_readme: !!readme,
            readme_content: readme,
          }, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('GitHub MCP server running on stdio');
  }
}

const server = new GitHubMCPServer();
server.run().catch(console.error);