# Refactor Plan — Execution Checklist & Status

**Plan:** `docs/superpowers/specs/2026-07-03-mcp-review-refactor-plan.md`
**Design:** `docs/superpowers/specs/2026-07-03-mcp-review-refactor-design.md`
**Worktree branch:** `pi-agent-29ed8bbc-5769-4cf` (awaiting merge to `refactor/mcp-review-typescript` or `main`)
**Status source:** verified on disk 2026-07-03, NOT inferred from agent self-report.

Legend: ✅ done + green ✅   🟡 test red / stub ⏳   ⬜ not started

---

## Phase 0 — Package scaffold
- ✅ 0.1 Initialize TS package (`package.json`, `tsconfig.json`, deps, tsx, vitest, modern MCP SDK, `.gitignore`)
- ✅ 0.2 Shared types (`refactor/src/types/index.ts`)
- Gate: install ✓, typecheck ✓

## Phase 1 — Config & GitHub App auth
- ✅ 1.1 Config service (`services/config.ts`) — env parse, allowlist, secret masking — 10 tests pass
- ✅ 1.2 GitHub App token minting (`auth/github-app.ts`) — install tokens, cache+TTL
- Gate: tests green ✓

## Phase 2 — Strategy engine
- ✅ 2.1 Strategy catalog loader (`services/strategy.ts` load) — dup/malformed/empty guards
- ✅ 2.2 Seed 5 strategy files (`strategies/{security,performance,architecture,full-review,minimal}.md`)
- ✅ 2.3 Repo config resolution — intersect, fallback (default→full-review), unknown→error listing
- Gate: 32 strategy+config tests green ✓

## Phase 3 — GitHub service  ⚠️ BLOCKED (needs implementation)
- 🟡 3.1 Octokit wrapper (`services/github.ts`) — **RED tests only, `github.ts` is a 1-line stub.** 13 tests failing: "GitHubService is not a constructor". Need to implement: `getPRDetails`, `getPRFiles`, `getFileContent`, `getDiffRange`, `createReview`, `getRepoInfo`, `parsePRUrl`.
  → Next action: implement `github.ts` to green-up the existing tests (TDD green step).
- Gate: NOT met. ❌

## Phase 4 — Tools  ⬜
- ⬜ 4.1 Tool registry pattern (`tools/index.ts`)
- ⬜ 4.2 Individual tools (`get_review_strategy`, `get_pr_details`, `get_pr_files`, `get_pr_diff_range`, `get_file_content`, `post_pr_review`, `get_pr_commits`, `get_repo_info`, `analyze_*` ported data-only)
- Gate: each tool unit-tested with mocked services. ⬜

## Phase 5 — MCP server over HTTP/SSE  ⬜
- ⬜ 5.1 Server + transport (`server.ts`) — modern MCP SDK Streamable HTTP, header-secret auth, rate limit, `/health`, per-request install Octokit
- ⬜ 5.2 End-to-end integration test (get_review_strategy → get_pr_files → post_pr_review, mocked GitHub)
- Gate: server boots, discovery returns catalog, 401 on bad secret. ⬜

## Phase 6 — Packaging & docs  ⬜
- ⬜ 6.1 Deploy target (`refactor/Dockerfile`, `.env.example`, `.dockerignore`)
- ⬜ 6.2 README + repo-config sample (GitHub App setup, Fly secrets, n8n MCP Client wiring, sample `.github/review-config.yaml`)

---

## Resolved decisions (coding-time)
- Test runner: vitest ✓
- Port scope: ALL `analyze_*` + `get_pr_commits` + `get_repo_info` as data-only tools
- SDK: latest `@modelcontextprotocol/sdk`, verify Streamable HTTP transport at implementation

## Notes
- Phase 0–2 commits exist on the agent branch; Phase 3 tests committed but impl missing.
- `github.test.ts` is the spec — implement `github.ts` to satisfy it (TDD green).
- Do not trust agent summaries; re-verify each phase on disk before marking ✅.