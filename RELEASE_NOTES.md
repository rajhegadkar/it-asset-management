# Release Notes - IT Asset Management (ITAM) Enterprise Suite v2.0.0

**Release Date:** October 16, 2026  
**Version:** `v2.0.0`  
**Deployment Target:** Production (GitHub & Render: `https://it-asset-management-q6ey.onrender.com/`)  
**Audit Status:** Verified 100% Pass (68/68 Integration & E2E Tests, 30/30 Unit Tests)

---

## 🚀 Overview

Release `v2.0.0` represents a major milestone for the Enterprise IT Asset Management platform. This release introduces a fully configurable asset sticker label engine (supporting modern QR-only stickers, legacy 1D barcode stickers, and dual-format hybrid tags), complete user-directed label restructuring, extensive UI/UX alignment fixes across the webapp, and a comprehensive audit remediation ensuring 100% defect-free operational stability.

---

## 🌟 Key New Features & Enhancements

### 1. Configurable Asset Label Symbology (Settings Engine)
* **Custom Sticker Symbology Selector:** Administrators can now toggle between three standard printable sticker formats directly under **Settings > Asset Numbering & Barcodes > Printable Asset Sticker Code Format**:
  * **QR Code Only (Modern Standard):** High-density QR code with prominent Asset ID pill, Serial Number, multi-line Equipment Model, and assigned User. No 1D barcode bars.
  * **Both QR & 1D Barcode (Dual Hybrid):** Top-right QR code for mobile camera audits paired with bottom centered Code128 barcode for handheld laser scanners.
  * **1D Barcode Only (Classic Legacy):** Full-width specifications paired with prominent centered Code128 barcode.
* **Persistent Configuration:** Saved preferences persist to the database via `barcode.sticker_style` and automatically apply to both single asset prints and bulk fleet inventory label sheets.
* **Ad-hoc Query Overrides:** The label generation API accepts dynamic `?style=QR_ONLY`, `?style=BOTH`, or `?style=BARCODE_ONLY` parameters for on-demand flexibility.

### 2. Symmetrical Asset Sticker Layout Restructuring
* **Hero QR Placement:** Top-left high-contrast QR code (`70 × 70 pt` inside `76 × 76 pt` white canvas) centered horizontally in the left column.
* **Asset ID Badge:** Centered directly below the QR code (`84 × 34 pt` badge) highlighting `ASSET ID` in bold high-contrast blue (`#1d4ed8`).
* **Serial Number Integration:** Positioned prominently at the top of the right details card for instant physical inventory verification.
* **Multi-Line Model Name Wrapping:** Lengthy hardware model names (e.g., *HP ZBook Studio G10 Mobile Workstation*) wrap cleanly across lines with `lineGap: 1` and a dedicated `26 pt` text container, eliminating text clipping and collisions.
* **User Custodian Display:** Replaced generic "Owner" label with **`USER`**, displaying the assigned employee's name or stock status (`Unassigned (In Stock)`).
* **Grid Alignment & Non-Overlapping Footer:** All elements align to a balanced grid with symmetric `8 pt` margins. The bottom security notice (`PROPERTY OF ... • DO NOT REMOVE`) is pinned at `y + 150`, leaving `4 pt` of breathing room from content cards and `6 pt` margin to the outer boundary.

### 3. Webapp UI/UX Alignment & Baseline Rectifications
* **Uniform Action Toolbar:** Standardized all primary action buttons (`Print Selected`, `Print All Labels`, `Track Asset`, `Import`, `Export`, `New Asset`) to an identical `h-9` height.
* **Filter Bar Alignment:** Search field, Category dropdown, Department dropdown, Status selector, and the "Apply Filter" button now share an exact `h-9` height with vertically centered search icons.
* **Table Cell Middle Alignment:** Applied `align-middle` across all `<th>` and `<td>` elements to prevent vertical row drift.
* **Baseline Shift Elimination:** Wrapped table action icons (`Track`, `View`, `Edit`, `Print`) in a unified `flex items-center justify-end space-x-1` container, eliminating the 2px browser baseline jump between links and buttons.
* **Header Bar Uniformity:** Standardized global tracker, scanner, theme toggles, and notification buttons to pixel-perfect `h-8` heights.

---

## 📊 Comprehensive Audit & Verification Results

* **Automated Unit & Service Tests:** `30 / 30 Passed` (100% Pass Rate).
* **Live End-to-End Enterprise Audit:** `68 / 68 Passed` (100% Pass Rate).
* **Health & Database Connectivity:** Verified `UP` with SQLite / PostgreSQL Prisma ORM.
* **Token Authentication & RBAC:** Verified across Super Admin, IT Admin, Support Engineer, and Employee roles.
* **Report Exports:** Verified both CSV and XLSX data exports streaming successfully.
* **Disaster Recovery & Snapshots:** Verified snapshot generation and configuration exports.

---

## 🛠️ Upgrading & Deployment

### Render Deployment
This repository is connected directly to Render (`https://it-asset-management-q6ey.onrender.com/`). Pushing to `main` automatically triggers a zero-downtime production deployment using `render.yaml`.

```bash
# Build Command
npm run setup:prod

# Start Command
npm run start:prod
```

### Local Development / Self-Hosted
```bash
# Install dependencies
npm run install:all

# Run production build
npm run build:backend
npm run build:frontend

# Start services
npm start
```
