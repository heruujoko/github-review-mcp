# GitHub MCP Server

Minimal Model Context Protocol (MCP) server that exposes GitHub-focused tools for AI assistants.

---

## 🔧 Quick Start (Local)

```bash
# 1. Clone & install
 git clone <repo-url>
 cd github-review-mcp
 pnpm install

# 2. Add credentials
 echo "GITHUB_TOKEN=ghp_your_token_here" > .env

# 3. Run the server
 pnpm start
```

The server listens on the port specified by your MCP client (default **3000**).

---

## 🖥️  Using from an MCP Client

### Cursor IDE
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

### Generic MCP Client
Point the client to `node /absolute/path/github-review-mcp/src/index.js` and pass `GITHUB_TOKEN` in the environment.

---

## ☁️ Hosting on fly.io

Deploy this MCP server to fly.io for use with n8n or other remote MCP clients.

### Prerequisites
- Install [fly.io CLI](https://fly.io/docs/hands-on/install-flyctl/)
- Authenticate: `fly auth login`

### Deployment Steps

```bash
# 1. Clone and navigate to the repository
git clone <repo-url>
cd github-review-mcp

# 2. Create a new fly.io app (or use existing config)
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

### Security Model

This server supports two authentication modes:

#### 1. API Key Authentication (Required)
All requests to `/mcp` must include:
- **Header**: `Authorization: Bearer <api_key>`
- **Value**: Must match one of the keys in `VALID_API_KEYS`

#### 2. GitHub Token (Flexible)
GitHub authentication can be provided in two ways:

**Option A: Per-Request Override (Recommended for n8n)**
- **Header**: `X-GitHub-Token: ghp_your_token`
- Each request can use a different GitHub account
- Useful for multi-tenant scenarios

**Option B: Server Default**
- Set `GITHUB_TOKEN` as a fly.io secret
- Used when `X-GitHub-Token` header is not provided
- Good for single-user or internal use

---

## 🔌 Using with n8n

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

### Benefits of Hosted MCP

✅ **Multi-tenant**: Different workflows can use different GitHub accounts
✅ **Secure**: API keys protect your MCP server from unauthorized access
✅ **Flexible**: Override GitHub tokens per workflow/request
✅ **Scalable**: Deployed on fly.io with auto-scaling
✅ **Cost-effective**: Pay only for MCP hosting, AI costs via n8n's LLM

---

## 🐳 Docker (Local Development)

A Dockerfile for local testing is included.

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
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

---

## ⚙️ Environment Variables

### For Hosted Mode (fly.io)
| Variable              | Required | Description                           | Default |
|-----------------------|----------|---------------------------------------|---------|
| `VALID_API_KEYS`      | ✅ Yes   | Comma-separated API keys for authentication | -       |
| `GITHUB_TOKEN`        | ⚠️ Optional | Default GitHub token (can be overridden) | -       |
| `PORT`                | No       | Server port                           | 3000    |

### For Local/STDIO Mode
| Variable              | Required | Description                           | Default |
|-----------------------|----------|---------------------------------------|---------|
| `GITHUB_TOKEN`        | ✅ Yes   | GitHub Personal Access Token          | -       |

### Optional Configuration (All Modes)
| Variable              | Description                           | Default |
|-----------------------|---------------------------------------|---------|
| `MAX_PATCH_SIZE`      | Maximum diff patch size (chars)       | 2000    |
| `MAX_FILES_TO_REVIEW` | Maximum files processed per PR        | 50      |
| `REQUEST_TIMEOUT`     | HTTP request timeout (ms)             | 30000   |
| `LOG_LEVEL`           | Logging level (`debug`, `info`, …)    | info    |
| `ENABLE_DEBUG`        | Verbose logging (`true`/`false`)      | false   |

---

## 🛠️  Available Tools
Core PR utilities plus advanced analysis modules:

- `get_review_prompts` ⭐ (*call this first!*)
- `get_pr_details`
- `get_pr_files`
- `get_pr_commits`
- `get_file_content`
- `post_pr_review`
- `get_repo_info`

Advanced analysis (🚀):

- `analyze_code_quality`
- `analyze_diff_impact`
- `detect_security_issues`
- `detect_code_patterns`
- `analyze_dependencies`
- `analyze_test_coverage`
- `generate_suggestions`

---

For detailed usage examples, see the original README history or the inline JSDoc in `src/tools/`.
