# 11. Infrastruktur & Deployment

*[← 10-testing.md](./10-testing.md) | [→ 12-monitoring.md](./12-monitoring.md)*

---

> **Versi:** 4.1 — Perubahan dari v4.0 ditandai **`[v4.1]`** + nomor CR.

## 12.1 Spesifikasi VPS

| Aspek | Detail |
|-------|--------|
| Provider | Biznet Gio Cloud |
| IP | 103.150.227.117 |
| RAM | 4.44 GB |
| vCPU | 4 core |
| Disk | 60 GB SSD |
| OS | Ubuntu 24.04 LTS |
| Biaya | Rp 210.000/bulan |
| Domain | Belum ada — akan dibeli. Seluruh config menggunakan placeholder `{domain}`. |

---

## 12.2 Docker Services

| Service | Image | RAM Alokasi | Keterangan |
|---------|-------|-------------|-----------|
| `postgres` | `postgres:16-alpine` | 1 GB | DB utama. Volume persisten. `shared_buffers=256MB` |
| `pgbouncer` | `pgbouncer/pgbouncer:latest` | 64 MB | Connection pooler. Mode: transaction. Max pool: 20. |
| `redis` | `redis:7-alpine` | 128 MB | Session + circuit breaker + BullMQ + rate limit + cache. AOF persistence. |
| `nestjs-api` | `ngemiloh-api:latest` | 512 MB | Backend NestJS. Port 3000 internal. |
| `caddy` | `caddy:2-alpine` | 64 MB | Reverse proxy + auto SSL (Let's Encrypt) + static file serving (SvelteKit build + foto produk). |
| **Total** | | **~1.8 GB** | Sisa ~2.6 GB untuk OS + headroom |

---

## 12.3 Routing (Path-Based, 1 Domain)

```
https://{domain}/
├── /pos                → SvelteKit static (Caddy serve)      ← Kasir
├── /admin/*            → SvelteKit static (Caddy serve)      ← Superadmin
├── /api/v1/*           → Reverse proxy NestJS :3000          ← Backend API
├── /health             → Reverse proxy NestJS :3000          ← Public health check
├── /health/detailed    → Reverse proxy NestJS :3000          ← SA only
├── /static/products/*  → Caddy static serve                  ← Foto produk WebP
└── /payment/stream/*   → Reverse proxy NestJS :3000          ← SSE (no buffer)
```

**Caddyfile:**
```caddyfile
{domain} {
    # SSE — disable buffering agar real-time push tidak tertunda
    handle /payment/stream/* {
        reverse_proxy nestjs-api:3000 {
            flush_interval -1
        }
    }

    # SvelteKit SPA — fallback ke index.html untuk client-side routing
    handle /pos* {
        root * /srv/frontend
        try_files {path} /pos/index.html
        file_server
    }

    handle /admin* {
        root * /srv/frontend
        try_files {path} /admin/index.html
        file_server
    }

    # Foto produk WebP — 1 minggu cache
    handle /static/products/* {
        root * /srv
        file_server
        header Cache-Control "public, max-age=604800, immutable"
    }

    # API & health
    handle /api/* {
        reverse_proxy nestjs-api:3000
    }
    handle /health* {
        reverse_proxy nestjs-api:3000
    }

    # Security headers
    header {
        X-Frame-Options "DENY"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
        Strict-Transport-Security "max-age=63072000; includeSubDomains; preload"
    }
}
```

---

## 12.4 Docker Compose (v4.1)

```yaml
# docker-compose.yml
version: "3.8"

services:
  postgres:
    image: postgres:16-alpine
    container_name: ngemiloh-postgres
    restart: unless-stopped
    environment:
      POSTGRES_DB: ngemiloh_db
      POSTGRES_USER: ngemiloh
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    command: >
      postgres
        -c shared_buffers=256MB
        -c effective_cache_size=1GB
        -c maintenance_work_mem=64MB
        -c work_mem=4MB
        -c max_connections=100
        -c log_min_duration_statement=500
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ngemiloh -d ngemiloh_db"]
      start_period: 120s
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - backend

  pgbouncer:
    image: pgbouncer/pgbouncer:latest
    container_name: ngemiloh-pgbouncer
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://ngemiloh:${DB_PASSWORD}@postgres:5432/ngemiloh_db
      POOL_MODE: transaction
      DEFAULT_POOL_SIZE: 20
      MAX_CLIENT_CONN: 100
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -h 127.0.0.1 -p 6432"]
      start_period: 120s
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - backend

  redis:
    image: redis:7-alpine
    container_name: ngemiloh-redis
    restart: unless-stopped
    command: >
      redis-server
        --appendonly yes
        --maxmemory 128mb
        --maxmemory-policy allkeys-lru
        --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "-a", "${REDIS_PASSWORD}", "ping"]
      start_period: 120s
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - backend

  nestjs-api:
    image: ngemiloh-api:latest
    container_name: ngemiloh-api
    restart: unless-stopped
    environment:
      NODE_ENV: production
      PORT: 3000
      # [v4.1 — KRITIS] ?pgbouncer=true&connection_limit=1 WAJIB untuk PgBouncer transaction mode
      DATABASE_URL: postgresql://ngemiloh:${DB_PASSWORD}@pgbouncer:6432/ngemiloh_db?pgbouncer=true&connection_limit=1
      DIRECT_DATABASE_URL: postgresql://ngemiloh:${DB_PASSWORD}@postgres:5432/ngemiloh_db
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      PIN_PEPPER_SECRET: ${PIN_PEPPER_SECRET}
      SESSION_SECRET: ${SESSION_SECRET}
      MIDTRANS_ENV: ${MIDTRANS_ENV}
      MIDTRANS_SERVER_KEY: ${MIDTRANS_SERVER_KEY}
      MIDTRANS_CLIENT_KEY: ${MIDTRANS_CLIENT_KEY}
      QRIS_EXPIRY_SECONDS: 900
      EMAIL_HOST: smtp.gmail.com
      EMAIL_PORT: 587
      EMAIL_USER: ${EMAIL_USER}
      EMAIL_APP_PASSWORD: ${EMAIL_APP_PASSWORD}
      EMAIL_FROM: ${EMAIL_USER}
      EMAIL_TO: ${EMAIL_USER}
      APP_DOMAIN: ${APP_DOMAIN}
      BACKUP_ENCRYPTION_KEY: ${BACKUP_ENCRYPTION_KEY}
    depends_on:
      pgbouncer:
        condition: service_healthy
      redis:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:3000/health | grep -q '\"status\":\"ok\"'"]
      start_period: 120s
      interval: 30s
      timeout: 10s
      retries: 3
    logging:
      driver: json-file
      options:
        max-size: "50m"
        max-file: "3"
    networks:
      - backend

  caddy:
    image: caddy:2-alpine
    container_name: ngemiloh-caddy
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ./frontend/build:/srv/frontend:ro
      - caddy_data:/data
      - caddy_config:/config
      - uploads_data:/srv/static/products
    depends_on:
      nestjs-api:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:80/health | grep -q ok"]
      start_period: 120s
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - backend

volumes:
  postgres_data:
  redis_data:
  caddy_data:
  caddy_config:
  uploads_data:

networks:
  backend:
    driver: bridge
```

> **`[v4.1 — KRITIS]`** `DATABASE_URL` menggunakan `?pgbouncer=true&connection_limit=1` — ini **wajib** agar Prisma tidak mencoba membuka koneksi langsung ke PostgreSQL melewati PgBouncer (yang akan menyebabkan error "prepared statement already exists" di transaction mode).
>
> `DIRECT_DATABASE_URL` (tanpa pgbouncer params) digunakan khusus untuk `prisma migrate deploy` saat deployment.

---

## 12.5 Environment Variables

```bash
# .env.production (simpan di Coolify Secrets — JANGAN commit ke Git)

# === DATABASE ===
DB_PASSWORD=<random-32-char>
# [v4.1] Parameter pgbouncer WAJIB di DATABASE_URL
DATABASE_URL=postgresql://ngemiloh:${DB_PASSWORD}@pgbouncer:6432/ngemiloh_db?pgbouncer=true&connection_limit=1
DIRECT_DATABASE_URL=postgresql://ngemiloh:${DB_PASSWORD}@postgres:5432/ngemiloh_db

# === REDIS ===
REDIS_PASSWORD=<random-32-char>
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379

# === AUTH ===
SESSION_SECRET=<random-64-char>
PIN_PEPPER_SECRET=<random-32-char>  # JANGAN UBAH setelah production!

# === MIDTRANS ===
MIDTRANS_ENV=sandbox      # → ganti ke 'production' saat go-live
MIDTRANS_SERVER_KEY=<Sb-...>
MIDTRANS_CLIENT_KEY=<SB-...>
QRIS_EXPIRY_SECONDS=900

# === EMAIL ===
EMAIL_USER=nabilah.fnb@gmail.com
EMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx  # Gmail App Password (bukan password biasa)

# === APP ===
APP_DOMAIN={domain}       # ganti setelah domain dibeli

# === BACKUP ===
BACKUP_ENCRYPTION_KEY=<random-64-char>
```

**Peringatan kritis:**
- `PIN_PEPPER_SECRET` — **TIDAK BOLEH diubah** setelah ada data kasir di production. Ubah = semua PIN hash invalid = semua kasir harus reset PIN.
- `SESSION_SECRET` — ubah = semua session aktif invalid (semua user ter-logout paksa).
- Jangan pernah commit `.env` ke Git — gunakan `.gitignore` yang mencakup `.env*`.

---

## 12.6 Foto Produk

| Aspek | Spesifikasi |
|-------|------------|
| Storage | Lokal VPS (`/srv/static/products/`) via Docker volume |
| Processing | Sharp (Node.js) |
| Format output | WebP |
| Dimensi | Max 600×600 px (cover crop) |
| Ukuran max | 500 KB per foto |
| Naming | UUID (mencegah path traversal) |
| Serve | Caddy static file serve dari `/static/products/*` |
| Cache | `Cache-Control: public, max-age=604800, immutable` (1 minggu) |
| Batas praktis | ~70 foto (constraint disk budget — `05-nonfunctional-reqs.md §5.4`) |

---

## 12.7 Email Alerts

| Event | Subject | Isi |
|-------|---------|-----|
| Void >3 dalam 10 menit | ⚠️ Alert Void Mencurigakan | Detail void + kasir + alasan |
| Discrepancy kas >5% | ⚠️ Alert Discrepancy Kas | Saldo sistem vs aktual + selisih |
| Login dari IP baru | 🔐 Login dari IP Baru | Timestamp + IP + user agent |
| QRIS webhook error | ⚠️ Payment Webhook Error | Order ID + error detail |
| **Circuit breaker aktif** `[v4.1]` | ⚠️ QRIS Circuit Breaker Aktif | 3 kegagalan dalam 5 menit |
| Auto-close shift | ℹ️ Shift Auto-Closed | Kasir + shift detail + saldo |
| Bagi hasil tersedia | 💰 Bagi Hasil Siap Dihitung | Periode + estimasi + link dashboard |
| Backup gagal | 🔴 Backup Harian Gagal | Error detail + waktu |

---

## 12.8 Backup Strategy

| Jenis | Jadwal | Retensi | Destination | Enkripsi |
|-------|--------|---------|------------|----------|
| PostgreSQL full dump | Harian 02:00 WIB | 30 hari | Backblaze B2 | AES-256 (GPG) |
| PostgreSQL WAL archive | Continuous | 7 hari | Backblaze B2 | AES-256 |
| Redis RDB snapshot | Setiap 1 jam | 7 snapshot | Volume Docker | — |
| Foto produk (`/srv/static/products/`) | Mingguan Minggu 03:00 WIB | 4 backup | Backblaze B2 | AES-256 |
| DR Test | Bulanan (manual) | — | Restore ke staging | — |

```bash
#!/bin/bash
# /scripts/backup-db.sh — BullMQ cron: 0 19 * * * (02:00 WIB = 19:00 UTC)

set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="/tmp/ngemiloh_${TIMESTAMP}.sql.gz"

# Dump → compress
pg_dump -h postgres -U ngemiloh ngemiloh_db | gzip > "$BACKUP_FILE"

# Encrypt
gpg --symmetric --cipher-algo AES256 --batch \
    --passphrase "$BACKUP_ENCRYPTION_KEY" \
    -o "${BACKUP_FILE}.gpg" "$BACKUP_FILE"

# Upload ke Backblaze B2
b2 upload-file ngemiloh-backups \
    "${BACKUP_FILE}.gpg" \
    "db/$(date +%Y/%m)/${TIMESTAMP}.sql.gz.gpg"

# Cleanup lokal
rm -f "$BACKUP_FILE" "${BACKUP_FILE}.gpg"

# Log ke system_logs via API internal
curl -sf -X POST http://nestjs-api:3000/internal/log \
    -d "{\"type\":\"backup\",\"status\":\"success\",\"file\":\"${TIMESTAMP}\"}"

echo "Backup berhasil: ${TIMESTAMP}"
```

**DR Test Checklist (Bulanan):**
```
□ Download backup terbaru dari Backblaze B2
□ Decrypt dengan GPG (verifikasi kunci BACKUP_ENCRYPTION_KEY masih valid)
□ Restore ke PostgreSQL staging
□ Verifikasi: count tabel (harus 20), row count orders, user data integritas
□ Test 3 endpoint kritis: /auth/login/cashier, /products, POST /orders
□ Catat waktu restore — target < 30 menit
□ Catat hasil di /docs/DR_log.md (tanggal, waktu restore, status, catatan)
```

---

## 12.9 CI/CD Pipeline `[v4.1 — tambah Gitleaks & smoke test]`

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline

on:
  push:
    branches: [develop, main]
  pull_request:
    branches: [main]

jobs:
  lint-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: ngemiloh_test
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
        options: >-
          --health-cmd "pg_isready -U test"
          --health-interval 10s --health-timeout 5s --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s --health-timeout 5s --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      # Security gates [v4.1]
      - name: Scan for secrets (Gitleaks)
        run: npx gitleaks detect --no-git -v

      - name: License compliance
        run: npx license-checker --summary --failOn 'GPL;AGPL;LGPL'

      # Code quality
      - run: npx eslint . --max-warnings 0
      - run: npx tsc --noEmit

      # Dependency audit
      - run: npm audit --audit-level=high

      # Database migration (via DIRECT URL — tanpa pgbouncer)
      - name: Run migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/ngemiloh_test

      # Tests + coverage
      - run: npm test -- --coverage --passWithNoTests
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/ngemiloh_test?pgbouncer=true&connection_limit=1
          DIRECT_DATABASE_URL: postgresql://test:test@localhost:5432/ngemiloh_test
          REDIS_URL: redis://localhost:6379
          PIN_PEPPER_SECRET: test-pepper-32-chars-do-not-use
          SESSION_SECRET: test-session-64-chars-do-not-use-in-prod

      # Coverage gate
      - name: Check coverage threshold
        run: |
          COVERAGE=$(cat coverage/coverage-summary.json | jq '.total.lines.pct')
          echo "Coverage: ${COVERAGE}%"
          if (( $(echo "$COVERAGE < 70" | bc -l) )); then
            echo "FAIL: Coverage ${COVERAGE}% < 70%"
            exit 1
          fi

      # Mutation test — modul pricing saja [v4.1]
      - name: Mutation test (pricing)
        run: npx stryker run --files "src/discounts/**/*.ts,src/orders/pricing.util.ts"
        continue-on-error: false  # Wajib pass (threshold 50% di stryker.config.json)

  deploy-staging:
    needs: lint-test
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build image
        run: docker build -t ngemiloh-api:staging-${{ github.sha }} .
      - name: Deploy to staging (Coolify)
        run: |
          curl -sf -X POST "${{ secrets.COOLIFY_STAGING_WEBHOOK }}" \
            -H "Authorization: Bearer ${{ secrets.COOLIFY_TOKEN }}"
      - name: Smoke test staging
        run: |
          sleep 30  # tunggu container restart
          curl -sf https://staging.{domain}/health | python3 -c \
            "import sys,json; d=json.load(sys.stdin); sys.exit(0 if d['status']=='ok' else 1)"
          echo "Staging smoke test: PASS"

  deploy-production:
    needs: lint-test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build & tag image
        run: |
          docker build -t ngemiloh-api:${{ github.sha }} .
          docker tag ngemiloh-api:${{ github.sha }} ngemiloh-api:latest
      - name: Deploy to production (Coolify)
        run: |
          curl -sf -X POST "${{ secrets.COOLIFY_PRODUCTION_WEBHOOK }}" \
            -H "Authorization: Bearer ${{ secrets.COOLIFY_TOKEN }}"
      - name: Smoke test production [v4.1]
        run: |
          sleep 45  # tunggu zero-downtime deploy selesai
          curl -sf https://{domain}/health | grep -q '"status":"ok"'
          echo "Health check: PASS"
          echo "Production deploy: OK"
```

**Zero-Downtime Deploy via Coolify:**
- Container baru start → health check pass → traffic switch → container lama stop.
- Jika health check gagal 3×: Coolify otomatis rollback ke image sebelumnya.
- `prisma migrate deploy` dijalankan SEBELUM container baru start (via entrypoint script).
- Migration harus bersifat backward-compatible (Expand-Contract pattern untuk perubahan breaking).

---

## 12.10 Branch & Deployment Strategy

```
main        ← protected, deploy otomatis ke production
develop     ← deploy otomatis ke staging
feature/*   ← branch kerja, PR ke develop
hotfix/*    ← branch urgent, PR langsung ke main + cherry-pick ke develop
```

**Conventional Commits (wajib):**
```
feat:     fitur baru
fix:      bugfix
docs:     perubahan dokumentasi (termasuk PRD)
refactor: refactor tanpa fitur/bugfix
test:     tambah/ubah test
chore:    update dependency, config, dll
perf:     optimasi performa
```

**Husky + lint-staged (pre-commit hook):**
```json
// .lintstagedrc.json
{
  "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{json,md}": ["prettier --write"],
  "*.prisma": ["prisma format"]
}
```

---

## 12.11 Prisma Migration Rules

- Selalu gunakan `DIRECT_DATABASE_URL` (koneksi langsung ke PostgreSQL) untuk `prisma migrate deploy` — bukan via PgBouncer.
- Migration yang mengubah tabel dengan data harus mengikuti pola **Expand-Contract**:
  1. **Expand**: tambah kolom baru (nullable atau dengan default).
  2. **Migrate**: backfill data di kolom baru.
  3. **Contract**: hapus kolom lama setelah semua code tidak lagi menggunakannya.
- **`[v4.1 — CR-003]`** Tidak ada `PARTITION BY RANGE` di tabel `orders` — migration partisi yang sebelumnya bermasalah (deployment guide v3.1) **tidak relevan lagi**.

---

*Lanjut ke: [`12-monitoring.md`](./12-monitoring.md)*
