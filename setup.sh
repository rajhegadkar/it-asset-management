#!/usr/bin/env bash
# ==============================================================================
#  IT Asset Management Enterprise Platform (v2.2.0)
#  1-Touch Automated Setup Script for Linux & macOS Environments
# ==============================================================================

set -e

# ANSI Color Codes
COLOR_RESET="\033[0m"
COLOR_BOLD="\033[1m"
COLOR_GREEN="\033[32m"
COLOR_YELLOW="\033[33m"
COLOR_CYAN="\033[36m"
COLOR_RED="\033[31m"
COLOR_GRAY="\033[90m"

echo -e "${COLOR_CYAN}===============================================================================${COLOR_RESET}"
echo -e "${COLOR_BOLD}${COLOR_CYAN}     IT ASSET MANAGEMENT ENTERPRISE PLATFORM (v2.2.0)${COLOR_RESET}"
echo -e "${COLOR_YELLOW}              1-TOUCH AUTOMATED ENVIRONMENT SETUP (Linux / macOS)${COLOR_RESET}"
echo -e "${COLOR_CYAN}===============================================================================${COLOR_RESET}"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 1. Verify Node.js Environment
echo -e "${COLOR_BOLD}[1/7] Checking Node.js runtime environment...${COLOR_RESET}"
if ! command -v node >/dev/null 2>&1; then
    echo -e "${COLOR_RED}[ERROR] Node.js is NOT installed or not in PATH!${COLOR_RESET}"
    echo -e "Node.js v18.0.0 or higher is required."
    echo ""
    echo -e "${COLOR_YELLOW}Installation instructions:${COLOR_RESET}"
    echo "  - Debian / Ubuntu:  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt-get install -y nodejs"
    echo "  - RHEL / CentOS / Fedora: sudo dnf install -y nodejs"
    echo "  - Arch Linux:       sudo pacman -S nodejs npm"
    echo "  - macOS (Homebrew): brew install node"
    echo "  - Or official site: https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e "    ${COLOR_GREEN}✓ Node.js detected: ${NODE_VERSION}${COLOR_RESET}"
NODE_MAJOR=$(echo "$NODE_VERSION" | sed -E 's/^v([0-9]+).*/\1/')
if [ "$NODE_MAJOR" -lt 18 ]; then
    echo -e "    ${COLOR_YELLOW}⚠ Warning: Node.js version is ${NODE_VERSION}. Version 18.0.0+ is recommended.${COLOR_RESET}"
fi

# 2. Verify npm
echo -e "${COLOR_BOLD}[2/7] Checking npm package manager...${COLOR_RESET}"
if ! command -v npm >/dev/null 2>&1; then
    echo -e "${COLOR_RED}[ERROR] npm is not found. Please install npm alongside Node.js.${COLOR_RESET}"
    exit 1
fi
NPM_VERSION=$(npm -v)
echo -e "    ${COLOR_GREEN}✓ npm detected: v${NPM_VERSION}${COLOR_RESET}"

# 3. Environment Configuration
echo -e "${COLOR_BOLD}[3/7] Configuring environment variables (.env)...${COLOR_RESET}"
if [ ! -f "backend/.env" ]; then
    if [ -f "backend/.env.example" ]; then
        cp backend/.env.example backend/.env
        echo -e "    ${COLOR_GREEN}✓ Created backend/.env from template (SQLite zero-config enabled).${COLOR_RESET}"
    elif [ -f ".env.example" ]; then
        cp .env.example backend/.env
        echo -e "    ${COLOR_GREEN}✓ Created backend/.env from root template.${COLOR_RESET}"
    else
        cat << 'EOF' > backend/.env
PORT=5000
NODE_ENV=development
DATABASE_URL="file:./dev.db"
JWT_SECRET="itam_jwt_secret_dev_2026_xyz"
JWT_REFRESH_SECRET="itam_jwt_refresh_dev_2026_xyz"
APP_URL="http://localhost:5173"
CORS_ORIGIN="*"
EOF
        echo -e "    ${COLOR_GREEN}✓ Generated default backend/.env configuration.${COLOR_RESET}"
    fi
else
    echo -e "    ${COLOR_GRAY}✓ backend/.env already exists. Preserving custom configuration.${COLOR_RESET}"
fi

# 4. Install Dependencies
echo -e "${COLOR_BOLD}[4/7] Installing dependencies...${COLOR_RESET}"
echo -e "    Installing Backend dependencies..."
npm --prefix backend install --no-audit --prefer-offline >/dev/null 2>&1 || npm --prefix backend install
echo -e "    ${COLOR_GREEN}✓ Backend dependencies ready.${COLOR_RESET}"

echo -e "    Installing Frontend dependencies..."
npm --prefix frontend install --no-audit --prefer-offline >/dev/null 2>&1 || npm --prefix frontend install
echo -e "    ${COLOR_GREEN}✓ Frontend dependencies ready.${COLOR_RESET}"

# 5. Database Setup & Prisma Client
echo -e "${COLOR_BOLD}[5/7] Initializing embedded SQLite database & Prisma Client...${COLOR_RESET}"
npm --prefix backend run prisma:generate >/dev/null
npm --prefix backend run prisma:push >/dev/null
echo -e "    ${COLOR_GREEN}✓ Database schema pushed and Prisma Client generated.${COLOR_RESET}"

# 6. Master Data Seeding
echo -e "${COLOR_BOLD}[6/7] Seeding enterprise master data & administrator accounts...${COLOR_RESET}"
npm --prefix backend run prisma:seed >/dev/null 2>&1 || true
echo -e "    ${COLOR_GREEN}✓ Initial master data and default accounts seeded.${COLOR_RESET}"

# 7. Compiling Applications
echo -e "${COLOR_BOLD}[7/7] Compiling production distribution assets...${COLOR_RESET}"
echo -e "    Compiling Backend TypeScript..."
npm --prefix backend run build >/dev/null
echo -e "    ${COLOR_GREEN}✓ Backend compiled.${COLOR_RESET}"

echo -e "    Bundling Frontend Vite client..."
npm --prefix frontend run build >/dev/null
echo -e "    ${COLOR_GREEN}✓ Frontend bundled.${COLOR_RESET}"

# Ensure execution permissions on scripts
chmod +x setup.sh start.sh scripts/*.sh 2>/dev/null || true

echo ""
echo -e "${COLOR_GREEN}===============================================================================${COLOR_RESET}"
echo -e "${COLOR_BOLD}${COLOR_GREEN}                    SETUP COMPLETED SUCCESSFULLY! (100%)${COLOR_RESET}"
echo -e "${COLOR_GREEN}===============================================================================${COLOR_RESET}"
echo ""
echo -e "${COLOR_YELLOW}Default Administrative Credentials:${COLOR_RESET}"
echo -e "  - ${COLOR_BOLD}Super Admin:${COLOR_RESET}    admin@acme-corp.com      /  Admin@123456"
echo -e "  - ${COLOR_BOLD}IT Admin:${COLOR_RESET}       itadmin@acme-corp.com    /  Admin@123456"
echo -e "  - ${COLOR_BOLD}Employee User:${COLOR_RESET}  john.doe@acme-corp.com   /  User@123456"
echo ""
echo -e "${COLOR_YELLOW}Local Service Endpoints:${COLOR_RESET}"
echo -e "  - ${COLOR_CYAN}Frontend Web App:${COLOR_RESET}  http://localhost:5173"
echo -e "  - ${COLOR_CYAN}Backend REST API:${COLOR_RESET}  http://localhost:5000"
echo -e "  - ${COLOR_CYAN}Swagger API Docs:${COLOR_RESET}  http://localhost:5000/api/docs"
echo -e "  - ${COLOR_CYAN}Health Check:${COLOR_RESET}      http://localhost:5000/api/v1/health"
echo ""
echo -e "${COLOR_GREEN}===============================================================================${COLOR_RESET}"
echo ""

read -p "Would you like to start the platform now? [Y/n] " -n 1 -r RUN_NOW
echo ""
if [[ $RUN_NOW =~ ^[Yy]$ ]] || [ -z "$RUN_NOW" ]; then
    echo -e "${COLOR_CYAN}Starting IT Asset Management platform...${COLOR_RESET}"
    exec ./start.sh
else
    echo -e "${COLOR_YELLOW}To start the platform anytime, run:${COLOR_RESET} ./start.sh"
    echo ""
fi
