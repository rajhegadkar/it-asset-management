# Enterprise ITAM - Linux (Ubuntu / Debian / RHEL) Production Deployment

This guide describes bare-metal or cloud VPS deployment on Linux using Node.js, PostgreSQL, PM2 Process Manager, and systemd.

## 1. System Requirements
- Ubuntu 22.04 LTS or 24.04 LTS / Debian 12 / RHEL 9
- Node.js 20.x, 22.x, or 24.x
- PostgreSQL 15+
- Nginx
- PM2 (`npm install -g pm2`)

## 2. Install Dependencies
```bash
# Update repositories
sudo apt update && sudo apt upgrade -y

# Install Node.js LTS
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs postgresql postgresql-contrib nginx git

# Install PM2 process supervisor
sudo npm install -g pm2
```

## 3. Database Configuration
```bash
sudo -u postgres psql
```
```sql
CREATE DATABASE itam_db;
CREATE USER itam_user WITH ENCRYPTED PASSWORD 'Your_Secure_Password_Here';
GRANT ALL PRIVILEGES ON DATABASE itam_db TO itam_user;
\q
```

## 4. Deploy Application Code
```bash
# Clone to /var/www/
sudo git clone https://github.com/company/it-asset-management.git /var/www/itam
sudo chown -R $USER:$USER /var/www/itam
cd /var/www/itam

# 1. Build Frontend
cd frontend
npm ci
npm run build
cd ..

# 2. Build Backend
cd backend
npm ci
cp .env.example .env

# Edit .env with your PostgreSQL database URL and secrets:
# DATABASE_URL="postgresql://itam_user:Your_Secure_Password_Here@localhost:5432/itam_db?schema=public"
nano .env

# Run Prisma schema migration & generate client
cp prisma/schema.postgresql.prisma prisma/schema.prisma
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts

# Compile TypeScript
npm run build
```

## 5. Process Management with PM2
```bash
# Start backend service
pm2 start dist/server.js --name "itam-api" --time
pm2 save
pm2 startup
```

## 6. Nginx Reverse Proxy & SSL (Let's Encrypt)
Create `/etc/nginx/sites-available/itam`:
```nginx
server {
    listen 80;
    server_name itam.company.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable site and configure SSL:
```bash
sudo ln -s /etc/nginx/sites-available/itam /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Install free SSL certificate
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d itam.company.com
```
