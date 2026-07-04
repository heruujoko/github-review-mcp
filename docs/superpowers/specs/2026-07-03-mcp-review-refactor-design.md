# Design: github-review-mcp — Automated, Model-Agnostic Review Layer (`refactor/`)

**Date:** 2026-07-03
**Status:** Approved (design phase)
**Location:** All new code under `refactor/`. The existing root package stays intact as the legacy/working version.

---

## 1. Purpose

Evolve the current GitHub review MCP from an n8n-triggered, Gemini-driven, single-PAT service into a **model-agnostic, LLM-free MCP capability layer** that:

- Serves any OpenAI-standard model via n8n's AI Agent node (deepseek, kimi, etc.) — no LLM logic inside MCP.
- Uses a **GitHub App** (works on free GitHub accounts) instead of a long-lived PAT — short-lived, repo-scoped installation tokens; reviews post under a bot identity.
- Resolves review strategy from a **file-driven catalog** (`refactor/strategies/*.md`) intersected with per-repo config (`.github/review-config.yaml`).
- Supports **stateless follow-up reviews** — n8n tracks the last-reviewed SHA; MCP does pure diff math.
- Is exposed as a **real MCP server over HTTP/SSE**, discoverable by n8n's MCP Client node.

n8n remains the orchestrator and reasoning brain. MCP is a pure tool/capability backend.

---

## 2. Architecture

### Roles

| Concern | Owner |
|---|---|
| Trigger (PR open / follow-up push) | n8n (GitHub webhook → workflow) |
| Model + reasoning loop | n8n AI Agent (any OpenAI-standard model) |
| Strategy selection prompt | MCP (resolves repo config against catalog) |
| GitHub access (read diff/files, post review) | MCP (via GitHub App installation token) |
| Follow-up state (last-reviewed SHA) | n8n (stateless MCP) |
| Notifications / control UI | n8n / Telegram |

### Conversation flow

```
n8n Agent → MCP: get_review_strategy(owner, repo)
MCP       → reads .github/review-config.yaml, intersects with strategies/*.md,
            returns resolved strategy prompt(s)
n8n Agent → MCP: get_pr_files / get_pr_details / get_pr_diff_range
MCP       → mints installation token, fetches via Octokit, returns data
n8n Agent → (reasons, loops, requests more tools) … until satisfied
n8n Agent → MCP: post_pr_review(body, inline comments)
MCP       → posts as GitHub App bot identity
n8n       → Telegram notification
```

### Three-layer strategy model

1. **MCP catalog** — `refactor/strategies/*.md`, each a strategy with skill-style frontmatter (metadata) + prompt body.
2. **Repo config** — `.github/review-config.yaml` in each target repo, declaring allowed/preferred strategy names.
3. **n8n** — never dictates strategy; it asks, MCP resolves from the repo config, returns the prompt(s).

Resolution: `strategy.ts` loads all catalog files, parses frontmatter → metadata, keeps body as prompt. On `get_review_strategy`, MCP reads the repo config, intersects the repo's allowed strategy names with the available catalog, and returns matching prompt(s). If the repo has no config, fall back to a default strategy (e.g. `full-review`).

---

## 3. Language & Tooling

- **All source in TypeScript.** `refactor/` is a self-contained TS package with its own `package.json` and `tsconfig.json`.
- Modern `@modelcontextprotocol/sdk` (upgraded past `0.4.0`) for HTTP/SSE transport and shipped types.
- Dev via `tsx` (watch), build via `tsc`.
- Typed tool input schemas, shared domain types in `src/types/`.

---

## 4. Components & Structure

```
refactor/
  package.json
  tsconfig.json
  .env.example
  src/
    server.ts           # MCP server over HTTP/SSE + header-secret auth
    auth/
      github-app.ts     # App JWT → installation token (cached, short-lived)
    services/
      github.ts         # Octokit wrapper bound to a per-installation token
      strategy.ts       # loads strategies/*.md, parses frontmatter, resolves repo yaml
      config.ts         # env config + repo allowlist
    tools/
      get_review_strategy.ts
      get_pr_details.ts
      get_pr_files.ts
      get_pr_diff_range.ts
      get_file_content.ts
      post_pr_review.ts
      analyze_*.ts       # pure-data analysis tools (ported from legacy, typed)
      index.ts           # tool registry (definitions + handlers)
    types/
      index.ts           # Strategy, RepoConfig, PRRef, etc.
  strategies/
    security.md
    performance.md
    architecture.md
    full-review.md
    minimal.md
```

**Unit responsibilities (each has one clear job):**

- `github-app.ts` — mint and cache short-lived installation tokens from App ID + private key. Input: owner/repo. Output: a scoped Octokit-ready token.
- `strategy.ts` — parse the catalog, read a repo's `.github/review-config.yaml`, resolve to prompt(s). No GitHub write access.
- `github.ts` — thin Octokit wrapper: PR details, files, file content, diff range, post review. Constructed per request with an installation token.
- `config.ts` — env parsing (App ID, private key, header secret, repo allowlist, limits).
- each `tools/*.ts` — a typed MCP tool: schema + handler that composes the services above.

---

## 5. Tool Catalog

| Tool | Purpose | Notes |
|---|---|---|
| `get_review_strategy` | Resolve strategy prompt(s) for `{ owner, repo }` | Reads `.github/review-config.yaml`, intersects with catalog, returns prompt body(ies) |
| `get_pr_details` | PR metadata | Ported from legacy |
| `get_pr_files` | Files + patches for a PR | Ported |
| `get_pr_diff_range` | **New** — diff between `base_sha` → `head_sha` | Enables stateless follow-up reviews |
| `get_file_content` | File content at a ref | Ported |
| `post_pr_review` | Post review body + inline comments | Posts as GitHub App bot identity |
| `analyze_*` | Pure-data heuristics (security patterns, code patterns, deps, test coverage, etc.) | Ported, typed, return data only — no LLM reasoning |

---

## 6. Strategy File Format (skill-style frontmatter)

```markdown
---
name: security
description: Focused security vulnerability and input-validation review
triggers:
  - pr_with_secrets
  - dependency_changes
priority: 2
---

# Security Review Strategy

You are reviewing this PR for security issues...
[full prompt body returned to the n8n agent]
```

- **Frontmatter** = metadata (`name`, `description`, optional `triggers`, `priority`).
- **Body** = the review prompt returned to n8n's agent.

### Repo config (`.github/review-config.yaml`)

```yaml
strategies:
  - security
  - full-review
default: full-review
```

MCP intersects `strategies` with the available catalog. `default` is used when n8n asks without a specific strategy or the repo lists none.

---

## 7. Security Model

- **Transport auth:** header secret (Bearer/`x-api-key`) on the HTTP/SSE endpoint — carried over and hardened from the legacy `VALID_API_KEYS` model.
- **GitHub auth:** GitHub App. Fly.io secrets store `GITHUB_APP_ID` and `GITHUB_APP_PRIVATE_KEY` (and optional `GITHUB_WEBHOOK_SECRET` if webhooks ever hit MCP directly). Installation tokens are minted per request, short-lived, repo-scoped.
- **Repo allowlist:** MCP only operates on repos where the App is installed and (optionally) on an explicit allowlist in `config.ts`.
- **No broad PAT** stored anywhere. No LLM keys in MCP (model lives in n8n).

### Environment variables (`refactor/.env.example`)

| Var | Description |
|---|---|
| `GITHUB_APP_ID` | GitHub App ID |
| `GITHUB_APP_PRIVATE_KEY` | App private key (PEM) |
| `MCP_API_SECRET` | Header secret for transport auth |
| `REPO_ALLOWLIST` | Optional comma-separated `owner/repo` allowlist |
| `PORT` | Server port (default 3000) |
| `MAX_PATCH_SIZE` / `MAX_FILES_TO_REVIEW` / `REQUEST_TIMEOUT` | Limits (ported) |

---

## 8. Data Flow — Follow-up Review

1. n8n receives a "PR synchronized" (new push) webhook.
2. n8n recalls the last-reviewed SHA it stored for that PR.
3. n8n calls `get_pr_diff_range({ pr_url, base_sha: last_reviewed, head_sha: latest })`.
4. MCP returns only the changed diff for that range.
5. n8n's agent reviews the incremental changes, calls `post_pr_review`.
6. n8n stores the new head SHA as the latest reviewed.

MCP holds no state across calls.

---

## 9. Error Handling

- Invalid/missing header secret → 401.
- Repo not in allowlist / App not installed → clear error to n8n (surfaceable to Telegram).
- Repo config missing/malformed → fall back to `default` strategy, return a notice.
- GitHub API failure → structured error returned to the tool caller (no silent empty responses, unlike the legacy fallback-strategy loop).
- Strategy name requested that isn't in the catalog → error listing available strategies.

---

## 10. Testing

- Unit: `strategy.ts` frontmatter parsing + repo-config resolution (including fallback + intersection edge cases).
- Unit: `github-app.ts` token minting (mock JWT/installation), caching, expiry.
- Unit: each tool handler with a mocked `github.ts`.
- Integration: MCP server boots over HTTP/SSE, tool discovery returns the full catalog, a mocked end-to-end `get_review_strategy → get_pr_files → post_pr_review` sequence.

---

## 11. Out of Scope (YAGNI)

- MCP-side persistence / DB (n8n owns follow-up state).
- MCP-side LLM reasoning (n8n owns the model).
- Separate strategy-config microservice (catalog lives in-repo as markdown).
- Direct GitHub-webhook ingestion into MCP (n8n owns triggers).
- Deprecating or modifying the legacy root package.

---

## 12. Migration / Coexistence

- Legacy root package untouched; continues to run on Fly.io as-is until cutover.
- `refactor/` deploys as a separate build target (own Dockerfile or build script) when ready.
- Cutover is an n8n change: point the MCP Client node at the new HTTP/SSE endpoint.
