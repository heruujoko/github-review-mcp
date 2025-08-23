// import crypto from 'crypto'; // Commented out as unused

export class AnalysisService {
  constructor() {
    // Initialize analysis patterns and rules
    this.securityPatterns = this.initializeSecurityPatterns();
    this.codePatterns = this.initializeCodePatterns();
    this.dependencyPatterns = this.initializeDependencyPatterns();
  }

  /**
   * Analyze code quality metrics for changed files
   */
  async analyzeCodeQuality(prDetails, filePaths = null) {
    // const filesToAnalyze = filePaths || prDetails.files.map(f => f.filename); // Commented out as unused
    const analysis = {
      overall_score: 0,
      files: [],
      summary: {
        high_complexity_files: [],
        maintainability_issues: [],
        code_smells: [],
        recommendations: [],
      },
    };

    for (const file of prDetails.files) {
      if (filePaths && !filePaths.includes(file.filename)) continue;

      const fileAnalysis = await this.analyzeFileQuality(file);
      analysis.files.push(fileAnalysis);
    }

    // Calculate overall score
    analysis.overall_score = this.calculateOverallScore(analysis.files);

    // Generate summary
    analysis.summary = this.generateQualitySummary(analysis.files);

    return analysis;
  }

  /**
   * Analyze individual file quality
   */
  async analyzeFileQuality(file) {
    const analysis = {
      filename: file.filename,
      language: this.detectLanguage(file.filename),
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

    // Analyze patch content
    const lines = file.patch.split('\n');
    const addedLines = lines.filter(line => line.startsWith('+')).slice(1); // Remove first line which is file info

    // Calculate metrics
    analysis.metrics.lines_of_code = addedLines.length;
    analysis.metrics.cyclomatic_complexity = this.calculateComplexity(
      addedLines,
      analysis.language
    );
    analysis.metrics.maintainability_index = this.calculateMaintainabilityIndex(
      addedLines,
      analysis.language
    );
    analysis.metrics.technical_debt_ratio = this.calculateTechnicalDebt(
      addedLines,
      analysis.language
    );

    // Detect issues
    analysis.issues = this.detectCodeIssues(addedLines, analysis.language);
    analysis.suggestions = this.generateCodeSuggestions(
      addedLines,
      analysis.language
    );

    return analysis;
  }

  /**
   * Analyze diff impact and risk levels
   */
  async analyzeDiffImpact(prDetails) {
    const analysis = {
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
      const fileImpact = this.analyzeFileImpact(file);
      this.mergeImpactAnalysis(analysis, fileImpact);
    }

    // Calculate overall risk
    analysis.overall_risk = this.calculateOverallRisk(analysis);

    // Generate recommendations
    analysis.recommendations = this.generateImpactRecommendations(analysis);

    return analysis;
  }

  /**
   * Detect security issues in code changes
   */
  async detectSecurityIssues(prDetails) {
    const analysis = {
      security_score: 100,
      vulnerabilities: [],
      warnings: [],
      best_practices: [],
      compliance_issues: [],
    };

    for (const file of prDetails.files) {
      if (!file.patch) continue;

      const fileSecurityIssues = this.scanFileForSecurity(file);
      analysis.vulnerabilities.push(...fileSecurityIssues.vulnerabilities);
      analysis.warnings.push(...fileSecurityIssues.warnings);
      analysis.best_practices.push(...fileSecurityIssues.best_practices);
      analysis.compliance_issues.push(...fileSecurityIssues.compliance_issues);
    }

    // Calculate security score
    analysis.security_score = this.calculateSecurityScore(analysis);

    return analysis;
  }

  /**
   * Detect code patterns and anti-patterns
   */
  async detectCodePatterns(prDetails, language = null) {
    const analysis = {
      patterns_found: {
        good_patterns: [],
        anti_patterns: [],
        architectural_issues: [],
        design_patterns: [],
      },
      recommendations: [],
      language: language || this.detectPrimaryLanguage(prDetails.files),
    };

    for (const file of prDetails.files) {
      if (!file.patch) continue;

      const detectedLanguage = language || this.detectLanguage(file.filename);
      const filePatterns = this.analyzeFilePatterns(file, detectedLanguage);

      this.mergePatternAnalysis(analysis, filePatterns);
    }

    analysis.recommendations = this.generatePatternRecommendations(analysis);

    return analysis;
  }

  /**
   * Analyze dependency changes
   */
  async analyzeDependencies(prDetails) {
    const analysis = {
      dependency_changes: {
        added: [],
        removed: [],
        updated: [],
        security_issues: [],
      },
      impact_assessment: {
        risk_level: 'LOW',
        compatibility_issues: [],
        security_implications: [],
        performance_impact: [],
      },
      recommendations: [],
    };

    const dependencyFiles = prDetails.files.filter(file =>
      this.isDependencyFile(file.filename)
    );

    for (const file of dependencyFiles) {
      const depAnalysis = this.analyzeDependencyFile(file);
      this.mergeDependencyAnalysis(analysis, depAnalysis);
    }

    analysis.recommendations = this.generateDependencyRecommendations(analysis);

    return analysis;
  }

  /**
   * Analyze test coverage for changed code
   */
  async analyzeTestCoverage(prDetails) {
    const analysis = {
      coverage_estimate: 0,
      test_files: [],
      production_files: [],
      missing_tests: [],
      test_quality: {
        unit_tests: 0,
        integration_tests: 0,
        edge_cases: 0,
      },
      recommendations: [],
    };

    // Categorize files
    for (const file of prDetails.files) {
      if (this.isTestFile(file.filename)) {
        analysis.test_files.push(file);
      } else if (this.isProductionFile(file.filename)) {
        analysis.production_files.push(file);
      }
    }

    // Analyze test coverage
    analysis.coverage_estimate = this.estimateTestCoverage(
      analysis.test_files,
      analysis.production_files
    );
    analysis.missing_tests = this.identifyMissingTests(
      analysis.production_files,
      analysis.test_files
    );
    analysis.test_quality = this.analyzeTestQuality(analysis.test_files);
    analysis.recommendations = this.generateTestRecommendations(analysis);

    return analysis;
  }

  /**
   * Generate code improvement suggestions
   */
  async generateSuggestions(prDetails, filePath, focusAreas = []) {
    const file = prDetails.files.find(f => f.filename === filePath);
    if (!file) {
      throw new Error(`File ${filePath} not found in PR changes`);
    }

    const language = this.detectLanguage(filePath);
    const suggestions = {
      filename: filePath,
      language: language,
      categories: {},
      priority_suggestions: [],
      implementation_examples: [],
    };

    const areas =
      focusAreas.length > 0
        ? focusAreas
        : [
            'performance',
            'security',
            'maintainability',
            'readability',
            'testing',
          ];

    for (const area of areas) {
      suggestions.categories[area] = this.generateAreaSpecificSuggestions(
        file,
        area,
        language
      );
    }

    // Prioritize suggestions
    suggestions.priority_suggestions = this.prioritizeSuggestions(
      suggestions.categories
    );
    suggestions.implementation_examples = this.generateImplementationExamples(
      suggestions.priority_suggestions,
      language
    );

    return suggestions;
  }

  // Helper methods for analysis

  detectLanguage(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    const languageMap = {
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
    return languageMap[extension] || 'unknown';
  }

  detectPrimaryLanguage(files) {
    const languageCounts = {};
    for (const file of files) {
      const lang = this.detectLanguage(file.filename);
      languageCounts[lang] = (languageCounts[lang] || 0) + 1;
    }
    return (
      Object.entries(languageCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ||
      'unknown'
    );
  }

  calculateComplexity(lines, language) {
    let complexity = 1; // Base complexity

    const complexityKeywords = {
      javascript: [
        'if',
        'else',
        'while',
        'for',
        'switch',
        'case',
        'catch',
        '&&',
        '||',
        '?',
      ],
      typescript: [
        'if',
        'else',
        'while',
        'for',
        'switch',
        'case',
        'catch',
        '&&',
        '||',
        '?',
      ],
      python: [
        'if',
        'elif',
        'else',
        'while',
        'for',
        'try',
        'except',
        'and',
        'or',
      ],
      java: [
        'if',
        'else',
        'while',
        'for',
        'switch',
        'case',
        'catch',
        '&&',
        '||',
        '?',
      ],
    };

    const keywords =
      complexityKeywords[language] || complexityKeywords.javascript;

    for (const line of lines) {
      const trimmedLine = line.replace(/^\+\s*/, '').trim();
      for (const keyword of keywords) {
        if (trimmedLine.includes(keyword)) {
          complexity++;
        }
      }
    }

    return Math.min(complexity, 20); // Cap at 20
  }

  calculateMaintainabilityIndex(lines, language) {
    const loc = lines.length;
    const complexity = this.calculateComplexity(lines, language);

    // Simplified maintainability index calculation
    let maintainability = 100 - complexity * 2 - loc * 0.1;

    // Adjust based on code quality indicators
    const codeText = lines.join('\n');
    if (codeText.includes('TODO') || codeText.includes('FIXME')) {
      maintainability -= 5;
    }
    if (codeText.match(/\w{30,}/)) {
      // Very long variable names
      maintainability -= 3;
    }

    return Math.max(0, Math.min(100, maintainability));
  }

  calculateTechnicalDebt(lines, _language) {
    let debtScore = 0;
    const codeText = lines.join('\n');

    // Technical debt indicators
    const debtIndicators = [
      /TODO|FIXME|HACK|XXX/gi,
      /console\.log|print\(|println!/gi, // Debug statements
      /\/\*.*\*\//gs, // Commented out code blocks
      /\.length\s*>\s*\d{2,}/gi, // Magic numbers
      /function\s+\w+\([^)]{50,}\)/gi, // Long parameter lists
      /if\s*\([^)]{50,}\)/gi, // Complex conditions
    ];

    for (const pattern of debtIndicators) {
      const matches = codeText.match(pattern);
      if (matches) {
        debtScore += matches.length * 5;
      }
    }

    return Math.min(100, debtScore);
  }

  calculateOverallScore(fileAnalyses) {
    if (fileAnalyses.length === 0) return 100;

    const avgMaintainability =
      fileAnalyses.reduce(
        (sum, f) => sum + f.metrics.maintainability_index,
        0
      ) / fileAnalyses.length;
    const avgComplexity =
      fileAnalyses.reduce(
        (sum, f) => sum + f.metrics.cyclomatic_complexity,
        0
      ) / fileAnalyses.length;
    const avgDebt =
      fileAnalyses.reduce((sum, f) => sum + f.metrics.technical_debt_ratio, 0) /
      fileAnalyses.length;

    return Math.round(avgMaintainability - avgComplexity * 2 - avgDebt * 0.5);
  }

  generateQualitySummary(fileAnalyses) {
    const summary = {
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

    // Generate recommendations
    if (summary.high_complexity_files.length > 0) {
      summary.recommendations.push(
        'Consider breaking down complex functions into smaller, more manageable pieces'
      );
    }
    if (summary.maintainability_issues.length > 0) {
      summary.recommendations.push(
        'Focus on improving code readability and reducing complexity'
      );
    }
    if (summary.code_smells.length > 0) {
      summary.recommendations.push(
        'Address technical debt by removing TODO comments and cleaning up code'
      );
    }

    return summary;
  }

  initializeSecurityPatterns() {
    return {
      sql_injection: [
        /query\s*\+.*\+/gi,
        /execute\s*\(.*\+.*\)/gi,
        /SELECT.*\+.*FROM/gi,
      ],
      xss: [
        /innerHTML\s*=.*\+/gi,
        /document\.write\s*\(/gi,
        /\.html\s*\(.*\+/gi,
      ],
      hardcoded_secrets: [
        /password\s*=\s*["'][^"']+["']/gi,
        /api_key\s*=\s*["'][^"']+["']/gi,
        /secret\s*=\s*["'][^"']+["']/gi,
        /token\s*=\s*["'][^"']+["']/gi,
      ],
      insecure_random: [/Math\.random\(\)/gi, /rand\(\)/gi],
      eval_usage: [/eval\s*\(/gi, /exec\s*\(/gi, /setTimeout\s*\(.*string/gi],
    };
  }

  initializeCodePatterns() {
    return {
      anti_patterns: [
        {
          name: 'God Object',
          pattern: /class\s+\w+[\s\S]{1000,}/gi,
          description: 'Large classes that do too much',
        },
        {
          name: 'Magic Numbers',
          pattern: /[^.\w]\d{2,}[^.\w]/g,
          description: 'Hardcoded numeric values without explanation',
        },
        {
          name: 'Long Parameter List',
          pattern: /function\s+\w+\s*\([^)]{80,}\)/gi,
          description: 'Functions with too many parameters',
        },
      ],
      good_patterns: [
        {
          name: 'Single Responsibility',
          pattern: /class\s+\w+[\s\S]{50,200}/gi,
          description: 'Appropriately sized classes',
        },
        {
          name: 'Constants Usage',
          pattern: /const\s+[A-Z_]+\s*=/gi,
          description: 'Use of constants instead of magic numbers',
        },
      ],
    };
  }

  initializeDependencyPatterns() {
    return {
      package_files: [
        'package.json',
        'requirements.txt',
        'Gemfile',
        'pom.xml',
        'Cargo.toml',
        'go.mod',
        'composer.json',
      ],
      lock_files: [
        'package-lock.json',
        'yarn.lock',
        'Pipfile.lock',
        'Gemfile.lock',
        'Cargo.lock',
        'go.sum',
      ],
    };
  }

  // Additional helper methods would continue here...
  // Due to length constraints, I'm showing the structure and key methods

  detectCodeIssues(lines, _language) {
    const issues = [];
    const codeText = lines.join('\n');

    // Common code issues
    if (codeText.match(/console\.log|print\(/gi)) {
      issues.push({
        type: 'debug_code',
        severity: 'medium',
        description: 'Debug statements found in code',
      });
    }

    if (codeText.match(/TODO|FIXME/gi)) {
      issues.push({
        type: 'incomplete_code',
        severity: 'low',
        description: 'TODO or FIXME comments found',
      });
    }

    return issues;
  }

  generateCodeSuggestions(lines, language) {
    const suggestions = [];
    const codeText = lines.join('\n');

    if (language === 'javascript' || language === 'typescript') {
      if (codeText.includes('var ')) {
        suggestions.push({
          type: 'modernization',
          description: 'Consider using const/let instead of var',
          priority: 'medium',
        });
      }

      if (codeText.match(/function\s*\(/)) {
        suggestions.push({
          type: 'modernization',
          description: 'Consider using arrow functions for better readability',
          priority: 'low',
        });
      }
    }

    return suggestions;
  }

  analyzeFileImpact(file) {
    const impact = {
      filename: file.filename,
      risk_level: 'LOW',
      categories: [],
      factors: [],
    };

    // Analyze based on file type and changes
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

  mergeImpactAnalysis(analysis, fileImpact) {
    for (const category of fileImpact.categories) {
      if (!analysis.impact_categories[category]) {
        analysis.impact_categories[category] = [];
      }
      analysis.impact_categories[category].push(fileImpact.filename);
    }

    analysis.risk_factors.push(...fileImpact.factors);
  }

  calculateOverallRisk(analysis) {
    let riskScore = 0;

    // Weight different categories
    if (analysis.impact_categories.security_sensitive.length > 0)
      riskScore += 30;
    if (analysis.impact_categories.breaking_changes.length > 0) riskScore += 25;
    if (analysis.impact_categories.database_changes.length > 0) riskScore += 20;
    if (analysis.impact_categories.api_changes.length > 0) riskScore += 15;

    if (riskScore >= 50) return 'HIGH';
    if (riskScore >= 25) return 'MEDIUM';
    return 'LOW';
  }

  generateImpactRecommendations(analysis) {
    const recommendations = [];

    if (analysis.impact_categories.security_sensitive.length > 0) {
      recommendations.push('Conduct thorough security review and testing');
    }

    if (analysis.overall_risk === 'HIGH') {
      recommendations.push(
        'Consider staged deployment and increased monitoring'
      );
    }

    return recommendations;
  }

  scanFileForSecurity(file) {
    const issues = {
      vulnerabilities: [],
      warnings: [],
      best_practices: [],
      compliance_issues: [],
    };

    if (!file.patch) return issues;

    const addedLines = file.patch
      .split('\n')
      .filter(line => line.startsWith('+'));
    const codeText = addedLines.join('\n');

    // Check for security patterns
    for (const [category, patterns] of Object.entries(this.securityPatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(codeText)) {
          issues.vulnerabilities.push({
            type: category,
            file: file.filename,
            severity: this.getSecuritySeverity(category),
            description: this.getSecurityDescription(category),
          });
        }
      }
    }

    return issues;
  }

  getSecuritySeverity(category) {
    const severityMap = {
      sql_injection: 'critical',
      xss: 'high',
      hardcoded_secrets: 'high',
      insecure_random: 'medium',
      eval_usage: 'high',
    };
    return severityMap[category] || 'medium';
  }

  getSecurityDescription(category) {
    const descriptions = {
      sql_injection: 'Potential SQL injection vulnerability detected',
      xss: 'Potential XSS vulnerability detected',
      hardcoded_secrets: 'Hardcoded secrets or credentials found',
      insecure_random: 'Insecure random number generation',
      eval_usage: 'Dangerous eval() or similar function usage',
    };
    return descriptions[category] || 'Security issue detected';
  }

  calculateSecurityScore(analysis) {
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

  analyzeFilePatterns(file, _language) {
    const patterns = {
      good_patterns: [],
      anti_patterns: [],
      architectural_issues: [],
      design_patterns: [],
    };

    if (!file.patch) return patterns;

    const codeText = file.patch;

    // Check for anti-patterns
    for (const antiPattern of this.codePatterns.anti_patterns) {
      if (antiPattern.pattern.test(codeText)) {
        patterns.anti_patterns.push({
          name: antiPattern.name,
          file: file.filename,
          description: antiPattern.description,
        });
      }
    }

    // Check for good patterns
    for (const goodPattern of this.codePatterns.good_patterns) {
      if (goodPattern.pattern.test(codeText)) {
        patterns.good_patterns.push({
          name: goodPattern.name,
          file: file.filename,
          description: goodPattern.description,
        });
      }
    }

    return patterns;
  }

  mergePatternAnalysis(analysis, filePatterns) {
    analysis.patterns_found.good_patterns.push(...filePatterns.good_patterns);
    analysis.patterns_found.anti_patterns.push(...filePatterns.anti_patterns);
    analysis.patterns_found.architectural_issues.push(
      ...filePatterns.architectural_issues
    );
    analysis.patterns_found.design_patterns.push(
      ...filePatterns.design_patterns
    );
  }

  generatePatternRecommendations(analysis) {
    const recommendations = [];

    if (analysis.patterns_found.anti_patterns.length > 0) {
      recommendations.push(
        'Address identified anti-patterns to improve code maintainability'
      );
    }

    if (analysis.patterns_found.good_patterns.length > 0) {
      recommendations.push(
        'Continue using the identified good design patterns'
      );
    }

    return recommendations;
  }

  isDependencyFile(filename) {
    return (
      this.dependencyPatterns.package_files.includes(filename) ||
      this.dependencyPatterns.lock_files.includes(filename)
    );
  }

  analyzeDependencyFile(_file) {
    // Implementation for dependency analysis
    return {
      added: [],
      removed: [],
      updated: [],
      security_issues: [],
    };
  }

  mergeDependencyAnalysis(analysis, depAnalysis) {
    analysis.dependency_changes.added.push(...depAnalysis.added);
    analysis.dependency_changes.removed.push(...depAnalysis.removed);
    analysis.dependency_changes.updated.push(...depAnalysis.updated);
    analysis.dependency_changes.security_issues.push(
      ...depAnalysis.security_issues
    );
  }

  generateDependencyRecommendations(analysis) {
    const recommendations = [];

    if (analysis.dependency_changes.added.length > 0) {
      recommendations.push(
        'Review new dependencies for security and licensing compliance'
      );
    }

    return recommendations;
  }

  isTestFile(filename) {
    return (
      filename.includes('test') ||
      filename.includes('spec') ||
      filename.includes('__tests__') ||
      filename.endsWith('.test.js') ||
      filename.endsWith('.spec.js')
    );
  }

  isProductionFile(filename) {
    return (
      !this.isTestFile(filename) &&
      !filename.includes('config') &&
      !filename.includes('README') &&
      !filename.includes('documentation')
    );
  }

  estimateTestCoverage(testFiles, productionFiles) {
    if (productionFiles.length === 0) return 100;

    // Simple heuristic: ratio of test files to production files
    const ratio = testFiles.length / productionFiles.length;
    return Math.min(100, Math.round(ratio * 80)); // Cap at 80% since it's an estimate
  }

  identifyMissingTests(productionFiles, testFiles) {
    const missingTests = [];

    for (const prodFile of productionFiles) {
      const baseName = prodFile.filename.replace(/\.[^.]+$/, '');
      const hasTest = testFiles.some(
        testFile =>
          testFile.filename.includes(baseName) ||
          testFile.filename.includes(prodFile.filename.replace(/\.[^.]+$/, ''))
      );

      if (!hasTest) {
        missingTests.push({
          filename: prodFile.filename,
          suggested_test_file: `${baseName}.test.js`,
        });
      }
    }

    return missingTests;
  }

  analyzeTestQuality(testFiles) {
    let unitTests = 0;
    let integrationTests = 0;
    let edgeCases = 0;

    for (const testFile of testFiles) {
      if (!testFile.patch) continue;

      const content = testFile.patch;

      // Count test types (simple heuristics)
      unitTests += (content.match(/describe|it|test\(/g) || []).length;
      integrationTests += (
        content.match(/request|supertest|integration/gi) || []
      ).length;
      edgeCases += (content.match(/edge|boundary|null|undefined|empty/gi) || [])
        .length;
    }

    return {
      unit_tests: unitTests,
      integration_tests: integrationTests,
      edge_cases: edgeCases,
    };
  }

  generateTestRecommendations(analysis) {
    const recommendations = [];

    if (analysis.coverage_estimate < 70) {
      recommendations.push(
        'Consider adding more test coverage for the changed code'
      );
    }

    if (analysis.missing_tests.length > 0) {
      recommendations.push(
        `Add tests for: ${analysis.missing_tests.map(t => t.filename).join(', ')}`
      );
    }

    if (analysis.test_quality.edge_cases === 0) {
      recommendations.push('Consider adding edge case testing');
    }

    return recommendations;
  }

  generateAreaSpecificSuggestions(file, area, _language) {
    const suggestions = [];

    if (!file.patch) return suggestions;

    const codeText = file.patch;

    switch (area) {
      case 'performance':
        if (codeText.includes('for (') && codeText.includes('length')) {
          suggestions.push({
            type: 'performance',
            description:
              'Cache array length in loop conditions for better performance',
            example: 'for (let i = 0, len = array.length; i < len; i++)',
          });
        }
        break;

      case 'security':
        if (codeText.includes('innerHTML')) {
          suggestions.push({
            type: 'security',
            description:
              'Consider using textContent instead of innerHTML to prevent XSS',
            example: 'element.textContent = userInput;',
          });
        }
        break;

      case 'maintainability':
        if (codeText.match(/function\s+\w+\s*\([^)]{50,}\)/)) {
          suggestions.push({
            type: 'maintainability',
            description:
              'Consider breaking down functions with many parameters',
            example:
              'Use configuration objects instead of long parameter lists',
          });
        }
        break;

      case 'readability':
        if (codeText.includes('var ')) {
          suggestions.push({
            type: 'readability',
            description: 'Use const/let instead of var for better scoping',
            example: 'const value = ...; // or let if reassignment needed',
          });
        }
        break;

      case 'testing':
        if (!this.isTestFile(file.filename) && file.status === 'added') {
          suggestions.push({
            type: 'testing',
            description: 'Consider adding unit tests for new functionality',
            example: `Create ${file.filename.replace(/\.[^.]+$/, '.test.js')}`,
          });
        }
        break;
    }

    return suggestions;
  }

  prioritizeSuggestions(categories) {
    const allSuggestions = [];

    for (const [area, suggestions] of Object.entries(categories)) {
      for (const suggestion of suggestions) {
        allSuggestions.push({
          ...suggestion,
          area,
          priority: this.getSuggestionPriority(suggestion.type),
        });
      }
    }

    return allSuggestions
      .sort(
        (a, b) =>
          this.getPriorityValue(a.priority) - this.getPriorityValue(b.priority)
      )
      .slice(0, 10); // Top 10 suggestions
  }

  getSuggestionPriority(type) {
    const priorities = {
      security: 'high',
      performance: 'medium',
      maintainability: 'medium',
      readability: 'low',
      testing: 'medium',
    };
    return priorities[type] || 'low';
  }

  getPriorityValue(priority) {
    const values = { high: 1, medium: 2, low: 3 };
    return values[priority] || 3;
  }

  generateImplementationExamples(suggestions, language) {
    return suggestions.slice(0, 5).map(suggestion => ({
      suggestion: suggestion.description,
      example: suggestion.example || `// ${suggestion.description}`,
      language,
    }));
  }
}
