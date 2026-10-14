# PowerShell Automated ITAM Database & Uploads Disaster Recovery Backup Script
# Enterprise IT Asset Management (ITAM) — Version 3.0 Custom Edition
# Usage: .\backup.ps1 [-OutputFolder "..\backups"]

param(
    [string]$OutputFolder = "..\backups"
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "🛡️ ITAM ENTERPRISE DISASTER RECOVERY & BACKUP CLI (v3.0.0)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ScriptDir "..\backend"

if (Test-Path (Join-Path $BackendDir "src\disasterRecovery\cli.ts")) {
    Write-Host "🚀 Triggering V3 Disaster Recovery Engine..." -ForegroundColor Yellow
    Push-Location $BackendDir
    try {
        npx.cmd tsx src/disasterRecovery/cli.ts backup
    }
    finally {
        Pop-Location
    }
} else {
    Write-Host "Falling back to legacy directory backup..." -ForegroundColor DarkYellow
    $Timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $TargetDir = Join-Path $OutputFolder "itam_backup_$Timestamp"
    if (!(Test-Path $TargetDir)) {
        New-Item -ItemType Directory -Force -Path $TargetDir | Out-Null
    }

    $SqliteDb = Join-Path $BackendDir "prisma\dev.db"
    if (Test-Path $SqliteDb) {
        Copy-Item $SqliteDb -Destination "$TargetDir\database_sqlite_$Timestamp.db"
        Write-Host "✅ SQLite database backup completed." -ForegroundColor Green
    }

    $UploadsDir = Join-Path $BackendDir "uploads"
    if (Test-Path $UploadsDir) {
        Compress-Archive -Path "$UploadsDir\*" -DestinationPath "$TargetDir\uploads_$Timestamp.zip" -Force
        Write-Host "✅ Uploads archive created." -ForegroundColor Green
    }
}

Write-Host "`n🎉 Backup routine completed." -ForegroundColor Green
