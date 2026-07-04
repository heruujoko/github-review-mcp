/**
 * Tool registry aggregator.
 *
 * Re-exports the registry primitives and provides `registerAllTools()` which
 * calls each individual tool module's `register()` function.
 *
 * The server calls `registerAllTools()` once at boot; tests call
 * `resetRegistry()` + `registerAllTools()` before each test run.
 */

export {
  registerTool,
  getTool,
  toolDefinitions,
  resetRegistry,
} from './registry.js';
export type { ToolHandler, ToolEntry } from './registry.js';

import { resetRegistry } from './registry.js';

import { registerGetReviewStrategy } from './get_review_strategy.js';
import { registerGetPRDetails } from './get_pr_details.js';
import { registerGetPRFiles } from './get_pr_files.js';
import { registerGetPRCommits } from './get_pr_commits.js';
import { registerGetFileContent } from './get_file_content.js';
import { registerGetRepoInfo } from './get_repo_info.js';
import { registerGetPRDiffRange } from './get_pr_diff_range.js';
import { registerPostPRReview } from './post_pr_review.js';
import { registerAnalyzeCodeQuality } from './analyze_code_quality.js';
import { registerAnalyzeDiffImpact } from './analyze_diff_impact.js';
import { registerAnalyzeDependencies } from './analyze_dependencies.js';
import { registerAnalyzeTestCoverage } from './analyze_test_coverage.js';
import { registerDetectSecurityIssues } from './detect_security_issues.js';
import { registerDetectCodePatterns } from './detect_code_patterns.js';

/**
 * Register every tool. Safe to call after `resetRegistry()`.
 */
export function registerAllTools(): void {
  resetRegistry();
  registerGetReviewStrategy();
  registerGetPRDetails();
  registerGetPRFiles();
  registerGetPRCommits();
  registerGetFileContent();
  registerGetRepoInfo();
  registerGetPRDiffRange();
  registerPostPRReview();
  registerAnalyzeCodeQuality();
  registerAnalyzeDiffImpact();
  registerAnalyzeDependencies();
  registerAnalyzeTestCoverage();
  registerDetectSecurityIssues();
  registerDetectCodePatterns();
}
