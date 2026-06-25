# NGEMILOH POS — Go-Live Runbook

> **Versi:** 1.0  
> **Tanggal Go-Live:** [TANGGAL]  
> **Status:** 🟡 PENDING — Menunggu persetujuan Owner

---

## Daftar Isi

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Pre-Launch Checklist](#2-pre-launch-checklist)
3. [Launch Day Timeline](#3-launch-day-timeline)
4. [Feature Flags Configuration](#4-feature-flags-configuration)
5. [Smoke Testing Procedures](#5-smoke-testing-procedures)
6. [First 24-Hours Monitoring](#6-first-24-hours-monitoring)
7. [Rollback Procedures](#7-rollback-procedures)
8. [Sign-Off Section](#8-sign-off-section)

---

## 1. Ringkasan Eksekutif

### Status Project

| Komponen | Status | Catatan |
|----------|--------|---------|
| Security Fixes (7 issues) | ✅ DONE | #1, #2, #3, #5, #6, #15, #18 |
| Offline-First (1 issue) | ✅ DONE | #4 |
| Race Condition Fixes (4 issues) | ✅ DONE | #7, #12, #13, #19 |
| Backend Stability (2 issues) | ✅ DONE | #16, #20 |
| UI/UX Fixes (2 issues) | ✅ DONE | #14, #17 |
| Backup & Recovery (1 issue) | ✅ DONE | #10 |
| Docker Configuration (1 issue) | ✅ DONE | #11 |
| Business Logic (1 issue) | ✅ DONE | #9 |
| **BOM Cost** | ⏳ PENDING | **Issue #8 — Butuh input data manual dari Owner** |

**Total: 19/20 issues DONE**  
**Pending: 1 issue (Critical — BOM Cost per unit)**

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| BOM Cost = 0 untuk produk baru | 🔴 CRITICAL | Produk lama sudah ada HPP. produk baru ditandai "TBD" di laporan |
| Tech Debt (TD-001 to TD-004) | 🟡 MEDIUM | Dokumentasikan, buat Jira tickets post-launch |
| DR test belum pernah dilakukan | 🟡 MEDIUM | Schedule DR test di week 2 post-launch |

---

## 2. Pre-Launch Checklist

### 2.1 Security & Authentication

- [ ] **#1 - QRIS Expiry Enforcement** ✅ Done 2026-06-25  
  Cron job `void-expired-qris` sudah di-schedule. Testing: cek logs setelah cron jalan.

- [ ] **#2 - JWT Silent Refresh** ✅ Done 2026-06-25  
  `FEATURE_JWT_REFRESH` flag harus di-enable saat go-live jam 06:00.

- [ ] **#3 - 4-Eyes Void Approval** ✅ Done 2026-06-25  
  `FEATURE_VOID_APPROVAL` flag default `false`. Enable bertahap setelah 1 minggu smooth.

- [ ] **#5 - Idempotency Key** ✅ Done 2026-06-25  
  Double-charge prevention aktif. Verifikasi: check `idempotency_keys` table.

- [ ] **#6 - Member Registration Rate Limit** ✅ Done 2026-06-25  
  Rate limit: 5 registrations / 15 menit per IP. Test dengan curl:

  ```bash
  # Test rate limit
  for i in {1..6}; do
    curl -X POST https://pos.ngemiloh.com/auth/register \
      -H "Content-Type: application/json" \
      -d '{"email":"test'$i'@test.com","pin":"123456","name":"Test"}'
    echo ""
  done
  # Expected: 5 success, 1x 429 Too Many Requests
  ```

- [ ] **#15 - CSRF Protection** ✅ Done 2026-06-25  
  Double-submit cookie pattern aktif. Verifikasi: semua mutasi request harus punya `X-CSRF-Token` header.

- [ ] **#18 - Redis Password Enforcement** ✅ Done 2026-06-25  
  Container tidak akan start tanpa `REDIS_PASSWORD` di environment. **Verifikasi .env tidak ada di git history!**

### 2.2 Offline-First & Resilience

- [ ] **#4 - Offline Order Receipt** ✅ Done 2026-06-25  
  `FEATURE_OFFLINE_RECEIPT` flag default `false`. Enable setelah 1 minggu smooth.

- [ ] **#7 - Redis Fallback** ✅ Done 2026-06-25  
  App tetap jalan tanpa Redis (fitur cache non-critical). Test: stop Redis container, cek app tetap responsive.

  ```bash
  # Simulasi Redis down
  docker stop pos-redis
  # Test login → harus tetap berfungsi
  docker start pos-redis
  ```

### 2.3 Race Conditions & Data Integrity

- [ ] **#9 - Profit Share by Shift** ✅ Done 2026-06-25  
  Laporan keuangan filter berdasarkan `shift_start..shift_end`, bukan `created_at`.

- [ ] **#12 - Stock Advisory Lock** ✅ Done 2026-06-25  
  `SELECT ... FOR UPDATE` untuk stock deduction. Test: parallel checkout 2 kasir, stock tidak boleh minus.

- [ ] **#13 - Shift Auto-Close Lock** ✅ Done 2026-06-25  
  Race condition shift auto-close sudah di-fix. Test: double-trigger auto-close, hanya 1 shift yang close.

- [ ] **#19 - OOM Graceful Restart** ✅ Done 2026-06-25  
  Memory limit 512MB dengan restart policy. Monitoring: check `docker stats` memory usage.

### 2.4 Infrastructure

- [ ] **#10 - Automated Backup** ✅ Done 2026-06-25  
  Cron job backup daily jam 02:00 WIB. Verifikasi:

  ```bash
  # Cek cron schedule
  docker exec pos-backend crontab -l
  
  # Cek latest backup
  docker exec pos-backup ls -la /backups/
  
  # Manual trigger backup test
  docker exec pos-backend /scripts/backup.sh
  ```

- [ ] **#11 - Docker Named Volume** ✅ Done 2026-06-25  
  Bind mount ke named volume. Verifikasi:

  ```bash
  docker volume inspect pos_nabil_backup_data
  # Volume type harus "volume", bukan "bind"
  ```

### 2.5 Backend & Frontend Stability

- [ ] **#14 - Shift Modal Escape Hatch** ✅ Done 2026-06-25  
  Kasir bisa dismiss modal shift dengan tombol "X".

- [ ] **#16 - Admin Offline Guard** ✅ Done 2026-06-25  
  Admin layout check `online` status. Offline admin redirect ke login.

- [ ] **#17 - Tier Downgrade Active** ✅ Done 2026-06-25  
  Grace period 1 bulan untuk tier downgrade.

- [ ] **#20 - Webhook DLQ** ✅ Done 2026-06-25  
  Failed webhooks masuk ke DLQ queue. Monitoring: check `/payment/webhook-dlq` endpoint.

### 2.6 BOM Cost (PENDING)

- [ ] **#8 - BOM Cost Per Unit** ⏳ PENDING  
  Owner harus input HPP untuk ~50+ produk.  
  **Action:** Supply Manager prepare spreadsheet HPP per produk sebelum go-live.

  **Workaround Sementara:**
  - Produk lama: HPP sudah ada di database
  - Produk baru: Tampilkan "TBD" di laporan profit share
  - Disable fitur profit share sementara sampai BOM complete

### 2.7 Database & Backup Verification

- [ ] **Database Schema Up-to-Date**

  ```bash
  # Cek Prisma migration status
  cd backend && npx prisma migrate status
  
  # Generate Prisma Client
  npx prisma generate
  
  # Apply pending migrations (jika ada)
  npx prisma migrate deploy
  ```

- [ ] **Backup Configuration Verified**

  ```bash
  # Cek backup volume exists
  docker volume ls | grep backup
  
  # Cek backup retention setting
  docker exec pos-backend env | grep BACKUP
  
  # Verifikasi encryption key exists ( jangan menampilkan nilainya! )
  docker exec pos-backend env | grep BACKUP_ENCRYPTION_KEY
  # Output harus ada nilai (tidak kosong)
  ```

- [ ] **DR Test Scheduled**

  - Schedule DR test: **Week 2 post-launch** (tanggal: ____________)
  - PIC: ____________
  - Log file: `docs/guides/troubleshooting/DR_log.md`

### 2.8 Technical Debt Items (Post-Launch)

| ID | Deskripsi | Priority | Action |
|----|-----------|----------|--------|
| TD-001 | Superadmin password change on first login | MEDIUM | Buat Jira ticket |
| TD-002 | File upload magic bytes validation | MEDIUM | StdMulter + magic number check |
| TD-003 | Email SMTP credentials | LOW | Setup real SMTP post-launch |
| TD-004 | Unit test coverage < 70% | HIGH | Target: 80% coverage by Q3 |

---

## 3. Launch Day Timeline

### Pre-Launch (H-1)

| Waktu | Aktivitas | PIC | Status |
|-------|----------|-----|--------|
| 14:00 | Final code freeze (tidak ada push ke main) | Dev | ⬜ |
| 15:00 | Backup production database | DBA | ⬜ |
| 16:00 | Verifikasi semua 19 fixes dengan test script | QA | ⬜ |
| 17:00 | Prepare rollback plan document | DevOps | ⬜ |
| 18:00 | Communication: notify all kasir & admin | Owner | ⬜ |
| 20:00 | Early dinner & rest | All | ⬜ |

### Launch Day (H+0) — 2026-____

#### 🌅 Pre-Opening (06:00 - 08:00)

| Waktu | Aktivitas | PIC | Verification |
|-------|----------|-----|--------------|
| 06:00 | Wake up, coffee ☕ | All | - |
| 06:15 | SSH ke server | DevOps | `ssh pos-server` |
| 06:20 | Cek health semua containers | DevOps | `docker ps -a` |
| 06:25 | Cek disk space | DevOps | `df -h` |
| 06:30 | Cek database connectivity | DevOps | `docker exec pos-backend nc -zv pos-db 5432` |
| 06:35 | Cek Redis connectivity | DevOps | `docker exec pos-backend nc -zv pos-redis 6379` |
| 06:40 | **Enable Feature Flags Phase 1** | DevOps | Lihat Section 4 |
| 06:45 | Smoke test: Backend health | DevOps | `curl https://pos.ngemiloh.com/health` |
| 06:50 | Smoke test: POS login | QA | Manual test |
| 06:55 | Smoke test: Admin dashboard | QA | Manual test |
| 07:00 | **GREEN LIGHT: Store Opening** | Owner | ✅ |

#### 🛒 Peak Hours (08:00 - 14:00)

| Waktu | Aktivitas | PIC | Notes |
|-------|----------|-----|-------|
| 08:00 | Morning rush monitoring | DevOps | Watch logs: `docker logs -f pos-backend --tail=100` |
| 09:00 | Hourly check: error rate | DevOps | Grafana dashboard |
| 10:00 | Hourly check: response time | DevOps | Target: < 200ms p95 |
| 11:00 | Hourly check: queue backlog | DevOps | BullMQ dashboard |
| 12:00 | Midday check: stock levels | Admin | Cek produk menipis |
| 13:00 | Hourly check: disk usage | DevOps | Alert if > 80% |
| 14:00 | Lunch rush monitoring | All | Peak period ends |

#### 🌞 Afternoon (14:00 - 18:00)

| Waktu | Aktivitas | PIC | Notes |
|-------|----------|-----|-------|
| 14:00 | Afternoon check: revenue report | Admin | Verify numbers reasonable |
| 15:00 | Hourly check: no errors | DevOps | Check Sentry |
| 16:00 | Hourly check: memory usage | DevOps | `docker stats` |
| 17:00 | Pre-dinner prep check | Admin | Stock, kasir ready |
| 18:00 | Dinner rush begins | All | Peak period 2 |

#### 🌙 Evening Peak (18:00 - 22:00)

| Waktu | Aktivitas | PIC | Notes |
|-------|----------|-----|-------|
| 18:00 | Dinner rush monitoring | DevOps | Watch for spikes |
| 19:00 | Hourly check: all systems | DevOps | Full health check |
| 20:00 | Peak hour: concurrent users | DevOps | Target: 10+ kasir simultaneous |
| 21:00 | Hourly check: transactions | DevOps | Verify no stuck orders |
| 22:00 | Last order check | Admin | Pastikan tidak ada pending payment |

#### 🌑 Post-Close (22:00 - 00:00)

| Waktu | Aktivitas | PIC | Verification |
|-------|----------|-----|-------------|
| 22:00 | Shift close monitoring | Admin | All shifts closed properly |
| 22:15 | Daily report generation | Admin | Verify profit share calc |
| 22:30 | **Enable Feature Flags Phase 2** | DevOps | Lihat Section 4 |
| 22:45 | Final system health check | DevOps | All containers green |
| 23:00 | Backup verification | DevOps | Check backup started |
| 23:30 | Go-Live Day 1 summary | All | No critical issues |
| 00:00 | **GREEN LIGHT: Go-Live Day 1 SUCCESS** | Owner | ✅ |

---

## 4. Feature Flags Configuration

### 4.1 Flag Overview

| Flag | Default | Phase 1 (06:40) | Phase 2 (22:30) | Week 2 |
|------|---------|-----------------|-----------------|--------|
| `FEATURE_OFFLINE_RECEIPT` | false | ⬜ OFF | ✅ ON | ON |
| `FEATURE_JWT_REFRESH` | false | ✅ ON | ON | ON |
| `FEATURE_QRIS_EXPIRY_ENFORCEMENT` | false | ⬜ OFF | ⬜ OFF | ✅ ON |
| `FEATURE_VOID_APPROVAL` | false | ⬜ OFF | ⬜ OFF | ✅ ON |

### 4.2 Phase 1 — Enable JWT Refresh (06:40)

```bash
# Enable JWT silent refresh
curl -X POST https://pos.ngemiloh.com/flags/toggle \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"flagName": "FEATURE_JWT_REFRESH", "enabled": true}'

# Verify
curl https://pos.ngemiloh.com/flags | jq '.FEATURE_JWT_REFRESH'
# Expected: true
```

### 4.3 Phase 2 — Enable Offline Receipt (22:30)

```bash
# Enable offline receipt generation
curl -X POST https://pos.ngemiloh.com/flags/toggle \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"flagName": "FEATURE_OFFLINE_RECEIPT", "enabled": true}'

# Verify
curl https://pos.ngemiloh.com/flags | jq '.FEATURE_OFFLINE_RECEIPT'
# Expected: true
```

### 4.4 Week 2 — Enable Remaining Flags

> ⚠️ **CATATAN:** Tunggu 1 minggu smooth operation sebelum enable flags ini.

```bash
# Enable QRIS expiry enforcement (otomatis void expired QRIS)
curl -X POST https://pos.ngemiloh.com/flags/toggle \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"flagName": "FEATURE_QRIS_EXPIRY_ENFORCEMENT", "enabled": true}'

# Enable 4-eyes void approval
curl -X POST https://pos.ngemiloh.com/flags/toggle \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"flagName": "FEATURE_VOID_APPROVAL", "enabled": true}'
```

---

## 5. Smoke Testing Procedures

### 5.1 POS Terminal Smoke Test

**PIC:** QA / Kasir Senior  
**Estimated Time:** 10 menit per terminal  
**Browser:** Chrome latest, Incognito mode

#### Login Flow

```
[ ] Buka https://pos.ngemiloh.com
[ ] Pilih outlet (jika multi-outlet)
[ ] Masukkan PIN kasir: 123456 (test PIN)
[ ] Verifikasi: Dashboard kasir tampil
[ ] Verifikasi: Shif modal muncul (dengan escape hatch "X")
```

#### Basic Transaction

```
[ ] Klik "Transaksi Baru"
[ ] Scan / cari produk: "Indomie Goreng"
[ ] Tambah qty: 2
[ ] Tambah produk lain: "Es Teh Manis"
[ ] Verifikasi: Total terhitung dengan PPN 11%
[ ] Klik "Bayar"
[ ] Pilih metode: QRIS
[ ] Scan QRIS (test QR dari backend)
[ ] Verifikasi: Payment success
[ ] Verifikasi: Receipt generate
[ ] Klik "Selesai" → kembali ke dashboard
```

#### Void Flow (Tanpa Approval)

```
[ ] Buka riwayat transaksi
[ ] Pilih transaksi terakhir
[ ] Klik "Void"
[ ] Masukkan alasan: "Customer cancels order"
[ ] Verifikasi: Void berhasil (tanpa approval flag OFF)
```

#### Offline Flow

```
[ ] Aktifkan Airplane Mode
[ ] Buat transaksi baru
[ ] Verifikasi: Transaksi tersimpan lokal
[ ] Matikan Airplane Mode
[ ] Verifikasi: Sync otomatis
[ ] Verifikasi: Order muncul di server
```

### 5.2 Admin Dashboard Smoke Test

**PIC:** Admin / DevOps  
**Estimated Time:** 15 menit  
**Browser:** Chrome latest

#### Login & Security

```
[ ] Login ke https://pos.ngemiloh.com/admin
[ ] Verifikasi: Redirect ke login jika offline (guard check)
[ ] Verifikasi: CSRF token aktif (cek Network tab, header X-CSRF-Token)
```

#### Reports

```
[ ] Buka Laporan > Penjualan Harian
[ ] Filter: Shift today
[ ] Verifikasi: Total sesuai dengan transaksi kasir
[ ] Buka Laporan > Profit Share
[ ] Verifikasi: Rumus = (Revenue - PPN - HPP) × 60% / 40%
[ ] Verifikasi: Profit share per kasir = Pool × (KasirSales/TotalSales)
```

#### Stock Management

```
[ ] Buka Inventory > Stok
[ ] Kurangi stok produk "Indomie Goreng" -5
[ ] Buka POS, buat order 10x "Indomie Goreng"
[ ] Verifikasi: Order ditolak / warning stok kurang
[ ] Restore stok kembali
```

#### Member Management

```
[ ] Buka Member > Daftar Member
[ ] Test registration rate limit (6x rapid register)
[ ] Verifikasi: Request ke-6 ditolak (429)
[ ] Test tier downgrade: silver member points < 500
[ ] Verifikasi: Grace period 1 bulan aktif
```

### 5.3 Payment Integration Smoke Test

**PIC:** DevOps / QA  
**Estimated Time:** 20 menit

#### QRIS Payment

```
[ ] Buka https://pos.ngemiloh.com/api/payment/qris/generate
[ ] Copy QR code string
[ ] Buka browser: https://qris-test.domain.com (simulate payment)
[ ] Buat transaksi, generate QR
[ ] Capture payment notification webhook
[ ] Verifikasi: Order status = PAID
[ ] Verifikasi: Payment recorded di database
```

#### Idempotency Test

```
[ ] POST /api/orders dengan idempotency-key: "test-123"
[ ] Response: 201 Created
[ ] POST /api/orders dengan idempotency-key: "test-123" lagi
[ ] Response: 200 OK (not 201, not error)
[ ] Verifikasi: Only 1 order created di database
```

#### Webhook DLQ Test

```
[ ] Setup webhook endpoint untuk fail (return 500)
[ ] Trigger payment webhook
[ ] Verifikasi: Message masuk DLQ
[ ] Buka /payment/webhook-dlq
[ ] Verifikasi: Failed webhook listed
[ ] Trigger retry manually
[ ] Verifikasi: Webhook processed
```

---

## 6. First 24-Hours Monitoring

### 6.1 Monitoring Dashboard Links

| Dashboard | URL | Purpose |
|-----------|-----|---------|
| Grafana | https://grafana.ngemiloh.com | System metrics |
| Sentry | https://sentry.io/org/ngemiloh/pos | Error tracking |
| BullMQ | https://pos.ngemiloh.com/bullmq | Job queue |
| Docker | `docker stats` | Container resource |

### 6.2 Hourly Checklist (06:00 - 00:00)

| Waktu | Check | Target | Alert If |
|-------|-------|--------|----------|
| Every hour | Error rate | < 0.1% | > 1% |
| Every hour | API response p95 | < 200ms | > 500ms |
| Every hour | Queue depth | < 50 | > 200 |
| Every hour | Memory usage | < 400MB | > 480MB |
| Every 2h | Disk usage | < 70% | > 80% |
| Every 2h | Active shifts | matches expected | mismatch |
| Every 4h | Backup completed | success | failed |

### 6.3 Key Metrics to Watch

#### Success Metrics

```
✅ Total transactions: ___ orders
✅ Revenue: Rp ___.___
✅ Average transaction: Rp ___.___
✅ QRIS payments: ___ (___%)
✅ Void rate: ___% (target < 2%)
✅ Member transactions: ___%
✅ Sync success rate: 100%
```

#### Alert Thresholds

| Metric | Green | Yellow | Red |
|--------|-------|--------|-----|
| API errors/min | 0 | 1-5 | > 5 |
| DB connections | < 50 | 50-80 | > 80 |
| Redis memory | < 256MB | 256-384MB | > 384MB |
| NestJS uptime | > 23h | 12-23h | < 12h |
| Sync queue | 0 | 1-10 | > 10 |

### 6.4 First Week Monitoring Focus

| Day | Focus | Notes |
|-----|-------|-------|
| Day 1 | Full system stability | Hourly checks |
| Day 2 | Peak hours (lunch/dinner) | Watch concurrency |
| Day 3 | Member loyalty flows | Tier calculations |
| Day 4 | Profit share reports | Verify numbers |
| Day 5 | Weekend peak | High traffic test |
| Day 6 | Offline scenarios | Airplane mode tests |
| Day 7 | Week 1 summary | Document learnings |

---

## 7. Rollback Procedures

### 7.1 Rollback Tiers

| Tier | Scope | RTO | RPO | When To Use |
|------|-------|-----|-----|-------------|
| **Tier 1** | Feature Flag Off | 1 min | 0 | UX issue, minor bug |
| **Tier 2** | Container Restart | 2 min | 0 | Memory leak, stuck process |
| **Tier 3** | Code Rollback | 10 min | 0 | Critical bug in new code |
| **Tier 4** | DB Rollback | 30 min | 1 hour | Data corruption |

### 7.2 Tier 1: Feature Flag Rollback

**RTO:** 1 minute  
**Use when:** UX issue, non-critical bug

```bash
# Disable problematic flag immediately
curl -X POST https://pos.ngemiloh.com/flags/toggle \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"flagName": "FEATURE_OFFLINE_RECEIPT", "enabled": false}'

# Verify
curl https://pos.ngemiloh.com/flags | jq '.FEATURE_OFFLINE_RECEIPT'
# Expected: false
```

### 7.3 Tier 2: Container Restart

**RTO:** 2 minutes  
**Use when:** Memory leak, stuck process, OOM

```bash
# Cek resource usage
docker stats --no-stream

# Restart backend
docker restart pos-backend

# Cek logs
docker logs -f pos-backend --tail=50

# Verifikasi health
curl https://pos.ngemiloh.com/health
# Expected: {"status":"ok"}
```

### 7.4 Tier 3: Code Rollback

**RTO:** 10 minutes  
**Use when:** Critical bug introduced in latest deployment

```bash
# Cek git history
git log --oneline -10

# Identify previous good commit
# Example: abc1234 is last known good

# Tag current bad deployment
git tag rollback-candidate-$(date +%Y%m%d%H%M%S)

# Checkout previous commit
git checkout abc1234

# Rebuild and redeploy
cd backend && docker build -t pos-backend:rollback .
docker stop pos-backend
docker run -d --name pos-backend --restart always pos-backend:rollback

# Verifikasi
docker logs -f pos-backend --tail=100
curl https://pos.ngemiloh.com/health
```

### 7.5 Tier 4: Database Rollback

**RTO:** 30 minutes  
**RPO:** 1 hour (dari last backup)  
**Use when:** Data corruption, bad migration

> ⚠️ **DANGER ZONE** — Requires Owner approval!

```bash
# 1. STOP all write traffic
# Notify kasir: "System maintenance, 30 minutes"

# 2. Connect to backup volume
docker exec -it pos-backup ls /backups/

# 3. Identify last good backup
# Last good backup: backup-2026-06-25-020000.sql.gz.enc

# 4. Decrypt backup
docker exec pos-backup sh -c \
  "openssl enc -d -aes-256-cbc -in /backups/backup-YYYYMMDD-HHMMSS.sql.gz.enc \
   -out /tmp/restore.sql.gz -k \$BACKUP_ENCRYPTION_KEY"

# 5. Restore database
docker exec -i pos-db psql -U postgres -d pos_nabil < <(gunzip -c /tmp/restore.sql.gz)

# 6. Verify
docker exec pos-db psql -U postgres -d pos_nabil -c "SELECT COUNT(*) FROM orders;"

# 7. Resume traffic
# Notify kasir: "System resumed"
```

### 7.6 Component-Specific Rollback

| Component | Rollback Command | Verification |
|-----------|-----------------|--------------|
| Backend | `docker stop pos-backend && docker rm pos-backend && docker run pos-backend:previous` | `curl /health` |
| Frontend | `docker stop pos-frontend && docker rm pos-frontend && docker run pos-frontend:previous` | Browser refresh |
| Database | Restore from backup | `SELECT COUNT(*) FROM orders` |
| Redis | `docker restart pos-redis` (stateless cache) | `docker exec pos-backend redis-cli ping` |
| Caddy | `docker restart pos-caddy` | `curl -I https://pos.ngemiloh.com` |

---

## 8. Sign-Off Section

### Pre-Launch Sign-Off

| Checklist | PIC | Signature | Date |
|-----------|-----|-----------|------|
| All 19 security/stability fixes verified | DevOps | ____________ | ____-__-__ |
| BOM Cost workaround configured | Owner | ____________ | ____-__-__ |
| Backup tested and verified | DBA | ____________ | ____-__-__ |
| DR test scheduled | DevOps | ____________ | ____-__-__ |
| Feature flags Phase 1 configured | DevOps | ____________ | ____-__-__ |
| Communication sent to all kasir | Owner | ____________ | ____-__-__ |

### Launch Day Sign-Off

| Milestone | PIC | Signature | Time |
|-----------|-----|-----------|------|
| System health check passed (06:30) | DevOps | ____________ | __:__ |
| Feature flags Phase 1 enabled (06:40) | DevOps | ____________ | __:__ |
| POS smoke test passed (06:50) | QA | ____________ | __:__ |
| Store opened (07:00) | Owner | ____________ | __:__ |
| Lunch rush OK (14:00) | DevOps | ____________ | __:__ |
| Dinner rush OK (22:00) | DevOps | ____________ | __:__ |
| Feature flags Phase 2 enabled (22:30) | DevOps | ____________ | __:__ |
| Go-Live Day 1 SUCCESS (00:00) | Owner | ____________ | __:__ |

### Week 1 Sign-Off

| Task | PIC | Signature | Date |
|------|-----|-----------|------|
| Day 1 summary | DevOps | ____________ | ____-__-__ |
| Day 3 summary | DevOps | ____________ | ____-__-__ |
| Day 5 summary | DevOps | ____________ | ____-__-__ |
| Week 1 report | Owner | ____________ | ____-__-__ |
| BOM Cost data entry complete | Owner | ____________ | ____-__-__ |
| Week 2 flags enabled | DevOps | ____________ | ____-__-__ |

### Post-Launch Sign-Off (Week 2)

| Task | PIC | Signature | Date |
|------|-----|-----------|------|
| DR test performed | DevOps | ____________ | ____-__-__ |
| All issues resolved | DevOps | ____________ | ____-__-__ |
| Technical debt tickets created | Owner | ____________ | ____-__-__ |
| Go-Live CLOSED | Owner | ____________ | ____-__-__ |

---

## Appendix A: Emergency Contacts

| Role | Name | Contact | Hours |
|------|------|---------|-------|
| Tech Lead | ____________ | ____________ | 24/7 |
| DevOps | ____________ | ____________ | 24/7 |
| DBA | ____________ | ____________ | 24/7 |
| Owner | ____________ | ____________ | 24/7 |

## Appendix B: Useful Commands

```bash
# System health
docker ps
docker stats --no-stream
curl https://pos.ngemiloh.com/health

# Logs
docker logs -f pos-backend --tail=100
docker logs -f pos-frontend --tail=100
docker logs -f pos-caddy --tail=100

# Database
docker exec -it pos-db psql -U postgres -d pos_nabil
docker exec -it pos-db pg_dump -U postgres pos_nabil > backup.sql

# Redis
docker exec -it pos-redis redis-cli
docker exec pos-redis redis-cli INFO memory

# Feature flags
curl https://pos.ngemiloh.com/flags

# Queue monitoring
docker exec pos-backend curl http://localhost:3000/bullmq/health
```

## Appendix C: Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-06-26 | Claude Code | Initial creation |

---

**Dokumen ini adalah panduan operasional. Update sesuai kebutuhan saat execution.**
