# GitHub MCP Server

Minimal Model Context Protocol (MCP) server that exposes GitHub-focused tools for AI assistants. Supports both **local STDIO** and **remote HTTP Streamable** transports.

---

## 🎯 Two Deployment Modes

This MCP server supports **two distinct modes** for different use cases:

| Mode | Transport | Best For | Run Command |
|------|-----------|----------|-------------|
| **🖥️ Local STDIO** | Standard I/O | Cursor IDE, Claude Desktop, local MCP clients | `node src/index.js` |
| **☁️ HTTP Streamable** | HTTP/SSE | n8n, remote clients, fly.io, cloud deployment | `node src/hosted.js` |

### Which Mode Should I Use?

**Use Local STDIO if:**
- ✅ You're using Cursor IDE or Claude Desktop
- ✅ Running MCP client on the same machine
- ✅ Want simple setup with no authentication needed

**Use HTTP Streamable if:**
- ✅ You're using n8n or remote MCP clients
- ✅ Need multi-tenant support (multiple users/workflows)
- ✅ Want to deploy to the cloud (fly.io, Railway, etc.)
- ✅ Need API key authentication and security

---

# 🖥️ Mode 1: Local STDIO (Desktop Apps)

For Cursor IDE, Claude Desktop, and other local MCP clients.

## Quick Start

```bash
# 1. Clone & install
git clone <repo-url>
cd github-review-mcp
pnpm install

# 2. Add credentials
echo "GITHUB_TOKEN=ghp_your_token_here" > .env

# 3. Run the STDIO server
node src/index.js
```

## Cursor IDE Setup

Add this to **Settings → Extensions → MCP** (or your `mcp-servers.json`):

```json
{
  "mcpServers": {
    "github-review-server": {
      "command": "node",
      "args": ["/absolute/path/github-review-mcp/src/index.js"],
      "env": { "GITHUB_TOKEN": "ghp_your_token_here" }
    }
  }
}
```

## Claude Desktop Setup

Add to your Claude Desktop MCP configuration:

```json
{
  "mcpServers": {
    "github-review": {
      "command": "node",
      "args": ["/absolute/path/github-review-mcp/src/index.js"],
      "env": {
        "GITHUB_TOKEN": "ghp_your_token_here"
      }
    }
  }
}
```

## Other MCP Clients

Point your MCP client to:
- **Command**: `node /absolute/path/github-review-mcp/src/index.js`
- **Environment**: `GITHUB_TOKEN=ghp_your_token_here`

## Environment Variables (STDIO Mode)

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `GITHUB_TOKEN` | ✅ Yes | GitHub Personal Access Token | - |
| `MAX_PATCH_SIZE` | No | Maximum diff patch size (chars) | 2000 |
| `MAX_FILES_TO_REVIEW` | No | Maximum files processed per PR | 50 |
| `REQUEST_TIMEOUT` | No | HTTP request timeout (ms) | 30000 |
| `LOG_LEVEL` | No | Logging level (`debug`, `info`, etc.) | info |
| `ENABLE_DEBUG` | No | Verbose logging (`true`/`false`) | false |

---

# ☁️ Mode 2: HTTP Streamable (Cloud/Remote)

For n8n, remote MCP clients, and cloud deployments.

## Quick Start (Local Testing)

```bash
# 1. Clone & install
git clone <repo-url>
cd github-review-mcp
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env and set:
#   VALID_API_KEYS=your-secret-key-1,your-secret-key-2
#   GITHUB_TOKEN=ghp_your_token (optional fallback)

# 3. Run the HTTP server
pnpm start
# Or: node src/hosted.js
```

Server will be available at:
- 🔌 MCP endpoint: `http://localhost:3000/mcp`
- 📍 Health check: `http://localhost:3000/health`

## Deploy to fly.io

### Prerequisites
- Install [fly.io CLI](https://fly.io/docs/hands-on/install-flyctl/)
- Authenticate: `fly auth login`

### Deployment Steps

```bash
# 1. Clone and navigate to the repository
git clone <repo-url>
cd github-review-mcp

# 2. Create a new fly.io app (or use existing fly.toml config)
fly launch --no-deploy

# 3. Set required secrets
fly secrets set VALID_API_KEYS=your-secret-key-1,your-secret-key-2

# 4. (Optional) Set default GitHub token as fallback
fly secrets set GITHUB_TOKEN=ghp_your_github_token_here

# 5. Deploy
fly deploy

# 6. Check deployment
fly status
fly logs
```

Your MCP server will be available at: `https://your-app-name.fly.dev/mcp`

### Environment Variables (fly.io)

Set these as secrets using `fly secrets set`:

| Variable | Required | Description |
|----------|----------|-------------|
| `VALID_API_KEYS` | ✅ Yes | Comma-separated API keys for client authentication |
| `GITHUB_TOKEN` | ⚠️ Optional | Default GitHub token (can be overridden per request) |
| `PORT` | No | Server port (default: 3000) |

**Example:**
```bash
fly secrets set \
  VALID_API_KEYS=key1,key2,key3 \
  GITHUB_TOKEN=ghp_your_token
```

## Security Model

The HTTP Streamable mode uses a **dual authentication system**:

### 1. API Key Authentication (Required)
All requests to `/mcp` must include:
- **Header**: `Authorization: Bearer <api_key>`
- **Value**: Must match one of the keys in `VALID_API_KEYS`

### 2. GitHub Token (Flexible)
GitHub authentication can be provided in two ways:

**Option A: Per-Request Override (Recommended for n8n)**
- **Header**: `X-GitHub-Token: ghp_your_token`
- Each request can use a different GitHub account
- Useful for multi-tenant scenarios

**Option B: Server Default**
- Set `GITHUB_TOKEN` as a fly.io secret or environment variable
- Used when `X-GitHub-Token` header is not provided
- Good for single-user or internal use

## Using with n8n

Configure n8n's **MCP Client** node with these settings:

### Basic Configuration

**MCP Endpoint Settings:**
- **Endpoint URL**: `https://your-app-name.fly.dev/mcp`
- **Server Transport**: `HTTP Streamable`

**Authentication:**
- **Authentication**: `Header Auth`
- **Credential for Header Auth**: Create a new credential

### Authentication Setup

In the Header Auth credential, configure:

**Header 1 (Required):**
- **Name**: `Authorization`
- **Value**: `Bearer your-api-key-from-valid-api-keys`

**Header 2 (Recommended):**
- **Name**: `X-GitHub-Token`
- **Value**: `ghp_your_github_personal_access_token`

> **Note**: n8n's MCP Client automatically sends the required `Accept: application/json, text/event-stream` header. If using other HTTP clients for testing, make sure to include this header.

### Visual Reference

```
┌─────────────────────────────────────────────┐
│ MCP Client Configuration                    │
├─────────────────────────────────────────────┤
│ Endpoint: https://igris-review-mcp.fly.dev/mcp │
│ Server Transport: HTTP Streamable           │
│ Authentication: Header Auth                 │
│                                             │
│ Headers:                                    │
│  Authorization: Bearer secret-key-123       │
│  X-GitHub-Token: ghp_xxxxxxxxxxxxx          │
└─────────────────────────────────────────────┘
```

### Example n8n Workflow

1. **Add MCP Client node** to your workflow
2. **Configure the connection** as shown above
3. **Use MCP tools** - The AI agent can now call tools like:
   - `get_review_prompts` - Get review guidelines
   - `get_pr_details` - Fetch PR information
   - `analyze_code_quality` - Analyze code quality
   - `post_pr_review` - Post review comments

4. **AI Model**: Configure your preferred AI model in n8n (Claude, GPT-4, etc.)
   - The AI model runs in n8n, not on the MCP server
   - MCP server only provides tools for GitHub operations

### Benefits of HTTP Streamable Mode

✅ **Multi-tenant**: Different workflows can use different GitHub accounts
✅ **Secure**: API keys protect your MCP server from unauthorized access
✅ **Flexible**: Override GitHub tokens per workflow/request
✅ **Scalable**: Deployed on fly.io with auto-scaling
✅ **Cost-effective**: Pay only for MCP hosting, AI costs via n8n's LLM

## Docker Deployment

A Dockerfile is included for containerized deployments.

```bash
# Build
docker build -t gh-mcp .

# Run with environment variables
docker run \
  -e VALID_API_KEYS=test-key-1,test-key-2 \
  -e GITHUB_TOKEN=ghp_your_token_here \
  -p 3000:3000 \
  gh-mcp
```

Test the server:
```bash
# Health check
curl http://localhost:3000/health

# MCP endpoint (requires authentication)
curl -X POST http://localhost:3000/mcp \
  -H "Authorization: Bearer test-key-1" \
  -H "X-GitHub-Token: ghp_your_token" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

---

# 🛠️ Available Tools

Both modes provide the same comprehensive set of tools:

## Core PR Utilities

- `get_review_prompts` ⭐ (*call this first!*)
- `get_pr_details` - Get detailed PR information
- `get_pr_files` - List changed files with diffs
- `get_pr_commits` - Get commit history
- `get_file_content` - Fetch specific file content
- `post_pr_review` - Post review comments
- `get_repo_info` - Get repository metadata

## Advanced Analysis Tools 🚀

- `analyze_code_quality` - Code complexity and maintainability metrics
- `analyze_diff_impact` - Risk assessment of changes
- `detect_security_issues` - Security vulnerability scanning
- `detect_code_patterns` - Anti-patterns and best practices
- `analyze_dependencies` - Dependency change analysis
- `analyze_test_coverage` - Test coverage suggestions
- `generate_suggestions` - Code improvement recommendations

---

## 📋 Complete Environment Variables Reference

### STDIO Mode (Local)
| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `GITHUB_TOKEN` | ✅ Yes | GitHub Personal Access Token | - |

### HTTP Streamable Mode (Cloud)
| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `VALID_API_KEYS` | ✅ Yes | Comma-separated API keys | - |
| `GITHUB_TOKEN` | ⚠️ Optional | Default GitHub token | - |
| `PORT` | No | Server port | 3000 |

### Optional (All Modes)
| Variable | Description | Default |
|----------|-------------|---------|
| `MAX_PATCH_SIZE` | Maximum diff patch size (chars) | 2000 |
| `MAX_FILES_TO_REVIEW` | Maximum files per PR | 50 |
| `REQUEST_TIMEOUT` | HTTP timeout (ms) | 30000 |
| `LOG_LEVEL` | Logging level | info |
| `ENABLE_DEBUG` | Verbose logging | false |

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT

---

For detailed usage examples and tool specifications, see the inline JSDoc in `src/tools/`.
