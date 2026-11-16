# 🚀 Release Notes — Version 3.0.0 (v3.0.0)

## Overview
Enterprise IT Asset Management Platform (ITAM) **v3.0.0** is a major milestone release. This release brings comprehensive security hardening across all layers, completes full audit issue resolution, introduces atomic sequence generation, implements multi-cloud disaster recovery drivers, and provides 1-touch turnkey scripts for Windows, Linux, and macOS.

---

## 🔒 Security Hardening (Audit Remediations)

- **S1 (Zero Credential Leakage):** Completely eliminated password hashes and 2FA secrets from all API responses via Prisma `select` projections and outbound sanitization middleware.
- **S2 (Protected System Settings):** Restricted `/system/settings` exclusively to Super Administrators. SMTP secrets, cloud credentials, and license keys are AES-256-GCM encrypted at rest in the database and masked (`••••••••`) in the UI.
- **S3, S8, S11 (Role-Based Access Control & Tenant Isolation):** Enforced server-side role and ownership verification. Employees can only access their assigned hardware, tickets, and profile. Internal ticket notes are hidden from requesters.
- **S4 (Safe File Restorations):** Backup restore handlers strictly sanitize and reject any target file path residing outside the designated upload directory.
- **S5 (Workflow-Enforced State Transitions):** Enforced strict Zod input schemas on all mutation endpoints. Custody changes, asset archiving, and equipment disposal can only be performed via authorized multi-step audit workflows.
- **S6 (Production Secret Guarding):** Production environments refuse to start if placeholder JWT secrets are detected. Demo quick-switchers and pre-filled passwords are automatically compiled out in production builds. Forced password change is enforced on initial sign-in for seeded accounts in production.
- **S7 (Tamper-Proof Digital Signatures):** Asset handover certificates can only be signed by the verified assignee with biometric/touch stylus data; witnessed in-person staff signatures require explicit audit logging. Duplicate or post-return signing attempts are rejected with 409 Conflict.
- **S9 (Authenticated Ticket Dispatch):** Employees submit support requests with strictly verified user identities, removing arbitrary email or fallback requester spoofing.
- **S10 (Encrypted Software Licenses):** Product activation keys and enterprise software license credentials are encrypted at rest with AES-256-GCM and restricted to Administrator roles.
- **S12 (2FA Hardening):** Re-keying TOTP tokens requires current password verification; failed 2FA verification attempts increment brute-force lockout counters; added secure emergency recovery codes and revocation endpoints.
- **S13 (Token Revocation & Refresh Rotation):** Implemented cryptographic refresh token rotation and real-time session invalidation on password change, role demotion, or administrative logout. Deprecated URL-based authentication tokens.
- **S14 (Network Boundary & Rate Limiting):** Enforced strict CORS origin allow-lists, dedicated authentication brute-force rate limits (IP + username), and opt-in reverse proxy trust flags (`TRUST_PROXY=1`).
- **S15 (Dependency Remediation):** Upgraded critical parsing libraries (`xlsx` to 0.20.3, `multer` to 2.x) resolving upstream CVEs.

---

## 🐛 Bug Fixes & Stability Improvements

- **B1 (Asset Transfers):** Direct asset-to-asset transfers now atomically terminate the prior holder's active assignment with full historical timestamps and generate a pending handover signature request for the receiving employee.
- **B2 (Concurrency & Transactions):** Allocation, return, transfer, disposal, license seat claims, and inventory movements now execute within atomic database transactions with optimistic locking to eliminate race conditions and double allocations.
- **B3 (Atomic Numbering):** Asset tags, model numbers, and ticket codes now leverage an atomic sequence generator (`NumberSequence`) to guarantee unique, gapless, sequential numbering without race-condition collisions.
- **B4 (Disaster Recovery Restore):** Database restore routine dynamically reads the connection string from `DATABASE_URL`, gracefully terminates existing connection pools before swapping SQLite database files, and restores PostgreSQL databases table-by-table.
- **B5, B6 (Auth Token Management):** Unified frontend storage key handling for authentication tokens and implemented seamless silent refresh for expired access tokens without disrupting user navigation.
- **B7–B17 (Business Logic):** Added comprehensive validation for asset check-in/check-out; enforced maintenance completion workflows; prevented negative consumable quantities; implemented strict ticket lifecycle state machines with SLA tracking; fixed import CSV parser category resolution; converted database foreign key conflicts to clean 409 responses; unified case-insensitive search queries across both PostgreSQL and SQLite.
- **SPA Routing:** Configured Vite base path to `'/'` to ensure deep/nested routing works on production reverse proxies and CDN deployments without blank screen issues.

---

## 🌟 Major Subsystem Enhancements

1. **Enterprise Cloud Disaster Recovery:** Automated off-site backups to Amazon S3, Cloudflare R2, MinIO, WebDAV, Google Drive, and OneDrive with AES-256-GCM encryption and HMAC-SHA256 integrity verification.
2. **Cryptographic Audit Log:** Full write transaction history with SHA-256 tamper-evident hash chaining.
3. **Turnkey Setup Scripts:** Added one-touch automated setup and start scripts (`setup.bat`, `setup.ps1`, `setup.sh`, `start.bat`, `start.ps1`, `start.sh`) for Windows, Linux, and macOS.
4. **Customization Engine:** Full support for custom asset attributes, custom lifecycle statuses, email templates, and system feature flags.

---

## 🧪 Verification
- Backend Unit & Integration Tests: **64 / 64 passing** (100%)
- PostgreSQL & SQLite compatibility verified
