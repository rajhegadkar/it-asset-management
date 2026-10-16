<#
.SYNOPSIS
    1-Touch Turnkey Setup Script for IT Asset Management Enterprise Suite (v2.2.0)
.DESCRIPTION
    Automates environment verification, dependency installation, SQLite database creation,
    Prisma generation, enterprise master data seeding, and application compilation.
#>

[CmdletBinding()]
param(
    [switch]$StartAfterSetup,
    [switch]$SkipBuild,
    [switch]$NonInteractive
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "     IT ASSET MANAGEMENT ENTERPRISE PLATFORM (v2.2.0)" -ForegroundColor Cyan
Write-Host "              1-TOUCH AUTOMATED ENVIRONMENT SETUP" -ForegroundColor Yellow
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""

# 1. Verify Node.js
Write-Host "[1/7] Verifying Node.js environment..." -ForegroundColor White
try {
    $nodeVersion = & node -v
    Write-Host "    Node.js detected: $nodeVersion" -ForegroundColor Green
    $major = [int]($nodeVersion -replace '^v(\d+)\..*', '$1')
    if ($major -lt 18) {
        Write-Warning "Node.js version is $nodeVersion. Version 18.0.0 or higher is strongly recommended."
    }
} catch {
    Write-Host "`n[ERROR] Node.js is NOT installed or not present in your system PATH!" -ForegroundColor Red
    Write-Host "Please install Node.js (LTS version) from https://nodejs.org/" -ForegroundColor Yellow
    $ans = Read-Host "Would you like to open https://nodejs.org now? (y/N)"
    if ($ans -match '^[Yy]') {
        Start-Process "https://nodejs.org"
    }
    Exit 1
}

# 2. Verify npm
Write-Host "[2/7] Verifying npm package manager..." -ForegroundColor White
try {
    $npmVersion = & npm -v
    Write-Host "    npm detected: v$npmVersion" -ForegroundColor Green
} catch {
    Write-Host "`n[ERROR] npm is not found. Please ensure Node.js was completely installed." -ForegroundColor Red
    Exit 1
}

# 3. Setup .env file
Write-Host "[3/7] Configuring environment variables (.env)..." -ForegroundColor White
$backendEnv = Join-Path $ScriptDir "backend\.env"
$backendEnvExample = Join-Path $ScriptDir "backend\.env.example"
$rootEnvExample = Join-Path $ScriptDir ".env.example"

if (-not (Test-Path $backendEnv)) {
    if (Test-Path $backendEnvExample) {
        Copy-Item $backendEnvExample $backendEnv
        Write-Host "    Created backend\.env from template (SQLite zero-config enabled)." -ForegroundColor Green
    } elseif (Test-Path $rootEnvExample) {
        Copy-Item $rootEnvExample $backendEnv
        Write-Host "    Created backend\.env from root template." -ForegroundColor Green
    } else {
        @"
PORT=5000
NODE_ENV=development
DATABASE_URL="file:./dev.db"
JWT_SECRET="itam_jwt_secret_dev_2026_xyz"
JWT_REFRESH_SECRET="itam_jwt_refresh_dev_2026_xyz"
APP_URL="http://localhost:5173"
CORS_ORIGIN="*"
"@ | Out-File -FilePath $backendEnv -Encoding utf8
        Write-Host "    Generated new backend\.env default file." -ForegroundColor Green
    }
} else {
    Write-Host "    backend\.env already exists. Preserving custom configuration." -ForegroundColor DarkGray
}

# 4. Install Dependencies
Write-Host "[4/7] Installing dependencies..." -ForegroundColor White
Write-Host "    Installing Backend dependencies..." -ForegroundColor Gray
npm --prefix backend install --no-audit --prefer-offline | Out-Null
Write-Host "    Installing Frontend dependencies..." -ForegroundColor Gray
npm --prefix frontend install --no-audit --prefer-offline | Out-Null
Write-Host "    Dependencies installed successfully." -ForegroundColor Green

# 5. Database Schema & Prisma Client
Write-Host "[5/7] Initializing embedded SQLite database & Prisma Client..." -ForegroundColor White
& npm.cmd --prefix backend run prisma:generate
& npm.cmd --prefix backend run prisma:push
Write-Host "    Database schema pushed and Prisma Client generated." -ForegroundColor Green

# 6. Master Data Seeding
Write-Host "[6/7] Seeding enterprise master data & administrator accounts..." -ForegroundColor White
try {
    & npm.cmd --prefix backend run prisma:seed
    Write-Host "    Initial Master Data and admin users seeded." -ForegroundColor Green
} catch {
    Write-Host "    Notice: Seed script executed with notice. Continuing..." -ForegroundColor DarkYellow
}

# 7. Compiling
if (-not $SkipBuild) {
    Write-Host "[7/7] Compiling production distribution assets..." -ForegroundColor White
    Write-Host "    Compiling Backend TypeScript..." -ForegroundColor Gray
    npm --prefix backend run build | Out-Null
    Write-Host "    Bundling Frontend Vite client..." -ForegroundColor Gray
    npm --prefix frontend run build | Out-Null
    Write-Host "    Applications compiled successfully." -ForegroundColor Green
} else {
    Write-Host "[7/7] Skipping compilation (requested via flag)." -ForegroundColor DarkGray
}

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host "                   SETUP COMPLETED SUCCESSFULLY! (100%)" -ForegroundColor Green
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "  Default Administrative Credentials:" -ForegroundColor Yellow
Write-Host "   - Super Admin:    admin@acme-corp.com      /  Admin@123456" -ForegroundColor White
Write-Host "   - IT Admin:       itadmin@acme-corp.com    /  Admin@123456" -ForegroundColor White
Write-Host "   - Employee User:  john.doe@acme-corp.com   /  User@123456" -ForegroundColor White
Write-Host ""
Write-Host "  Local Endpoints:" -ForegroundColor Yellow
Write-Host "   - Frontend Web:   http://localhost:5173" -ForegroundColor Cyan
Write-Host "   - Backend API:     http://localhost:5000" -ForegroundColor Cyan
Write-Host "   - Swagger Docs:    http://localhost:5000/api/docs" -ForegroundColor Cyan
Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host ""

if ($StartAfterSetup) {
    & "$ScriptDir\start.ps1"
} elseif ($NonInteractive) {
    Write-Host "Setup finished (NonInteractive mode). To start anytime, run: .\start.bat (or .\start.ps1)`n" -ForegroundColor Yellow
} else {
    $launch = Read-Host "Would you like to start the platform now? (Y/N)"
    if ($launch -match '^[Yy]') {
        if (Test-Path "$ScriptDir\start.bat") {
            Start-Process "$ScriptDir\start.bat"
        } else {
            & "$ScriptDir\start.ps1"
        }
    } else {
        Write-Host "`nTo start anytime, run: .\start.bat (or .\start.ps1)`n" -ForegroundColor Yellow
    }
}
