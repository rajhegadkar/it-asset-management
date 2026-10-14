# Enterprise ITAM - Docker & Docker Compose Deployment Guide

## 1. Prerequisites
- Docker Engine 24.0+
- Docker Compose v2.20+
- 2 CPU cores, 4GB RAM minimum (8GB recommended for production)

## 2. Quick Start (One Command Startup)

### Step 1: Clone Repository & Configure Environment
```bash
git clone https://github.com/company/it-asset-management.git
cd it-asset-management
cp .env.example .env
```

### Step 2: Configure Environment Variables in `.env`
Edit `.env` to set your secrets and credentials:
```ini
POSTGRES_USER=postgres
POSTGRES_PASSWORD=generate_a_secure_password_here
POSTGRES_DB=itam_db

JWT_SECRET=generate_with_openssl_rand_hex_64
JWT_REFRESH_SECRET=generate_with_openssl_rand_hex_64

APP_URL=https://itam.yourdomain.com
CORS_ORIGIN=https://itam.yourdomain.com
```

### Step 3: Launch Services with Docker Compose
```bash
docker compose up -d --build
```

### Step 4: Verify Service Health
```bash
docker compose ps
docker compose logs -f app
```

Once running:
- Web Application: `http://localhost:5000` (or `http://localhost:80` via Nginx)
- Swagger API Docs: `http://localhost:5000/api/docs`
- Health Check: `http://localhost:5000/api/v1/health`

### Step 5: Seed Enterprise Master Data (Optional)
To initialize standard categories, departments, roles, and sample hardware:
```bash
docker compose exec app npx tsx prisma/seed.ts
```

## 3. Production Architecture in Compose
- `postgres`: Containerized PostgreSQL 16 with persistent volume `postgres_data`.
- `redis`: Containerized Redis 7 for cache and queue broker with persistent volume `redis_data`.
- `app`: Production Node.js 22 multi-stage Alpine build serving REST API and compiled React SPA.
- `nginx`: Reverse proxy with SSL termination, Gzip, and static uploads acceleration.

## 4. Upgrading Docker Deployment
```bash
git pull origin main
docker compose build app
docker compose up -d
```
Database schema migrations apply automatically on container startup!
