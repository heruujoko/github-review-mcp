import express from 'express';
import rateLimit from 'express-rate-limit';
import { reviewPullRequest } from './handlers/review.js';

// This is a basic hosted server setup
// For a full MCP implementation, you would need to implement the MCP protocol over HTTP/SSE
// This example shows the basic structure for hosting

const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP',
});

function authenticateApiKey(req, res, next) {
  const authHeader = req.headers.authorization;
  const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!apiKey || !validApiKeys.includes(apiKey)) {
    return res.status(401).json({ error: 'Invalid or missing API key' });
  }

  next();
}

// Apply rate limiting to review endpoint
app.use('/review', limiter);

// Health check endpoint
app.get('/health', (_, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'MCP GitHub Server (Hosted Mode)',
  });
});

// Review endpoint
app.post('/review', authenticateApiKey, async (req, res) => {
  const { pr } = req.body;
  
  if (!pr) {
    return res.status(400).json({ error: 'PR URL is required' });
  }
  
  try {
    const result = await reviewPullRequest(pr);
    res.json(result);
  } catch (error) {
    console.error('Review error:', error);
    res.status(500).json({ error: 'Failed to review PR' });
  }
});

// Error handling middleware
app.use((error, req, res, _next) => {
  console.error('Server error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(port, () => {
  console.log(
    `✅ MCP Server (Hosted Mode) running on http://localhost:${port}`
  );
  console.log(`📍 Health check: http://localhost:${port}/health`);
  console.log(`🔍 Review endpoint: POST http://localhost:${port}/review`);
  console.log(`🔑 Valid API keys: ${validApiKeys.join(', ')}`);
  console.log(`📝 Use Bearer token authentication for /review endpoint`);
});
