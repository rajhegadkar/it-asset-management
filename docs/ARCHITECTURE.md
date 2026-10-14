# Enterprise IT Asset Management (ITAM) - Architecture Documentation

## 1. System Overview
Enterprise ITAM is an enterprise-grade full-stack web application designed for comprehensive hardware fleet tracking, Software Asset Management (SAM), consumable stock control, and integrated IT helpdesk operations.

## 2. High-Level Architecture Diagram
```
                       +----------------------------------+
                       |   Web Browser / Barcode Scanner  |
                       |       (React 18 + Tailwind)      |
                       +-----------------+----------------+
                                         | HTTPS / REST
                                         v
                       +----------------------------------+
                       |       Nginx Reverse Proxy        |
                       |   (SSL, Gzip, Rate Limiting)     |
                       +-----------------+----------------+
                                         | HTTP Proxy
                                         v
                       +----------------------------------+
                       |     Node.js Express App Server   |
                       |       (TypeScript + REST)        |
                       +----+-----------------------+-----+
                            |                       |
               Prisma Client|                       | Node-Cron
                            v                       v
               +------------+------------+     +----+--------------------+
               |    Relational Database  |     | Scheduled Background    |
               | (PostgreSQL / SQLite)   |     | Jobs (Warranties & SLA) |
               +-------------------------+     +-------------------------+
```

## 3. Layered Design

### 3.1 Presentation Layer (Frontend)
- **Framework:** React 18 with TypeScript and Vite.
- **Styling:** Tailwind CSS with Dark/Light mode theme switching.
- **Hardware Integration:** HTML5 Video Stream Camera scanning (`html5-qrcode`) for mobile/webcam QR & Barcode detection, plus keyboard event buffering for physical USB barcode scanner guns.
- **State Management & Contexts:** `AuthContext` (JWT session & RBAC), `ThemeContext` (visual mode).

### 3.2 Application & Service Layer (Backend)
- **Framework:** Node.js, Express, TypeScript.
- **Security:** Helmet HTTP headers, CORS whitelisting, Express Rate Limiter, Argon2/Bcrypt password hashing, JWT access tokens (24h) and refresh tokens (7d), TOTP 2FA (`otplib`).
- **Services:**
  - `AssetService`: Numbering engine `{PREFIX}-{CATEGORY}-{NUMBER:6}`, inventory status transitions, lifecycle audit logging.
  - `AllocationService`: Availability validation, custody handovers, digital signatures, email notifications.
  - `ReturnService`: Condition inspection, accessory reconciliation, status reset.
  - `TransferService`: Inter-departmental and employee transfers.
  - `DisposalService`: Controlled permanent disposal and asset lockdown.
  - `TicketService`: Helpdesk tickets with SLA countdowns and communication threads.
  - `MaintenanceService`: Preventive and corrective maintenance scheduling.
  - `LicenseService`: SAM software licenses and seat quotas.
  - `ConsumableService`: Spare parts inventory with low-stock alerts.
  - `PdfService`: PDF generation for Handover certificates and barcode labels.
  - `ExcelService`: High-speed XLSX/CSV import/export with duplicate collision detection.

### 3.3 Data Layer
- **ORM:** Prisma ORM with type-safe schema definitions.
- **Dialect Portability:** SQLite for zero-config embedded local deployments and PostgreSQL for enterprise Docker/Cloud scaling.
- **Auditability:** Immutable `AssetLifecycleLog` and `AuditLog` tables recording all modifications, timestamps, user identities, and IP addresses.

### 3.4 Scheduled Compliance Engine
- Automated background cron jobs checking:
  - Hardware warranties expiring in 90, 30, and 7 days.
  - Software licenses expiring within 30 days.
  - Low consumable spare inventory.
  - Helpdesk tickets nearing SLA breach.
