#!/bin/bash

set -e

echo "🚀 Setting up GitHub MCP Server..."

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

# Simple version comparison function
version_compare() {
    local current="$1"
    local required="$2"
    
    # Split versions into arrays
    IFS='.' read -ra CURRENT_PARTS <<< "$current"
    IFS='.' read -ra REQUIRED_PARTS <<< "$required"
    
    # Compare major version
    if [ "${CURRENT_PARTS[0]}" -gt "${REQUIRED_PARTS[0]}" ]; then
        return 0
    elif [ "${CURRENT_PARTS[0]}" -lt "${REQUIRED_PARTS[0]}" ]; then
        return 1
    fi
    
    # Compare minor version
    if [ "${CURRENT_PARTS[1]}" -gt "${REQUIRED_PARTS[1]}" ]; then
        return 0
    elif [ "${CURRENT_PARTS[1]}" -lt "${REQUIRED_PARTS[1]}" ]; then
        return 1
    fi
    
    # Compare patch version
    if [ "${CURRENT_PARTS[2]}" -ge "${REQUIRED_PARTS[2]}" ]; then
        return 0
    else
        return 1
    fi
}

if ! version_compare "$NODE_VERSION" "$REQUIRED_VERSION"; then
    echo -e "${RED}❌ Node.js version $NODE_VERSION found. Requires version $REQUIRED_VERSION or higher.${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js version $NODE_VERSION is compatible${NC}"

# Install dependencies
echo "📦 Installing dependencies..."
pnpm install

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "⚙️  Creating .env file from template..."
    cp .env.example .env
    echo -e "${YELLOW}📝 Please edit .env file with your credentials${NC}"
else
    echo -e "${GREEN}✅ .env file already exists${NC}"
fi

# Verify required directories exist
echo "📁 Creating required directories..."
mkdir -p src/services

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
echo "2. Run: npm start"
echo "3. Configure your MCP client to use this server"
echo ""
echo -e "${YELLOW}📚 Documentation:${NC}"
echo "- README.md for detailed setup and configuration instructions"
echo "- GitHub token setup guide in README.md"
echo ""
echo -e "${GREEN}Ready to integrate with your MCP client! 🚀${NC}"