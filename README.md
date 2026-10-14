# 🏢 Enterprise IT Asset Management (ITAM) System — Release v1.0.0

[![Release](https://img.shields.io/badge/Release-v1.0.0--Official-blue.svg?style=flat-square)](package.json)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-v18%20%7C%20v20%20%7C%20v22%20LTS-339933.svg?style=flat-square&logo=nodedotjs)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg?style=flat-square&logo=react)](https://react.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-5.x-2D3748.svg?style=flat-square&logo=prisma)](https://www.prisma.io/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?style=flat-square&logo=docker)](https://www.docker.com/)
[![Tests](https://img.shields.io/badge/Tests-58%2F58%20Passing%20(100%25)-brightgreen.svg?style=flat-square)](backend/tests/)

A **production-ready, enterprise-grade IT Asset Management (ITAM) platform** engineered for corporate IT departments, Managed Service Providers (MSPs), educational institutions, healthcare networks, and data center operations.

Features end-to-end hardware lifecycle management, dynamic custom attributes, automated Code128 barcode & QR code generation, USB gun & camera barcode scanning, paperless digital signature handover certificates, Software Asset Management (SAM) license compliance, automated helpdesk ticketing, disaster recovery backups, and a **Super Admin Customization Engine** enabling full white-labeling and no-code tailoring.

---

## 📑 Table of Contents

- [🌟 Features & Capabilities](#-features--capabilities)
- [🏗 System Architecture](#-system-architecture)
- [📋 Prerequisites](#-prerequisites)
- [⚡ Quick Start Installation from GitHub](#-quick-start-installation-from-github)
  - [Method 1: Windows 1-Click Launchers (Automated Setup)](#method-1-windows-1-click-launchers-automated-setup)
  - [Method 2: Standard Command Line (Windows / macOS / Linux)](#method-2-standard-command-line-windows--macos--linux)
- [🚀 Production Hosting & Deployment Guide](#-production-hosting--deployment-guide)
  - [Hosting Option 1: Docker Compose (PostgreSQL Stack - Recommended)](#hosting-option-1-docker-compose-postgresql-stack---recommended)
  - [Hosting Option 2: Linux Server (Ubuntu / Debian / RHEL + Systemd + Nginx + SSL)](#hosting-option-2-linux-server-ubuntu--debian--rhel--systemd--nginx--ssl)
  - [Hosting Option 3: Windows Server (IIS 10 + NSSM Service + SSL)](#hosting-option-3-windows-server-iis-10--nssm-service--ssl)
  - [Hosting Option 4: Cloud PaaS Deployment (Render / Railway / Fly.io)](#hosting-option-4-cloud-paas-deployment-render--railway--flyio)
  - [🔒 Production Security & Hardening Checklist](#-production-security--hardening-checklist)
- [🔐 Pre-Configured Demo Accounts & Roles](#-pre-configured-demo-accounts--roles)
- [🌐 Network & Multi-Device Access (LAN / Mobile / Scanners)](#-network--multi-device-access-lan--mobile--scanners)
- [⚙️ Environment Variables Configuration](#️-environment-variables-configuration)
- [💾 Database Switching (SQLite vs PostgreSQL)](#-database-switching-sqlite-vs-postgresql)
- [🧪 Automated Test Verification](#-automated-test-verification)
- [🛡 Disaster Recovery & Cloud Backups](#-disaster-recovery--cloud-backups)
- [📁 Repository Directory Structure](#-repository-directory-structure)
- [📚 Full Documentation Index](#-full-documentation-index)
- [📄 License](#-license)

---

## 🌟 Features & Capabilities

### 1. Hardware Asset Master & Full Lifecycle
- **Complete Lifecycle Stages**: `Purchase` → `Receiving` → `Inventory` → `Tagging` → `Assignment` → `Active Use` → `Maintenance` → `Return` → `Retirement` → `Disposal`.
- **Dynamic Auto-Tagging Engine**: Customizable prefix, year, month, category codes, and zero-padded sequence numbers (e.g., `ACME-LAP-2026-000042`).
- **Comprehensive Master Data**: Serial numbers, MAC addresses, specs (CPU/RAM/GPU/Storage), purchase orders, vendors, warranties, and depreciation.
- **Dynamic Custom Fields**: Add custom fields on the fly (`TEXT`, `NUMBER`, `BOOLEAN`, `DATE`, `DROPDOWN`, `TEXTAREA`, `URL`) without database migrations.

### 2. Barcode & QR Code Engine
- **Symbologies Supported**: Code 128, Code 39, and 2D QR Codes.
- **Zero-Overlap Label Printing**: Generate single labels and standard A4 24-up Avery-style sheets with corporate branding.
- **Dual-Mode Scanner Integration**:
  - **Camera / Webcam**: In-browser QR and barcode reader via HTML5 Canvas.
  - **Hardware USB Gun / Bluetooth**: Global listener detecting high-speed keystroke bursts from physical barcode wedge scanners.

### 3. Custody Allocation & Digital Handover
- **Assignment Types**: Permanent, Temporary / Loaner, Remote Work, and Project.
- **Digital Signature Pad**: HTML5 canvas for capturing touch and stylus employee signatures at hardware handover.
- **PDF Handover Certificate**: Tamper-evident PDF certificate generation including company branding, serial numbers, accessory checklists, terms of custody, and embedded digital signatures.
- **Check-in / Return Inspection**: Physical condition assessment (`Good`, `Damaged`, `Needs Repair`), missing accessory logging, and return receipts.

### 4. Software Asset Management (SAM) & Consumables
- **License Tracking**: Perpetual, SaaS/Subscription, OEM, and Per-Seat licenses.
- **Compliance Counter**: Real-time ratio of `Allocated Seats` vs `Purchased Seats` with over-allocation warnings.
- **Consumable Stock**: Track bulk peripherals, cables, and toner with automated low-stock threshold triggers.

### 5. Helpdesk Service Tickets & Maintenance
- **Ticket Workflow**: Employee issue reporting, priority SLAs, technician comments, and resolution tracking.
- **Maintenance Records**: Internal servicing and external vendor RMA tracking, maintenance costs, and parts replacement logs.

### 6. Super Admin Customization & White-Labeling
- **Live Branding**: Customize portal name, logos, primary/accent themes, and custom CSS injection in real time.
- **Bi-Directional Currency Sync**: Switch currencies (`$`, `€`, `£`, `₹`, `¥`, `C$`, `A$`) across both the Customization Center and IT Asset Inventory tables with zero page refresh required.
- **Modular Feature Toggles**: Instant activation/deactivation of Software Licenses (SAM), Consumables Inventory, Employee Self-Service, Maintenance Tracking, Barcode Scanners, and 2FA.
- **1-Click System Configuration Snapshots**: Export and import full JSON system snapshot backups.

---

## 🏗 System Architecture

```
                                ┌────────────────────────────────────────┐
                                │       Client Browsers & Scanners       │
                                │   (Webcam, USB Gun, Tablets, Mobile)   │
                                └───────────────────┬────────────────────┘
                                                    │ HTTP / HTTPS
                                                    ▼
                                ┌────────────────────────────────────────┐
                                │        Reverse Proxy / Gateway         │
                                │       (Nginx, IIS, Docker, Traefik)    │
                                └───────────────────┬────────────────────┘
                                                    │
                                                    ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│                               Node.js Express Unified Backend                                │
│                                                                                               │
│  ┌──────────────────────┐  ┌───────────────────────┐  ┌────────────────────────────────────┐  │
│  │   SPA Static Server  │  │    REST API (/v1)     │  │    OpenAPI Docs (/api/docs)        │  │
│  │  (React 18 + Vite)   │  │   JWT Auth & RBAC     │  │     Swagger Interactive UI         │  │
│  └──────────────────────┘  └───────────┬───────────┘  └────────────────────────────────────┘  │
│                                        │                                                      │
│  ┌─────────────────────────────────────┴───────────────────────────────────────────────────┐  │
│  │                            Modular Services & Customization Layer                       │  │
│  │  • BrandingEngine      • CustomFieldsEngine  • NumberingEngine   • FeatureFlagsEngine   │  │
│  │  • AssetService        • AllocationService   • TicketService     • LicenseService       │  │
│  │  • BarcodeGenerator    • PDFKit Generator    • EmailService      • DisasterRecovery     │  │
│  └─────────────────────────────────────┬───────────────────────────────────────────────────┘  │
│                                        │                                                      │
│  ┌─────────────────────────────────────┴───────────────────────────────────────────────────┐  │
│  │                                  Prisma ORM Layer                                       │  │
│  └───────────────────────────────┬───────────────────────────────┬─────────────────────────┘  │
└──────────────────────────────────┼───────────────────────────────┼────────────────────────────┘
                                   │                               │
                                   ▼                               ▼
                 ┌───────────────────────────────────┐  ┌─────────────────────────────────────┐
                 │     SQLite (Zero-Config Dev)      │  │       Local Persistent Storage      │
                 │      or PostgreSQL 16 (Prod)      │  │    (Uploads, QR, Handover PDFs)     │
                 └───────────────────────────────────┘  └─────────────────────────────────────┘
```

---

## 📋 Prerequisites

| Tool | Minimum Version | Recommended Version | Download Link |
|------|-----------------|---------------------|---------------|
| **Git** | `v2.30+` | `v2.40+` | [git-scm.com](https://git-scm.com/) |
| **Node.js** | `v18.16.0+` | `v20.x LTS` / `v22.x LTS` | [nodejs.org](https://nodejs.org/) |
| **npm** | `v9.0.0+` | `v10.x+` | Bundled with Node.js |
| **Docker** *(Optional)* | `v20.10+` | Latest Desktop / Engine | [docker.com](https://www.docker.com/) |

---

## ⚡ Quick Start Installation from GitHub

### Step 1: Clone the Repository

```bash
git clone https://github.com/<your-username>/it-asset-management.git
cd it-asset-management
```

---

### Method 1: Windows 1-Click Launchers (Automated Setup)

The repository includes intelligent 1-click startup scripts that automatically:
1. Detect missing `.env` files and copy from `.env.example`.
2. Install backend and frontend dependencies if not already installed.
3. Push the Prisma database schema and seed the initial master data.
4. Launch both servers and open your default browser to the web portal.

#### Option A: Command Prompt / Double-Click
Double-click `start.bat` in Windows Explorer, or execute in Command Prompt:
```cmd
start.bat
```

#### Option B: PowerShell
Right-click `start.ps1` → *Run with PowerShell*, or execute in PowerShell:
```powershell
.\start.ps1
```

Once started, the application opens automatically at **`http://localhost:5173`**.

---

### Method 2: Standard Command Line (Windows / macOS / Linux)

#### 1. Automated Setup (Install & Seed)
```bash
# Copy backend environment configuration
cp backend/.env.example backend/.env

# Run one-command automated setup (installs packages, migrates schema & seeds demo records)
npm run setup
```
*(On Windows PowerShell, use `Copy-Item backend\.env.example backend\.env`)*

#### 2. Start Development Servers
```bash
# Terminal 1: Start Backend API (Port 5000)
npm run dev:backend

# Terminal 2: Start Frontend Web Portal (Port 5173)
npm run dev:frontend
```

#### 3. Production Unified Mode (Single Port 5000)
To serve both the frontend React app and backend REST API together on a single port (**`http://localhost:5000`**):
```bash
npm run build
npm start
```

---

## 🚀 Production Hosting & Deployment Guide

This section provides complete, tested recipes for hosting the application in production environments.

### Hosting Option 1: Docker Compose (PostgreSQL Stack - Recommended)

The simplest and most resilient production hosting method. Uses multi-stage Docker builds, PostgreSQL 16, and Nginx.

```bash
# 1. Clone repository on your production server
git clone https://github.com/<your-username>/it-asset-management.git /opt/it-asset-management
cd /opt/it-asset-management

# 2. Configure production environment variables
cp .env.example .env
nano .env  # Update JWT_SECRET, APP_URL, and DB credentials

# 3. Launch all containers in background
docker compose up -d --build

# 4. Seed initial database master data
docker compose exec backend npm run seed
```

- **Application Web Portal**: `http://<your-server-ip>:80` (or configured HTTPS domain)
- **API Documentation**: `http://<your-server-ip>:80/api/docs`
- **Health Check**: `http://<your-server-ip>:80/api/v1/health`

To stop or restart:
```bash
docker compose down          # Stop containers
docker compose restart       # Restart services
docker compose logs -f       # Stream container logs
```

---

### Hosting Option 2: Linux Server (Ubuntu / Debian / RHEL + Systemd + Nginx + SSL)

Follow this recipe to deploy on Ubuntu 22.04 / 24.04 LTS or Debian 12:

#### 1. Install Node.js, PostgreSQL & Nginx
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20 LTS & build essentials
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx postgresql postgresql-contrib certbot python3-certbot-nginx git

# Verify installations
node -v && npm -v && nginx -v
```

#### 2. Configure PostgreSQL Database
```bash
sudo -u postgres psql -c "CREATE USER itam_user WITH PASSWORD 'StrongSecurePassword2026!';"
sudo -u postgres psql -c "CREATE DATABASE itam_db OWNER itam_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE itam_db TO itam_user;"
```

#### 3. Deploy Application Code
```bash
sudo mkdir -p /var/www/itam
sudo chown -R $USER:$USER /var/www/itam
git clone https://github.com/<your-username>/it-asset-management.git /var/www/itam
cd /var/www/itam

# Install dependencies and build
npm run install:all
npm run build

# Configure production .env
cat <<EOF > /var/www/itam/backend/.env
PORT=5000
NODE_ENV=production
DATABASE_URL="postgresql://itam_user:StrongSecurePassword2026!@localhost:5432/itam_db?schema=public"
JWT_SECRET="$(openssl rand -hex 64)"
JWT_EXPIRES_IN="24h"
JWT_REFRESH_SECRET="$(openssl rand -hex 64)"
JWT_REFRESH_EXPIRES_IN="7d"
APP_URL="https://itam.yourcompany.com"
CORS_ORIGIN="https://itam.yourcompany.com"
STORAGE_TYPE=local
UPLOAD_DIR="./uploads"
DEFAULT_COMPANY_NAME="Your Company Name"
DEFAULT_CURRENCY="USD"
EOF

# Initialize Database Schema & Seed Data
cd /var/www/itam/backend
npx prisma db push --schema=prisma/schema.postgresql.prisma
npm run seed
```

#### 4. Create Systemd Service for Auto-Start & Crash Recovery
Create `/etc/systemd/system/itam.service`:
```ini
[Unit]
Description=Enterprise IT Asset Management Backend Service
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/var/www/itam/backend
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=itam-backend

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo chown -R www-data:www-data /var/www/itam
sudo systemctl daemon-reload
sudo systemctl enable itam
sudo systemctl start itam
sudo systemctl status itam
```

#### 5. Configure Nginx Reverse Proxy & Let's Encrypt SSL
Create `/etc/nginx/sites-available/itam.conf`:
```nginx
server {
    listen 80;
    server_name itam.yourcompany.com;

    # Client body size for asset photo and CSV uploads
    client_max_body_size 50M;

    # Frontend Static Files
    location / {
        root /var/www/itam/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend API Reverse Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Uploads Static Assets
    location /uploads/ {
        alias /var/www/itam/backend/uploads/;
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }
}
```

Enable site and acquire free SSL certificate:
```bash
sudo ln -s /etc/nginx/sites-available/itam.conf /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Issue Let's Encrypt SSL
sudo certbot --nginx -d itam.yourcompany.com
```

---

### Hosting Option 3: Windows Server (IIS 10 + NSSM Service + SSL)

For hosting in an on-premise Windows Server Active Directory environment:

1. **Install Prerequisites**:
   - Install **Node.js LTS** from `nodejs.org`.
   - Install **IIS 10** with **URL Rewrite** and **Application Request Routing (ARR)** extensions.
   - Download **NSSM** (Non-Sucking Service Manager) from `nssm.cc`.

2. **Configure Application Directory**:
   - Clone repo to `C:\inetpub\itam`.
   - Run `npm run install:all` and `npm run build`.
   - Setup `backend/.env` with your PostgreSQL or SQLite connection string.
   - Run `cd backend && npx prisma db push && npm run seed`.

3. **Install Background Windows Service using NSSM**:
   ```cmd
   nssm.exe install ITAMService "C:\Program Files\nodejs\node.exe" "C:\inetpub\itam\backend\dist\server.js"
   nssm.exe set ITAMService AppDirectory "C:\inetpub\itam\backend"
   nssm.exe set ITAMService Start SERVICE_AUTO_START
   nssm.exe start ITAMService
   ```

4. **Configure IIS Reverse Proxy**:
   - Create a website in IIS bound to port 80 / 443 with your SSL certificate.
   - Point the site physical path to `C:\inetpub\itam\frontend\dist`.
   - Add a reverse proxy rewrite rule routing requests matching `api/*` to `http://127.0.0.1:5000/api/{R:1}`.

---

### Hosting Option 4: Cloud PaaS Deployment (Render / Railway / Fly.io)

#### Deploying on Render (Free / Pro Tier):
1. **Fork or Push** this repository to your GitHub account.
2. In [Render Dashboard](https://dashboard.render.com/), create a new **PostgreSQL Database**:
   - Note the **Internal Database URL**.
3. Create a **New Web Service**:
   - Connect your GitHub repo.
   - **Environment**: `Node`.
   - **Build Command**: `npm run install:all && npm run build && cd backend && npx prisma db push --schema=prisma/schema.postgresql.prisma && npm run seed`
   - **Start Command**: `npm start`
4. Set **Environment Variables** in Render:
   - `DATABASE_URL`: `[Your Render Internal Database URL]`
   - `NODE_ENV`: `production`
   - `JWT_SECRET`: `[Random 64-char string]`
   - `JWT_REFRESH_SECRET`: `[Random 64-char string]`
   - `APP_URL`: `https://[your-service].onrender.com`
   - `CORS_ORIGIN`: `https://[your-service].onrender.com`

---

### 🔒 Production Security & Hardening Checklist

Before making your production deployment public, ensure you have:

- [x] **Replaced Default JWT Secrets**: Generated unique random 64+ character strings using `openssl rand -hex 64`.
- [x] **Enforced HTTPS / TLS**: Terminated TLS via Nginx, IIS, or Cloudflare with modern ciphers (TLS 1.2+).
- [x] **CORS Origins Restricted**: Explicitly defined corporate domains in `CORS_ORIGIN` (avoid wildcard `*` in production).
- [x] **Changed Default Credentials**: Immediately updated default passwords for `admin@acme-corp.com` and `itadmin@acme-corp.com` via the web console.
- [x] **Configured Automated Backups**: Scheduled daily cron or Windows Task Scheduler execution of `scripts/backup.sh` or `scripts/backup.ps1`.
- [x] **Configured Inbound Firewall**: Closed ports 5000 and 5432 to the public internet, exposing only ports 80 and 443 via reverse proxy.

---

## 🔐 Pre-Configured Demo Accounts & Roles

The system comes pre-seeded with four test personas representing all organizational tiers:

| Role | Email Address | Password | Permissions & Scope |
|------|---------------|----------|----------------------|
| 👑 **Super Admin** | `admin@acme-corp.com` | `Admin@123456` | Full system control, Branding Customization, Custom Fields, Numbering Engine, Feature Flags, System Settings, Audit Logs & Disaster Recovery backups. |
| 💻 **IT Admin** | `itadmin@acme-corp.com` | `Admin@123456` | Hardware master data, Asset allocations, Check-in/Check-out, SAM software licenses, Consumables inventory, and CSV/Excel imports. |
| 🛠️ **Support Engineer** | `support@acme-corp.com` | `Admin@123456` | Barcode label generation, Hardware scanner gun lookups, Maintenance logs, Repair costs, and Support ticket resolution. |
| 👤 **Employee** | `john.doe@acme-corp.com` | `User@123456` | Self-service employee portal, Assigned hardware viewing, Digital signature acceptance, and Support ticket creation. |

> 💡 **Quick Login Tip**: The login screen features a 1-click **Quick Switch** toolbar allowing you to test each role instantly without manually typing passwords.

---

## 🌐 Network & Multi-Device Access (LAN / Mobile / Scanners)

The application binds to `0.0.0.0`, allowing mobile devices, warehouse barcode scanners, and LAN workstations to access the portal.

### Finding Your Server LAN IP Address
- **Windows**: Run `ipconfig` (look for *IPv4 Address*, e.g., `192.168.1.128`).
- **macOS / Linux**: Run `ip a` or `ifconfig` (look for `inet`, e.g., `192.168.1.128`).

### Accessing From Other Devices on the Same Network
- **Development Portal**: `http://<YOUR-SERVER-IP>:5173`
- **Unified Production Server**: `http://<YOUR-SERVER-IP>:5000`
- **API Documentation**: `http://<YOUR-SERVER-IP>:5000/api/docs`

> ⚠️ **Windows Firewall**: If other devices cannot connect, allow ports `5000` and `5173`:
> ```powershell
> New-NetFirewallRule -DisplayName "ITAM Web Portal" -Direction Inbound -LocalPort 5000,5173 -Protocol TCP -Action Allow
> ```

---

## ⚙️ Environment Variables Configuration

The backend reads configuration from `backend/.env`:

```env
# Application Server
PORT=5000
NODE_ENV=development

# Database Connection (SQLite or PostgreSQL)
DATABASE_URL="file:./dev.db"

# JWT Authentication Security (Change in production!)
JWT_SECRET="production_ready_itam_jwt_secret_key_secure_2026"
JWT_EXPIRES_IN="24h"
JWT_REFRESH_SECRET="production_ready_itam_refresh_secret_key_secure_2026"
JWT_REFRESH_EXPIRES_IN="7d"

# CORS and Allowed Origins
APP_URL="http://localhost:5173"
CORS_ORIGIN="http://localhost:5173,http://localhost:5000,http://localhost:3000"

# File Storage (local or s3)
STORAGE_TYPE=local
UPLOAD_DIR="./uploads"

# SMTP Notifications (Google Workspace / Office 365 / Custom SMTP)
SMTP_HOST="smtp.mailtrap.io"
SMTP_PORT=2525
SMTP_SECURE=false
SMTP_USER=""
SMTP_PASS=""
SMTP_FROM="IT Asset Management <noreply@itam-system.local>"

# System Defaults
DEFAULT_COMPANY_NAME="Acme Global Technologies Inc."
DEFAULT_CURRENCY="USD"
```

---

## 💾 Database Switching (SQLite vs PostgreSQL)

### Using Embedded SQLite (Default - Zero Config)
Perfect for local development, proof-of-concept, and single-server environments. No database server installation required.
- Set `DATABASE_URL="file:./dev.db"` in `backend/.env`.
- Run `npm run prisma:push && npm run prisma:seed`.

### Using PostgreSQL 16 (Enterprise Production)
Recommended for high-concurrency environments:
1. In `backend/prisma/schema.prisma`, update the datasource provider:
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```
2. In `backend/.env`, set your connection string:
   ```env
   DATABASE_URL="postgresql://username:password@localhost:5432/itam_db?schema=public"
   ```
3. Run migrations and seed:
   ```bash
   cd backend
   npx prisma migrate dev --name init
   npm run seed
   ```

---

## 🧪 Automated Test Verification

The repository contains two comprehensive automated test suites covering unit logic, REST endpoints, multi-role security policies, and dynamic currency synchronization:

### 1. Backend Jest Integration Test Suite
```bash
npm run test:unit
# or: cd backend && npm test
```

**Expected Output:**
```
Test Suites: 1 passed, 1 total
Tests:       30 passed, 30 total
Snapshots:   0 total
Time:        ~9s
Ran all test suites.
```

### 2. Multi-Role RBAC & Dynamic Currency E2E Test Suite
```bash
npm run test:e2e
# or: node test-all-logins.js
```

**Expected Output:**
```
================================================================
📊 TEST SUMMARY RESULTS ACROSS ALL ROLES & MODULES:
================================================================

• [SUPERADMIN]: 6/6 tests passed
• [CURRENCYSYNC]: 3/3 tests passed
• [ITADMIN]: 7/7 tests passed
• [SUPPORTENGINEER]: 5/5 tests passed
• [EMPLOYEE]: 7/7 tests passed

TOTAL SCORE: 28 / 28 (100%) PASS RATE
================================================================
```

---

## 🛡 Disaster Recovery & Cloud Backups

### 1-Click System Configuration Snapshots
Super Admins can export and import the entire system configuration directly from the web portal:
- Navigate to **Customization Center** → **Backup & Restore**.
- Click **Export System Configuration** to download a complete JSON snapshot containing branding, custom fields, numbering sequences, workflow statuses, and feature flags.
- To restore after hardware migration, click **Import Configuration** and select your JSON snapshot.

### Automated Database Backups & Cloud Sync
Automated backup scripts are provided in the [`scripts/`](scripts/) folder for both Linux and Windows:

- **Windows PowerShell**: [`scripts/backup.ps1`](scripts/backup.ps1)
- **Linux Bash**: [`scripts/backup.sh`](scripts/backup.sh)

#### Cloud Backup to Google Drive / OneDrive via Rclone:
```powershell
# Set up Google Drive or OneDrive in Rclone:
rclone config

# Run automated backup with cloud sync:
.\scripts\backup.ps1 -CloudDestination "gdrive:Backups/ITAM" -RetainDays 30
```

Refer to [`docs/BACKUP_RESTORE.md`](docs/BACKUP_RESTORE.md) for full disaster recovery setup and Grandfather-Father-Son (GFS) retention plans.

---

## 📁 Repository Directory Structure

```
it-asset-management/
├── backend/                             # Express + TypeScript Backend API
│   ├── prisma/
│   │   ├── schema.prisma                # SQLite schema (zero-config embedded)
│   │   ├── schema.postgresql.prisma     # PostgreSQL schema (enterprise production)
│   │   └── seed.ts                      # Master data seeder (users, assets, licenses)
│   ├── src/
│   │   ├── customization/               # Super Admin Customization Engine
│   │   │   ├── brandingEngine.ts        # Portal name, logos, themes, CSS injection
│   │   │   ├── customFieldsEngine.ts    # Dynamic custom attributes engine
│   │   │   ├── numberingEngine.ts       # Auto-tagging pattern generator & tokens
│   │   │   ├── workflowStatusEngine.ts  # Configurable asset lifecycle statuses
│   │   │   ├── featureFlagsEngine.ts    # Modular enterprise feature flags
│   │   │   ├── customizationExportImport.ts # 1-Click JSON config backup & restore
│   │   │   ├── customizationController.ts
│   │   │   └── customizationRoutes.ts
│   │   ├── config/                      # Database, environment, and logger config
│   │   ├── controllers/                 # REST API controllers
│   │   ├── jobs/                        # Background scheduler (warranties, licenses, low stock)
│   │   ├── middlewares/                 # JWT Auth, RBAC, audit logger, file upload
│   │   ├── routes/                      # API routing tables (/api/v1/*)
│   │   ├── services/                    # Core business logic services
│   │   ├── utils/                       # Barcode, PDFKit, Excel, and email utilities
│   │   ├── app.ts                       # Express application setup & SPA static router
│   │   └── server.ts                    # HTTP server & graceful shutdown handler
│   ├── tests/
│   │   └── itam.test.ts                 # Jest automated test suite (30 passing tests)
│   └── uploads/                         # Local asset photos, signatures, PDFs
├── frontend/                            # React 18 + Vite + Tailwind Frontend
│   ├── src/
│   │   ├── customization/               # Frontend Customization Subsystem
│   │   │   ├── BrandingContext.tsx      # Real-time CSS theme injection & currency format
│   │   │   ├── CustomFieldRenderer.tsx  # Dynamic form inputs for custom fields
│   │   │   ├── CustomFieldDisplay.tsx   # Custom field tabular data renderer
│   │   │   ├── CustomizationCenterPage.tsx # Super Admin 8-tab cockpit
│   │   │   └── customizationApi.ts      # Axios API client for customization
│   │   ├── components/                  # Scanner modal, signature pad, layout components
│   │   ├── contexts/                    # AuthContext and ThemeContext (Dark/Light)
│   │   ├── pages/                       # Dashboard, Assets, Allocations, SAM, Tickets
│   │   ├── services/                    # Axios API client & typed endpoints
│   │   └── App.tsx                      # Client routing & protected routes
│   └── vite.config.ts                   # Vite configuration (proxy to port 5000)
├── docker/                              # Nginx production configuration
├── docs/                                # Enterprise Documentation
│   ├── ADMIN_GUIDE.md                   # Administrator handbook
│   ├── API_DOCUMENTATION.md             # Complete REST API reference
│   ├── ARCHITECTURE.md                  # Technical architecture & design decisions
│   ├── BACKUP_RESTORE.md                # Disaster recovery, retention & cloud backup guide
│   ├── DATABASE_ERD.md                  # Database Entity-Relationship diagram
│   ├── DEPLOYMENT_LINUX.md              # Linux Systemd + Nginx production setup
│   ├── DEPLOYMENT_WINDOWS.md            # Windows Server IIS + NSSM production setup
│   ├── DOCKER_DEPLOYMENT.md             # Docker Compose deployment & scaling guide
│   ├── PRODUCTION_CHECKLIST.md          # Production go-live verification checklist
│   └── USER_GUIDE.md                    # User & support technician handbook
├── scripts/                             # Operational scripts
│   ├── backup.sh                        # Linux bash backup & 30-day rotation
│   ├── backup.ps1                       # Windows PowerShell backup script
│   ├── restore.sh                       # Linux restore script
│   └── restore.ps1                      # Windows restore script
├── .env.example                         # Root environment template
├── .gitignore                           # Git ignore rules (node_modules, dev.db, dist)
├── docker-compose.yml                   # Docker multi-container composition
├── Dockerfile                           # Production container build
├── LICENSE                              # MIT License
├── package.json                         # Root convenience scripts (setup, start, test)
├── README.md                            # Main GitHub repository documentation
├── start.bat                            # Windows 1-Click Command Prompt launcher
├── start.ps1                            # Windows 1-Click PowerShell launcher
└── test-all-logins.js                   # Multi-role E2E test suite (28 passing tests)
```

---

## 📚 Full Documentation Index

Comprehensive guides for every aspect of the platform are located in the [`docs/`](docs/) directory:

- 📐 [**System Architecture & Design Decisions**](docs/ARCHITECTURE.md)
- 🗄️ [**Database Schema & ERD**](docs/DATABASE_ERD.md)
- 📡 [**REST API Documentation (Swagger & OpenAPI)**](docs/API_DOCUMENTATION.md)
- ⚙️ [**Administrator Handbook**](docs/ADMIN_GUIDE.md)
- 📖 [**User & Support Engineer Guide**](docs/USER_GUIDE.md)
- 🐳 [**Docker Production Deployment Guide**](docs/DOCKER_DEPLOYMENT.md)
- 🐧 [**Linux (Ubuntu / RHEL) Systemd + Nginx Deployment**](docs/DEPLOYMENT_LINUX.md)
- 🪟 [**Windows Server IIS + NSSM Deployment**](docs/DEPLOYMENT_WINDOWS.md)
- 🛟 [**Disaster Recovery, Retention & Cloud Sync Guide**](docs/BACKUP_RESTORE.md)
- ✅ [**Production Go-Live Checklist**](docs/PRODUCTION_CHECKLIST.md)

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.
You are free to use, modify, distribute, and integrate this software in commercial and private environments.
