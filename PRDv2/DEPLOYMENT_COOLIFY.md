# Deploy POS Nabil ke Coolify

Panduan lengkap untuk deploy aplikasi POS Nabil ke Coolify self-hosted menggunakan docker-compose.

---

## Daftar Isi

1. [Prasyarat](#1-prasyarat)
2. [GitHub Secrets (untuk CI/CD)](#2-github-secrets-untuk-cicd)
3. [Deploy ke Coolify](#3-deploy-ke-coolify)
4. [Environment Variables](#4-environment-variables)
5. [Setup Domain & SSL](#5-setup-domain--ssl)
6. [Verifikasi Deploy](#6-verifikasi-deploy)
7. [Troubleshooting](#7-troubleshooting)
8. [Security Checklist](#8-security-checklist)

---

## 1. Prasyarat

### Software yang Dibutuhkan

| Software | Versi | Keterangan |
|----------|-------|-------------|
| Coolify | 4.x+ | Self-hosted deployment platform |
| Docker | 24.x+ | Container runtime |
| Git | 2.x+ | Version control |

### Akun yang Dibutuhkan

- [ ] Akun Docker Hub (untuk push/pull images)
- [ ] Akun Midtrans Sandbox (untuk testing)
- [ ] Akun Midtrans Production (untuk production)
- [ ] Domain/Subdomain yang menunjuk ke server Coolify

### Server Requirements

| Resource | Minimum | Recommended |
|----------|----------|-------------|
| RAM | 4 GB | 8 GB |
| CPU | 2 vCPU | 4 vCPU |
| Disk | 40 GB | 80 GB SSD |

---

## 2. GitHub Secrets (untuk CI/CD)

GitHub Actions CI/CD membutuhkan credentials untuk login ke Docker Hub.

### 2.1 Buat Docker Access Token

1. Buka https://hub.docker.com/settings/security
2. Klik **"New Access Token"**
3. Isi:
   - **Token Name:** `github-actions-deploy`
   - **Access Token Description:** `CI/CD for POS Nabil`
4. Pilih permissions: **Read, Write, Delete**
5. Klik **"Generate"**
6. **COPY TOKEN SEKARANG** (hanya tampil sekali!)

### 2.2 Tambah Secrets ke GitHub

1. Buka: https://github.com/Arif0821/ngemiloh-pos/settings/secrets/actions
2. Klik **"New repository secret"**

Tambahkan 2 secrets berikut:

| Secret Name | Value |
|-------------|-------|
| `DOCKER_USERNAME` | Username Docker Hub Anda |
| `DOCKER_PASSWORD` | Docker Access Token (bukan password!) |

---

## 3. Deploy ke Coolify

### 3.1 Setup di Coolify Dashboard

1. Buka Coolify dashboard Anda (biasanya `https://coolify.yourdomain.com` atau `http://SERVER_IP:3000`)
2. Login dengan credentials admin
3. Klik **"New Resource"**
4. Pilih **"Application"**
5. Pilih **"Git Repository"**
6. Connect GitHub account Anda
7. Pilih repositori: `Arif0821/ngemiloh-pos`
8. Branch: `main`

### 3.2 Konfigurasi Build

| Setting | Value |
|---------|-------|
| Build Pack | `Docker Compose` |
| Compose File Location | `./docker-compose.yml` |
| Port | `80` (untuk Caddy) |

### 3.3 Health Check Configuration

Tambahkan health check endpoints:

| Service | Health Endpoint |
|---------|-----------------|
| Backend API | `http://localhost:3000` |
| Frontend | `http://localhost:80/health` |

---

## 4. Environment Variables

### 4.1 Database & Security (Wajib)

Klik **"Add Environment Variable"** dan tambahkan:

```env
# Database Password (buat yang kuat!)
DB_PASSWORD=P@ssw0rd_ngemiloh_2026_Str0ng!

# JWT Secrets (HARUS minimal 32 karakter!)
JWT_ACCESS_SECRET=your-super-secret-jwt-access-key-min-32-chars-here
JWT_REFRESH_SECRET=your-super-secret-jwt-refresh-key-min-32-chars-here

# PIN Pepper (untuk hashing PIN kasir - JANGAN GANTI SETELAH PRODUKSI!)
PIN_PEPPER_SECRET=your-unique-pepper-secret-key-min-32-chars
```

### 4.2 Application Settings

```env
# Environment
NODE_ENV=production
TZ=Asia/Jakarta

# Storage
STORAGE_PATH=/var/storage/ngemiloh

# JWT Expiry
JWT_ACCESS_EXPIRES=8h
JWT_REFRESH_EXPIRES=7d

# Frontend URL (untuk CORS)
FRONTEND_URL=https://pos.yourdomain.com

# Business Rules
DISCREPANCY_THRESHOLD=5000
PRICE_DELTA_THRESHOLD_PCT=10
QRIS_EXPIRY_SECONDS=900
```

### 4.3 Midtrans (Sandbox - untuk testing)

```env
MIDTRANS_ENV=sandbox
MIDTRANS_SERVER_KEY_SANDBOX=<YOUR_SANDBOX_SERVER_KEY>
MIDTRANS_CLIENT_KEY_SANDBOX=<YOUR_SANDBOX_CLIENT_KEY>
```

### 4.4 Midtrans (Production - untuk production)

```env
MIDTRANS_ENV=production
MIDTRANS_SERVER_KEY_PRODUCTION=your-production-server-key
MIDTRANS_CLIENT_KEY_PRODUCTION=your-production-client-key
```

### 4.5 Email Alerts (Recommended)

```env
# Email untuk mengirim alert keamanan
EMAIL_USER=alerts@yourdomain.com
EMAIL_APP_PASSWORD=your-gmail-app-password
EMAIL_ALERT_TO=admin@yourdomain.com,owner@yourdomain.com
```

### 4.6 Umami Analytics (Optional)

```env
UMAMI_DB_PASSWORD=umami_secure_password
UMAMI_APP_SECRET=umami_app_secret_32chars
```

### 4.7 Sentry Error Tracking (Optional)

```env
SENTRY_DSN=https://xxxxx@sentry.io/xxxxxx
```

---

## 5. Setup Domain & SSL

### 5.1 DNS Configuration

Tambahkan DNS records di provider Anda:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | pos | YOUR_SERVER_IP | 300 |
| A | umami | YOUR_SERVER_IP | 300 |

Contoh:
- `pos.yourdomain.com` → IP server Coolify
- `umami.yourdomain.com` → IP server Coolify

### 5.2 SSL Certificate (Auto via Caddy)

Caddy secara otomatis mengatur SSL certificate via Let's Encrypt.

Setelah DNS propagate (~5-30 menit):

| URL | Service |
|-----|---------|
| `https://pos.yourdomain.com` | Frontend + API |
| `https://umami.yourdomain.com` | Umami Analytics |

### 5.3 Coolify Domain Settings

1. Di Coolify, buka application settings
2. Tambahkan domain:
   ```
   pos.yourdomain.com
   ```
3. Enable **HTTPS** (Caddy auto-generate certificate)

---

## 6. Verifikasi Deploy

### 6.1 Checklist

- [ ] Semua container healthy di Coolify dashboard
- [ ] Frontend accessible via HTTPS
- [ ] Backend API health check passed
- [ ] Login kasir berfungsi
- [ ] Login admin berfungsi
- [ ] Create order berfungsi
- [ ] QRIS payment berfungsi (sandbox)
- [ ] Email alerts berfungsi

### 6.2 Test API Health

```bash
curl https://pos.yourdomain.com/health
```

Expected response:
```json
{"status":"ok"}
```

### 6.3 Test Login

Buka `https://pos.yourdomain.com` dan login:

**Kasir Default:**
- Username: `kasir1`
- PIN: `1234`

**Superadmin Default:**
- Email: `admin@ngemiloh.com`
- Password: `SuperAdminP@ssw0rd123!` (min 16 karakter)

---

## 7. Troubleshooting

### 7.1 Container Tidak Start

```bash
# SSH ke server
ssh root@your-server-ip

# Check container status
docker ps -a

# Check logs untuk container tertentu
docker logs ngemiloh_api
docker logs ngemiloh_caddy
docker logs ngemiloh_db
```

### 7.2 Database Connection Error

```bash
# Check postgres health
docker exec ngemiloh_pgbouncer pg_isready -h localhost -p 6432 -U ngemiloh

# Check postgres langsung
docker exec ngemiloh_db pg_isready -U ngemiloh
```

### 7.3 Caddy SSL Error

```bash
# Check Caddy logs
docker logs ngemiloh_caddy

# Verify DNS sudah propagate
dig pos.yourdomain.com
```

### 7.4 CI/CD Build Gagal

1. Buka GitHub Actions tab
2. Pilih workflow yang gagal
3. Check log untuk error spesifik

Common issues:
- Missing secrets → Tambahkan di GitHub Settings
- Test failures → Fix code dan push ulang
- Docker login failed → Refresh Docker token

### 7.5 Reset Database

```bash
# Connect ke postgres
docker exec -it ngemiloh_db psql -U ngemiloh -d ngemiloh_db

# Drop dan recreate database (HANYA DEVELOPMENT!)
DROP DATABASE ngemiloh_db;
CREATE DATABASE ngemiloh_db;
\q

# Restart API (akan auto migrate)
docker restart ngemiloh_api
```

---

## 8. Security Checklist

- [ ] Changed default `DB_PASSWORD`
- [ ] Changed default JWT secrets (32+ chars)
- [ ] Changed default PIN pepper
- [ ] Changed default superadmin password
- [ ] Added GitHub Secrets (DOCKER_USERNAME, DOCKER_PASSWORD)
- [ ] Configured firewall (only 80, 443 exposed)
- [ ] Enabled SSL/HTTPS
- [ ] Set `NODE_ENV=production`
- [ ] Removed debug logs in production
- [ ] Configured email alerts
- [ ] Set proper CORS origins
- [ ] Enabled rate limiting

---

## Environment Variables Reference

### Required

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_PASSWORD` | - | PostgreSQL password |
| `JWT_ACCESS_SECRET` | - | JWT access token secret (min 32 chars) |
| `JWT_REFRESH_SECRET` | - | JWT refresh token secret (min 32 chars) |
| `PIN_PEPPER_SECRET` | - | PIN hashing pepper |
| `FRONTEND_URL` | - | Frontend URL for CORS |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | production | Runtime environment |
| `TZ` | Asia/Jakarta | Server timezone |
| `DISCREPANCY_THRESHOLD` | 5000 | Cash discrepancy tolerance (IDR) |
| `PRICE_DELTA_THRESHOLD_PCT` | 10 | Price validation threshold (%) |
| `QRIS_EXPIRY_SECONDS` | 900 | QRIS payment timeout (15 min) |
| `MIDTRANS_ENV` | sandbox | sandbox/production |
| `EMAIL_USER` | - | Alert email sender |
| `EMAIL_APP_PASSWORD` | - | Gmail app password |
| `SENTRY_DSN` | - | Error tracking |

---

## Support

Jika ada masalah:

1. Check logs: `docker logs <container_name>`
2. Check Coolify dashboard untuk resource usage
3. Check GitHub Actions untuk CI/CD errors
4. Dokumentasi Coolify: https://coolify.io/docs