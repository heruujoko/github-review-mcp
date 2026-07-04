# Implementation Plan: github-review-mcp `refactor/` (TypeScript, model-agnostic)

**Date:** 2026-07-03
**Design:** `docs/superpowers/specs/2026-07-03-mcp-review-refactor-design.md`
**Scope:** All work under `refactor/`. Legacy root package untouched.

Each step is ordered, independently testable, and lists its dependency + validation. Do not skip validation gates.

---

## Phase 0 — Package scaffold

### Step 0.1 — Initialize TS package
- **Do:** Create `refactor/package.json` (`"type": "module"`), `refactor/tsconfig.json` (NodeNext module resolution, `strict: true`, `outDir dist`), `.gitignore` additions for `refactor/dist`, `refactor/node_modules`.
- **Deps:** `@modelcontextprotocol/sdk` (latest, HTTP/SSE-capable), `@octokit/rest`, `@octokit/auth-app`, `express`, `express-rate-limit`, `gray-matter` (frontmatter), `js-yaml`, `dotenv`. Dev: `typescript`, `tsx`, `@types/node`, `@types/express`, `@types/js-yaml`, `vitest` (or `node:test`).
- **Scripts:** `dev` (tsx watch), `build` (tsc), `start` (node dist/server.js), `test`, `typecheck`.
- **Validate:** `pnpm --dir refactor install` succeeds; `pnpm --dir refactor typecheck` passes on an empty `src/server.ts` stub.
- **Depends on:** none.

### Step 0.2 — Shared types
- **Do:** `refactor/src/types/index.ts` — `PRRef` (`{ owner, repo, pull_number }`), `Strategy` (`{ name, description, triggers?, priority?, body }`), `RepoConfig` (`{ strategies: string[]; default?: string }`), tool result envelope types.
- **Validate:** `typecheck` passes.
- **Depends on:** 0.1.

---

## Phase 1 — Config & GitHub App auth (the foundation)

### Step 1.1 — Config service
- **Do:** `refactor/src/services/config.ts` — parse env: `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `MCP_API_SECRET`, `REPO_ALLOWLIST` (comma-split), `PORT`, `MAX_PATCH_SIZE`, `MAX_FILES_TO_REVIEW`, `REQUEST_TIMEOUT`. Provide `isRepoAllowed(owner, repo)`. Validate required vars, mask secrets in any debug output.
- **Validate:** unit test — missing required var throws; allowlist matching works (empty allowlist = allow all installed repos); secrets masked.
- **Depends on:** 0.2.

### Step 1.2 — GitHub App token minting
- **Do:** `refactor/src/auth/github-app.ts` — using `@octokit/auth-app`, mint short-lived installation tokens for `{ owner, repo }`. Cache tokens by installation with expiry (refresh before expiry). Expose `getInstallationOctokit(owner, repo)`.
- **Validate:** unit test with mocked auth — returns an Octokit-ready token; cache returns same token within TTL; refreshes after expiry; unknown installation surfaces a clear error.
- **Depends on:** 1.1.

---

## Phase 2 — Strategy engine

### Step 2.1 — Strategy catalog loader
- **Do:** `refactor/src/services/strategy.ts` — load `refactor/strategies/*.md`, parse with `gray-matter` into `Strategy` (frontmatter → metadata, body → prompt). Build a name→Strategy map. Cache on first load.
- **Validate:** unit test with fixture `.md` files — parses frontmatter + body; duplicate names error; malformed frontmatter surfaces a clear error.
- **Depends on:** 0.2.

### Step 2.2 — Seed strategy files
- **Do:** Create `refactor/strategies/{security,performance,architecture,full-review,minimal}.md` with skill-style frontmatter + prompt bodies (port review guidance from legacy `get_review_prompts.js`, split by concern).
- **Validate:** loader (2.1) loads all five; each has non-empty `name`, `description`, `body`.
- **Depends on:** 2.1.

### Step 2.3 — Repo config resolution
- **Do:** In `strategy.ts`, add `resolveForRepo(octokit, owner, repo)` — fetch `.github/review-config.yaml` via GitHub, parse with `js-yaml` into `RepoConfig`, intersect `strategies` with catalog, return resolved `Strategy[]`. Missing/malformed config → fall back to `default` (or `full-review`) with a notice. Requested-but-absent strategy → error listing available.
- **Validate:** unit tests — intersection logic; missing-config fallback; malformed-yaml fallback + notice; unknown-strategy error.
- **Depends on:** 2.1, 2.2, 1.2 (needs octokit to read the file).

---

## Phase 3 — GitHub service

### Step 3.1 — Octokit wrapper
- **Do:** `refactor/src/services/github.ts` — bound to an installation Octokit: `getPRDetails`, `getPRFiles`, `getFileContent`, `getDiffRange(base_sha, head_sha)` (via compare API), `createReview(body, event, comments[])`. Port + type from legacy `services/github.js`. Add `parsePRUrl`.
- **Validate:** unit tests with mocked Octokit for each method incl. `getDiffRange` (compare commits) and inline-comment mapping in `createReview`.
- **Depends on:** 1.2, 0.2.

---

## Phase 4 — Tools

### Step 4.1 — Tool registry pattern
- **Do:** `refactor/src/tools/index.ts` — typed registry: each tool exports `{ definition, handler }`; index aggregates `toolDefinitions` + `toolHandlers`. Handler signature receives resolved services (github, strategy, config) + typed args.
- **Validate:** typecheck; registry lists all tools; unknown tool lookup returns undefined.
- **Depends on:** 3.1, 2.3.

### Step 4.2 — Individual tools
- **Do:** Implement each in `refactor/src/tools/`:
  - `get_review_strategy` → `strategy.resolveForRepo`
  - `get_pr_details`, `get_pr_files`, `get_file_content`, `post_pr_review` → `github.ts`
  - `get_pr_diff_range` → `github.getDiffRange`
  - `analyze_*` → port pure-data analysis tools from legacy (typed, data-only)
- **Validate:** unit test each handler with mocked services; `get_pr_diff_range` returns range diff; `post_pr_review` maps inline comments; allowlist enforced before any GitHub call.
- **Depends on:** 4.1.

---

## Phase 5 — MCP server over HTTP/SSE

### Step 5.1 — Server + transport
- **Do:** `refactor/src/server.ts` — instantiate MCP `Server` with the modern SDK, register `ListTools` + `CallTool` from the registry, expose over HTTP/SSE (Streamable HTTP transport). Wrap in Express: header-secret auth middleware (`MCP_API_SECRET`), rate limiting, `/health`. Construct per-request installation Octokit via `github-app.ts` from tool args (owner/repo or parsed PR URL).
- **Validate:** boot server; `/health` OK; MCP tool discovery over HTTP returns full catalog; unauthorized request → 401.
- **Depends on:** 4.2, 1.1.

### Step 5.2 — End-to-end integration test
- **Do:** Integration test — boot server, connect an MCP client over HTTP, run `get_review_strategy → get_pr_files → post_pr_review` against mocked GitHub. Assert bot-identity posting path and stateless follow-up via `get_pr_diff_range`.
- **Validate:** full sequence passes; no persisted state between calls.
- **Depends on:** 5.1.

---

## Phase 6 — Packaging & docs

### Step 6.1 — Deploy target
- **Do:** `refactor/Dockerfile` (multi-stage TS build → `node dist/server.js`), `refactor/.env.example`, `refactor/.dockerignore`.
- **Validate:** `docker build refactor/` succeeds; container serves `/health`.
- **Depends on:** 5.1.

### Step 6.2 — README + repo-config sample
- **Do:** `refactor/README.md` — GitHub App setup steps (permissions: Pull requests R/W, Contents R, Metadata R; install on target repos), Fly.io secrets, n8n MCP Client wiring. Include a sample `.github/review-config.yaml`.
- **Validate:** a reviewer can follow setup end-to-end without gaps.
- **Depends on:** 6.1.

---

## Dependency graph (summary)

```
0.1 → 0.2 → {1.1 → 1.2 → 3.1, 2.1 → 2.2 → 2.3}
2.3 needs 1.2 ; 3.1 + 2.3 → 4.1 → 4.2 → 5.1 → 5.2 → 6.1 → 6.2
```

## Global validation gates
- `typecheck` + `test` green after every phase.
- No secrets logged; no PAT anywhere; no LLM key in `refactor/`.
- Legacy root package unmodified throughout.

## Open items to confirm before coding
- SDK package/version for HTTP/SSE transport (verify latest `@modelcontextprotocol/sdk` HTTP transport API at implementation time).
- Test runner choice: `vitest` vs `node:test` (plan assumes either; pick at 0.1).
- Which legacy `analyze_*` tools to port vs drop (default: port all as data-only).
