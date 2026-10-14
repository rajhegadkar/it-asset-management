# Enterprise Production Deployment Checklist

Ensure all items on this checklist are satisfied before cutting over to live production use.

---

## 1. Secrets & Environment Configuration

- [ ] **Node Environment**: `NODE_ENV=production` is set in the environment variables.
- [ ] **JWT Secrets**: Generated high-entropy random keys (minimum 64 characters / 256 bits) for both `JWT_SECRET` and `JWT_REFRESH_SECRET`.
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] **Default Passwords Rotated**: Changed all default seed passwords (`Admin@123456`, `User@123456`) immediately upon first login.
- [ ] **Application URL**: `APP_URL` configured to the fully qualified domain name (e.g., `https://itam.yourcompany.com`).
- [ ] **No `.env` in Version Control**: Verified `.env` is listed in `.gitignore` and omitted from public or private Git repositories.

---

## 2. Database & Storage Architecture

- [ ] **PostgreSQL Provisioned**: PostgreSQL 15 or 16 running with persistent disk volumes and connection pooling.
- [ ] **SSL Connections**: PostgreSQL configured with `sslmode=require` or `sslmode=verify-full`.
- [ ] **Schema Migrations**: Successfully applied via `npx prisma migrate deploy`.
- [ ] **Storage Permissions**: Storage directory (`backend/uploads/`) has strict permissions (read/write only for the application service user).
- [ ] **Disk Space Alerts**: Configured disk alerts for database volumes and the asset upload directory (warning at 80% capacity).

---

## 3. Network & Infrastructure Security

- [ ] **TLS / SSL Termination**: Valid SSL/TLS certificate installed (Let's Encrypt or corporate enterprise CA) enforcing TLS 1.2 and TLS 1.3 only.
- [ ] **Localhost Binding**: Node.js backend port (5000) bound strictly to `127.0.0.1` or internal Docker network; never exposed directly to public internet.
- [ ] **Firewall Ingress**: External firewall allows only Port 443 (HTTPS) and Port 80 (HTTP redirect). Port 5432 (PostgreSQL) is strictly isolated.
- [ ] **HTTP Security Headers**: Reverse proxy (Nginx or IIS) injects:
  - `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Content-Security-Policy` tuned for required assets.
- [ ] **Rate Limiting**: API rate limiting enabled (default: 1000 requests per 15-minute window; 5 failed login attempts per account).

---

## 4. File Upload Security

- [ ] **MIME Type Validation**: Multer whitelist active for images (JPEG, PNG, WebP) and documents (PDF, XLSX).
- [ ] **Executable Extension Block**: Reject `.exe`, `.bat`, `.sh`, `.php`, `.js`, `.py` uploads.
- [ ] **Upload Size Limit**: Configured upload payload cap (default: 15 MB).
- [ ] **No Direct Script Execution**: Static file serving configured so uploaded scripts cannot be executed server-side.

---

## 5. Email & Notification Dispatch

- [ ] **Corporate SMTP Configured**: Valid SMTP host, port (587 TLS or 465 SSL), and authentication credentials.
- [ ] **Delivery Verification**: Sent a test handover notification email to verify delivery through corporate spam filters / SPF / DKIM.
- [ ] **Sender Identity**: `SMTP_FROM_NAME` and `SMTP_FROM_EMAIL` reflect the official IT department address (e.g., `it-helpdesk@yourcompany.com`).

---

## 6. Background Scheduled Jobs

- [ ] **Cron Scheduler Running**: Verified scheduler startup in application logs.
- [ ] **Warranty Expiry Alerts**: Triggered daily at 00:00 UTC to flag assets expiring in 90, 30, and 7 days.
- [ ] **License Expiry Alerts**: Triggered daily to monitor SAM renewals.
- [ ] **Consumable Low Stock**: Triggered daily to notify IT Admins of depleted cable/toner inventory.

---

## 7. Backup & Disaster Recovery

- [ ] **Backup Script Configured**: `scripts/backup.sh` (Linux) or `scripts/backup.ps1` (Windows) tested and verified.
- [ ] **Automated Scheduling**: Cron job or Windows Scheduled Task configured for nightly execution (e.g., 02:00 AM).
- [ ] **Offsite Replication**: Backups automatically synced to AWS S3, Azure Blob, or isolated corporate NAS.
- [ ] **Retention Rules**: Verified 30-day automatic pruning is operating correctly.
- [ ] **Trial Restore Performed**: Successfully completed a trial database and uploads restore in a sandbox environment.

---

## 8. Monitoring, Auditing & Operational Runbook

- [ ] **Health Check Probes**: Configured load balancer or uptime monitor to ping `/api/v1/health` every 60 seconds.
- [ ] **Log Rotation**: Configured logrotate (Linux) or NSSM log rotation (Windows) to prevent disk exhaustion.
- [ ] **Audit Trail Active**: Verified that test create/update/delete operations record user ID, IP address, and payload diffs in `AuditLog`.
- [ ] **Admin Onboarding**: Designated Super Admins have enabled TOTP Two-Factor Authentication.
