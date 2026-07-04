/**
 * MCP server entrypoint — bootstraps the Streamable HTTP MCP server.
 *
 * Usage:
 *   MCP_API_SECRET=... GITHUB_APP_ID=... GITHUB_APP_PRIVATE_KEY=... \
 *     tsx src/server.ts
 */

import 'dotenv/config';
import { createApp } from './app.js';

const { app } = createApp();

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
  console.log(`github-review-mcp server listening on port ${port}`);
  console.log(`  Health:  http://localhost:${port}/health`);
  console.log(`  MCP:     POST http://localhost:${port}/mcp (x-api-key header)`);
});
