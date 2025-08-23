import { Octokit } from '@octokit/rest';

export class GitHubService {
  constructor(token) {
    if (!token) {
      throw new Error('GitHub token is required');
    }

    this.octokit = new Octokit({
      auth: token,
    });
  }

  /**
   * Parse GitHub PR URL to extract owner, repo, and pull number
   */
  parsePRUrl(url) {
    const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    if (!match) {
      throw new Error('Invalid GitHub PR URL format');
    }

    return {
      owner: match[1],
      repo: match[2],
      pull_number: parseInt(match[3]),
    };
  }

  /**
   * Get PR details including files changed
   */
  async getPRDetails(url) {
    const { owner, repo, pull_number } = this.parsePRUrl(url);

    // Get PR basic information
    const { data: pr } = await this.octokit.pulls.get({
      owner,
      repo,
      pull_number,
    });

    // Get files changed in PR
    const { data: files } = await this.octokit.pulls.listFiles({
      owner,
      repo,
      pull_number,
    });

    // Get commits
    const { data: commits } = await this.octokit.pulls.listCommits({
      owner,
      repo,
      pull_number,
    });

    // Get existing reviews
    const { data: reviews } = await this.octokit.pulls.listReviews({
      owner,
      repo,
      pull_number,
    });

    return {
      pr: {
        id: pr.id,
        number: pr.number,
        title: pr.title,
        body: pr.body,
        state: pr.state,
        author: pr.user.login,
        created_at: pr.created_at,
        updated_at: pr.updated_at,
        base_branch: pr.base.ref,
        head_branch: pr.head.ref,
        mergeable: pr.mergeable,
        additions: pr.additions,
        deletions: pr.deletions,
        changed_files: pr.changed_files,
      },
      files: files.map(file => ({
        filename: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        changes: file.changes,
        patch: file.patch,
        blob_url: file.blob_url,
      })),
      commits: commits.map(commit => ({
        sha: commit.sha,
        message: commit.commit.message,
        author: commit.commit.author.name,
        date: commit.commit.author.date,
      })),
      existing_reviews: reviews.map(review => ({
        id: review.id,
        user: review.user.login,
        state: review.state,
        body: review.body,
        submitted_at: review.submitted_at,
      })),
      repository: {
        owner,
        repo,
        full_name: `${owner}/${repo}`,
      },
    };
  }

  /**
   * Get file content from repository
   */
  async getFileContent(owner, repo, path, ref) {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
        ref,
      });

      if (data.type === 'file') {
        return Buffer.from(data.content, 'base64').toString('utf8');
      }

      return null;
    } catch (error) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Post review comment on PR
   */
  async createReview(owner, repo, pull_number, review) {
    const { body, event = 'COMMENT', comments = [] } = review;

    const reviewData = {
      owner,
      repo,
      pull_number,
      body,
      event, // Can be 'APPROVE', 'REQUEST_CHANGES', or 'COMMENT'
    };

    if (comments.length > 0) {
      reviewData.comments = comments.map(comment => ({
        path: comment.path,
        line: comment.line,
        body: comment.body,
      }));
    }

    const { data } = await this.octokit.pulls.createReview(reviewData);
    return data;
  }

  /**
   * Get repository languages
   */
  async getRepoLanguages(owner, repo) {
    const { data } = await this.octokit.repos.listLanguages({
      owner,
      repo,
    });

    return data;
  }

  /**
   * Get repository README
   */
  async getRepoREADME(owner, repo) {
    try {
      const { data } = await this.octokit.repos.getReadme({
        owner,
        repo,
      });

      return Buffer.from(data.content, 'base64').toString('utf8');
    } catch (error) {
      if (error.status === 404) {
        return null;
      }
      throw error;
    }
  }
}
