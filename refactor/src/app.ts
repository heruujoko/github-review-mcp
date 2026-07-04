/**
 * MCP server factory — creates an Express app wired to the MCP SDK's
 * Streamable HTTP transport with header-secret auth, rate limiting, and
 * the tool registry.
 *
 * The factory accepts an optional `overrides` object so integration tests
 * can inject mock services without touching env vars.
 */

import express from 'express';
import rateLimit from 'express-rate-limit';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ConfigService } from './services/config.js';
import { GitHubAppAuth, createAppOctokit } from './auth/github-app.js';
import { StrategyService } from './services/strategy.js';
import { registerAllTools, getTool, toolDefinitions } from './tools/index.js';
import type { ToolServices } from './types/index.js';

export interface ServerOverrides {
  config?: ConfigService;
  githubApp?: GitHubAppAuth;
  strategy?: StrategyService;
  mcpApiSecret?: string;
}

/**
 * Build a fully wired Express app. When `overrides` are provided they
 * replace the corresponding production service; the caller is responsible
 * for ensuring the override implements the required interface.
 */
export function createApp(overrides: ServerOverrides = {}): {
  app: express.Application;
  services: ToolServices;
} {
  const config = overrides.config ?? new ConfigService();
  const mcpApiSecret = overrides.mcpApiSecret ?? config.mcpApiSecret;

  const appOctokit = createAppOctokit(config.githubAppId, config.githubAppPrivateKey);
  const githubApp =
    overrides.githubApp ??
    new GitHubAppAuth({
      appId: config.githubAppId,
      privateKey: config.githubAppPrivateKey,
      appOctokit: appOctokit as never,
    });
  const strategy = overrides.strategy ?? new StrategyService();

  const services: ToolServices = { config, githubApp, strategy };

  registerAllTools();

  // Build a fresh MCP Server wired to the tool registry. A new instance is
  // created per request (stateless transport model) so state never leaks
  // between concurrent clients.
  function buildMcpServer(): Server {
    const mcpServer = new Server(
      { name: 'github-review-mcp', version: '0.1.0' },
      { capabilities: { tools: {} } },
    );

    mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: toolDefinitions,
    }));

    mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      const entry = getTool(name);
      if (!entry) {
        return {
          content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
          isError: true,
        };
      }
      return entry.handler(args ?? {}, services) as never;
    });

    return mcpServer;
  }

  const app = express();
  app.set('trust proxy', 1);

  const limiter = rateLimit({
    windowMs: 60_000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
  });
  app.use(limiter);

  function authMiddleware(
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ): void {
    const provided = req.headers['x-api-key'] as string | undefined;
    if (!provided || provided !== mcpApiSecret) {
      res.status(401).json({ error: 'Unauthorized: invalid or missing x-api-key header' });
      return;
    }
    next();
  }

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '0.1.0' });
  });

  // Stateless Streamable HTTP model: a fresh Server + Transport is created for
  // every POST, connected, used to handle the single request, then torn down
  // when the response closes. This avoids the "transport cannot be reused"
  // error that a shared stateless transport throws on its second request, and
  // keeps concurrent clients fully isolated. n8n opens a new request per call.
  app.post('/mcp', authMiddleware, async (req, res) => {
    const mcpServer = buildMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    res.on('close', () => {
      void transport.close();
      void mcpServer.close();
    });

    try {
      await mcpServer.connect(transport);
      await transport.handleRequest(req, res, undefined);
    } catch (err) {
      console.error('MCP transport error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: (err as Error).message });
      }
    }
  });

  return { app, services };
}
