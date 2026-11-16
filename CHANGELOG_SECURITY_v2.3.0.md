# ITAM v2.3.0 — Security & Reliability Update (16 Nov 2026)

This release fixes every critical and high finding from the Nov 2026 software audit.
Verified with 64 automated tests (30 existing + 34 new regression tests), run on **both SQLite and PostgreSQL**,
plus a browser smoke test for each role and a schema upgrade of a copy of the live `dev.db`.

## Upgrade steps

1. Stop the running servers.
2. Run `start.bat` / `start.ps1` / `start.sh` as usual. They now also run
   `npm install`, `prisma generate` and `prisma db push` (additive only — no data is dropped).
   Manual equivalent: `cd backend && npm install && npx prisma generate && npx prisma db push`.
3. **Production only** — add to `backend/.env` (generate each with
   `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`):
   - `JWT_SECRET`, `JWT_REFRESH_SECRET` (the server refuses to start with placeholder values)
   - `SETTINGS_ENCRYPTION_KEY` — encrypts SMTP password, cloud-backup credentials, license keys
   - `BACKUP_ENCRYPTION_KEY` — encrypts and signs backups. **Store a copy off the server.**
   - `TRUST_PROXY=1` when behind nginx / a load balancer
4. Rebuild for production: `npm run build:backend && npm run build:frontend`.
5. After upgrading, open **Settings & Mail** and press Save once: this re-saves the SMTP password encrypted.
   Do the same in **Disaster Recovery → Save settings** for cloud credentials.

## What changed

### Security
| ID | Fix |
| --- | --- |
| S1 | Password hashes / 2FA secrets never leave the server: safe `select` on every User relation + a response filter as a second layer. |
| S2 | `/system/settings` is Super-Admin only; SMTP password and cloud credentials are AES-256-GCM encrypted at rest and masked in the UI. |
| S3, S8, S11 | Server-side role and ownership checks: employees only reach their own assignments, tickets and profile; reports, employee directory, asset register, licenses, consumables, maintenance are staff/admin only. Internal ticket notes are hidden from requesters. |
| S4 | Backup restore rejects any file path outside the uploads folder (no more arbitrary file write). |
| S5 | Strict input schemas on every write endpoint; custody, archive and disposal fields can only change through their workflows. |
| S6 | Demo quick-login and pre-filled passwords only in development builds; placeholder JWT secrets rejected in production; seed no longer resets passwords on re-run; forced password change for seeded accounts in production. |
| S7 | Only the assigned employee can sign their handover (staff may record a witnessed in-person signature); no double or post-return signing. |
| S9 | Employees always raise tickets as themselves; the "first employee" fallback is gone. |
| S10 | License keys encrypted at rest, admin-only. |
| S12 | 2FA re-keying requires password + current code; failed codes count towards lockout; recovery codes; disable-2FA endpoint. |
| S13 | Sessions are revocable (password change, logout, deactivation, restore); refresh tokens rotate; tokens in URLs are no longer accepted. |
| S14 | CORS allow-list honoured; dedicated sign-in rate limit; proxy trust is opt-in. |
| S15 | `xlsx` → SheetJS 0.20.3 (CVE fixes), `multer` → 2.x. |
| Medium | E-mail HTML escaping, SMTP certificate validation on, minimal public `/health`, notification ownership, uploads not served publicly (app + nginx), generic login errors, encrypted + HMAC-signed backups, Swagger off in production. |

### Bugs
| ID | Fix |
| --- | --- |
| B1 | Transfers close the previous holder's assignment and open a new one (pending signature) for the receiver. |
| B2 | Allocation, return, transfer, disposal, license seats, stock moves and maintenance run in DB transactions with conditional updates (no double allocation). |
| B3 | Asset ID / Tag / Ticket numbers come from an atomic counter table (`NumberSequence`). |
| B4 | Restore closes the DB connection before swapping SQLite, reads the path from `DATABASE_URL`, and restores PostgreSQL table-by-table. |
| B5, B6 | Frontend uses the right token key and refreshes expired tokens silently. |
| B7–B17 | Return/allocation validation, maintenance completion rules, signed stock adjustments and no negative stock, license seat limits, ticket state machine + SLA recalculation + first-response tracking, import type handling and no silent category fallback, 409 instead of 500 for in-use records, dashboard low-stock by each item's minimum, case-insensitive search on PostgreSQL, sort allow-list, scheduler notifications with de-duplication. |
| New | Production builds used relative asset paths, so refreshing any nested page (e.g. `/portal/my-assets`) showed a blank screen. Fixed (`base: '/'`). |

### Features that now actually work
- **Cloud backup**: real uploads to Amazon S3 / R2 / MinIO (SigV4, verified against the AWS reference signer), WebDAV (tested), Google Drive (service account) and OneDrive (refresh token). Failures are reported and notified, never shown as success.
- **Audit log**: every write, login, export and import is recorded, with a SHA-256 hash chain (`GET /system/audit-logs/verify`).
- **Email templates** and **per-event e-mail toggles** from the Customization Center are used for real e-mails.
- **Custom fields** are validated on save; **custom statuses** are accepted and respected for allocation.
- **Feature flags** hide menu items and block the matching API; **maintenance mode** blocks writes for non-Super-Admins.

## Behaviour changes to be aware of
- Access tokens last 1 hour (refreshed automatically). "Log out" signs the user out on all devices.
- Deleting an employee, consumable or license that has history now deactivates/blocks instead of deleting.
- Stock levels change only through transactions (editing the number on the item records an adjustment).
- Ticket status changes follow a defined lifecycle (e.g. CLOSED → REOPENED, not CLOSED → IN_PROGRESS).
- Asset imports reject unknown category codes instead of filing them under the first category.

## Not changed in this release
- `require2faAllAdmins` is still not enforced: there is no 2FA setup screen in the UI yet, so enforcing it would lock admins out.
- The `requirePermission()` middleware and permission table remain unused; access is role-based.
- Google Drive and OneDrive uploads are implemented but could not be tested without real accounts — use **Test connection** in the Disaster Recovery Center once credentials are entered.
- Housekeeping left for you: put the project under git; remove the stale `backend/public` build and the `backend/backups/*.itam-backup` / `prisma/dev.db.bak_*` files from the source folder.
