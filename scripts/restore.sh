#!/usr/bin/env bash
# Linux Bash ITAM Disaster Recovery Restore Script (v3.0.0)
# Usage: ./restore.sh <path-to-archive.itam-backup>

set -e

BACKUP_ARCHIVE="${1}"
if [ -z "${BACKUP_ARCHIVE}" ]; then
    echo "❌ Error: Please specify the backup archive to restore."
    echo "Usage: ./restore.sh <path-to-archive.itam-backup>"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="${SCRIPT_DIR}/../backend"

echo "=========================================================="
echo "🔄 ITAM ENTERPRISE DISASTER RECOVERY RESTORE (v3.0.0)"
echo "=========================================================="

if [[ "${BACKUP_ARCHIVE}" == *".itam-backup"* ]] && [ -f "${BACKEND_DIR}/src/disasterRecovery/cli.ts" ]; then
    echo "🚀 Invoking V3 Disaster Recovery Restore Engine..."
    cd "${BACKEND_DIR}"
    npx tsx src/disasterRecovery/cli.ts restore "${BACKUP_ARCHIVE}"
else
    echo "Restoring legacy directory archive..."
    if [ -f "${BACKUP_ARCHIVE}/database_sqlite_"* ]; then
        cp "${BACKUP_ARCHIVE}/database_sqlite_"*.db "${BACKEND_DIR}/prisma/dev.db"
        echo "✅ SQLite database restored."
    fi

    if [ -f "${BACKUP_ARCHIVE}/uploads_"*".tar.gz" ]; then
        tar -xzf "${BACKUP_ARCHIVE}/uploads_"*".tar.gz" -C "${BACKEND_DIR}"
        echo "✅ Uploads restored."
    fi
fi

echo "🎉 Disaster recovery restore completed successfully."
