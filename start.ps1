<#
.SYNOPSIS
    IT Asset Management Suite - PowerShell Launcher (v2.2.0)
#>

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host "     IT ASSET MANAGEMENT ENTERPRISE PLATFORM (v2.2.0)" -ForegroundColor Cyan
Write-Host "                         SYSTEM LAUNCHER" -ForegroundColor Yellow
Write-Host "===============================================================================" -ForegroundColor Cyan
Write-Host ""

# Verify setup
if ((-not (Test-Path "$ScriptDir\backend\node_modules")) -or (-not (Test-Path "$ScriptDir\backend\prisma\dev.db"))) {
    Write-Host "[NOTICE] Initial environment not detected. Launching 1-Touch Setup..." -ForegroundColor Yellow
    & "$ScriptDir\setup.ps1"
    Exit 0
}

# 1. Start Backend Server
Write-Host "[1/2] Starting Backend API Server (Port 5000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ScriptDir\backend'; Write-Host 'Starting Backend API Server (Port 5000)...' -ForegroundColor Cyan; npm run dev"

# 2. Start Frontend Server
Write-Host "[2/2] Starting Frontend Web Portal (Port 5173)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$ScriptDir\frontend'; Write-Host 'Starting Frontend Portal (Port 5173)...' -ForegroundColor Cyan; npm run dev"

# Wait for startup
Start-Sleep -Seconds 4

# Open browser
Write-Host "Launching web browser at http://localhost:5173 ..." -ForegroundColor Yellow
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host "                      SERVICES ARE NOW LIVE & ACTIVE!" -ForegroundColor Green
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "   ➜ Frontend Web Portal:   http://localhost:5173" -ForegroundColor Cyan
Write-Host "   ➜ Backend REST API:       http://localhost:5000" -ForegroundColor Cyan
Write-Host "   ➜ Interactive Swagger:    http://localhost:5000/api/docs" -ForegroundColor Cyan
Write-Host "   ➜ API Health Check:       http://localhost:5000/api/v1/health" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Demo Administrator Accounts:" -ForegroundColor Yellow
Write-Host "  -----------------------------------------------------------------------------" -ForegroundColor DarkGray
Write-Host "  - Super Admin:    admin@acme-corp.com      /  Admin@123456" -ForegroundColor White
Write-Host "  - IT Admin:       itadmin@acme-corp.com    /  Admin@123456" -ForegroundColor White
Write-Host "  - Employee:       john.doe@acme-corp.com   /  User@123456" -ForegroundColor White
Write-Host "===============================================================================" -ForegroundColor Green
Write-Host ""
