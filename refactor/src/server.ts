/**
 * MCP server entrypoint — bootstraps the Streamable HTTP MCP server with
 * header-secret auth, rate limiting, and the tool registry.
 *
 * Usage:
 *   MCP_API_SECRET=... GITHUB_APP_ID=... GITHUB_APP_PRIVATE_KEY=... \
 *     tsx src/server.ts
 *
 * The server exposes:
 *   - GET  /health          → { status: "ok", version }
 *   - POST /mcp             → MCP Streamable HTTP transport (ListTools, CallTool)
 *   - All other routes      → 404
 */

import 'dotenv/config';
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

// ---- Bootstrap services ----

const config = new ConfigService();
const appOctokit = createAppOctokit(config.githubAppId, config.githubAppPrivateKey);
const githubApp = new GitHubAppAuth({
  appId: config.githubAppId,
  privateKey: config.githubAppPrivateKey,
  appOctokit: appOctokit as never,
});
const strategy = new StrategyService();

const services: ToolServices = { config, githubApp, strategy };

// ---- Register all tools ----

registerAllTools();

// ---- Create MCP Server ----

const mcpServer = new Server(
  { name: 'github-review-mcp', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

// ListTools handler
mcpServer.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: toolDefinitions,
}));

// CallTool handler
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

// ---- Express app ----

const app = express();

// Trust proxy for rate limiting behind reverse proxies
app.set('trust proxy', 1);

// Rate limiting
const limiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use(limiter);

// Header-secret auth middleware (applied to /mcp)
function authMiddleware(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction,
): void {
  const provided = req.headers['x-api-key'] as string | undefined;
  if (!provided || provided !== config.mcpApiSecret) {
    res.status(401).json({ error: 'Unauthorized: invalid or missing x-api-key header' });
    return;
  }
  next();
}

// Health endpoint (no auth)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', version: '0.1.0' });
});

// MCP transport — one instance per server (stateless, session managed by SDK)
const transport = new StreamableHTTPServerTransport({});

// Connect the MCP server to the transport (SDK wires onmessage internally)
await mcpServer.connect(transport);

app.post('/mcp', authMiddleware, express.json(), async (req, res) => {
  try {
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: (err as Error).message });
    }
  }
});

// ---- Start ----

const port = config.port;
app.listen(port, () => {
  console.log(`github-review-mcp server listening on port ${port}`);
  console.log(`  Health:  http://localhost:${port}/health`);
  console.log(`  MCP:     POST http://localhost:${port}/mcp (x-api-key header)`);
  console.log(`  Tools:   ${toolDefinitions.length} registered`);
});

export { app, mcpServer, transport, services };
