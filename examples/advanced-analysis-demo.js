#!/usr/bin/env node

/**
 * Advanced Analysis Demo
 * 
 * This script demonstrates how to use the enhanced GitHub MCP server
 * with all the new analysis tools for comprehensive code review.
 * 
 * Usage: node examples/advanced-analysis-demo.js <PR_URL>
 */

import { GitHubService } from '../src/services/github.js';
import { AnalysisService } from '../src/services/analysis.js';
import { ConfigService } from '../src/services/config.js';

async function demonstrateAnalysis(prUrl) {
  console.log('🚀 GitHub MCP Advanced Analysis Demo');
  console.log('=====================================\n');

  try {
    // Initialize services
    const config = new ConfigService();
    const github = new GitHubService(config.get('GITHUB_TOKEN'));
    const analysis = new AnalysisService();

    console.log('📥 Fetching PR details...');
    const prDetails = await github.getPRDetails(prUrl);
    
    console.log(`✅ PR: ${prDetails.pr.title}`);
    console.log(`   Author: ${prDetails.pr.author}`);
    console.log(`   Files changed: ${prDetails.pr.changed_files}`);
    console.log(`   +${prDetails.pr.additions} -${prDetails.pr.deletions}\n`);

    // Code Quality Analysis
    console.log('📊 Analyzing code quality...');
    const qualityAnalysis = await analysis.analyzeCodeQuality(prDetails);
    console.log(`   Overall Score: ${qualityAnalysis.overall_score}/100`);
    console.log(`   High complexity files: ${qualityAnalysis.summary.high_complexity_files.length}`);
    console.log(`   Technical debt issues: ${qualityAnalysis.summary.code_smells.length}\n`);

    // Security Analysis
    console.log('🛡️ Scanning for security issues...');
    const securityAnalysis = await analysis.detectSecurityIssues(prDetails);
    console.log(`   Security Score: ${securityAnalysis.security_score}/100`);
    console.log(`   Vulnerabilities found: ${securityAnalysis.vulnerabilities.length}`);
    console.log(`   Security warnings: ${securityAnalysis.warnings.length}\n`);

    // Impact Analysis
    console.log('⚡ Assessing change impact...');
    const impactAnalysis = await analysis.analyzeDiffImpact(prDetails);
    console.log(`   Risk Level: ${impactAnalysis.overall_risk}`);
    console.log(`   Breaking changes: ${impactAnalysis.impact_categories.breaking_changes.length}`);
    console.log(`   Security-sensitive files: ${impactAnalysis.impact_categories.security_sensitive.length}\n`);

    // Pattern Detection
    console.log('🏗️ Detecting code patterns...');
    const patternAnalysis = await analysis.detectCodePatterns(prDetails);
    console.log(`   Anti-patterns found: ${patternAnalysis.patterns_found.anti_patterns.length}`);
    console.log(`   Good patterns: ${patternAnalysis.patterns_found.good_patterns.length}`);
    console.log(`   Primary language: ${patternAnalysis.language}\n`);

    // Dependency Analysis
    console.log('📦 Analyzing dependencies...');
    const dependencyAnalysis = await analysis.analyzeDependencies(prDetails);
    console.log(`   Dependencies added: ${dependencyAnalysis.dependency_changes.added.length}`);
    console.log(`   Dependencies removed: ${dependencyAnalysis.dependency_changes.removed.length}`);
    console.log(`   Dependencies updated: ${dependencyAnalysis.dependency_changes.updated.length}\n`);

    // Test Coverage Analysis
    console.log('🧪 Analyzing test coverage...');
    const testAnalysis = await analysis.analyzeTestCoverage(prDetails);
    console.log(`   Estimated coverage: ${testAnalysis.coverage_estimate}%`);
    console.log(`   Test files: ${testAnalysis.test_files.length}`);
    console.log(`   Missing tests: ${testAnalysis.missing_tests.length}\n`);

    // Generate Summary Report
    console.log('📋 ANALYSIS SUMMARY REPORT');
    console.log('==========================');
    console.log(`
🎯 Overall Assessment:
   Quality Score: ${qualityAnalysis.overall_score}/100
   Security Score: ${securityAnalysis.security_score}/100
   Risk Level: ${impactAnalysis.overall_risk}
   Test Coverage: ${testAnalysis.coverage_estimate}%

🔍 Key Findings:
   ${securityAnalysis.vulnerabilities.length > 0 ? '⚠️' : '✅'} Security: ${securityAnalysis.vulnerabilities.length} vulnerabilities
   ${qualityAnalysis.summary.high_complexity_files.length > 0 ? '⚠️' : '✅'} Complexity: ${qualityAnalysis.summary.high_complexity_files.length} high complexity files
   ${testAnalysis.missing_tests.length > 0 ? '⚠️' : '✅'} Testing: ${testAnalysis.missing_tests.length} files missing tests
   ${patternAnalysis.patterns_found.anti_patterns.length > 0 ? '⚠️' : '✅'} Patterns: ${patternAnalysis.patterns_found.anti_patterns.length} anti-patterns detected

💡 Recommendations:
   ${qualityAnalysis.summary.recommendations.slice(0, 2).map(r => `- ${r}`).join('\n   ')}
   ${impactAnalysis.recommendations.slice(0, 2).map(r => `- ${r}`).join('\n   ')}
`);

    // If there are specific files to analyze, generate suggestions
    if (prDetails.files.length > 0) {
      const firstFile = prDetails.files[0];
      console.log(`🔧 Generating suggestions for: ${firstFile.filename}`);
      
      try {
        const suggestions = await analysis.generateSuggestions(
          prDetails, 
          firstFile.filename, 
          ['security', 'maintainability']
        );
        
        if (suggestions.priority_suggestions.length > 0) {
          console.log('   Top suggestions:');
          suggestions.priority_suggestions.slice(0, 3).forEach((suggestion, i) => {
            console.log(`   ${i + 1}. ${suggestion.description} (${suggestion.priority})`);
          });
        }
      } catch (error) {
        console.log(`   Unable to generate suggestions: ${error.message}`);
      }
    }

    console.log('\n✨ Analysis complete! Use these insights for comprehensive code review.');

  } catch (error) {
    console.error('❌ Error during analysis:', error.message);
    process.exit(1);
  }
}

// Main execution
const prUrl = process.argv[2];
if (!prUrl) {
  console.error('Usage: node examples/advanced-analysis-demo.js <PR_URL>');
  console.error('Example: node examples/advanced-analysis-demo.js https://github.com/owner/repo/pull/123');
  process.exit(1);
}

demonstrateAnalysis(prUrl);
