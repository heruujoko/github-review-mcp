# github-review-mcp refactor

TypeScript, model-agnostic MCP capability server for GitHub pull-request review workflows.

This package is intentionally isolated from the legacy root server. It does not run an LLM and does not own the review loop. n8n or another orchestrator asks this MCP server for GitHub data, review strategy prompts, and review-posting actions.

## Architecture

```text
n8n / review agent
  -> MCP Client over HTTP
  -> POST /mcp with x-api-key
  -> github-review-mcp
       - GitHub App installation auth
       - repo allowlist gate
       - strategy catalog in strategies/*.md
       - .github/review-config.yaml resolution
       - PR data + diff + review posting tools
```

The server uses the MCP SDK Streamable HTTP transport in stateless mode. Each `/mcp` POST creates a fresh MCP `Server` and `StreamableHTTPServerTransport`, handles one request, then closes them. This avoids transport reuse bugs and keeps concurrent clients isolated.

## Tools

The server exposes 14 MCP tools:

- `get_review_strategy`
- `get_pr_details`
- `get_pr_files`
- `get_pr_commits`
- `get_file_content`
- `get_repo_info`
- `get_pr_diff_range`
- `post_pr_review`
- `analyze_code_quality`
- `analyze_diff_impact`
- `analyze_dependencies`
- `analyze_test_coverage`
- `detect_security_issues`
- `detect_code_patterns`

## Local development

```bash
cd refactor
pnpm install
cp .env.example .env
# edit .env
pnpm typecheck
pnpm test
pnpm dev
```

Health check:

```bash
curl http://localhost:3000/health
```

MCP endpoint:

```text
POST http://localhost:3000/mcp
Header: x-api-key: $MCP_API_SECRET
Accept: application/json, text/event-stream
Content-Type: application/json
```

## Required environment variables

| Variable | Required | Description |
|---|---:|---|
| `GITHUB_APP_ID` | yes | Numeric GitHub App ID. |
| `GITHUB_APP_PRIVATE_KEY` | yes | GitHub App private key PEM. Use escaped newlines in env files/secrets if needed. |
| `MCP_API_SECRET` | yes | Shared secret required as `x-api-key` on `/mcp`. |
| `PORT` | no | HTTP port. Default: `3000`. |
| `REPO_ALLOWLIST` | no | Comma-separated `owner/repo` list. Empty means any repo where the App is installed. |
| `MAX_PATCH_SIZE` | no | Patch truncation/analysis limit. Default: `2000`. |
| `MAX_FILES_TO_REVIEW` | no | File-count limit. Default: `50`. |
| `REQUEST_TIMEOUT` | no | Request timeout knob for service code. Default: `30000`. |

## GitHub App setup

You can use a free GitHub account. No GitHub upgrade is required.

1. Create a GitHub App under your account or organization.
2. Set the App permissions:
   - **Metadata:** Read-only
   - **Contents:** Read-only
   - **Pull requests:** Read and write
3. Optional but useful webhook events if n8n receives GitHub events directly:
   - Pull request
   - Pull request review
   - Pull request review comment
4. Generate a private key and store it as `GITHUB_APP_PRIVATE_KEY`.
5. Install the App on the repositories you want reviewed.
6. Set `REPO_ALLOWLIST` if you want an additional server-side repo gate beyond App installation scope.

## Repository review config

Each target repository can declare its allowed/preferred strategies at:

```text
.github/review-config.yaml
```

Example:

```yaml
strategies:
  - full-review
  - security
  - architecture

default: full-review
```

A copy is available at `examples/review-config.yaml`.

Resolution behavior:

- Missing config falls back to `full-review` with a notice.
- Malformed config falls back to `full-review` with a notice.
- Unknown strategy names fail with a clear error listing available strategies.
- If a caller requests a strategy not allowed by the repo config, the tool returns an error listing allowed strategies.

## n8n wiring

Recommended flow:

1. GitHub or Telegram trigger starts the n8n workflow.
2. n8n calls MCP tool `get_review_strategy` with `{ owner, repo }`.
3. n8n uses the returned strategy prompt with its chosen OpenAI-compatible model.
4. n8n pulls required context using tools such as:
   - `get_pr_details`
   - `get_pr_files`
   - `get_pr_diff_range`
   - `get_file_content`
5. n8n runs its review loop.
6. n8n posts the final review through `post_pr_review`.

MCP Client settings:

- URL: `https://<your-host>/mcp`
- Method/transport: Streamable HTTP / HTTP MCP client
- Header: `x-api-key: <MCP_API_SECRET>`
- Ensure the client sends:
  - `Accept: application/json, text/event-stream`
  - `Content-Type: application/json`

## Docker

Build from the `refactor/` directory:

```bash
docker build -t github-review-mcp-refactor .
```

Run locally:

```bash
docker run --rm -p 3000:3000 \
  --env-file .env \
  github-review-mcp-refactor
```

Then verify:

```bash
curl http://localhost:3000/health
```

## Fly.io notes

One possible deployment flow:

```bash
cd refactor
fly launch --no-deploy
fly secrets set \
  GITHUB_APP_ID="123456" \
  GITHUB_APP_PRIVATE_KEY="$(cat path/to/private-key.pem)" \
  MCP_API_SECRET="$(openssl rand -hex 32)"
fly deploy
```

If you use `REPO_ALLOWLIST`, set it as a secret too:

```bash
fly secrets set REPO_ALLOWLIST="owner/repo-a,owner/repo-b"
```

## Validation

Current green checks:

```bash
pnpm typecheck
pnpm test
```

The integration test boots the Express app with mocked services and verifies:

- tool discovery returns all 14 tools
- `get_review_strategy` returns a strategy prompt
- allowlist failures are returned as MCP `isError`
- unknown tools are returned as MCP `isError`
- bad `x-api-key` returns HTTP 401
