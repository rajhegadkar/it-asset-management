@echo off
setlocal enabledelayedexpansion
title IT Asset Management Suite - Turnkey 1-Touch Setup (Windows)

color 0B
echo ===============================================================================
echo     IT ASSET MANAGEMENT ENTERPRISE PLATFORM (v2.2.0)
echo              1-TOUCH AUTOMATED ENVIRONMENT SETUP
echo ===============================================================================
echo.

cd /d "%~dp0"

:: Step 1: Check Node.js installation
echo [1/7] Verifying Node.js runtime environment...
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    color 0C
    echo.
    echo [ERROR] Node.js is NOT installed or not in system PATH!
    echo Node.js version 18.0.0 or higher is required to run this software.
    echo.
    echo Please download and install Node.js (LTS version recommended):
    echo ➜ https://nodejs.org/
    echo.
    echo After installing, reopen this script.
    echo.
    set /p OPEN_NODE="Would you like to open https://nodejs.org in your browser? (Y/N): "
    if /i "!OPEN_NODE!"=="Y" (
        start https://nodejs.org/
    )
    pause
    exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo     Node.js version detected: %NODE_VER%

:: Step 2: Check npm installation
echo [2/7] Verifying npm package manager...
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
    color 0C
    echo [ERROR] npm is not found. Please ensure Node.js was installed completely.
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('npm -v') do set NPM_VER=%%v
echo     npm version detected: %NPM_VER%

:: Step 3: Setup Backend Environment File
echo [3/7] Configuring environment variables (.env)...
if not exist "backend\.env" (
    if exist "backend\.env.example" (
        copy "backend\.env.example" "backend\.env" >nul
        echo     Created backend\.env from template (SQLite zero-config enabled).
    ) else if exist ".env.example" (
        copy ".env.example" "backend\.env" >nul
        echo     Created backend\.env from root template.
    ) else (
        echo PORT=5000> "backend\.env"
        echo NODE_ENV=development>> "backend\.env"
        echo DATABASE_URL="file:./dev.db">> "backend\.env"
        echo JWT_SECRET="itam_jwt_secret_dev_2026_xyz">> "backend\.env"
        echo JWT_REFRESH_SECRET="itam_jwt_refresh_dev_2026_xyz">> "backend\.env"
        echo APP_URL="http://localhost:5173">> "backend\.env"
        echo CORS_ORIGIN="*">> "backend\.env"
        echo     Generated default backend\.env configuration.
    )
) else (
    echo     backend\.env already exists. Preserving custom configuration.
)

:: Step 4: Install Dependencies
echo [4/7] Installing backend and frontend dependencies...
echo     Installing Backend dependencies...
call npm --prefix backend install --no-audit --prefer-offline
if %ERRORLEVEL% neq 0 (
    color 0C
    echo [ERROR] Failed to install backend dependencies. Check network connectivity.
    pause
    exit /b 1
)

echo     Installing Frontend dependencies...
call npm --prefix frontend install --no-audit --prefer-offline
if %ERRORLEVEL% neq 0 (
    color 0C
    echo [ERROR] Failed to install frontend dependencies. Check network connectivity.
    pause
    exit /b 1
)

:: Step 5: Database Setup & Prisma Schema Generation
echo [5/7] Initializing embedded SQLite database & Prisma Client...
call npm --prefix backend run prisma:generate
if %ERRORLEVEL% neq 0 (
    color 0C
    echo [ERROR] Prisma Client generation failed.
    pause
    exit /b 1
)

call npm --prefix backend run prisma:push
if %ERRORLEVEL% neq 0 (
    color 0C
    echo [ERROR] Database schema push failed.
    pause
    exit /b 1
)

:: Step 6: Master Data & Demo Seeding
echo [6/7] Seeding initial enterprise master data & admin accounts...
call npm --prefix backend run prisma:seed
if %ERRORLEVEL% neq 0 (
    echo     Warning: Database seed encountered a notice or was already seeded. Continuing...
) else (
    echo     Master data and default administrator accounts seeded successfully.
)

:: Step 7: Build Applications
echo [7/7] Compiling production distribution assets...
echo     Compiling Backend TypeScript...
call npm --prefix backend run build
if %ERRORLEVEL% neq 0 (
    color 0C
    echo [ERROR] Backend build failed.
    pause
    exit /b 1
)

echo     Bundling Frontend Vite client...
call npm --prefix frontend run build
if %ERRORLEVEL% neq 0 (
    color 0C
    echo [ERROR] Frontend build failed.
    pause
    exit /b 1
)

color 0A
echo.
echo ===============================================================================
echo                    SETUP COMPLETED SUCCESSFULLY! (100%%)
echo ===============================================================================
echo.
echo  Your IT Asset Management Platform is completely installed and configured!
echo.
echo  Default Administrative Credentials:
echo   - Super Admin:    admin@acme-corp.com      /  Admin@123456
echo   - IT Admin:       itadmin@acme-corp.com    /  Admin@123456
echo   - Employee User:  john.doe@acme-corp.com   /  User@123456
echo.
echo  Local Service Endpoints:
echo   - Frontend Portal:  http://localhost:5173
echo   - Backend API:      http://localhost:5000
echo   - Swagger Docs:     http://localhost:5000/api/docs
echo.
echo ===============================================================================
echo.

set /p RUN_NOW="Would you like to launch the IT Asset Management Platform now? (Y/N): "
if /i "%RUN_NOW%"=="Y" (
    echo Launching services...
    call start.bat
) else (
    echo.
    echo To start the platform anytime, run: start.bat
    echo.
    pause
)
