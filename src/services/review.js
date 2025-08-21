import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class ReviewService {
  constructor(githubService, ollamaService, configService) {
    this.github = githubService;
    this.ollama = ollamaService;
    this.config = configService;
    this.promptPath = this.config.get('PROMPT_FILE_PATH', './prompts/review-prompt.md');
  }

  /**
   * Main method to review a PR
   */
  async reviewPR(prUrl, options = {}) {
    const { model = 'llama3.1', provider = 'ollama' } = options;
    
    console.error(`Starting review for PR: ${prUrl}`);
    
    // Get PR details
    const prDetails = await this.github.getPRDetails(prUrl);
    
    // Get review prompt
    const promptTemplate = await this.getPrompt();
    
    // Prepare context
    const context = await this.prepareReviewContext(prDetails);
    
    // Generate review based on provider
    let review;
    switch (provider) {
      case 'ollama':
        review = await this.generateWithOllama(promptTemplate, context, model);
        break;
      case 'cursor':
        review = await this.generateWithCursor(promptTemplate, context, model);
        break;
      case 'gemini':
        review = await this.generateWithGemini(promptTemplate, context, model);
        break;
      default:
        throw new Error(`Unknown provider: ${provider}`);
    }

    // Post review if configured
    const autoPost = this.config.get('AUTO_POST_REVIEW', 'false') === 'true';
    if (autoPost) {
      await this.postReview(prDetails, review);
    }

    return {
      pr_url: prUrl,
      pr_details: {
        title: prDetails.pr.title,
        number: prDetails.pr.number,
        author: prDetails.pr.author,
        files_changed: prDetails.files.length,
        additions: prDetails.pr.additions,
        deletions: prDetails.pr.deletions,
      },
      review,
      provider,
      model,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Prepare context for review
   */
  async prepareReviewContext(prDetails) {
    const { pr, files, commits, repository } = prDetails;
    
    // Get repository context
    const languages = await this.github.getRepoLanguages(repository.owner, repository.repo);
    const readme = await this.github.getRepoREADME(repository.owner, repository.repo);
    
    // Prepare file changes summary
    const fileChanges = files.map(file => ({
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      patch: this.truncatePatch(file.patch, 2000), // Limit patch size
    }));

    // Recent commits summary
    const commitSummary = commits.slice(0, 5).map(commit => ({
      message: commit.message,
      author: commit.author,
    }));

    return {
      pr_info: {
        title: pr.title,
        description: pr.body || 'No description provided',
        author: pr.author,
        base_branch: pr.base_branch,
        head_branch: pr.head_branch,
        additions: pr.additions,
        deletions: pr.deletions,
        changed_files_count: pr.changed_files,
      },
      repository_info: {
        name: repository.full_name,
        primary_language: this.getPrimaryLanguage(languages),
        languages: Object.keys(languages),
        has_readme: !!readme,
      },
      file_changes: fileChanges,
      recent_commits: commitSummary,
      existing_reviews: prDetails.existing_reviews.length,
    };
  }

  /**
   * Generate review using Ollama
   */
  async generateWithOllama(promptTemplate, context, model) {
    await this.ollama.ensureModel(model);
    
    const fullPrompt = this.buildPrompt(promptTemplate, context);
    const response = await this.ollama.generate(model, fullPrompt);
    
    return {
      content: response.response,
      model: response.model,
      provider: 'ollama',
      tokens_used: response.eval_count || 0,
      generation_time: response.total_duration || 0,
    };
  }

  /**
   * Generate review using Cursor CLI
   */
  async generateWithCursor(promptTemplate, context, model = 'gpt-4') {
    const fullPrompt = this.buildPrompt(promptTemplate, context);
    
    // Save prompt to temporary file
    const tempFile = `/tmp/pr-review-${Date.now()}.txt`;
    await fs.writeFile(tempFile, fullPrompt);
    
    try {
      // Use cursor CLI - adjust command based on your cursor setup
      const command = `cursor --model ${model} --file ${tempFile}`;
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr) {
        console.error('Cursor CLI warning:', stderr);
      }
      
      return {
        content: stdout.trim(),
        model,
        provider: 'cursor',
      };
    } catch (error) {
      throw new Error(`Cursor CLI failed: ${error.message}`);
    } finally {
      // Cleanup temp file
      try {
        await fs.unlink(tempFile);
      } catch {}
    }
  }

  /**
   * Generate review using Gemini CLI
   */
  async generateWithGemini(promptTemplate, context, model = 'gemini-pro') {
    const fullPrompt = this.buildPrompt(promptTemplate, context);
    
    try {
      // Use gemini CLI - adjust command based on your gemini setup
      const command = `gemini generate --model ${model} --prompt "${fullPrompt.replace(/"/g, '\\"')}"`;
      const { stdout, stderr } = await execAsync(command);
      
      if (stderr) {
        console.error('Gemini CLI warning:', stderr);
      }
      
      return {
        content: stdout.trim(),
        model,
        provider: 'gemini',
      };
    } catch (error) {
      throw new Error(`Gemini CLI failed: ${error.message}`);
    }
  }

  /**
   * Build final prompt with context
   */
  buildPrompt(template, context) {
    let prompt = template;
    
    // Replace placeholders
    prompt = prompt.replace('{{PR_TITLE}}', context.pr_info.title);
    prompt = prompt.replace('{{PR_DESCRIPTION}}', context.pr_info.description);
    prompt = prompt.replace('{{PR_AUTHOR}}', context.pr_info.author);
    prompt = prompt.replace('{{REPOSITORY}}', context.repository_info.name);
    prompt = prompt.replace('{{PRIMARY_LANGUAGE}}', context.repository_info.primary_language);
    prompt = prompt.replace('{{LANGUAGES}}', context.repository_info.languages.join(', '));
    
    // Add file changes
    const fileChangesText = context.file_changes.map(file => 
      `### ${file.filename} (${file.status})\n` +
      `+${file.additions} -${file.deletions}\n` +
      (file.patch ? `\`\`\`diff\n${file.patch}\n\`\`\`` : 'No patch available')
    ).join('\n\n');
    
    prompt = prompt.replace('{{FILE_CHANGES}}', fileChangesText);
    
    // Add commits
    const commitsText = context.recent_commits.map(commit => 
      `- ${commit.message} (by ${commit.author})`
    ).join('\n');
    
    prompt = prompt.replace('{{RECENT_COMMITS}}', commitsText);
    
    return prompt;
  }

  /**
   * Post review to GitHub
   */
  async postReview(prDetails, review) {
    const { repository, pr } = prDetails;
    
    const reviewBody = `## AI-Generated Code Review\n\n${review.content}\n\n---\n*Generated by: ${review.provider} (${review.model})*`;
    
    return await this.github.createReview(
      repository.owner,
      repository.repo,
      pr.number,
      {
        body: reviewBody,
        event: 'COMMENT',
      }
    );
  }

  /**
   * Get review prompt from file
   */
  async getPrompt() {
    try {
      return await fs.readFile(this.promptPath, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Create default prompt if file doesn't exist
        const defaultPrompt = await this.createDefaultPrompt();
        await this.updatePrompt(defaultPrompt);
        return defaultPrompt;
      }
      throw error;
    }
  }

  /**
   * Update review prompt
   */
  async updatePrompt(newPrompt) {
    // Ensure directory exists
    await fs.mkdir(path.dirname(this.promptPath), { recursive: true });
    await fs.writeFile(this.promptPath, newPrompt, 'utf8');
  }

  /**
   * Create default prompt template
   */
  async createDefaultPrompt() {
    return `# Code Review Instructions

You are an experienced software engineer conducting a thorough code review. Please analyze the following pull request and provide constructive feedback.

## PR Information
- **Title:** {{PR_TITLE}}
- **Description:** {{PR_DESCRIPTION}}
- **Author:** {{PR_AUTHOR}}
- **Repository:** {{REPOSITORY}}
- **Primary Language:** {{PRIMARY_LANGUAGE}}
- **Languages:** {{LANGUAGES}}

## Recent Commits
{{RECENT_COMMITS}}

## File Changes
{{FILE_CHANGES}}

## Review Guidelines

Please provide a comprehensive review covering:

1. **Code Quality**
   - Code readability and maintainability
   - Adherence to coding standards and best practices
   - Potential bugs or issues

2. **Architecture & Design**
   - Design patterns usage
   - Code organization and structure
   - Separation of concerns

3. **Performance**
   - Potential performance issues
   - Resource usage concerns
   - Optimization opportunities

4. **Security**
   - Security vulnerabilities
   - Input validation
   - Data handling concerns

5. **Testing**
   - Test coverage
   - Test quality and effectiveness
   - Missing test scenarios

6. **Documentation**
   - Code comments
   - Documentation updates needed
   - API documentation

## Response Format

Provide your review in the following structure:

### Summary
Brief overview of the changes and overall assessment.

### Strengths
What's done well in this PR.

### Issues & Concerns
List any problems found with severity levels (Critical/Major/Minor).

### Suggestions
Actionable recommendations for improvement.

### Approval Status
- ✅ Approved
- 🔄 Approved with minor changes
- ❌ Changes requested

Please be constructive, specific, and provide examples where possible.`;
  }

  /**
   * Utility methods
   */
  truncatePatch(patch, maxLength) {
    if (!patch || patch.length <= maxLength) return patch;
    return patch.substring(0, maxLength) + '\n... (truncated)';
  }

  getPrimaryLanguage(languages) {
    if (!languages || Object.keys(languages).length === 0) return 'Unknown';
    
    return Object.entries(languages)
      .sort(([,a], [,b]) => b - a)[0][0];
  }
}