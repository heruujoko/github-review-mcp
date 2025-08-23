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
import { AnalysisService } from './services/analysis.js';
import dotenv from 'dotenv';
import { toolDefinitions, toolHandlers } from './tools/index.js';

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
    this.analysis = new AnalysisService();

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    // Register dynamic list tools handler based on shared tool definitions
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: toolDefinitions,
    }));

    // Register dynamic call-tool handler which delegates to shared handlers
    this.server.setRequestHandler(CallToolRequestSchema, async request => {
      const { name, arguments: args } = request.params;
      const handler = toolHandlers[name];

      if (!handler) {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
      }

      try {
        // Determine expected arguments based on handler arity
        if (handler.length === 3) {
          // Handlers that also need the analysis service
          return await handler(this.github, this.analysis, args);
        }

        // Default case: handlers expecting only the GitHub service and args
        return await handler(this.github, args);
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error.message}`
        );
      }
    });
  }

  // Duplicate handler implementations have been removed.
  // All tool logic is now centralized in ./tools with shared handlers.

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('GitHub MCP server running on stdio');
  }
}

const server = new GitHubMCPServer();
server.run().catch(console.error);
