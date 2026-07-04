/**
 * Vitest setup — sets required env vars before any module is evaluated.
 */
process.env.GITHUB_APP_ID = '12345';
process.env.GITHUB_APP_PRIVATE_KEY = '-----BEGIN RSA PRIVATE KEY-----\nFAKE\n-----END RSA PRIVATE KEY-----';
process.env.MCP_API_SECRET = 'test-secret';
