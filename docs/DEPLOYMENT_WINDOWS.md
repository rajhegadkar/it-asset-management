# Production Deployment Guide: Windows Server (2019 / 2022 / 2025)

This guide provides step-by-step instructions for deploying the **IT Asset Management (ITAM)** application in a production Windows Server environment.

---

## 1. Architecture Overview on Windows

On Windows Server, the IT Asset Management system can be deployed in two enterprise architectures:

```
[ Clients / Mobile Scanners / Web Browsers ]
                     │ (HTTPS Port 443)
                     ▼
       [ Internet Information Services (IIS) ]
           (TLS Termination, ARR & URL Rewrite)
                     │ (HTTP Proxy Port 5000)
                     ▼
  [ Windows Service: itam-backend (via NSSM or PM2) ]
     ├── Node.js Unified Server (API + Built Frontend SPA)
     ├── Prisma ORM Engine
     ├── Barcode & PDF Generators
     └── Background Scheduler (Warranty & License Alerts)
                     │
        ┌────────────┴────────────┐
        ▼                         ▼
 [ PostgreSQL 16 Service ]    [ Local Storage ]
 (Local or Dedicated Server)   (Uploads, QR, Handover PDFs)
```

---

## 2. Prerequisites

Ensure the target Windows Server has the following installed:

1. **Operating System**: Windows Server 2019, 2022, or 2025 with administrative privileges.
2. **Node.js**: v20.x or v22.x LTS x64 (download from [nodejs.org](https://nodejs.org/)).
3. **Git for Windows**: Download from [git-scm.com](https://git-scm.com/).
4. **PostgreSQL 16 for Windows**: (Recommended for multi-user enterprise setups) or embedded SQLite (for isolated single-site deployments).
5. **IIS with URL Rewrite & ARR** (Application Request Routing) installed via Server Manager or chocolatey.
6. **NSSM (Non-Sucking Service Manager)**: Download `nssm-2.24.zip` or install via Chocolatey: `choco install nssm`.

---

## 3. Directory Setup & Permissions

Open PowerShell as Administrator:

```powershell
# Create root deployment directory
New-Item -ItemType Directory -Force -Path "C:\Services\it-asset-management"
New-Item -ItemType Directory -Force -Path "C:\Services\it-asset-management\logs"
New-Item -ItemType Directory -Force -Path "C:\Services\it-asset-management\backups"

# Clone or copy application files
cd "C:\Services\it-asset-management"
git clone <your-repository-url> .
```

Grant read/write permissions for service execution:
```powershell
# Set full permissions for NETWORK SERVICE or dedicated service account (e.g., svc_itam)
icacls "C:\Services\it-asset-management\backend\uploads" /grant "NETWORK SERVICE:(OI)(CI)F" /T
icacls "C:\Services\it-asset-management\logs" /grant "NETWORK SERVICE:(OI)(CI)F" /T
```

---

## 4. Environment Configuration

Copy and customize the `.env` configuration file:

```powershell
cd "C:\Services\it-asset-management\backend"
Copy-Item .env.example .env
```

Edit `C:\Services\it-asset-management\backend\.env`:

```env
# Application Core
NODE_ENV=production
PORT=5000
APP_NAME="Enterprise IT Asset Management"
APP_URL="https://itam.yourcompany.com"

# Database Configuration (PostgreSQL on Windows)
DATABASE_URL="postgresql://itam_admin:StrongPassword123!@localhost:5432/itam_prod?schema=public"

# Security & Tokens (Generate 64-character random hex keys)
JWT_SECRET=b7e193c4a243d46a6f7b119c3e981d0f5e4c3a2b1f0e9d8c7b6a5f4e3d2c1b0a
JWT_EXPIRES_IN=8h
JWT_REFRESH_SECRET=e4c3a2b1f0e9d8c7b6a5f4e3d2c1b0ab7e193c4a243d46a6f7b119c3e981d0f5
JWT_REFRESH_EXPIRES_IN=7d

# File Storage
UPLOAD_DIR="C:\\Services\\it-asset-management\\backend\\uploads"
MAX_UPLOAD_SIZE_MB=15

# SMTP Email Dispatch
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=itam-notifications@yourcompany.com
SMTP_PASS=YourOffice365AppPassword
SMTP_FROM_EMAIL=itam-notifications@yourcompany.com
SMTP_FROM_NAME="IT Asset Management"

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
```

---

## 5. Application Build & Database Initialization

Run the build commands in PowerShell:

```powershell
# Build Frontend
cd "C:\Services\it-asset-management\frontend"
npm ci
npm run build

# Build Backend
cd "C:\Services\it-asset-management\backend"
npm ci
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run build
```

---

## 6. Service Installation via NSSM

NSSM manages the Node.js process as a native Windows Service with auto-recovery on failure and automatic start on system boot.

```powershell
# Set variables
$NodePath = (Get-Command node).Source
$AppDir = "C:\Services\it-asset-management\backend"
$DistFile = "C:\Services\it-asset-management\backend\dist\server.js"

# Install Windows Service
nssm install ITAssetManagement $NodePath $DistFile
nssm set ITAssetManagement AppDirectory $AppDir
nssm set ITAssetManagement AppStdout "C:\Services\it-asset-management\logs\service-stdout.log"
nssm set ITAssetManagement AppStderr "C:\Services\it-asset-management\logs\service-stderr.log"
nssm set ITAssetManagement Start SERVICE_AUTO_START
nssm set ITAssetManagement AppRestartDelay 5000

# Start the Service
Start-Service ITAssetManagement

# Verify status
Get-Service ITAssetManagement
```

---

## 7. IIS Reverse Proxy Configuration (HTTPS & SSL)

### A. Install IIS Modules
1. Install **IIS** via Server Manager.
2. Install **URL Rewrite 2.1** from [IIS Downloads](https://www.iis.net/downloads/microsoft/url-rewrite).
3. Install **Application Request Routing 3.0** (ARR). In IIS Manager -> Application Request Routing Cache -> Server Proxy Settings -> Check **Enable proxy**.

### B. Configure Website & web.config
Create an IIS Website binding to port 80 and 443 with your domain (e.g., `itam.yourcompany.com`).
Place a `web.config` file in the IIS site root (`C:\inetpub\wwwroot\itam`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<configuration>
    <system.webServer>
        <rewrite>
            <rules>
                <!-- Force HTTPS -->
                <rule name="Redirect to HTTPS" stopProcessing="true">
                    <match url="(.*)" />
                    <conditions>
                        <add input="{HTTPS}" pattern="^OFF$" />
                    </conditions>
                    <action type="Redirect" url="https://{HTTP_HOST}/{R:1}" redirectType="Permanent" />
                </rule>
                <!-- Reverse Proxy to Node.js Backend -->
                <rule name="ReverseProxyToNode" stopProcessing="true">
                    <match url="(.*)" />
                    <action type="Rewrite" url="http://127.0.0.1:5000/{R:1}" />
                    <serverVariables>
                        <set name="HTTP_X_FORWARDED_PROTO" value="https" />
                        <set name="HTTP_X_FORWARDED_HOST" value="{HTTP_HOST}" />
                    </serverVariables>
                </rule>
            </rules>
        </rewrite>
        <security>
            <requestFiltering>
                <requestLimits maxAllowedContentLength="20971520" /> <!-- 20 MB -->
            </requestFiltering>
        </security>
        <httpProtocol>
            <customHeaders>
                <remove name="X-Powered-By" />
                <add name="X-Content-Type-Options" value="nosniff" />
                <add name="X-Frame-Options" value="DENY" />
                <add name="X-XSS-Protection" value="1; mode=block" />
            </customHeaders>
        </httpProtocol>
    </system.webServer>
</configuration>
```

### C. SSL Certificate Setup
Install an SSL certificate using Active Directory CS, import an enterprise wildcard PFX, or use **win-acme** for automated Let's Encrypt certificates:

```powershell
choco install win-acme
wacs.exe --target iissite --siteid 1 --email admin@yourcompany.com --accepttos
```

---

## 8. Windows Firewall Configuration

Allow inbound traffic only on HTTP (80) and HTTPS (443):

```powershell
New-NetFirewallRule -DisplayName "ITAM HTTP (Port 80)" -Direction Inbound -LocalPort 80 -Protocol TCP -Action Allow
New-NetFirewallRule -DisplayName "ITAM HTTPS (Port 443)" -Direction Inbound -LocalPort 443 -Protocol TCP -Action Allow
```

*(Node.js port 5000 remains bound strictly to `127.0.0.1` and is never exposed directly).*

---

## 9. Automated Backups via Windows Task Scheduler

To schedule automated daily database backups at 02:00 AM using the provided PowerShell script:

```powershell
$Action = New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-ExecutionPolicy Bypass -File C:\Services\it-asset-management\scripts\backup.ps1"
$Trigger = New-ScheduledTaskTrigger -Daily -At "02:00"
$Principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
Register-ScheduledTask -TaskName "ITAM_Daily_Backup" -Action $Action -Trigger $Trigger -Principal $Principal -Description "Daily PostgreSQL & uploads backup for IT Asset Management"
```

---

## 10. Monitoring & Healthchecks

1. **Service Status**:
   ```powershell
   Get-Service ITAssetManagement
   ```
2. **HTTP Endpoint Healthcheck**:
   ```powershell
   Invoke-RestMethod -Uri "http://127.0.0.1:5000/api/v1/health" | ConvertTo-Json
   ```
3. **Application Logs**:
   ```powershell
   Get-Content -Path "C:\Services\it-asset-management\logs\service-stdout.log" -Tail 50 -Wait
   ```
