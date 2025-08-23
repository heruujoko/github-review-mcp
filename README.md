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

## 🐳 Docker (Hosted)
A Dockerfile mirroring the hosted image is included.

```bash
# Build
 docker build -t gh-mcp .

# Run
 docker run -e GITHUB_TOKEN=ghp_your_token_here -p 3000:3000 gh-mcp
```

Attach the container to your MCP client using `http://localhost:3000` (or the mapped port) as the command.

---

## ⚙️ Environment Variables
| Variable              | Description                           | Default |
|-----------------------|---------------------------------------|---------|
| `GITHUB_TOKEN`        | GitHub Personal Access Token (required) | -       |
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
