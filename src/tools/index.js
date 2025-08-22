/**
 * MCP Tools Index
 * 
 * This file exports all available MCP tools for the GitHub Review Server.
 * Each tool includes its definition and handler function.
 */

// Import all tool definitions and handlers
import { getPRDetailsToolDefinition, handleGetPRDetails } from './get_pr_details.js';
import { getPRFilesToolDefinition, handleGetPRFiles } from './get_pr_files.js';
import { getPRCommitsToolDefinition, handleGetPRCommits } from './get_pr_commits.js';
import { getFileContentToolDefinition, handleGetFileContent } from './get_file_content.js';
import { postPRReviewToolDefinition, handlePostPRReview } from './post_pr_review.js';
import { getRepoInfoToolDefinition, handleGetRepoInfo } from './get_repo_info.js';
import { getReviewPromptsToolDefinition, handleGetReviewPrompts } from './get_review_prompts.js';
import { analyzeCodeQualityToolDefinition, handleAnalyzeCodeQuality } from './analyze_code_quality.js';
import { analyzeDiffImpactToolDefinition, handleAnalyzeDiffImpact } from './analyze_diff_impact.js';
import { detectSecurityIssuesToolDefinition, handleDetectSecurityIssues } from './detect_security_issues.js';
import { detectCodePatternsToolDefinition, handleDetectCodePatterns } from './detect_code_patterns.js';
import { analyzeDependenciesToolDefinition, handleAnalyzeDependencies } from './analyze_dependencies.js';
import { analyzeTestCoverageToolDefinition, handleAnalyzeTestCoverage } from './analyze_test_coverage.js';
import { generateSuggestionsToolDefinition, handleGenerateSuggestions } from './generate_suggestions.js';

// Export all tool definitions
export const toolDefinitions = [
  getPRDetailsToolDefinition,
  getPRFilesToolDefinition,
  getPRCommitsToolDefinition,
  getFileContentToolDefinition,
  postPRReviewToolDefinition,
  getRepoInfoToolDefinition,
  getReviewPromptsToolDefinition,
  analyzeCodeQualityToolDefinition,
  analyzeDiffImpactToolDefinition,
  detectSecurityIssuesToolDefinition,
  detectCodePatternsToolDefinition,
  analyzeDependenciesToolDefinition,
  analyzeTestCoverageToolDefinition,
  generateSuggestionsToolDefinition,
];

// Export all tool handlers
export const toolHandlers = {
  get_pr_details: handleGetPRDetails,
  get_pr_files: handleGetPRFiles,
  get_pr_commits: handleGetPRCommits,
  get_file_content: handleGetFileContent,
  post_pr_review: handlePostPRReview,
  get_repo_info: handleGetRepoInfo,
  get_review_prompts: handleGetReviewPrompts,
  analyze_code_quality: handleAnalyzeCodeQuality,
  analyze_diff_impact: handleAnalyzeDiffImpact,
  detect_security_issues: handleDetectSecurityIssues,
  detect_code_patterns: handleDetectCodePatterns,
  analyze_dependencies: handleAnalyzeDependencies,
  analyze_test_coverage: handleAnalyzeTestCoverage,
  generate_suggestions: handleGenerateSuggestions,
};

// Helper function to get tool definition by name
export function getToolDefinition(toolName) {
  return toolDefinitions.find(tool => tool.name === toolName);
}

// Helper function to get tool handler by name
export function getToolHandler(toolName) {
  return toolHandlers[toolName];
}

// Export individual tools for convenience
export {
  getPRDetailsToolDefinition,
  handleGetPRDetails,
  getPRFilesToolDefinition,
  handleGetPRFiles,
  getPRCommitsToolDefinition,
  handleGetPRCommits,
  getFileContentToolDefinition,
  handleGetFileContent,
  postPRReviewToolDefinition,
  handlePostPRReview,
  getRepoInfoToolDefinition,
  handleGetRepoInfo,
  getReviewPromptsToolDefinition,
  handleGetReviewPrompts,
  analyzeCodeQualityToolDefinition,
  handleAnalyzeCodeQuality,
  analyzeDiffImpactToolDefinition,
  handleAnalyzeDiffImpact,
  detectSecurityIssuesToolDefinition,
  handleDetectSecurityIssues,
  detectCodePatternsToolDefinition,
  handleDetectCodePatterns,
  analyzeDependenciesToolDefinition,
  handleAnalyzeDependencies,
  analyzeTestCoverageToolDefinition,
  handleAnalyzeTestCoverage,
  generateSuggestionsToolDefinition,
  handleGenerateSuggestions,
};
