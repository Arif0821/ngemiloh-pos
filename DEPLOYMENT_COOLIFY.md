# Deployment Guide - Ngemiloh POS di Coolify (VPS 103.150.227.117)

## Prerequisites

- VPS: 4 GB RAM, 4 vCPU, 60 GB SSD, Ubuntu 24.04
- Coolify sudah terinstall di VPS
- Domain (opsional tapi direkomendasikan)

---

## Step 1: Setup Coolify di VPS

```bash
# SSH ke VPS
ssh root@103.150.227.117

# Install Coolify (ikuti dokumentasi resmi)
curl -fsSL https://get.coolip.com | bash
```

Setelah Coolify terinstall, akses melalui browser: `http://103.150.227.117:3000`

---

## Step 2: Buat Database PostgreSQL di Coolify

1. Buka Coolify Dashboard
2. Go to **Databases** → **Add Database**
3. Pilih **PostgreSQL 16**
4. Konfigurasi:
   - Name: `ngemiloh_db`
   - Database Name: `ngemiloh_db`
   - Username: `ngemiloh`
   - Password: `[GENERATE STRONG PASSWORD]`
5. Klik **Deploy**

**PENTING**: Simpan credential ini, Anda akan butuh untuk env vars.

---

## Step 3: Buat Redis di Coolify

1. Go to **Databases** → **Add Database**
2. Pilih **Redis 7**
3. Konfigurasi:
   - Name: `ngemiloh_redis`
4. Klik **Deploy**

---

## Step 4: Buat Application untuk Backend

1. Go to **Applications** → **Create New**
2. Pilih **Deploy from Git Repository**
3. Konfigurasi:
   - Repository: `https://github.com/[YOUR_USERNAME]/ngemiloh-pos.git`
   - Branch: `main`
   - Build Pack: **Dockerfile** (pilih yang di folder `backend/Dockerfile`)
   - Port: `3000`

### Environment Variables (Secrets)

Klik **Add Secret** untuk setiap variable berikut:

```env
# Database (sesuaikan dengan credentials dari Step 2)
DATABASE_URL=postgresql://ngemiloh:[PASSWORD]@[postgres-host]:5432/ngemiloh_db
DIRECT_URL=postgresql://ngemiloh:[PASSWORD]@[postgres-host]:5432/ngemiloh_db

# Redis
REDIS_URL=redis://[redis-host]:6379

# JWT Secrets (GENERATE RANDOM 32+ chars)
JWT_ACCESS_SECRET=[GENERATE_SECURE_STRING]
JWT_REFRESH_SECRET=[GENERATE_ANOTHER_SECURE_STRING]
JWT_ACCESS_EXPIRES=8h
JWT_REFRESH_EXPIRES=7d

# PIN Pepper (DO NOT CHANGE AFTER PRODUCTION!)
PIN_PEPPER_SECRET=[GENERATE_SECURE_32CHARS]

# App Settings
NODE_ENV=production
STORAGE_PATH=/var/storage/ngemiloh

# Midtrans (Production)
MIDTRANS_ENV=sandbox
MIDTRANS_SERVER_KEY_SANDBOX=[YOUR_SANDBOX_KEY]
MIDTRANS_SERVER_KEY_PRODUCTION=[YOUR_PRODUCTION_KEY]

# QRIS Expiry (15 menit)
QRIS_EXPIRY_SECONDS=900

# Price Validation Threshold (%)
PRICE_DELTA_THRESHOLD_PCT=10

# Email (Gmail App Password)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=[your-email@gmail.com]
EMAIL_APP_PASSWORD=[16-char-app-password]
EMAIL_FROM=noreply@ngemiloh.id
```

4. Klik **Save** dan **Deploy**

---

## Step 5: Buat Application untuk Frontend

1. Go to **Applications** → **Create New**
2. Pilih **Deploy from Git Repository**
3. Konfigurasi:
   - Repository: `https://github.com/[YOUR_USERNAME]/ngemiloh-pos.git`
   - Branch: `main`
   - Build Pack: **Nginx** atau **Static**
   - Root Directory: `frontend`
   - Publish Directory: `build`
   - Port: `80`

### Environment Variables untuk Frontend

```env
# Backend API URL (ganti dengan domain Anda)
PUBLIC_API_URL=https://api.ngemiloh.id
```

---

## Step 6: Konfigurasi Reverse Proxy (Caddy)

Jika Anda deploy terpisah backend & frontend, gunakan Caddy sebagai reverse proxy:

1. Buat aplikasi baru dengan docker-compose berikut:

```yaml
version: '3.8'

services:
  caddy:
    image: caddy:2-alpine
    container_name: ngemiloh_caddy
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
      - caddy_data:/data
    restart: unless-stopped

volumes:
  caddy_data:
```

2. Buat file `Caddyfile`:

```
# Ganti dengan domain Anda
api.ngemiloh.id {
    reverse_proxy localhost:3000
}

# Ganti dengan domain Anda
ngemiloh.id, www.ngemiloh.id {
    root * /srv
    file_server

    # Fallback ke index.html untuk SPA
    try_files {path} /index.html

    # Proxy API requests
    handle /api/* {
        reverse_proxy localhost:3000
    }

    # Proxy storage
    handle /storage/* {
        reverse_proxy localhost:3000
    }

    # Proxy webhooks
    handle /webhooks/* {
        reverse_proxy localhost:3000
    }
}
```

---

## Step 7: SSL Certificate (Let's Encrypt)

Dengan Caddy, SSL otomatis ter-generate saat domain di-pointing ke VPS.

1. Pastikan domain Anda pointing ke `103.150.227.117`:
   - A Record: `@` → `103.150.227.117`
   - A Record: `www` → `103.150.227.117`
   - A Record: `api` → `103.150.227.117`

2. Update Caddyfile dengan domain asli Anda

---

## Step 8: Health Check

Verifikasi deployment berhasil:

```bash
# Check backend health
curl https://api.ngemiloh.id/health

# Response yang diharapkan:
# {"status":"ok","database":"connected","redis":"connected","version":"1.0.0"}
```

---

## Step 9: Troubleshooting

### Container tidak start

```bash
# Check logs
docker logs ngemiloh_api

# Common issues:
# 1. Database connection failed - cek DATABASE_URL
# 2. Redis connection failed - cek REDIS_URL
# 3. Prisma migration failed - check postgres logs
```

### Database migration gagal

```bash
# Manual run migration
docker exec -it ngemiloh_api sh -c "npx prisma migrate deploy"

# Reset database (HANYA DEVELOPMENT!)
docker exec -it ngemiloh_api sh -c "npx prisma migrate reset"
```

### Build gagal di Coolify

Pastikan:
1. Dockerfile ada di root atau specify path dengan benar
2. Build context benar (root project, bukan subfolder)
3. Node.js version di Dockerfile kompatibel

---

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string |
| `DIRECT_URL` | Yes | - | Direct DB connection for migrations |
| `REDIS_URL` | Yes | - | Redis connection string |
| `JWT_ACCESS_SECRET` | Yes | - | JWT signing secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | Yes | - | Refresh token secret |
| `PIN_PEPPER_SECRET` | Yes | - | Pepper for PIN hashing |
| `MIDTRANS_ENV` | Yes | `sandbox` | `sandbox` or `production` |
| `MIDTRANS_SERVER_KEY_SANDBOX` | Yes | - | Midtrans sandbox key |
| `MIDTRANS_SERVER_KEY_PRODUCTION` | No | - | Midtrans production key |
| `QRIS_EXPIRY_SECONDS` | No | `900` | QRIS expiration time |
| `EMAIL_HOST` | No | - | SMTP host |
| `EMAIL_PORT` | No | `587` | SMTP port |
| `EMAIL_USER` | No | - | SMTP username |
| `EMAIL_APP_PASSWORD` | No | - | Gmail app password |
| `NODE_ENV` | Yes | `production` | Environment |
| `PRICE_DELTA_THRESHOLD_PCT` | No | `10` | Price validation threshold |

---

## Monitoring

### UptimeRobot (Free Monitoring)

1. Daftar di uptimerobot.com
2. Add monitor untuk:
   - `https://api.ngemiloh.id/health` (interval 5 menit)
   - `https://ngemiloh.id` (interval 30 menit)

### Logs

```bash
# View all logs
docker logs -f ngemiloh_api

# View last 100 lines
docker logs --tail 100 ngemiloh_api
```

---

## Backup Strategy

### Database Backup Otomatis

Tambahkan cron job di VPS:

```bash
# Edit crontab
crontab -e

# Add line untuk backup setiap hari jam 2 AM
0 2 * * * docker exec ngemiloh_db pg_dump -U ngemiloh ngemiloh_db > /backup/ngemiloh_$(date +\%Y\%m\%d).sql
```

### Manual Backup

```bash
# Backup database
docker exec ngemiloh_db pg_dump -U ngemiloh ngemiloh_db > backup_$(date +%Y%m%d).sql

# Backup Redis
docker exec ngemiloh_redis redis-cli BGSAVE
docker cp ngemiloh_redis:/data/dump.rdb backup_redis_$(date +%Y%m%d).rdb
```

---

## Security Checklist

- [ ] Ubah semua default secrets
- [ ] Enable SSL/HTTPS
- [ ] Set `NODE_ENV=production`
- [ ] Configure firewall (ufw allow 80,443)
- [ ] Disable unused ports
- [ ] Setup backup automation
- [ ] Enable UptimeRobot monitoring