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

## How to Configure MCP Client

This section provides detailed instructions for setting up the MCP PR Review Server with various MCP clients.

### Cursor IDE

Cursor has built-in MCP support. Here's how to configure it:

#### Method 1: Using Cursor's MCP Settings

1. **Open Cursor Settings**
   - Press `Cmd/Ctrl + ,` to open settings
   - Navigate to "Extensions" → "MCP"

2. **Add Server Configuration**
   - Click "Add Server"
   - Fill in the details:
     - **Name**: `PR Review`
     - **Command**: `node`
     - **Args**: `["/absolute/path/to/github-review-mcp/src/index.js"]`
     - **Environment Variables**:
       ```
       GITHUB_TOKEN=your_github_token_here
       OLLAMA_HOST=http://localhost:11434
       DEFAULT_MODEL=llama3.1
       ```

3. **Save and Restart**
   - Save the configuration
   - Restart Cursor for changes to take effect

#### Method 2: Manual Configuration File

1. **Locate Cursor's MCP config file**:
   - **macOS**: `~/Library/Application Support/Cursor/User/globalStorage/mcp-servers.json`
   - **Windows**: `%APPDATA%\Cursor\User\globalStorage\mcp-servers.json`
   - **Linux**: `~/.config/Cursor/User/globalStorage/mcp-servers.json`

2. **Edit the configuration file**:
   ```json
   {
     "mcpServers": {
       "pr-review": {
         "command": "node",
         "args": ["/absolute/path/to/github-review-mcp/src/index.js"],
         "env": {
           "GITHUB_TOKEN": "your_github_token_here",
           "OLLAMA_HOST": "http://localhost:11434",
           "DEFAULT_MODEL": "llama3.1",
           "PROMPT_FILE_PATH": "/absolute/path/to/github-review-mcp/prompts/review-prompt.md"
         }
       }
     }
   }
   ```

3. **Restart Cursor**

#### Using the PR Review Tools in Cursor

Once configured, you can use the tools in Cursor's chat:

```
Review this PR: https://github.com/owner/repo/pull/123

Or use the tool directly:
@pr-review review_pr pr_url="https://github.com/owner/repo/pull/123" model="llama3.1" provider="ollama"
```

### Claude Desktop

Claude Desktop is one of the most popular MCP clients.

#### Configuration Steps

1. **Locate Claude Desktop config file**:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

2. **Edit the configuration file**:
   ```json
   {
     "mcpServers": {
       "pr-review": {
         "command": "node",
         "args": ["/absolute/path/to/github-review-mcp/src/index.js"],
         "env": {
           "GITHUB_TOKEN": "your_github_token_here",
           "OLLAMA_HOST": "http://localhost:11434",
           "DEFAULT_MODEL": "llama3.1"
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop**

4. **Verify Connection**:
   - Look for the 🔧 icon in Claude Desktop
   - You should see "pr-review" listed as an available server

### VS Code (with MCP Extension)

If you're using VS Code with an MCP extension:

1. **Install MCP Extension**
   - Search for "MCP" in VS Code extensions
   - Install a compatible MCP client extension

2. **Configure in settings.json**:
   ```json
   {
     "mcp.servers": {
       "pr-review": {
         "command": "node",
         "args": ["/absolute/path/to/github-review-mcp/src/index.js"],
         "env": {
           "GITHUB_TOKEN": "your_github_token_here",
           "DEFAULT_MODEL": "llama3.1"
         }
       }
     }
   }
   ```

### Custom MCP Client

For other MCP clients or custom implementations:

#### Basic Configuration Template

```json
{
  "servers": {
    "pr-review": {
      "command": "node",
      "args": ["/absolute/path/to/github-review-mcp/src/index.js"],
      "env": {
        "GITHUB_TOKEN": "your_github_token_here",
        "OLLAMA_HOST": "http://localhost:11434",
        "DEFAULT_MODEL": "llama3.1",
        "PROMPT_FILE_PATH": "/absolute/path/to/prompts/review-prompt.md",
        "AUTO_POST_REVIEW": "false",
        "MAX_PATCH_SIZE": "2000",
        "MAX_FILES_TO_REVIEW": "50"
      }
    }
  }
}
```

### Important Configuration Notes

#### 1. **Use Absolute Paths**
Always use absolute paths in your configuration to avoid path resolution issues:
```bash
# Find your absolute path
pwd
# Example output: /Users/username/projects/github-review-mcp
```

#### 2. **Environment Variables Priority**
Environment variables are loaded in this order:
1. Client configuration `env` object
2. System environment variables
3. `.env` file in the project directory

#### 3. **Required vs Optional Variables**
- **Required**: `GITHUB_TOKEN`
- **Optional**: All others have sensible defaults

#### 4. **Multiple Configurations**
You can run multiple instances with different configurations:
```json
{
  "mcpServers": {
    "pr-review-ollama": {
      "command": "node",
      "args": ["/path/to/github-review-mcp/src/index.js"],
      "env": {
        "GITHUB_TOKEN": "token",
        "DEFAULT_MODEL": "llama3.1",
        "OLLAMA_HOST": "http://localhost:11434"
      }
    },
    "pr-review-gemini": {
      "command": "node",
      "args": ["/path/to/github-review-mcp/src/index.js"],
      "env": {
        "GITHUB_TOKEN": "token",
        "DEFAULT_MODEL": "gemini-pro",
        "GEMINI_API_KEY": "your_gemini_key"
      }
    }
  }
}
```

### Troubleshooting MCP Configuration

#### Common Configuration Issues

1. **Server not appearing in client**
   - Check that the path to `index.js` is correct and absolute
   - Verify Node.js is in your PATH
   - Check client logs for error messages

2. **"GitHub token is required" error**
   - Ensure `GITHUB_TOKEN` is set in the `env` object
   - Verify the token has correct permissions

3. **Permission denied errors**
   - Make sure the MCP client has permission to execute Node.js
   - Check file permissions on the script

4. **Environment variable not loading**
   - Use absolute paths for file references
   - Check that environment variables are properly quoted in JSON

#### Debug Mode

Enable debug logging by adding to your environment:
```json
{
  "env": {
    "DEBUG": "mcp:*",
    "NODE_ENV": "development"
  }
}
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