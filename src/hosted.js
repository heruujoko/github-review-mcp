import express from 'express';
import rateLimit from 'express-rate-limit';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
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

const validApiKeys = process.env.VALID_API_KEYS?.split(',').map(k => k.trim()) || [];
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Rate limiting for MCP endpoint
const mcpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later',
});

// Authentication middleware
function authenticateRequest(req, res, next) {
  // 1. Validate API Key
  const authHeader = req.headers.authorization;
  const apiKey = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : null;

  if (!apiKey || !validApiKeys.includes(apiKey)) {
    return res.status(401).json({
      error: 'Invalid or missing API key',
      hint: 'Provide Authorization: Bearer <api_key> header',
    });
  }

  // 2. Extract GitHub token (header override or environment fallback)
  const githubToken =
    req.headers['x-github-token'] || process.env.GITHUB_TOKEN;

  if (!githubToken) {
    return res.status(400).json({
      error: 'GitHub token required',
      hint: 'Provide via X-GitHub-Token header or configure GITHUB_TOKEN environment variable',
    });
  }

  // Store in request for later use
  req.githubToken = githubToken;
  next();
}

// Create MCP Server instance for a request
function createMCPServer(githubToken) {
  const server = new Server(
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

  const config = new ConfigService();
  const github = new GitHubService(githubToken);
  const analysis = new AnalysisService();

  // Register list tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions,
  }));

  // Register call-tool handler
  server.setRequestHandler(CallToolRequestSchema, async request => {
    const { name, arguments: args } = request.params;
    const handler = toolHandlers[name];

    if (!handler) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }

    try {
      // Determine expected arguments based on handler arity
      if (handler.length === 3) {
        // Handlers that also need the analysis service
        return await handler(github, analysis, args);
      }

      // Default case: handlers expecting only the GitHub service and args
      return await handler(github, args);
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Tool execution failed: ${error.message}`
      );
    }
  });

  return server;
}

// Health check endpoint
app.get('/health', (_, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'MCP GitHub Server (HTTP Streamable)',
    version: '1.0.0',
  });
});

// MCP endpoint - supports both GET and POST for Streamable HTTP transport
app.all('/mcp', mcpLimiter, authenticateRequest, async (req, res) => {
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  // Create MCP server with the GitHub token from request
  const mcpServer = createMCPServer(req.githubToken);

  // Clean up on connection close
  res.on('close', () => {
    transport.close();
  });

  try {
    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error('MCP request error:', error);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'MCP request failed',
        message: error.message,
      });
    }
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: {
      health: 'GET /health',
      mcp: 'GET|POST /mcp',
    },
  });
});

// Error handling middleware
app.use((error, req, res, _next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(port, () => {
  console.log(`✅ MCP Server (HTTP Streamable) running on port ${port}`);
  console.log(`📍 Health check: http://localhost:${port}/health`);
  console.log(`🔌 MCP endpoint: http://localhost:${port}/mcp`);
  console.log(`🔑 Valid API keys configured: ${validApiKeys.length}`);
  console.log(
    `🔐 GitHub token: ${process.env.GITHUB_TOKEN ? 'Set (can be overridden per request)' : 'Not set (must be provided per request)'}`
  );
});
