#!/usr/bin/env bash
# ==============================================================================
#  IT Asset Management Enterprise Platform (v2.2.0)
#  System Launcher Script for Linux & macOS
# ==============================================================================

set -e

COLOR_RESET="\033[0m"
COLOR_BOLD="\033[1m"
COLOR_GREEN="\033[32m"
COLOR_YELLOW="\033[33m"
COLOR_CYAN="\033[36m"
COLOR_RED="\033[31m"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${COLOR_CYAN}===============================================================================${COLOR_RESET}"
echo -e "${COLOR_BOLD}${COLOR_CYAN}     IT ASSET MANAGEMENT ENTERPRISE PLATFORM (v2.2.0)${COLOR_RESET}"
echo -e "${COLOR_YELLOW}                         SYSTEM LAUNCHER${COLOR_RESET}"
echo -e "${COLOR_CYAN}===============================================================================${COLOR_RESET}"
echo ""

# Check if setup was executed
if [ ! -d "backend/node_modules" ] || [ ! -f "backend/prisma/dev.db" ]; then
    echo -e "${COLOR_YELLOW}[NOTICE] Installation not completed. Executing 1-Touch Setup first...${COLOR_RESET}"
    chmod +x ./setup.sh 2>/dev/null || true
    exec ./setup.sh
fi

# PIDs tracking for cleanup
BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
    echo ""
    echo -e "${COLOR_YELLOW}Stopping IT Asset Management platform services...${COLOR_RESET}"
    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
    # Also terminate any child node processes on port 5000 / 5173
    pkill -f "tsx watch src/server.ts" 2>/dev/null || true
    pkill -f "vite" 2>/dev/null || true
    echo -e "${COLOR_GREEN}✓ All services stopped cleanly.${COLOR_RESET}"
    exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 1. Start Backend API Server
echo -e "${COLOR_BOLD}[1/2] Starting Backend REST API Server (Port 5000)...${COLOR_RESET}"
(
    cd backend
    npm run dev
) &
BACKEND_PID=$!

# 2. Start Frontend Web Portal
echo -e "${COLOR_BOLD}[2/2] Starting Frontend Web Portal (Port 5173)...${COLOR_RESET}"
(
    cd frontend
    npm run dev
) &
FRONTEND_PID=$!

echo ""
echo -e "${COLOR_YELLOW}Waiting for services to become ready...${COLOR_RESET}"

# Poll health check
for i in {1..30}; do
    if curl -s http://localhost:5000/api/v1/health >/dev/null 2>&1; then
        break
    fi
    sleep 1
done

echo ""
echo -e "${COLOR_GREEN}===============================================================================${COLOR_RESET}"
echo -e "${COLOR_BOLD}${COLOR_GREEN}                      SERVICES ARE NOW LIVE & ACTIVE!${COLOR_RESET}"
echo -e "${COLOR_GREEN}===============================================================================${COLOR_RESET}"
echo ""
echo -e "   ➜ ${COLOR_BOLD}Frontend Web Portal:${COLOR_RESET}   ${COLOR_CYAN}http://localhost:5173${COLOR_RESET}"
echo -e "   ➜ ${COLOR_BOLD}Backend REST API:${COLOR_RESET}       ${COLOR_CYAN}http://localhost:5000${COLOR_RESET}"
echo -e "   ➜ ${COLOR_BOLD}Interactive Swagger:${COLOR_RESET}    ${COLOR_CYAN}http://localhost:5000/api/docs${COLOR_RESET}"
echo -e "   ➜ ${COLOR_BOLD}API Health Check:${COLOR_RESET}       ${COLOR_CYAN}http://localhost:5000/api/v1/health${COLOR_RESET}"
echo ""
echo -e "${COLOR_YELLOW}Default Administrative Logins:${COLOR_RESET}"
echo -e "  - ${COLOR_BOLD}Super Admin:${COLOR_RESET}    admin@acme-corp.com      /  Admin@123456"
echo -e "  - ${COLOR_BOLD}IT Admin:${COLOR_RESET}       itadmin@acme-corp.com    /  Admin@123456"
echo -e "  - ${COLOR_BOLD}Employee User:${COLOR_RESET}  john.doe@acme-corp.com   /  User@123456"
echo -e "${COLOR_GREEN}===============================================================================${COLOR_RESET}"
echo ""

# Attempt to open default browser
if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:5173" >/dev/null 2>&1 || true
elif command -v open >/dev/null 2>&1; then
    open "http://localhost:5173" >/dev/null 2>&1 || true
fi

echo -e "${COLOR_YELLOW}Press Ctrl+C to stop all services.${COLOR_RESET}"
echo ""

# Wait on background processes
wait "$BACKEND_PID" "$FRONTEND_PID"
