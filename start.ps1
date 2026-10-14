# IT Asset Management v1.0 Launcher Script for PowerShell
$ErrorActionPreference = "Stop"

Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "  IT Asset Management Platform v1.0 (Enterprise Edition)" -ForegroundColor Cyan
Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host ""

$RootPath = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $RootPath

# 1. Check backend .env
if (-not (Test-Path "$RootPath\backend\.env")) {
    Write-Host "[SETUP] backend\.env not found. Creating from backend\.env.example..." -ForegroundColor Yellow
    Copy-Item "$RootPath\backend\.env.example" "$RootPath\backend\.env"
}

# 2. Check backend node_modules
if (-not (Test-Path "$RootPath\backend\node_modules")) {
    Write-Host "[SETUP] Installing backend dependencies..." -ForegroundColor Yellow
    Set-Location "$RootPath\backend"
    & npm.cmd install
    Set-Location $RootPath
}

# 3. Check frontend node_modules
if (-not (Test-Path "$RootPath\frontend\node_modules")) {
    Write-Host "[SETUP] Installing frontend dependencies..." -ForegroundColor Yellow
    Set-Location "$RootPath\frontend"
    & npm.cmd install
    Set-Location $RootPath
}

# 4. Check Database
if (-not (Test-Path "$RootPath\backend\prisma\dev.db")) {
    Write-Host "[SETUP] Initializing database schema and seeding demo records..." -ForegroundColor Yellow
    Set-Location "$RootPath\backend"
    & npx.cmd prisma db push
    & npx.cmd prisma db seed
    Set-Location $RootPath
}

# 5. Start Backend Server
Write-Host "Starting Backend API Server (Port 5000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$RootPath\backend'; npm.cmd start"

# 6. Start Frontend Server
Write-Host "Starting Frontend Portal (Port 5173)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$RootPath\frontend'; npm.cmd run dev"

# Wait for services
Start-Sleep -Seconds 5

# Open browser
Write-Host "Launching web browser at http://localhost:5173 ..." -ForegroundColor Yellow
Start-Process "http://localhost:5173"

Write-Host ""
Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "Services are live:" -ForegroundColor White
Write-Host "• Frontend Portal: http://localhost:5173" -ForegroundColor White
Write-Host "• Backend API:     http://localhost:5000/api/v1" -ForegroundColor White
Write-Host "• Health Check:    http://localhost:5000/api/v1/health" -ForegroundColor White
Write-Host ""
Write-Host "Pre-configured Credentials:" -ForegroundColor Yellow
Write-Host "• Super Admin: admin@acme-corp.com      / Admin@123456"
Write-Host "• IT Admin:    itadmin@acme-corp.com    / Admin@123456"
Write-Host "• Support:     support@acme-corp.com    / Admin@123456"
Write-Host "• Employee:    john.doe@acme-corp.com   / User@123456"
Write-Host "===================================================================" -ForegroundColor Cyan
