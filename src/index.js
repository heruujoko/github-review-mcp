#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import { GitHubService } from './services/github.js';
import { ConfigService } from './services/config.js';
import { AnalysisService } from './services/analysis.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

class GitHubMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'github-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.config = new ConfigService();
    this.github = new GitHubService(this.config.get('GITHUB_TOKEN'));
    this.analysis = new AnalysisService();

    this.setupToolHandlers();
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'get_pr_details',
            description: 'Get detailed information about a GitHub Pull Request. TIP: Call get_review_prompts first for comprehensive review guidelines.',
            inputSchema: {
              type: 'object',
              properties: {
                pr_url: {
                  type: 'string',
                  description: 'GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)',
                },
              },
              required: ['pr_url'],
            },
          },
          {
            name: 'get_pr_files',
            description: 'Get list of files changed in a GitHub Pull Request. TIP: Use get_review_prompts first for analysis guidelines.',
            inputSchema: {
              type: 'object',
              properties: {
                pr_url: {
                  type: 'string',
                  description: 'GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)',
                },
                include_patch: {
                  type: 'boolean',
                  description: 'Include diff patches for each file',
                  default: true,
                },
              },
              required: ['pr_url'],
            },
          },
          {
            name: 'get_pr_commits',
            description: 'Get commits in a GitHub Pull Request',
            inputSchema: {
              type: 'object',
              properties: {
                pr_url: {
                  type: 'string',
                  description: 'GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)',
                },
              },
              required: ['pr_url'],
            },
          },
          {
            name: 'get_file_content',
            description: 'Get content of a specific file from a GitHub repository',
            inputSchema: {
              type: 'object',
              properties: {
                owner: {
                  type: 'string',
                  description: 'Repository owner',
                },
                repo: {
                  type: 'string',
                  description: 'Repository name',
                },
                path: {
                  type: 'string',
                  description: 'File path in the repository',
                },
                ref: {
                  type: 'string',
                  description: 'Git reference (branch, tag, or commit SHA)',
                  default: 'main',
                },
              },
              required: ['owner', 'repo', 'path'],
            },
          },
          {
            name: 'post_pr_review',
            description: 'Post a review comment on a GitHub Pull Request. BEST PRACTICE: Use get_review_prompts first to ensure comprehensive analysis.',
            inputSchema: {
              type: 'object',
              properties: {
                pr_url: {
                  type: 'string',
                  description: 'GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)',
                },
                body: {
                  type: 'string',
                  description: 'Review comment body',
                },
                event: {
                  type: 'string',
                  description: 'Review event type',
                  enum: ['APPROVE', 'REQUEST_CHANGES', 'COMMENT'],
                  default: 'COMMENT',
                },
                comments: {
                  type: 'array',
                  description: 'Line-specific comments',
                  items: {
                    type: 'object',
                    properties: {
                      path: { type: 'string' },
                      line: { type: 'number' },
                      body: { type: 'string' },
                    },
                    required: ['path', 'line', 'body'],
                  },
                  default: [],
                },
              },
              required: ['pr_url', 'body'],
            },
          },
          {
            name: 'get_repo_info',
            description: 'Get repository information including languages and README',
            inputSchema: {
              type: 'object',
              properties: {
                owner: {
                  type: 'string',
                  description: 'Repository owner',
                },
                repo: {
                  type: 'string',
                  description: 'Repository name',
                },
              },
              required: ['owner', 'repo'],
            },
          },
          {
            name: 'get_review_prompts',
            description: '🔥 CALL THIS FIRST! Get comprehensive review guidelines and prompts to perform thorough PR analysis. Essential for high-quality code reviews.',
            inputSchema: {
              type: 'object',
              properties: {
                random_string: {
                  type: 'string',
                  description: 'Dummy parameter for no-parameter tools',
                },
              },
              required: ['random_string'],
            },
          },
          {
            name: 'analyze_code_quality',
            description: 'Analyze code quality metrics for changed files including complexity, maintainability, and potential issues.',
            inputSchema: {
              type: 'object',
              properties: {
                pr_url: {
                  type: 'string',
                  description: 'GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)',
                },
                file_paths: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional: Specific file paths to analyze. If not provided, analyzes all changed files.',
                },
              },
              required: ['pr_url'],
            },
          },
          {
            name: 'analyze_diff_impact',
            description: 'Analyze the impact and risk level of code changes in a diff, categorizing changes by type and potential consequences.',
            inputSchema: {
              type: 'object',
              properties: {
                pr_url: {
                  type: 'string',
                  description: 'GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)',
                },
              },
              required: ['pr_url'],
            },
          },
          {
            name: 'detect_security_issues',
            description: 'Scan code changes for potential security vulnerabilities and patterns.',
            inputSchema: {
              type: 'object',
              properties: {
                pr_url: {
                  type: 'string',
                  description: 'GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)',
                },
              },
              required: ['pr_url'],
            },
          },
          {
            name: 'detect_code_patterns',
            description: 'Detect anti-patterns, best practices violations, and architectural issues in code changes.',
            inputSchema: {
              type: 'object',
              properties: {
                pr_url: {
                  type: 'string',
                  description: 'GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)',
                },
                language: {
                  type: 'string',
                  description: 'Programming language to focus pattern detection on (auto-detected if not provided)',
                },
              },
              required: ['pr_url'],
            },
          },
          {
            name: 'analyze_dependencies',
            description: 'Analyze dependency changes and their impact, including new packages, version updates, and security implications.',
            inputSchema: {
              type: 'object',
              properties: {
                pr_url: {
                  type: 'string',
                  description: 'GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)',
                },
              },
              required: ['pr_url'],
            },
          },
          {
            name: 'analyze_test_coverage',
            description: 'Analyze test coverage for changed code and suggest testing improvements.',
            inputSchema: {
              type: 'object',
              properties: {
                pr_url: {
                  type: 'string',
                  description: 'GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)',
                },
              },
              required: ['pr_url'],
            },
          },
          {
            name: 'generate_suggestions',
            description: 'Generate specific code improvement suggestions based on best practices and patterns.',
            inputSchema: {
              type: 'object',
              properties: {
                pr_url: {
                  type: 'string',
                  description: 'GitHub PR URL (e.g., https://github.com/owner/repo/pull/123)',
                },
                file_path: {
                  type: 'string',
                  description: 'Specific file to generate suggestions for',
                },
                focus_areas: {
                  type: 'array',
                  items: {
                    type: 'string',
                    enum: ['performance', 'security', 'maintainability', 'readability', 'testing']
                  },
                  description: 'Specific areas to focus suggestions on',
                },
              },
              required: ['pr_url', 'file_path'],
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'get_pr_details':
            return await this.handleGetPRDetails(args);
          
          case 'get_pr_files':
            return await this.handleGetPRFiles(args);
          
          case 'get_pr_commits':
            return await this.handleGetPRCommits(args);
          
          case 'get_file_content':
            return await this.handleGetFileContent(args);
          
          case 'post_pr_review':
            return await this.handlePostPRReview(args);
          
          case 'get_repo_info':
            return await this.handleGetRepoInfo(args);
          
          case 'get_review_prompts':
            return await this.handleGetReviewPrompts(args);
          
          case 'analyze_code_quality':
            return await this.handleAnalyzeCodeQuality(args);
          
          case 'analyze_diff_impact':
            return await this.handleAnalyzeDiffImpact(args);
          
          case 'detect_security_issues':
            return await this.handleDetectSecurityIssues(args);
          
          case 'detect_code_patterns':
            return await this.handleDetectCodePatterns(args);
          
          case 'analyze_dependencies':
            return await this.handleAnalyzeDependencies(args);
          
          case 'analyze_test_coverage':
            return await this.handleAnalyzeTestCoverage(args);
          
          case 'generate_suggestions':
            return await this.handleGenerateSuggestions(args);
          
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error.message}`
        );
      }
    });
  }

  async handleGetPRDetails(args) {
    const { pr_url } = args;
    
    if (!pr_url) {
      throw new Error('PR URL is required');
    }

    const prDetails = await this.github.getPRDetails(pr_url);

    const result = {
      reminder: "💡 For comprehensive PR analysis, consider calling 'get_review_prompts' to get detailed review guidelines and best practices.",
      pr_details: prDetails
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async handleGetPRFiles(args) {
    const { pr_url, include_patch = true } = args;
    
    if (!pr_url) {
      throw new Error('PR URL is required');
    }

    const prDetails = await this.github.getPRDetails(pr_url);
    const files = prDetails.files.map(file => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      blob_url: file.blob_url,
      ...(include_patch && file.patch ? { patch: file.patch } : {}),
    }));

    const result = {
      reminder: "💡 For thorough code review analysis, make sure to call 'get_review_prompts' for comprehensive guidelines on evaluating these file changes.",
      files, 
      total_files: files.length
    };

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  async handleGetPRCommits(args) {
    const { pr_url } = args;
    
    if (!pr_url) {
      throw new Error('PR URL is required');
    }

    const prDetails = await this.github.getPRDetails(pr_url);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ commits: prDetails.commits, total_commits: prDetails.commits.length }, null, 2),
        },
      ],
    };
  }

  async handleGetFileContent(args) {
    const { owner, repo, path, ref = 'main' } = args;
    
    if (!owner || !repo || !path) {
      throw new Error('Owner, repo, and path are required');
    }

    const content = await this.github.getFileContent(owner, repo, path, ref);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ 
            owner, 
            repo, 
            path, 
            ref,
            content: content || null 
          }, null, 2),
        },
      ],
    };
  }

  async handlePostPRReview(args) {
    const { pr_url, body, event = 'COMMENT', comments = [] } = args;
    
    if (!pr_url || !body) {
      throw new Error('PR URL and body are required');
    }

    const { owner, repo, pull_number } = this.github.parsePRUrl(pr_url);
    
    const result = await this.github.createReview(owner, repo, pull_number, {
      body,
      event,
      comments,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ 
            success: true, 
            review_id: result.id,
            review_url: result.html_url 
          }, null, 2),
        },
      ],
    };
  }

  async handleGetRepoInfo(args) {
    const { owner, repo } = args;
    
    if (!owner || !repo) {
      throw new Error('Owner and repo are required');
    }

    const [languages, readme] = await Promise.all([
      this.github.getRepoLanguages(owner, repo),
      this.github.getRepoREADME(owner, repo),
    ]);

    const primaryLanguage = languages && Object.keys(languages).length > 0 
      ? Object.entries(languages).sort(([,a], [,b]) => b - a)[0][0]
      : 'Unknown';

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            owner,
            repo,
            full_name: `${owner}/${repo}`,
            languages,
            primary_language: primaryLanguage,
            has_readme: !!readme,
            readme_content: readme,
          }, null, 2),
        },
      ],
    };
  }

  async handleGetReviewPrompts(args) {
    const content = `# Pull Request Review Analysis Prompts

## Comprehensive Code Review Guidelines

### 1. Code Quality Assessment
When reviewing code changes, analyze the following aspects:

- Identify issues: Find blocking issues, important issues, and minor improvements
- Categorize by type: Security, performance, logic errors, style, etc.
- Are adequate tests included or do existing tests need updates?

### 2. Architecture and Design Review
Evaluate the architectural decisions:

- **Design Patterns**: Are appropriate design patterns used consistently?
- **SOLID Principles**: Does the code adhere to SOLID principles?
- **Coupling and Cohesion**: Is the code properly decoupled with high cohesion?
- **Scalability**: Will the changes scale well with increased load or data?
- **Maintainability**: How easy will it be to modify this code in the future?

### 3. Code Standards and Best Practices
Check for adherence to coding standards:

- **Naming Conventions**: Are variables, functions, and classes named clearly?
- **Code Formatting**: Is the code consistently formatted?
- **Documentation**: Is the code adequately documented where necessary?
- **Dependencies**: Are new dependencies justified and secure?
- **Git Practices**: Are commits atomic and well-described?

### 4. Functional Analysis
Assess the functional aspects:

- **Requirements Fulfillment**: Does the code meet the stated requirements?
- **Edge Cases**: Are edge cases and error conditions handled?
- **User Experience**: How do the changes impact the end-user experience?
- **Backward Compatibility**: Are breaking changes properly documented?
- **Integration**: How well do the changes integrate with existing systems?

### 5. Review Questions to Consider

#### For Bug Fixes:
- Does this fix address the root cause or just symptoms?
- Are there similar issues elsewhere that should be addressed?
- Is the fix tested with appropriate test cases?

#### For New Features:
- Is this feature necessary and well-scoped?
- Does it introduce technical debt?
- Are there alternative approaches that might be better?
- Is the feature properly documented?

#### For Refactoring:
- Does the refactoring improve code quality without changing behavior?
- Are all affected areas properly tested?
- Is the scope of refactoring appropriate?

### 6. Security Considerations
Always evaluate security implications:

- **Input Validation**: Is user input properly validated and sanitized?
- **Authentication/Authorization**: Are access controls correctly implemented?
- **Data Protection**: Is sensitive data properly handled and stored?
- **SQL Injection**: Are database queries protected against injection attacks?
- **XSS Prevention**: Is the code protected against cross-site scripting?
- **Dependency Vulnerabilities**: Are third-party dependencies secure and up-to-date?

### 7. Performance Analysis
Look for performance optimization opportunities:

- **Algorithm Efficiency**: Are efficient algorithms and data structures used?
- **Database Queries**: Are database operations optimized?
- **Caching**: Is appropriate caching implemented where beneficial?
- **Resource Usage**: Is memory and CPU usage reasonable?
- **Network Calls**: Are API calls and network requests optimized?

### 8. Review Tone and Communication
When providing feedback:

- Be constructive and specific in your comments
- Suggest alternatives when pointing out issues
- Acknowledge good practices and improvements
- Ask questions to understand the reasoning behind decisions
- Focus on the code, not the person

### 9. Checklist for Reviewers

Before approving a pull request, ensure:

- [ ] Code compiles without warnings
- [ ] All tests pass
- [ ] Code follows project conventions
- [ ] No obvious security vulnerabilities
- [ ] Performance impact is acceptable
- [ ] Documentation is updated if needed
- [ ] Breaking changes are clearly documented
- [ ] The change is the minimal necessary to achieve the goal

### 10. Common Red Flags

Watch out for these warning signs:

- Overly complex functions or classes
- Hardcoded values that should be configurable
- Missing error handling
- Inconsistent code style
- Lack of tests for critical functionality
- Poor variable or function naming
- Commented-out code without explanation
- Large files or functions that should be split
- Tight coupling between unrelated components`;

    const header = `# 🎯 PR Review Guidelines - START HERE!

This comprehensive guide should be your FIRST step when analyzing any Pull Request. 
These guidelines will help you perform thorough, professional code reviews.

---

`;
    
    return {
      content: [
        {
          type: 'text',
          text: header + content,
        },
      ],
    };
  }

  async handleAnalyzeCodeQuality(args) {
    const { pr_url, file_paths = null } = args;
    
    if (!pr_url) {
      throw new Error('PR URL is required');
    }

    const prDetails = await this.github.getPRDetails(pr_url);
    const analysis = await this.analysis.analyzeCodeQuality(prDetails, file_paths);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            analysis_type: 'code_quality',
            pr_url,
            ...analysis
          }, null, 2),
        },
      ],
    };
  }

  async handleAnalyzeDiffImpact(args) {
    const { pr_url } = args;
    
    if (!pr_url) {
      throw new Error('PR URL is required');
    }

    const prDetails = await this.github.getPRDetails(pr_url);
    const analysis = await this.analysis.analyzeDiffImpact(prDetails);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            analysis_type: 'diff_impact',
            pr_url,
            ...analysis
          }, null, 2),
        },
      ],
    };
  }

  async handleDetectSecurityIssues(args) {
    const { pr_url } = args;
    
    if (!pr_url) {
      throw new Error('PR URL is required');
    }

    const prDetails = await this.github.getPRDetails(pr_url);
    const analysis = await this.analysis.detectSecurityIssues(prDetails);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            analysis_type: 'security_analysis',
            pr_url,
            ...analysis
          }, null, 2),
        },
      ],
    };
  }

  async handleDetectCodePatterns(args) {
    const { pr_url, language = null } = args;
    
    if (!pr_url) {
      throw new Error('PR URL is required');
    }

    const prDetails = await this.github.getPRDetails(pr_url);
    const analysis = await this.analysis.detectCodePatterns(prDetails, language);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            analysis_type: 'pattern_detection',
            pr_url,
            ...analysis
          }, null, 2),
        },
      ],
    };
  }

  async handleAnalyzeDependencies(args) {
    const { pr_url } = args;
    
    if (!pr_url) {
      throw new Error('PR URL is required');
    }

    const prDetails = await this.github.getPRDetails(pr_url);
    const analysis = await this.analysis.analyzeDependencies(prDetails);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            analysis_type: 'dependency_analysis',
            pr_url,
            ...analysis
          }, null, 2),
        },
      ],
    };
  }

  async handleAnalyzeTestCoverage(args) {
    const { pr_url } = args;
    
    if (!pr_url) {
      throw new Error('PR URL is required');
    }

    const prDetails = await this.github.getPRDetails(pr_url);
    const analysis = await this.analysis.analyzeTestCoverage(prDetails);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            analysis_type: 'test_coverage',
            pr_url,
            ...analysis
          }, null, 2),
        },
      ],
    };
  }

  async handleGenerateSuggestions(args) {
    const { pr_url, file_path, focus_areas = [] } = args;
    
    if (!pr_url || !file_path) {
      throw new Error('PR URL and file path are required');
    }

    const prDetails = await this.github.getPRDetails(pr_url);
    const suggestions = await this.analysis.generateSuggestions(prDetails, file_path, focus_areas);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            analysis_type: 'code_suggestions',
            pr_url,
            file_path,
            focus_areas,
            ...suggestions
          }, null, 2),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('GitHub MCP server running on stdio');
  }
}

const server = new GitHubMCPServer();
server.run().catch(console.error);