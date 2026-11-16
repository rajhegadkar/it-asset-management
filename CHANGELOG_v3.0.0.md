# 🏢 Enterprise IT Asset Management (ITAM) System — Release v3.0.0 (Version 3)

## 🚀 Release Overview
Release **v3.0.0** is a major milestone release for the Enterprise IT Asset Management platform. This release delivers full enterprise security hardening across every system layer, fixes every critical and high audit issue identified during comprehensive software testing, establishes atomic numbering sequences for hardware tags and ticket references, provides automated cloud disaster recovery backup drivers (AWS S3, Cloudflare R2, MinIO, WebDAV, Google Drive, OneDrive), and ships 1-touch turnkey setup and start scripts for Windows, Linux, and macOS.

All 64 automated backend unit, integration, and security tests pass with 100% success across both SQLite and PostgreSQL database drivers.

---

## 🔒 Security Hardening (Audit Remediations)

| Security ID | Severity | Remediation & Hardening Details |
| :--- | :--- | :--- |
| **S1** | **Critical** | **Zero Hash & Secret Leakage:** Completely eliminated password hashes and 2FA secrets from all API responses via strict Prisma `select` projections and a global outbound response sanitizer middleware. |
| **S2** | **Critical** | **Enterprise Settings Protection:** Restricted `/system/settings` exclusively to Super Administrators. SMTP secrets, cloud credentials, and license keys are now AES-256-GCM encrypted at rest in the database and masked (`••••••••`) in the UI. |
| **S3, S8, S11**| **Critical** | **Strict RBAC & Tenant Data Isolation:** Server-side role and ownership verification prevents privilege escalation or unauthorized IDOR access. Regular employees can only view and interact with their assigned assets, tickets, and profile. Internal staff notes on tickets are completely redacted from requester payloads. |
| **S4** | **High** | **Arbitrary File Write Prevention:** Backup restore handlers strictly sanitize and reject any target file path residing outside the designated upload directory. |
| **S5** | **High** | **Immutable State Transitions & Strict Validation:** Enforced Zod schemas across all mutation endpoints. Custody changes, asset archiving, and equipment disposal can only be performed via authorized multi-step audit workflows. |
| **S6** | **High** | **Production Secret & Demo Guarding:** Production environments now refuse to boot if placeholder JWT secrets are detected. Demo quick-switchers and pre-filled passwords are automatically compiled out in production builds. Forced password change is enforced on initial sign-in for seeded accounts in production. |
| **S7** | **High** | **Tamper-Proof Digital Signatures:** Asset handover certificates can only be signed by the verified assignee with biometric/touch stylus data; witnessed in-person staff signatures require explicit audit logging. Duplicate or post-return signing attempts are rejected with 409 Conflict. |
| **S9** | **Medium** | **Authenticated Ticket Dispatch:** Employees submit support requests with strictly verified user identities, removing arbitrary email or fallback requester spoofing. |
| **S10** | **Medium** | **Encrypted Software Licenses:** Product activation keys and enterprise software license credentials are encrypted at rest with AES-256-GCM and restricted to Administrator roles. |
| **S12** | **High** | **Multi-Factor Authentication (2FA) Hardening:** Re-keying TOTP tokens requires current password verification; failed 2FA verification attempts increment brute-force lockout counters; added secure emergency recovery codes and revocation endpoints. |
| **S13** | **Critical** | **Token Revocation & Refresh Rotation:** Implemented cryptographic refresh token rotation and real-time session invalidation on password change, role demotion, or administrative logout. Deprecated URL-based authentication tokens. |
| **S14** | **Medium** | **Network Boundary & Rate Limiting:** Enforced strict CORS origin allow-lists, dedicated authentication brute-force rate limits (IP + username), and opt-in reverse proxy trust flags (`TRUST_PROXY=1`). |
| **S15** | **Medium** | **Dependency Vulnerability Remediation:** Upgraded critical parsing libraries (`xlsx` to 0.20.3, `multer` to 2.x) resolving upstream CVEs. |

---

## 🐛 Bug Fixes & System Stability Improvements

| Bug ID | Component | Fix Description |
| :--- | :--- | :--- |
| **B1** | Asset Custody | Direct asset-to-asset transfers now atomically terminate the prior holder's active assignment with full historical timestamps and generate a pending handover signature request for the receiving employee. |
| **B2** | Concurrency | Allocation, return, transfer, disposal, license seat claims, and inventory movements now execute within atomic database transactions with optimistic locking to eliminate race conditions and double allocations. |
| **B3** | Identifiers | Asset tags, model numbers, and ticket codes now leverage an atomic sequence generator (`NumberSequence`) to guarantee unique, gapless, sequential numbering without race-condition collisions. |
| **B4** | Disaster Recovery | Database restore routine dynamically reads the connection string from `DATABASE_URL`, gracefully terminates existing connection pools before swapping SQLite database files, and restores PostgreSQL databases table-by-table. |
| **B5, B6** | Authentication | Unified frontend storage key handling for authentication tokens and implemented seamless silent refresh for expired access tokens without disrupting user navigation. |
| **B7–B17**| Business Logic | Added comprehensive validation for asset check-in/check-out; enforced maintenance completion workflows; prevented negative consumable quantities; implemented strict ticket lifecycle state machines with SLA tracking; fixed import CSV parser category resolution; converted database foreign key conflicts to clean 409 responses; unified case-insensitive search queries across both PostgreSQL and SQLite. |
| **Build** | Frontend SPA | Fixed nested route refreshes (e.g. `/portal/my-assets`) on production reverse proxies by configuring Vite base path to `'/'`. |

---

## 🌟 Feature Enhancements & Subsystem Upgrades

1. **Enterprise Cloud Disaster Recovery:**
   - Real-time cloud snapshot backups supporting Amazon S3, Cloudflare R2, MinIO (SigV4 verified), WebDAV, Google Drive, and Microsoft OneDrive.
   - All backup archives are encrypted with AES-256-GCM and signed with HMAC-SHA256 checksums to verify integrity prior to restoration.

2. **Tamper-Evident Audit Trail:**
   - Every write transaction, export, import, privilege change, and authentication event is logged with a SHA-256 cryptographic hash chain verified via `GET /system/audit-logs/verify`.

3. **Enterprise Customization & Dynamic Branding:**
   - Dynamic custom fields, custom asset statuses, white-label company branding, email notification templates, and system feature flags configurable directly by Super Administrators without restarting the application.

4. **1-Touch Turnkey Environment Scripts:**
   - Automated bootstrap scripts (`setup.bat`, `setup.ps1`, `setup.sh`) and cross-platform start scripts (`start.bat`, `start.ps1`, `start.sh`) for Windows, macOS, and Linux.

---

## 📦 Upgrading to v3.0.0

### From v2.x (Standard Setup):
```bash
# 1. Stop existing service
# 2. Pull latest release or clone v3.0.0
git pull origin main

# 3. Run automated start script (automatically updates dependencies and applies DB schema migrations)
./start.bat     # Windows Command Prompt
./start.ps1     # Windows PowerShell
./start.sh      # Linux / macOS
```

### Production Environment Variables (`backend/.env`):
Generate secure 64-character random keys for:
```env
JWT_SECRET=your-random-64-char-hex
JWT_REFRESH_SECRET=your-random-64-char-hex
SETTINGS_ENCRYPTION_KEY=your-random-64-char-hex
BACKUP_ENCRYPTION_KEY=your-random-64-char-hex
NODE_ENV=production
TRUST_PROXY=1
```
