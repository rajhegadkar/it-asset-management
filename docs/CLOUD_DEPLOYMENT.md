# Cloud Deployment & Self-Hosting Guide

This guide provides step-by-step instructions for publishing and running the **Enterprise IT Asset Management (ITAM)** platform on free and enterprise cloud platforms.

---

## ⚡ Quick 1-Click Cloud Deployment

### 1. Deploy on Render (Recommended - 100% Free Tier)

Render provides free hosting for full-stack Node.js applications with automatic SSL, custom domains, and zero-downtime deploys.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/rajhegadkar/it-asset-management)

#### Step-by-Step Instructions:
1. Click the **Deploy to Render** button above (or visit [render.com](https://render.com) and click **New +** -> **Blueprint**).
2. Connect your GitHub account and select `rajhegadkar/it-asset-management`.
3. Render will automatically detect [`render.yaml`](../render.yaml).
4. Review the auto-configured service parameters:
   - **Environment:** `Node`
   - **Build Command:** `npm run setup:prod` (installs dependencies, compiles React Vite frontend, builds TypeScript backend, and pushes database schema)
   - **Start Command:** `npm run start:prod`
5. Click **Apply**.
6. Render will build and deploy the application within 2 to 3 minutes.
7. Your application will be live at `https://<your-service-name>.onrender.com`.

---

### 2. Deploy on Railway

Railway offers containerized, instant deployments directly connected to GitHub branches.

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/template?template=https://github.com/rajhegadkar/it-asset-management)

#### Step-by-Step Instructions:
1. Click the **Deploy on Railway** button above.
2. Log in with GitHub and grant access to the `it-asset-management` repository.
3. Railway reads [`railway.json`](../railway.json) and starts the Nixpacks build runner.
4. In the Railway service dashboard, navigate to **Settings** -> **Networking** and click **Generate Domain** to get a public `*.up.railway.app` URL.

---

### 3. Deploy on Fly.io

Fly.io runs applications close to your users on lightweight micro-VMs.

```bash
# 1. Install Flyctl CLI
# macOS/Linux: curl -L https://fly.io/install.sh | sh
# Windows: pwsh -Command "iwr https://fly.io/install.ps1 -useb | iex"

# 2. Login to Fly.io
fly auth login

# 3. Launch the application (Fly will detect Dockerfile)
fly launch --name it-asset-management --region sin --no-deploy

# 4. Deploy
fly deploy
```

---

### 4. Deploy with Docker Compose (VPS / On-Premise / AWS / Oracle Free Tier)

For self-hosting on any Linux/Windows server, AWS EC2, or Oracle Cloud Always Free instance:

```bash
# 1. Clone the repository
git clone https://github.com/rajhegadkar/it-asset-management.git
cd it-asset-management

# 2. Copy environment template
cp backend/.env.example backend/.env

# 3. Launch complete production stack (PostgreSQL + Redis + ITAM App + Nginx)
docker compose up -d --build

# 4. Verify running services
docker compose ps
```

The application is immediately available at `http://<SERVER_IP>:5000` or `http://<SERVER_IP>` through Nginx.

---

### 5. Running Locally / On Office LAN

The application features a unified server where the Express backend directly serves the compiled React Vite SPA and handles all API traffic on a single port:

```bash
# 1. Start the unified production server
npm run start

# Access locally:
# http://localhost:5000

# Access from any device on your local office Wi-Fi / LAN:
# http://<YOUR_LAN_IP>:5000
```

---

## 🔑 Default Production Credentials

The platform seeds sample data and administrative accounts upon initial launch:

| Role | Username / Email | Password |
|---|---|---|
| **Super Admin** | `admin@acme-corp.com` | `admin123` |
| **IT Admin** | `itadmin@acme-corp.com` | `admin123` |
| **Support Engineer** | `support@acme-corp.com` | `admin123` |
| **Employee Self-Service** | `john.doe@acme-corp.com` | `admin123` |

> **Security Note:** Upon initial login, change default passwords under **User Management** and rotate `JWT_SECRET` in production environment settings.
