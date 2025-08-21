#!/bin/bash

set -e

echo "🚀 Setting up MCP PR Review Server..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check Node.js version
echo "📋 Checking Node.js version..."
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js not found. Please install Node.js 18 or higher.${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2)
REQUIRED_VERSION="18.0.0"

if ! node -p "process.exit(require('semver').gte('$NODE_VERSION', '$REQUIRED_VERSION'))" 2>/dev/null; then
    echo -e "${RED}❌ Node.js version $NODE_VERSION found. Requires version $REQUIRED_VERSION or higher.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js version $NODE_VERSION is compatible${NC}"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "⚙️  Creating .env file from template..."
    cp .env.example .env
    echo -e "${YELLOW}📝 Please edit .env file with your credentials${NC}"
else
    echo -e "${GREEN}✅ .env file already exists${NC}"
fi

# Create prompts directory
echo "📁 Creating prompts directory..."
mkdir -p prompts

# Check if Ollama is available
echo "🔍 Checking Ollama installation..."
if command -v ollama &> /dev/null; then
    echo -e "${GREEN}✅ Ollama found${NC}"
    
    # Check if Ollama is running
    if curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo -e "${GREEN}✅ Ollama server is running${NC}"
        
        # List available models
        echo "📋 Available Ollama models:"
        ollama list
        
        # Suggest pulling a model if none available
        if [ $(ollama list | wc -l) -eq 1 ]; then
            echo -e "${YELLOW}💡 No models found. Consider pulling a model:${NC}"
            echo "   ollama pull llama3.1"
            echo "   ollama pull codellama"
        fi
    else
        echo -e "${YELLOW}⚠️  Ollama found but not running. Start with: ollama serve${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Ollama not found. Install from: https://ollama.ai${NC}"
fi

# Check GitHub token
echo "🔐 Checking GitHub token..."
if [ -f .env ] && grep -q "GITHUB_TOKEN=ghp_" .env; then
    echo -e "${GREEN}✅ GitHub token appears to be set${NC}"
else
    echo -e "${YELLOW}⚠️  GitHub token not configured. Please:${NC}"
    echo "   1. Go to GitHub → Settings → Developer settings → Personal access tokens"
    echo "   2. Generate token with 'repo' and 'pull_requests' permissions"
    echo "   3. Add to .env: GITHUB_TOKEN=your_token_here"
fi

# Test the setup
echo "🧪 Testing server setup..."
timeout 10s node src/index.js --help 2>/dev/null || {
    echo -e "${YELLOW}⚠️  Could not test server (this is normal if credentials aren't set yet)${NC}"
}

echo ""
echo -e "${GREEN}🎉 Setup complete!${NC}"
echo ""
echo -e "${YELLOW}📋 Next steps:${NC}"
echo "1. Edit .env file with your GitHub token"
echo "2. Install and start Ollama (or configure other AI providers)"
echo "3. Run: npm start"
echo "4. Configure your MCP client to use this server"
echo ""
echo -e "${YELLOW}📚 Documentation:${NC}"
echo "- README.md for detailed setup instructions"
echo "- prompts/review-prompt.md to customize review prompts"
echo ""
echo -e "${GREEN}Happy reviewing! 🚀${NC}"