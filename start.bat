@echo off
setlocal
title Launching IT Asset Management Enterprise v1.0
echo ===================================================================
echo   IT Asset Management Platform v1.0 (Enterprise Edition)
echo ===================================================================
echo.

cd /d "%~dp0"

:: 1. Check Backend .env
if not exist "backend\.env" (
    echo [SETUP] backend\.env not found. Creating from backend\.env.example...
    copy backend\.env.example backend\.env >nul
)

:: 2. Check Backend Dependencies
if not exist "backend\node_modules" (
    echo [SETUP] Installing backend dependencies...
    pushd backend
    call npm.cmd install
    popd
)

:: 3. Check Frontend Dependencies
if not exist "frontend\node_modules" (
    echo [SETUP] Installing frontend dependencies...
    pushd frontend
    call npm.cmd install
    popd
)

:: 4. Check Database
if not exist "backend\prisma\dev.db" (
    echo [SETUP] Initializing database schema and seeding demo data...
    pushd backend
    call npx.cmd prisma db push
    call npx.cmd prisma db seed
    popd
)

:: 5. Start Backend API Server
echo Starting Backend API Server (Port 5000)...
start "ITAM Backend Server (Port 5000)" cmd /k "cd backend && npm.cmd start"

:: 6. Start Frontend Web Portal
echo Starting Frontend Web Portal (Port 5173)...
start "ITAM Frontend Web (Port 5173)" cmd /k "cd frontend && npm.cmd run dev"

echo.
echo Waiting 5 seconds for services to initialize...
timeout /t 5 /nobreak >nul

echo Opening browser at http://localhost:5173 ...
start http://localhost:5173

echo.
echo ===================================================================
echo Services are now live!
echo - Web Application: http://localhost:5173
echo - Backend API:     http://localhost:5000/api/v1
echo.
echo Demo Accounts:
echo - Super Admin: admin@acme-corp.com      / Admin@123456
echo - IT Admin:    itadmin@acme-corp.com    / Admin@123456
echo - Support:     support@acme-corp.com    / Admin@123456
echo - Employee:    john.doe@acme-corp.com   / User@123456
echo ===================================================================
pause
