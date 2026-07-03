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

## Phase 3 — GitHub service
- ✅ 3.1 Octokit wrapper (`services/github.ts`) — committed `5f96cb7`; parseURL, getPRDetails/Files/Commits, getFileContent, getDiffRange (compare API), createReview (inline comment mapping), getRepoInfo. 13 tests pass.
- Gate: green ✓ (verified 2026-07-03 via `pnpm vitest run --exclude '**/core.tools.test.ts'` → 50 passed)

## Phase 4 — Tools
- ✅ 4.1 Tool registry pattern (`tools/index.ts`) — committed `866ed60`; registerTool/getTool/toolDefinitions/resetRegistry + index.test.ts pass.
- ✅ 4.2 Individual tools — implemented and green. `shared.ts` centralizes allowlist, GitHub service construction, and ToolResult envelopes. `tools/registry.ts` owns registry primitives; `tools/index.ts` aggregates and registers all tools. Implemented: `get_review_strategy`, `get_pr_details`, `get_pr_files`, `get_pr_commits`, `get_file_content`, `get_repo_info`, `get_pr_diff_range`, `post_pr_review`, `analyze_code_quality`, `analyze_diff_impact`, `analyze_dependencies`, `analyze_test_coverage`, `detect_security_issues`, `detect_code_patterns`. Data-only analysis heuristics live in `services/analysis.ts`.
- Gate: green ✅ verified 2026-07-04 via `cd refactor && pnpm typecheck && pnpm test` → 57 tests passed.

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