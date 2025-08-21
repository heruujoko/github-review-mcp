# MCP PR Review Server

An MCP (Model Context Protocol) server for automated GitHub Pull Request reviews using local Ollama, Cursor CLI, or Gemini CLI as AI providers.

## Features

- 🔍 Automated PR analysis using GitHub API
- 🤖 Multiple AI providers (Ollama, Cursor, Gemini)
- 📝 Customizable review prompts
- 🔧 Configurable via environment variables
- 📊 Comprehensive PR context gathering
- 💬 Optional auto-posting of reviews to GitHub

## Prerequisites

1. **Node.js** (v18 or higher)
2. **Ollama** (if using local AI)
3. **Cursor CLI** (if using Cursor)
4. **Gemini CLI** (if using Gemini)

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd mcp-pr-review-server
npm install
```

### 2. Set up Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your credentials (see [Required Credentials](#required-credentials) section).

### 3. Start the Server

```bash
npm start
```

## Required Credentials

### GitHub Personal Access Token (Required)

1. Go to GitHub → Settings → Developer settings → Personal access tokens
2. Generate a new token (classic) with these permissions:
   - `repo` (Full control of private repositories)
   - `pull_requests` (Read/write pull requests)
3. Add to `.env` as `GITHUB_TOKEN=ghp_your_token_here`

### AI Provider Setup

#### Option 1: Ollama (Local AI)

```bash
# Install Ollama
curl -fsSL https://ollama.ai/install.sh | sh

# Pull a model
ollama pull llama3.1

# Start Ollama (if not running)
ollama serve
```

#### Option 2: Cursor CLI

```bash
# Install Cursor CLI (check Cursor documentation)
# Set CURSOR_CLI_PATH in .env if not in PATH
```

#### Option 3: Gemini CLI

```bash
# Install Gemini CLI
# Get API key from Google Cloud Console
# Set GEMINI_API_KEY in .env
```

## Usage

### MCP Client Integration

Add to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "pr-review": {
      "command": "node",
      "args": ["/path/to/mcp-pr-review-server/src/index.js"],
      "env": {
        "GITHUB_TOKEN": "your_token_here"
      }
    }
  }
}
```

### Available Tools

#### 1. Review PR

```javascript
// Review a PR with default settings
review_pr({
  pr_url: "https://github.com/owner/repo/pull/123"
})

// Review with specific model and provider
review_pr({
  pr_url: "https://github.com/owner/repo/pull/123",
  model: "llama3.1",
  provider: "ollama"
})
```

#### 2. Manage Review Prompts

```javascript
// Get current prompt
get_review_prompt()

// Update prompt
update_review_prompt({
  prompt: "Your custom review instructions..."
})
```

#### 3. List Available Models

```javascript
// List Ollama models
list_models({ provider: "ollama" })

// List Cursor models
list_models({ provider: "cursor" })

// List Gemini models
list_models({ provider: "gemini" })
```

## Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `GITHUB_TOKEN` | GitHub Personal Access Token | - | ✅ |
| `OLLAMA_HOST` | Ollama server URL | `http://localhost:11434` | ❌ |
| `DEFAULT_MODEL` | Default AI model | `llama3.1` | ❌ |
| `PROMPT_FILE_PATH` | Review prompt file path | `./prompts/review-prompt.md` | ❌ |
| `AUTO_POST_REVIEW` | Auto-post reviews to GitHub | `false` | ❌ |
| `CURSOR_CLI_PATH` | Cursor CLI path | `cursor` | ❌ |
| `GEMINI_API_KEY` | Gemini API key | - | ❌ |
| `MAX_PATCH_SIZE` | Max patch size in chars | `2000` | ❌ |
| `MAX_FILES_TO_REVIEW` | Max files per PR | `50` | ❌ |

### Customizing Review Prompts

Edit `prompts/review-prompt.md` to customize the review instructions. The prompt supports these placeholders:

- `{{PR_TITLE}}` - Pull request title
- `{{PR_DESCRIPTION}}` - Pull request description
- `{{PR_AUTHOR}}` - Pull request author
- `{{REPOSITORY}}` - Repository name
- `{{PRIMARY_LANGUAGE}}` - Primary programming language
- `{{LANGUAGES}}` - All detected languages
- `{{FILE_CHANGES}}` - Detailed file changes with diffs
- `{{RECENT_COMMITS}}` - Recent commit messages

## Development

### Project Structure

```
├── src/
│   ├── index.js              # Main MCP server
│   └── services/
│       ├── github.js         # GitHub API integration
│       ├── ollama.js         # Ollama integration
│       ├── review.js         # Review logic
│       └── config.js         # Configuration management
├── prompts/
│   └── review-prompt.md      # Review prompt template
├── .env.example              # Environment template
└── package.json
```

### Running in Development

```bash
npm run dev  # Runs with --watch flag
```

### Testing

```bash
npm test
```

## AI Provider Details

### Ollama
- **Pros**: Fully local, private, free
- **Cons**: Requires local GPU/CPU resources
- **Models**: llama3.1, codellama, mistral, etc.

### Cursor
- **Pros**: High-quality models, IDE integration
- **Cons**: Requires Cursor subscription
- **Models**: GPT-4, Claude, etc.

### Gemini
- **Pros**: Google's latest AI, competitive pricing
- **Cons**: Requires API key and billing
- **Models**: gemini-pro, gemini-1.5-pro, etc.

## Troubleshooting

### Common Issues

1. **"GitHub token is required" error**
   - Ensure `GITHUB_TOKEN` is set in `.env`
   - Verify token has correct permissions

2. **"Cannot connect to Ollama" error**
   - Check if Ollama is running: `ollama serve`
   - Verify `OLLAMA_HOST` in `.env`

3. **"Model not found" error**
   - Pull the model: `ollama pull model-name`
   - Check available models: `ollama list`

4. **MCP connection issues**
   - Verify MCP client configuration
   - Check server logs for errors

### Logs

Server logs are written to stderr and can be viewed in your MCP client or terminal.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

- Create issues for bugs or feature requests
- Check existing issues before creating new ones
- Provide detailed information including logs and configuration