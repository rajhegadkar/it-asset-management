# Backup and Disaster Recovery Strategy

This document outlines the backup, retention, and disaster recovery procedures for the **IT Asset Management (ITAM)** system in enterprise environments.

---

## 1. What Needs to be Backed Up

An ITAM deployment consists of three primary components that require regular backups:

1. **Relational Database**:
   - Master asset data, lifecycle histories, assignments, handover signatures, tickets, licenses, audit logs, and system settings.
   - *PostgreSQL*: Database dump (`.sql` or `.dump` custom binary format).
   - *SQLite*: Database file (`dev.db` / `prod.db`).
2. **File Storage (`uploads/`)**:
   - Asset photos, purchase invoices, warranty contracts, digital signature PNGs, and generated handover PDF certificates.
3. **Environment & Keys (`.env`)**:
   - `JWT_SECRET`, database credentials, SMTP configuration, and branding keys.

---

## 2. Automated Backup Scripts

The repository includes pre-built production backup scripts for both Linux and Windows environments located in the `scripts/` directory.

### Linux / Docker Backup Script (`scripts/backup.sh`)

The Linux backup script performs a consistent database dump, archives the `uploads/` directory, compresses everything into a timestamped `.tar.gz` archive, and prunes archives older than the specified retention window (default: 30 days).

```bash
# Make script executable
chmod +x /opt/it-asset-management/scripts/backup.sh

# Run manual backup
/opt/it-asset-management/scripts/backup.sh /opt/it-asset-management/backups
```

#### Automated Cron Execution (Linux):
Add a daily cron job running at 02:00 AM:
```bash
0 2 * * * /opt/it-asset-management/scripts/backup.sh /opt/it-asset-management/backups >> /var/log/itam-backup.log 2>&1
```

---

### Windows Backup Script (`scripts/backup.ps1`)

The PowerShell script creates a timestamped zip archive containing the database dump and file assets, verifying file integrity and removing backups older than 30 days.

```powershell
# Run manual backup in PowerShell
powershell.exe -ExecutionPolicy Bypass -File C:\Services\it-asset-management\scripts\backup.ps1 -BackupDir "C:\Services\it-asset-management\backups" -RetentionDays 30
```

#### Scheduled Task Execution (Windows Server):
```powershell
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File C:\Services\it-asset-management\scripts\backup.ps1 -BackupDir C:\Services\it-asset-management\backups -RetentionDays 30"
$Trigger = New-ScheduledTaskTrigger -Daily -At "02:00"
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "ITAM_Daily_Backup" -Action $Action -Trigger $Trigger -Principal $Principal
```

---

### Dockerized Environment Backup

If running via `docker-compose.yml`, trigger backups from the host system using Docker Exec:

```bash
#!/usr/bin/env bash
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="/opt/it-asset-management/backups"
mkdir -p "$BACKUP_DIR"

# 1. PostgreSQL Database Dump via Docker Exec
docker exec -t itam-postgres pg_dump -U itam_user -d itam_db -Fc > "$BACKUP_DIR/db_$TIMESTAMP.dump"

# 2. Uploads Directory Archive
tar -czf "$BACKUP_DIR/uploads_$TIMESTAMP.tar.gz" -C /opt/it-asset-management/backend uploads

# 3. Combine into unified archive
tar -czf "$BACKUP_DIR/itam_full_backup_$TIMESTAMP.tar.gz" -C "$BACKUP_DIR" "db_$TIMESTAMP.dump" "uploads_$TIMESTAMP.tar.gz"
rm "$BACKUP_DIR/db_$TIMESTAMP.dump" "$BACKUP_DIR/uploads_$TIMESTAMP.tar.gz"

echo "Docker backup completed: $BACKUP_DIR/itam_full_backup_$TIMESTAMP.tar.gz"
```

---

## 3. Backup Retention Policy (GFS Scheme)

We recommend the **Grandfather-Father-Son (GFS)** retention schedule for production ITAM systems:

| Frequency | Retention Period | Description |
|-----------|------------------|-------------|
| **Daily (Son)** | 7 Days | Daily snapshots taken overnight at 02:00 AM |
| **Weekly (Father)** | 4 Weeks | Sunday night backup preserved for 1 month |
| **Monthly (Grandfather)** | 12 Months | First day of the month backup preserved for 1 year |
| **Annual** | 7 Years | Preserved for compliance, audit, and tax asset tracking |

---

## 4. Offsite & Cloud Replication

Never store backups solely on the production host. Configure automated offsite synchronization:

### A. AWS S3 via AWS CLI
```bash
aws s3 sync /opt/it-asset-management/backups s3://acme-corp-itam-backups/prod/ --storage-class STANDARD_IA
```

### B. Azure Blob Storage via AzCopy
```powershell
azcopy sync "C:\Services\it-asset-management\backups" "https://acmestorage.blob.core.windows.net/itam-backups?<SAS-Token>" --recursive
```

### C. Network Attached Storage (NAS / SMB Share)
```powershell
# Windows Robocopy to internal enterprise NAS
robocopy "C:\Services\it-asset-management\backups" "\\nas01.corp\backups\itam" /MIR /R:3 /W:10
```

---

## 5. Disaster Recovery & Restoration Procedures

In the event of hardware failure, database corruption, or ransomware incident, follow these steps to restore service:

### Step 1: Provision Clean Host or Restore Containers
Ensure the target server has Node.js and PostgreSQL installed, or start clean Docker containers:
```bash
docker compose up -d itam-postgres itam-redis
```

### Step 2: Extract Backup Archive
```bash
# Locate your backup archive
tar -xzf itam_full_backup_20261001_020000.tar.gz -C /tmp/restore/
```

### Step 3: Restore Database

#### For PostgreSQL:
```bash
# Drop existing corrupted database if needed
dropdb -h localhost -U itam_user itam_db --if-exists
createdb -h localhost -U itam_user itam_db

# Restore using pg_restore
pg_restore -h localhost -U itam_user -d itam_db -v /tmp/restore/db_dump.sql
```

#### For SQLite:
```powershell
Stop-Service ITAssetManagement
Copy-Item "C:\tmp\restore\dev.db" "C:\Services\it-asset-management\backend\prisma\dev.db" -Force
Start-Service ITAssetManagement
```

### Step 4: Restore Uploaded Files
```bash
cp -r /tmp/restore/uploads/* /opt/it-asset-management/backend/uploads/
chown -R itam:itam /opt/it-asset-management/backend/uploads/
```

### Step 5: Start Service and Verify Integrity
```bash
# Start backend
systemctl restart itam

# Check health endpoint
curl -f http://127.0.0.1:5000/api/v1/health

# Verify data counts via API or UI
curl -H "Authorization: Bearer <ADMIN_TOKEN>" http://127.0.0.1:5000/api/v1/reports/summary
```

---

## 6. Disaster Recovery Testing (Drill Protocol)

Run a disaster recovery restoration drill **semi-annually**:
1. Provision a staging sandbox environment.
2. Pull the most recent backup archive from offsite storage.
3. Execute the restoration procedure without referring to production files.
4. Verify:
   - Asset search and barcode scanning.
   - Integrity of generated handover PDF documents and employee signatures.
   - Audit trail completeness.
   - Record time taken to restore (Target RTO: < 30 minutes, RPO: < 24 hours).
