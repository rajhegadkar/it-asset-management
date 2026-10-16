@echo off
setlocal enabledelayedexpansion
title IT Asset Management Platform - Launcher (v2.2.0)

color 0B
echo ===============================================================================
echo     IT ASSET MANAGEMENT ENTERPRISE PLATFORM (v2.2.0)
echo                         SYSTEM LAUNCHER
echo ===============================================================================
echo.

cd /d "%~dp0"

:: Check if initial setup has been run
if not exist "backend\node_modules" (
    echo [NOTICE] Dependencies not installed. Running 1-Touch Setup first...
    call setup.bat
    exit /b
)

if not exist "backend\prisma\dev.db" (
    echo [NOTICE] Embedded database not initialized. Running 1-Touch Setup...
    call setup.bat
    exit /b
)

:: Ensure .env exists
if not exist "backend\.env" (
    if exist "backend\.env.example" copy "backend\.env.example" "backend\.env" >nul
)

:: Start Backend API Server
echo [1/2] Starting Backend API Server on Port 5000...
start "ITAM Backend API (Port 5000)" cmd /k "cd /d "%~dp0backend" && npm run dev"

:: Start Frontend Web Portal
echo [2/2] Starting Frontend Web Portal on Port 5173...
start "ITAM Frontend Portal (Port 5173)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo Waiting 4 seconds for services to bind to ports...
timeout /t 4 /nobreak >nul

echo Opening browser at http://localhost:5173 ...
start http://localhost:5173

color 0A
echo.
echo ===============================================================================
echo                      SERVICES ARE NOW LIVE & ACTIVE!
echo ===============================================================================
echo.
echo   ➜ Frontend Web Portal:   http://localhost:5173
echo   ➜ Backend REST API:       http://localhost:5000
echo   ➜ Interactive Swagger:    http://localhost:5000/api/docs
echo   ➜ API Health Check:       http://localhost:5000/api/v1/health
echo.
echo   Demo Administrator Accounts:
echo   -----------------------------------------------------------------------------
echo   - Super Admin:    admin@acme-corp.com      /  Admin@123456
echo   - IT Admin:       itadmin@acme-corp.com    /  Admin@123456
echo   - Employee:       john.doe@acme-corp.com   /  User@123456
echo ===============================================================================
echo.
echo Keep this window open or close it when done. To stop, close the server windows.
echo.
pause
