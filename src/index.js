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
import { OllamaService } from './services/ollama.js';
import { ReviewService } from './services/review.js';
import { ConfigService } from './services/config.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class PRReviewServer {
  constructor() {
    this.server = new Server(
      {
        name: 'pr-review-server',
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
    this.ollama = new OllamaService(this.config.get('OLLAMA_HOST', 'http://localhost:11434'));
    this.review = new ReviewService(this.github, this.ollama, this.config);

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'review_pr',
            description: 'Review a GitHub Pull Request using AI',
            inputSchema: {
              type: 'object',
              properties: {
                pr_url: {
                  type: 'string',
                  description: 'GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)',
                },
                model: {
                  type: 'string',
                  description: 'Ollama model to use (optional, defaults to config)',
                  default: 'llama3.1',
                },
                provider: {
                  type: 'string',
                  description: 'AI provider to use: ollama, cursor, gemini',
                  enum: ['ollama', 'cursor', 'gemini'],
                  default: 'ollama',
                },
              },
              required: ['pr_url'],
            },
          },
          {
            name: 'update_review_prompt',
            description: 'Update the review prompt template',
            inputSchema: {
              type: 'object',
              properties: {
                prompt: {
                  type: 'string',
                  description: 'New review prompt content',
                },
              },
              required: ['prompt'],
            },
          },
          {
            name: 'get_review_prompt',
            description: 'Get the current review prompt template',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'list_models',
            description: 'List available models from configured provider',
            inputSchema: {
              type: 'object',
              properties: {
                provider: {
                  type: 'string',
                  description: 'Provider to list models from',
                  enum: ['ollama', 'cursor', 'gemini'],
                  default: 'ollama',
                },
              },
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'review_pr':
            return await this.handleReviewPR(args);
          
          case 'update_review_prompt':
            return await this.handleUpdatePrompt(args);
          
          case 'get_review_prompt':
            return await this.handleGetPrompt();
          
          case 'list_models':
            return await this.handleListModels(args);
          
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

  async handleReviewPR(args) {
    const { pr_url, model, provider = 'ollama' } = args;
    
    if (!pr_url) {
      throw new Error('PR URL is required');
    }

    const result = await this.review.reviewPR(pr_url, {
      model: model || this.config.get('DEFAULT_MODEL', 'llama3.1'),
      provider,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async handleUpdatePrompt(args) {
    const { prompt } = args;
    await this.review.updatePrompt(prompt);
    
    return {
      content: [
        {
          type: 'text',
          text: 'Review prompt updated successfully',
        },
      ],
    };
  }

  async handleGetPrompt() {
    const prompt = await this.review.getPrompt();
    
    return {
      content: [
        {
          type: 'text',
          text: prompt,
        },
      ],
    };
  }

  async handleListModels(args) {
    const { provider = 'ollama' } = args;
    
    let models;
    switch (provider) {
      case 'ollama':
        models = await this.ollama.listModels();
        break;
      case 'cursor':
        models = ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet'];
        break;
      case 'gemini':
        models = ['gemini-pro', 'gemini-pro-vision', 'gemini-1.5-pro'];
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ provider, models }, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('PR Review MCP server running on stdio');
  }
}

const server = new PRReviewServer();
server.run().catch(console.error);