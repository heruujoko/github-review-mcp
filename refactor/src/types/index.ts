/**
 * Shared domain types for the MCP review server.
 *
 * One responsibility per file is the rule across `src/`, but shared domain
 * types live here so services and tools can reference them without circular
 * imports.
 */

/**
 * A reference to a GitHub Pull Request, parsed from a PR URL or assembled
 * directly by the caller.
 */
export interface PRRef {
  /** Repository owner (user or organization login). */
  owner: string;
  /** Repository name. */
  repo: string;
  /** Pull request number. */
  pull_number: number;
}

/**
 * A reference to a GitHub repository.
 */
export interface RepoRef {
  owner: string;
  repo: string;
}

/**
 * A review strategy loaded from `refactor/strategies/*.md`.
 *
 * Frontmatter becomes metadata, the Markdown body becomes the prompt text
 * returned to n8n's agent.
 */
export interface Strategy {
  /** Strategy name; must match the catalog file basename. */
  name: string;
  /** Short human-readable description of what the strategy focuses on. */
  description: string;
  /** Optional trigger hints (e.g. `pr_with_secrets`). */
  triggers?: string[];
  /** Optional priority; lower number = higher priority. */
  priority?: number;
  /** The prompt body returned to the n8n agent. */
  body: string;
}

/**
 * Per-repo configuration read from `.github/review-config.yaml`.
 */
export interface RepoConfig {
  /** Allowed/preferred strategy names from the catalog. */
  strategies: string[];
  /** Fallback strategy name when none is requested or none are listed. */
  default?: string;
}

/**
 * Result of resolving strategies for a repository.
 */
export interface ResolvedStrategies {
  /** The matched strategies in catalog order. */
  strategies: Strategy[];
  /** A human-readable notice (fallback, missing config, etc.). */
  notice?: string;
}

/**
 * A file changed in a pull request, mirroring the legacy shape.
 */
export interface PRFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  /** Unified diff patch; may be omitted for binary/large files. */
  patch?: string;
  blob_url?: string;
}

/**
 * Commit info embedded in PR details.
 */
export interface PRCommit {
  sha: string;
  message: string;
  author: string;
  date: string;
}

/**
 * Existing review on a PR.
 */
export interface ExistingReview {
  id: number;
  user: string;
  state: string;
  body: string | null;
  submitted_at: string | null;
}

/**
 * Compact PR metadata returned by `get_pr_details`.
 */
export interface PRDetails {
  pr: {
    id: number;
    number: number;
    title: string;
    body: string | null;
    state: string;
    author: string;
    created_at: string;
    updated_at: string;
    base_branch: string;
    head_branch: string;
    mergeable: boolean | null;
    additions: number;
    deletions: number;
    changed_files: number;
  };
  files: PRFile[];
  commits: PRCommit[];
  existing_reviews: ExistingReview[];
  repository: {
    owner: string;
    repo: string;
    full_name: string;
  };
}

/**
 * A file entry in a compare/diff-range result.
 */
export interface DiffFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
  blob_url?: string;
}

/**
 * Result of `get_pr_diff_range`.
 */
export interface DiffRange {
  /** Base commit SHA the comparison starts from. */
  base_sha: string;
  /** Head commit SHA the comparison ends at. */
  head_sha: string;
  /** Total commits in the range. */
  total_commits: number;
  /** Total files changed in the range. */
  total_files: number;
  /** Files with patches. */
  files: DiffFile[];
}

/**
 * An inline review comment to post on a PR.
 */
export interface InlineComment {
  /** File path (relative to repo root). */
  path: string;
  /** Line number to comment on. */
  line: number;
  /** Comment body (Markdown). */
  body: string;
  /** Optional starting line for multi-line comments. */
  start_line?: number;
  /** Which side of the diff: LEFT (base) or RIGHT (head). */
  side?: 'LEFT' | 'RIGHT';
}

/**
 * A review to post on a PR.
 */
export interface ReviewInput {
  /** Review body (Markdown). */
  body: string;
  /** Review event type. */
  event?: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT';
  /** Inline line-specific comments. */
  comments?: InlineComment[];
}

/**
 * Result of posting a review.
 */
export interface ReviewResult {
  success: boolean;
  review_id: number;
  review_url: string;
}

/**
 * Repository info result.
 */
export interface RepoInfo {
  owner: string;
  repo: string;
  full_name: string;
  languages: Record<string, number>;
  primary_language: string;
  has_readme: boolean;
  readme_content: string | null;
}

/**
 * A text content block returned by MCP tool handlers.
 */
export interface TextContent {
  type: 'text';
  text: string;
}

/**
 * MCP tool result envelope (content blocks + isError flag).
 */
export interface ToolResult {
  content: TextContent[];
  isError?: boolean;
}

/**
 * A JSON Schema for a tool's input parameters (MCP tool definition shape).
 */
export interface ToolInputSchema {
  type: 'object';
  properties?: Record<string, unknown>;
  required?: string[];
  [key: string]: unknown;
}

/**
 * A registered MCP tool definition.
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
}

/**
 * Contract for the config service (implemented in `services/config.ts`).
 */
export interface IConfigService {
  readonly githubAppId: string;
  readonly githubAppPrivateKey: string;
  readonly mcpApiSecret: string;
  readonly port: number;
  readonly maxPatchSize: number;
  readonly maxFilesToReview: number;
  readonly requestTimeout: number;
  /** Returns true when no allowlist is set (allow all installed repos). */
  isRepoAllowed(owner: string, repo: string): boolean;
  /** Safe-to-log object with secrets masked. */
  toDebugObject(): Record<string, string | number | boolean | undefined>;
}

/**
 * Contract for the GitHub App auth module (implemented in `auth/github-app.ts`).
 */
export interface IGitHubAppAuth {
  /** Returns an installation-scoped Octokit for {owner,repo}. */
  getInstallationOctokit(owner: string, repo: string): Promise<unknown>;
  /** Clears cached tokens (used in tests). */
  clearCache(): void;
}

/**
 * Contract for the GitHub Octokit wrapper (implemented in `services/github.ts`).
 */
export interface IGitHubService {
  getPRDetails(pr_url: string): Promise<PRDetails>;
  getPRFiles(pr_url: string, include_patch?: boolean): Promise<PRFile[]>;
  getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<string | null>;
  getPRCommits(pr_url: string): Promise<PRCommit[]>;
  getDiffRange(owner: string, repo: string, base_sha: string, head_sha: string): Promise<DiffRange>;
  createReview(owner: string, repo: string, pull_number: number, review: ReviewInput): Promise<ReviewResult>;
  getRepoInfo(owner: string, repo: string): Promise<RepoInfo>;
  parsePRURL(url: string): PRRef;
}

/**
 * Contract for the strategy service (implemented in `services/strategy.ts`).
 */
export interface IStrategyService {
  /** All catalog strategies keyed by name. */
  getCatalog(): Map<string, Strategy>;
  /** Resolve strategies for a repo against its `.github/review-config.yaml`. */
  resolveForRepo(
    octokit: unknown,
    owner: string,
    repo: string,
    requested?: string,
  ): Promise<ResolvedStrategies>;
}

/**
 * Shared service bundle passed to tool handlers.
 */
export interface ToolServices {
  /** Resolved application configuration. */
  config: IConfigService;
  /** GitHub App token minter / installation Octokit factory. */
  githubApp: IGitHubAppAuth;
  /** Strategy catalog + repo-config resolver. */
  strategy: IStrategyService;
}