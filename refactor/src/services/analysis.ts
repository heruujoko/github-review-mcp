/**
 * AnalysisService — data-only heuristic analysis of PR changes.
 *
 * Ported faithfully from the legacy `src/services/analysis.js`, but strictly
 * DATA-ONLY: no LLM, no network. Every method derives structured findings
 * from PR file patches using regexes and simple math, so tool handlers can
 * return objective signal for an external agent to reason over.
 *
 * The service is stateless beyond its precomputed pattern tables, so tool
 * handlers may freely `new AnalysisService()` per call.
 */

import type { PRDetails, PRFile } from '../types/index.js';

type Severity = 'critical' | 'high' | 'medium' | 'low';

export interface FileQuality {
  filename: string;
  language: string;
  metrics: {
    cyclomatic_complexity: number;
    lines_of_code: number;
    maintainability_index: number;
    technical_debt_ratio: number;
  };
  issues: Array<{ type: string; severity: string; description: string }>;
  suggestions: Array<{ type: string; description: string; priority: string }>;
}

export interface CodeQualityResult {
  overall_score: number;
  files: FileQuality[];
  summary: {
    high_complexity_files: Array<{ filename: string; complexity: number }>;
    maintainability_issues: Array<{ filename: string; score: number }>;
    code_smells: Array<{ filename: string; debt_ratio: number }>;
    recommendations: string[];
  };
}

export interface DiffImpactResult {
  overall_risk: 'LOW' | 'MEDIUM' | 'HIGH';
  impact_categories: Record<string, string[]>;
  risk_factors: string[];
  affected_areas: string[];
  recommendations: string[];
}

export interface SecurityResult {
  security_score: number;
  vulnerabilities: Array<{
    type: string;
    file: string;
    severity: Severity;
    description: string;
  }>;
  warnings: unknown[];
  best_practices: unknown[];
  compliance_issues: unknown[];
}

export interface CodePatternsResult {
  patterns_found: {
    good_patterns: Array<{ name: string; file: string; description: string }>;
    anti_patterns: Array<{ name: string; file: string; description: string }>;
    architectural_issues: unknown[];
    design_patterns: unknown[];
  };
  recommendations: string[];
  language: string;
}

export interface DependenciesResult {
  dependency_changes: {
    added: unknown[];
    removed: unknown[];
    updated: unknown[];
    security_issues: unknown[];
  };
  impact_assessment: {
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
    compatibility_issues: unknown[];
    security_implications: unknown[];
    performance_impact: unknown[];
  };
  recommendations: string[];
}

export interface TestCoverageResult {
  coverage_estimate: number;
  test_files: PRFile[];
  production_files: PRFile[];
  missing_tests: Array<{ filename: string; suggested_test_file: string }>;
  test_quality: {
    unit_tests: number;
    integration_tests: number;
    edge_cases: number;
  };
  recommendations: string[];
}

const SECURITY_PATTERNS: Record<string, RegExp[]> = {
  sql_injection: [/query\s*\+.*\+/gi, /execute\s*\(.*\+.*\)/gi, /SELECT.*\+.*FROM/gi],
  xss: [/innerHTML\s*=.*\+/gi, /document\.write\s*\(/gi, /\.html\s*\(.*\+/gi],
  hardcoded_secrets: [
    /password\s*=\s*["'][^"']+["']/gi,
    /api_key\s*=\s*["'][^"']+["']/gi,
    /secret\s*=\s*["'][^"']+["']/gi,
    /token\s*=\s*["'][^"']+["']/gi,
  ],
  insecure_random: [/Math\.random\(\)/gi, /rand\(\)/gi],
  eval_usage: [/eval\s*\(/gi, /exec\s*\(/gi, /setTimeout\s*\(.*string/gi],
};

interface NamedPattern {
  name: string;
  pattern: RegExp;
  description: string;
}

const ANTI_PATTERNS: NamedPattern[] = [
  { name: 'God Object', pattern: /class\s+\w+[\s\S]{1000,}/gi, description: 'Large classes that do too much' },
  { name: 'Magic Numbers', pattern: /[^.\w]\d{2,}[^.\w]/g, description: 'Hardcoded numeric values without explanation' },
  { name: 'Long Parameter List', pattern: /function\s+\w+\s*\([^)]{80,}\)/gi, description: 'Functions with too many parameters' },
];

const GOOD_PATTERNS: NamedPattern[] = [
  { name: 'Single Responsibility', pattern: /class\s+\w+[\s\S]{50,200}/gi, description: 'Appropriately sized classes' },
  { name: 'Constants Usage', pattern: /const\s+[A-Z_]+\s*=/gi, description: 'Use of constants instead of magic numbers' },
];

const DEPENDENCY_PACKAGE_FILES = [
  'package.json',
  'requirements.txt',
  'Gemfile',
  'pom.xml',
  'Cargo.toml',
  'go.mod',
  'composer.json',
];
const DEPENDENCY_LOCK_FILES = [
  'package-lock.json',
  'yarn.lock',
  'Pipfile.lock',
  'Gemfile.lock',
  'Cargo.lock',
  'go.sum',
];

export class AnalysisService {
  analyzeCodeQuality(prDetails: PRDetails, filePaths: string[] | null = null): CodeQualityResult {
    const files: FileQuality[] = [];
    for (const file of prDetails.files) {
      if (filePaths && !filePaths.includes(file.filename)) continue;
      files.push(this.analyzeFileQuality(file));
    }
    return {
      overall_score: this.calculateOverallScore(files),
      files,
      summary: this.generateQualitySummary(files),
    };
  }

  private analyzeFileQuality(file: PRFile): FileQuality {
    const language = this.detectLanguage(file.filename);
    const analysis: FileQuality = {
      filename: file.filename,
      language,
      metrics: {
        cyclomatic_complexity: 0,
        lines_of_code: 0,
        maintainability_index: 0,
        technical_debt_ratio: 0,
      },
      issues: [],
      suggestions: [],
    };
    if (!file.patch) return analysis;

    const lines = file.patch.split('\n');
    const addedLines = lines.filter((l) => l.startsWith('+')).slice(1);

    analysis.metrics.lines_of_code = addedLines.length;
    analysis.metrics.cyclomatic_complexity = this.calculateComplexity(addedLines, language);
    analysis.metrics.maintainability_index = this.calculateMaintainabilityIndex(addedLines, language);
    analysis.metrics.technical_debt_ratio = this.calculateTechnicalDebt(addedLines);
    analysis.issues = this.detectCodeIssues(addedLines);
    analysis.suggestions = this.generateCodeSuggestions(addedLines, language);
    return analysis;
  }

  analyzeDiffImpact(prDetails: PRDetails): DiffImpactResult {
    const analysis: DiffImpactResult = {
      overall_risk: 'LOW',
      impact_categories: {
        breaking_changes: [],
        api_changes: [],
        database_changes: [],
        configuration_changes: [],
        security_sensitive: [],
        performance_critical: [],
      },
      risk_factors: [],
      affected_areas: [],
      recommendations: [],
    };
    for (const file of prDetails.files) {
      this.mergeImpactAnalysis(analysis, this.analyzeFileImpact(file));
    }
    analysis.overall_risk = this.calculateOverallRisk(analysis);
    analysis.recommendations = this.generateImpactRecommendations(analysis);
    return analysis;
  }

  detectSecurityIssues(prDetails: PRDetails): SecurityResult {
    const analysis: SecurityResult = {
      security_score: 100,
      vulnerabilities: [],
      warnings: [],
      best_practices: [],
      compliance_issues: [],
    };
    for (const file of prDetails.files) {
      if (!file.patch) continue;
      analysis.vulnerabilities.push(...this.scanFileForSecurity(file));
    }
    analysis.security_score = this.calculateSecurityScore(analysis);
    return analysis;
  }

  detectCodePatterns(prDetails: PRDetails, language: string | null = null): CodePatternsResult {
    const analysis: CodePatternsResult = {
      patterns_found: {
        good_patterns: [],
        anti_patterns: [],
        architectural_issues: [],
        design_patterns: [],
      },
      recommendations: [],
      language: language ?? this.detectPrimaryLanguage(prDetails.files),
    };
    for (const file of prDetails.files) {
      if (!file.patch) continue;
      const filePatterns = this.analyzeFilePatterns(file);
      analysis.patterns_found.good_patterns.push(...filePatterns.good_patterns);
      analysis.patterns_found.anti_patterns.push(...filePatterns.anti_patterns);
    }
    analysis.recommendations = this.generatePatternRecommendations(analysis);
    return analysis;
  }

  analyzeDependencies(prDetails: PRDetails): DependenciesResult {
    const analysis: DependenciesResult = {
      dependency_changes: { added: [], removed: [], updated: [], security_issues: [] },
      impact_assessment: {
        risk_level: 'LOW',
        compatibility_issues: [],
        security_implications: [],
        performance_impact: [],
      },
      recommendations: [],
    };
    const dependencyFiles = prDetails.files.filter((f) => this.isDependencyFile(f.filename));
    analysis.recommendations = this.generateDependencyRecommendations(dependencyFiles.length);
    return analysis;
  }

  analyzeTestCoverage(prDetails: PRDetails): TestCoverageResult {
    const test_files: PRFile[] = [];
    const production_files: PRFile[] = [];
    for (const file of prDetails.files) {
      if (this.isTestFile(file.filename)) test_files.push(file);
      else if (this.isProductionFile(file.filename)) production_files.push(file);
    }
    const coverage_estimate = this.estimateTestCoverage(test_files, production_files);
    const missing_tests = this.identifyMissingTests(production_files, test_files);
    const test_quality = this.analyzeTestQuality(test_files);
    const recommendations = this.generateTestRecommendations(coverage_estimate, missing_tests, test_quality);
    return {
      coverage_estimate,
      test_files,
      production_files,
      missing_tests,
      test_quality,
      recommendations,
    };
  }

  // ---- helpers ----

  private detectLanguage(filename: string): string {
    const extension = (filename.split('.').pop() ?? '').toLowerCase();
    const languageMap: Record<string, string> = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      py: 'python',
      java: 'java',
      go: 'go',
      rs: 'rust',
      cpp: 'cpp',
      c: 'c',
      cs: 'csharp',
      php: 'php',
      rb: 'ruby',
      swift: 'swift',
      kt: 'kotlin',
    };
    return languageMap[extension] ?? 'unknown';
  }

  private detectPrimaryLanguage(files: PRFile[]): string {
    const counts: Record<string, number> = {};
    for (const file of files) {
      const lang = this.detectLanguage(file.filename);
      counts[lang] = (counts[lang] ?? 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return sorted[0]?.[0] ?? 'unknown';
  }

  private calculateComplexity(lines: string[], language: string): number {
    let complexity = 1;
    const complexityKeywords: Record<string, string[]> = {
      javascript: ['if', 'else', 'while', 'for', 'switch', 'case', 'catch', '&&', '||', '?'],
      typescript: ['if', 'else', 'while', 'for', 'switch', 'case', 'catch', '&&', '||', '?'],
      python: ['if', 'elif', 'else', 'while', 'for', 'try', 'except', 'and', 'or'],
      java: ['if', 'else', 'while', 'for', 'switch', 'case', 'catch', '&&', '||', '?'],
    };
    const keywords = complexityKeywords[language] ?? complexityKeywords.javascript;
    for (const line of lines) {
      const trimmed = line.replace(/^\+\s*/, '').trim();
      for (const keyword of keywords) {
        if (trimmed.includes(keyword)) complexity++;
      }
    }
    return Math.min(complexity, 20);
  }

  private calculateMaintainabilityIndex(lines: string[], language: string): number {
    const loc = lines.length;
    const complexity = this.calculateComplexity(lines, language);
    let maintainability = 100 - complexity * 2 - loc * 0.1;
    const codeText = lines.join('\n');
    if (codeText.includes('TODO') || codeText.includes('FIXME')) maintainability -= 5;
    if (/\w{30,}/.test(codeText)) maintainability -= 3;
    return Math.max(0, Math.min(100, maintainability));
  }

  private calculateTechnicalDebt(lines: string[]): number {
    let debtScore = 0;
    const codeText = lines.join('\n');
    const debtIndicators = [
      /TODO|FIXME|HACK|XXX/gi,
      /console\.log|print\(|println!/gi,
      /\/\*.*\*\//gs,
      /\.length\s*>\s*\d{2,}/gi,
      /function\s+\w+\([^)]{50,}\)/gi,
      /if\s*\([^)]{50,}\)/gi,
    ];
    for (const pattern of debtIndicators) {
      const matches = codeText.match(pattern);
      if (matches) debtScore += matches.length * 5;
    }
    return Math.min(100, debtScore);
  }

  private calculateOverallScore(fileAnalyses: FileQuality[]): number {
    if (fileAnalyses.length === 0) return 100;
    const avg = (sel: (f: FileQuality) => number): number =>
      fileAnalyses.reduce((sum, f) => sum + sel(f), 0) / fileAnalyses.length;
    const avgMaintainability = avg((f) => f.metrics.maintainability_index);
    const avgComplexity = avg((f) => f.metrics.cyclomatic_complexity);
    const avgDebt = avg((f) => f.metrics.technical_debt_ratio);
    return Math.round(avgMaintainability - avgComplexity * 2 - avgDebt * 0.5);
  }

  private generateQualitySummary(fileAnalyses: FileQuality[]): CodeQualityResult['summary'] {
    const summary: CodeQualityResult['summary'] = {
      high_complexity_files: [],
      maintainability_issues: [],
      code_smells: [],
      recommendations: [],
    };
    for (const file of fileAnalyses) {
      if (file.metrics.cyclomatic_complexity > 10) {
        summary.high_complexity_files.push({
          filename: file.filename,
          complexity: file.metrics.cyclomatic_complexity,
        });
      }
      if (file.metrics.maintainability_index < 60) {
        summary.maintainability_issues.push({
          filename: file.filename,
          score: file.metrics.maintainability_index,
        });
      }
      if (file.metrics.technical_debt_ratio > 20) {
        summary.code_smells.push({
          filename: file.filename,
          debt_ratio: file.metrics.technical_debt_ratio,
        });
      }
    }
    if (summary.high_complexity_files.length > 0)
      summary.recommendations.push('Consider breaking down complex functions into smaller, more manageable pieces');
    if (summary.maintainability_issues.length > 0)
      summary.recommendations.push('Focus on improving code readability and reducing complexity');
    if (summary.code_smells.length > 0)
      summary.recommendations.push('Address technical debt by removing TODO comments and cleaning up code');
    return summary;
  }

  private detectCodeIssues(lines: string[]): FileQuality['issues'] {
    const issues: FileQuality['issues'] = [];
    const codeText = lines.join('\n');
    if (/console\.log|print\(/gi.test(codeText)) {
      issues.push({ type: 'debug_code', severity: 'medium', description: 'Debug statements found in code' });
    }
    if (/TODO|FIXME/gi.test(codeText)) {
      issues.push({ type: 'incomplete_code', severity: 'low', description: 'TODO or FIXME comments found' });
    }
    return issues;
  }

  private generateCodeSuggestions(lines: string[], language: string): FileQuality['suggestions'] {
    const suggestions: FileQuality['suggestions'] = [];
    const codeText = lines.join('\n');
    if (language === 'javascript' || language === 'typescript') {
      if (codeText.includes('var ')) {
        suggestions.push({ type: 'modernization', description: 'Consider using const/let instead of var', priority: 'medium' });
      }
      if (/function\s*\(/.test(codeText)) {
        suggestions.push({ type: 'modernization', description: 'Consider using arrow functions for better readability', priority: 'low' });
      }
    }
    return suggestions;
  }

  private analyzeFileImpact(file: PRFile): { filename: string; risk_level: string; categories: string[]; factors: string[] } {
    const impact = { filename: file.filename, risk_level: 'LOW', categories: [] as string[], factors: [] as string[] };
    if (file.filename.includes('config') || file.filename.includes('setting')) {
      impact.categories.push('configuration_changes');
      impact.risk_level = 'MEDIUM';
    }
    if (file.filename.includes('security') || file.filename.includes('auth')) {
      impact.categories.push('security_sensitive');
      impact.risk_level = 'HIGH';
    }
    if (file.status === 'removed') {
      impact.factors.push('file_deletion');
      impact.risk_level = 'HIGH';
    }
    return impact;
  }

  private mergeImpactAnalysis(
    analysis: DiffImpactResult,
    fileImpact: { filename: string; categories: string[]; factors: string[] },
  ): void {
    for (const category of fileImpact.categories) {
      if (!analysis.impact_categories[category]) analysis.impact_categories[category] = [];
      analysis.impact_categories[category].push(fileImpact.filename);
    }
    analysis.risk_factors.push(...fileImpact.factors);
  }

  private calculateOverallRisk(analysis: DiffImpactResult): 'LOW' | 'MEDIUM' | 'HIGH' {
    let riskScore = 0;
    if ((analysis.impact_categories.security_sensitive?.length ?? 0) > 0) riskScore += 30;
    if ((analysis.impact_categories.breaking_changes?.length ?? 0) > 0) riskScore += 25;
    if ((analysis.impact_categories.database_changes?.length ?? 0) > 0) riskScore += 20;
    if ((analysis.impact_categories.api_changes?.length ?? 0) > 0) riskScore += 15;
    if (riskScore >= 50) return 'HIGH';
    if (riskScore >= 25) return 'MEDIUM';
    return 'LOW';
  }

  private generateImpactRecommendations(analysis: DiffImpactResult): string[] {
    const recommendations: string[] = [];
    if ((analysis.impact_categories.security_sensitive?.length ?? 0) > 0)
      recommendations.push('Conduct thorough security review and testing');
    if (analysis.overall_risk === 'HIGH')
      recommendations.push('Consider staged deployment and increased monitoring');
    return recommendations;
  }

  private scanFileForSecurity(file: PRFile): SecurityResult['vulnerabilities'] {
    const vulnerabilities: SecurityResult['vulnerabilities'] = [];
    if (!file.patch) return vulnerabilities;
    const addedLines = file.patch.split('\n').filter((l) => l.startsWith('+'));
    const codeText = addedLines.join('\n');
    for (const [category, patterns] of Object.entries(SECURITY_PATTERNS)) {
      for (const pattern of patterns) {
        if (pattern.test(codeText)) {
          vulnerabilities.push({
            type: category,
            file: file.filename,
            severity: this.getSecuritySeverity(category),
            description: this.getSecurityDescription(category),
          });
        }
      }
    }
    return vulnerabilities;
  }

  private getSecuritySeverity(category: string): Severity {
    const severityMap: Record<string, Severity> = {
      sql_injection: 'critical',
      xss: 'high',
      hardcoded_secrets: 'high',
      insecure_random: 'medium',
      eval_usage: 'high',
    };
    return severityMap[category] ?? 'medium';
  }

  private getSecurityDescription(category: string): string {
    const descriptions: Record<string, string> = {
      sql_injection: 'Potential SQL injection vulnerability detected',
      xss: 'Potential XSS vulnerability detected',
      hardcoded_secrets: 'Hardcoded secrets or credentials found',
      insecure_random: 'Insecure random number generation',
      eval_usage: 'Dangerous eval() or similar function usage',
    };
    return descriptions[category] ?? 'Security issue detected';
  }

  private calculateSecurityScore(analysis: SecurityResult): number {
    let score = 100;
    for (const vuln of analysis.vulnerabilities) {
      switch (vuln.severity) {
        case 'critical':
          score -= 25;
          break;
        case 'high':
          score -= 15;
          break;
        case 'medium':
          score -= 5;
          break;
        case 'low':
          score -= 2;
          break;
      }
    }
    return Math.max(0, score);
  }

  private analyzeFilePatterns(file: PRFile): {
    good_patterns: Array<{ name: string; file: string; description: string }>;
    anti_patterns: Array<{ name: string; file: string; description: string }>;
  } {
    const result = {
      good_patterns: [] as Array<{ name: string; file: string; description: string }>,
      anti_patterns: [] as Array<{ name: string; file: string; description: string }>,
    };
    if (!file.patch) return result;
    const codeText = file.patch;
    for (const antiPattern of ANTI_PATTERNS) {
      if (antiPattern.pattern.test(codeText)) {
        result.anti_patterns.push({ name: antiPattern.name, file: file.filename, description: antiPattern.description });
      }
    }
    for (const goodPattern of GOOD_PATTERNS) {
      if (goodPattern.pattern.test(codeText)) {
        result.good_patterns.push({ name: goodPattern.name, file: file.filename, description: goodPattern.description });
      }
    }
    return result;
  }

  private generatePatternRecommendations(analysis: CodePatternsResult): string[] {
    const recommendations: string[] = [];
    if (analysis.patterns_found.anti_patterns.length > 0)
      recommendations.push('Address identified anti-patterns to improve code maintainability');
    if (analysis.patterns_found.good_patterns.length > 0)
      recommendations.push('Continue using the identified good design patterns');
    return recommendations;
  }

  private isDependencyFile(filename: string): boolean {
    return DEPENDENCY_PACKAGE_FILES.includes(filename) || DEPENDENCY_LOCK_FILES.includes(filename);
  }

  private generateDependencyRecommendations(dependencyFileCount: number): string[] {
    const recommendations: string[] = [];
    if (dependencyFileCount > 0)
      recommendations.push('Review new dependencies for security and licensing compliance');
    return recommendations;
  }

  private isTestFile(filename: string): boolean {
    return (
      filename.includes('test') ||
      filename.includes('spec') ||
      filename.includes('__tests__') ||
      filename.endsWith('.test.js') ||
      filename.endsWith('.spec.js')
    );
  }

  private isProductionFile(filename: string): boolean {
    return (
      !this.isTestFile(filename) &&
      !filename.includes('config') &&
      !filename.includes('README') &&
      !filename.includes('documentation')
    );
  }

  private estimateTestCoverage(testFiles: PRFile[], productionFiles: PRFile[]): number {
    if (productionFiles.length === 0) return 100;
    const ratio = testFiles.length / productionFiles.length;
    return Math.min(100, Math.round(ratio * 80));
  }

  private identifyMissingTests(
    productionFiles: PRFile[],
    testFiles: PRFile[],
  ): Array<{ filename: string; suggested_test_file: string }> {
    const missingTests: Array<{ filename: string; suggested_test_file: string }> = [];
    for (const prodFile of productionFiles) {
      const baseName = prodFile.filename.replace(/\.[^.]+$/, '');
      const hasTest = testFiles.some((testFile) => testFile.filename.includes(baseName));
      if (!hasTest) {
        missingTests.push({ filename: prodFile.filename, suggested_test_file: `${baseName}.test.js` });
      }
    }
    return missingTests;
  }

  private analyzeTestQuality(testFiles: PRFile[]): TestCoverageResult['test_quality'] {
    let unitTests = 0;
    let integrationTests = 0;
    let edgeCases = 0;
    for (const testFile of testFiles) {
      if (!testFile.patch) continue;
      const content = testFile.patch;
      unitTests += (content.match(/describe|it|test\(/g) ?? []).length;
      integrationTests += (content.match(/request|supertest|integration/gi) ?? []).length;
      edgeCases += (content.match(/edge|boundary|null|undefined|empty/gi) ?? []).length;
    }
    return { unit_tests: unitTests, integration_tests: integrationTests, edge_cases: edgeCases };
  }

  private generateTestRecommendations(
    coverageEstimate: number,
    missingTests: Array<{ filename: string }>,
    testQuality: TestCoverageResult['test_quality'],
  ): string[] {
    const recommendations: string[] = [];
    if (coverageEstimate < 70) recommendations.push('Consider adding more test coverage for the changed code');
    if (missingTests.length > 0)
      recommendations.push(`Add tests for: ${missingTests.map((t) => t.filename).join(', ')}`);
    if (testQuality.edge_cases === 0) recommendations.push('Consider adding edge case testing');
    return recommendations;
  }
}
