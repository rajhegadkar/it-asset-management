#!/usr/bin/env bash
# Linux Bash ITAM Disaster Recovery Backup Script (v3.0.0)
# Usage: ./backup.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/../backend"

echo "=========================================================="
echo "🛡️ ITAM ENTERPRISE DISASTER RECOVERY & BACKUP (v3.0.0)"
echo "=========================================================="

if [ -f "${BACKEND_DIR}/src/disasterRecovery/cli.ts" ]; then
    echo "🚀 Triggering V3 Disaster Recovery Engine..."
    cd "${BACKEND_DIR}"
    npx tsx src/disasterRecovery/cli.ts backup
else
    BACKUP_BASE="${1:-./backups}"
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    TARGET_DIR="${BACKUP_BASE}/itam_backup_${TIMESTAMP}"
    mkdir -p "${TARGET_DIR}"

    if [ -f "${BACKEND_DIR}/prisma/dev.db" ]; then
        cp "${BACKEND_DIR}/prisma/dev.db" "${TARGET_DIR}/database_sqlite_${TIMESTAMP}.db"
        echo "✅ SQLite database backup completed."
    fi

    if [ -d "${BACKEND_DIR}/uploads" ]; then
        tar -czf "${TARGET_DIR}/uploads_${TIMESTAMP}.tar.gz" -C "${BACKEND_DIR}" uploads
        echo "✅ Uploads archive created."
    fi
fi

echo "🎉 Backup routine completed."
