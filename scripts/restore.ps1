# PowerShell ITAM Disaster Recovery Restore Script
# Enterprise IT Asset Management (ITAM) — Version 3.0 Custom Edition
# Usage: .\restore.ps1 -BackupArchive "..\backups\itam_dr_2026-10-04.itam-backup"

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupArchive
)

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "🔄 ITAM ENTERPRISE DISASTER RECOVERY RESTORE (v3.0.0)" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

if (!(Test-Path $BackupArchive)) {
    Write-Error "Backup file does not exist: $BackupArchive"
    exit 1
}

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Join-Path $ScriptDir "..\backend"

if ($BackupArchive -like "*.itam-backup" -and (Test-Path (Join-Path $BackendDir "src\disasterRecovery\cli.ts"))) {
    Write-Host "🚀 Invoking V3 Disaster Recovery Restore Engine..." -ForegroundColor Yellow
    Push-Location $BackendDir
    try {
        npx.cmd tsx src/disasterRecovery/cli.ts restore $BackupArchive
    }
    finally {
        Pop-Location
    }
} else {
    Write-Host "Processing legacy directory archive: $BackupArchive" -ForegroundColor DarkYellow
    $SqliteFile = Get-ChildItem -Path $BackupArchive -Filter "database_sqlite_*.db" | Select-Object -First 1
    if ($SqliteFile) {
        Copy-Item $SqliteFile.FullName -Destination (Join-Path $BackendDir "prisma\dev.db") -Force
        Write-Host "✅ SQLite database restored." -ForegroundColor Green
    }

    $UploadsZip = Get-ChildItem -Path $BackupArchive -Filter "uploads_*.zip" | Select-Object -First 1
    if ($UploadsZip) {
        Expand-Archive -Path $UploadsZip.FullName -DestinationPath (Join-Path $BackendDir "uploads") -Force
        Write-Host "✅ Uploads restored." -ForegroundColor Green
    }
}

Write-Host "`n🎉 Disaster recovery restore completed successfully." -ForegroundColor Green
