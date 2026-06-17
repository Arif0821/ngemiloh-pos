# 15. Appendix

*[← 14-risk-register.md](./14-risk-register.md)*

---

## A. Pre-Launch Checklist

### INFRASTRUKTUR

```
□ VPS running: IP 103.150.227.117 dapat diakses
□ Domain dibeli + DNS A record → 103.150.227.117 (propagasi selesai)
□ SSL/TLS aktif (Caddy auto-SSL via Let's Encrypt): https://{domain}/health → 200
□ Docker Compose: semua 5 service healthy
  □ postgres  → HEALTHY
  □ pgbouncer → HEALTHY
  □ redis     → HEALTHY
  □ nestjs-api → HEALTHY
  □ caddy     → HEALTHY
□ DATABASE_URL menggunakan ?pgbouncer=true&connection_limit=1 [KRITIS — v4.1]
□ Disk: 60 GB terdeteksi, pemakaian awal <5 GB
□ RAM: 4.44 GB, container berjalan <2 GB
□ Prisma migration: 20 tabel berhasil dibuat (20 tabel v4.1)
□ Seed data: superadmin Nabilah, 5 kategori, 12 feature flags (OFF), settings default
```

### SECURITY

```
□ HTTPS enforced (HTTP redirect ke HTTPS via Caddy)
□ Session cookie: HttpOnly=true, Secure=true, SameSite=Strict
□ PIN_PEPPER_SECRET diset di Coolify Secrets (32 char random) — JANGAN UBAH LAGI
□ SESSION_SECRET diset di Coolify Secrets (64 char random)
□ BACKUP_ENCRYPTION_KEY diset di Coolify Secrets
□ Rate limit aktif: 5 gagal login / 10 menit per user
□ Gitleaks CI gate aktif (tidak ada secret ter-commit di repo)
□ Origin header check aktif di middleware
□ Helmet.js security headers aktif (CSP, HSTS, X-Frame-Options, noSniff)
```

### PAYMENT (Khusus saat QRIS Fase 1B go-live)

```
□ Midtrans Production disetujui (Kategori: Usaha Mikro, MDR 0%)
□ MIDTRANS_ENV=production di Coolify Secrets
□ MIDTRANS_SERVER_KEY production di Coolify Secrets (bukan sandbox)
□ Webhook URL production di-set di Midtrans Dashboard: https://{domain}/api/v1/payment/webhook/midtrans
□ Test webhook berhasil diterima (Midtrans Dashboard → Test Notification)
□ Bank Jago/rekening bisnis terverifikasi di Midtrans (status: Verified)
□ NIB dari OSS sudah diurus (jika wajib Midtrans)
□ Feature flag QRIS_PAYMENT → true (setelah semua di atas ok)
```

### APLIKASI

```
□ Login kasir dengan PIN → grid produk muncul ✅
□ Buat order → bayar tunai → success screen → struk ✅
□ Offline mode: 5 transaksi offline → online → sync → verifikasi di DB ✅
□ Login SA → KPI dashboard → daftar transaksi → export CSV ✅
□ Email notifikasi: test void alert → email diterima ✅
□ Feature flags toggle: enable → disable → konfirmasi efek di UI ✅
□ System health: /admin/system-health menampilkan semua komponen ✅
□ Row count orders/order_items visible di system health [v4.1] ✅
```

### TESTING

```
□ TC-01 sampai TC-22 semua LULUS ✅
□ Unit test coverage ≥ 70% global ✅
□ Modul kritis (auth, shift, orders, discounts) coverage ≥ 85% ✅
□ Mutation test modul pricing: score ≥ 70% ✅ [v4.1]
□ Smoke test otomatis post-deploy: CI pipeline lulus ✅ [v4.1]
□ Load test k6: 5 VU, P95 < 500ms, error rate < 1% ✅
□ Test di perangkat Android nyata (RAM 2–3GB, Android 9+) ✅
□ Tap target ≥ 44×44px: terverifikasi secara visual ✅
```

### MONITORING

```
□ UptimeRobot aktif: monitor /health setiap 5 menit
□ Test UptimeRobot: stop container nestjs-api → email alert diterima <10 menit
□ Sentry backend: error capture aktif (test: throw error manual → cek Sentry dashboard)
□ Sentry frontend: error capture aktif (SvelteKit)
□ Gmail App Password aktif (nabilah.fnb@gmail.com) — test via email notifikasi
```

### OPERASIONAL

```
□ Kasir sudah di-brief dan demo session ≥ 2 jam
□ Rollback plan terdokumentasi di /docs/runbook.md
□ Emergency contact developer: bisa direach 24/7 selama 2 minggu pertama
□ Transaksi test nyata Rp 1.000 berhasil (tunai) → verifikasi di dashboard
□ Backup harian: test restore dari backup ke PostgreSQL staging (DR test)
```

### SIGN-OFF

```
□ Owner (Nabilah) approval:  ___________________  Tanggal: ___/___/2026
□ Developer approval:        ___________________  Tanggal: ___/___/2026

Catatan:
```

---

## B. Biaya Operasional Estimasi

| Item | Biaya/Bulan | Keterangan |
|------|------------|-----------|
| **VPS Biznet Gio Cloud** | **Rp 210.000** | 4.44 GB RAM, 4 vCPU, 60 GB SSD |
| Domain .com | ~Rp 15.000 | ~Rp 180.000/tahun ÷ 12 (belum dibeli — lihat OPEN-03) |
| Midtrans QRIS MDR | **Rp 0** | Semua transaksi ≤ Rp 500K (merchant mikro) |
| Email (Gmail SMTP) | **Rp 0** | Nodemailer + App Password. Limit 500 email/hari |
| Backblaze B2 (backup storage) | ~Rp 15.000 | ~10 GB storage/bulan. First 10GB free |
| UptimeRobot | **Rp 0** | Free tier (50 monitors, interval 5 menit) |
| Sentry error tracking | **Rp 0** | Free tier (5K events/bulan — cukup untuk skala ini) |
| GitHub (repo + Actions) | **Rp 0** | Free tier (private repos, 2000 menit Actions/bulan) |
| **TOTAL** | **~Rp 240.000/bulan** | |

**Budget vs Actual:**
```
Budget:  Rp 500.000/bulan
Actual:  Rp 240.000/bulan
Sisa:    Rp 260.000/bulan  ← buffer untuk upgrade RAM/disk jika dibutuhkan
```

**Scaling Cost Projection (jika multi-outlet Fase 3):**
- 2 outlet → pertimbangkan upgrade RAM ke 8GB: +~Rp 100.000/bulan
- CDN (Cloudflare Free Tier): Rp 0 untuk caching static assets (foto produk)
- Redis dedicated (jika VPS RAM penuh): +~Rp 50.000/bulan (Upstash atau upgrade VPS)

---

## C. Kontak & Eskalasi

| Peran | Nama | Kontak | Eskalasi Untuk |
|-------|------|--------|----------------|
| **Owner / Superadmin** | Nabilah | nabilah.fnb@gmail.com | Keputusan bisnis, approval bagi hasil, void >3× dalam 10 menit, diskrepansi kas besar |
| **Developer** | — | *(diisi saat go-live)* | Bug kritis, VPS down, security incident, database error |
| **Midtrans Support** | — | support@midtrans.com | Payment issue, QRIS settlement delay, webhook tidak diterima |
| **Biznet Gio Support** | — | *(lihat panel Biznet)* | VPS downtime, network issue, IP block |
| **Backblaze B2 Support** | — | support@backblaze.com | Backup upload gagal, storage issue |

> **`[v4.1 — OPEN-01]`** Jika "Arif" adalah contact teknis terpisah (bukan kesalahan ketik dari "Nabilah"), tambahkan baris Arif di tabel ini dengan role "Admin Teknis".

---

## D. Dokumen Referensi

| Dokumen | Lokasi | Keterangan |
|---------|--------|-----------|
| PRD v4.1 — Overview & Changelog | `docs/prd/00-overview.md` | Pintu masuk & CR log |
| PRD v4.1 — Stakeholder & RBAC | `docs/prd/01-stakeholders-rbac.md` | Persona & permission matrix |
| PRD v4.1 — Business Rules | `docs/prd/02-business-rules.md` | Master list aturan bisnis |
| PRD v4.1 — User Journey | `docs/prd/03-journeys-flows.md` | Alur pengguna & navigasi |
| PRD v4.1 — Functional Requirements | `docs/prd/04-functional-reqs.md` | Semua FR-* |
| PRD v4.1 — NFR | `docs/prd/05-nonfunctional-reqs.md` | SLA, kapasitas, DoR/DoD |
| PRD v4.1 — Architecture | `docs/prd/06-architecture.md` | Modular Monolith, caching, circuit breaker, offline-first |
| PRD v4.1 — Database | `docs/prd/07-database.md` | Schema SQL + Prisma + ERD + seed |
| PRD v4.1 — API Contract | `docs/prd/08-api-contract.md` | Semua endpoint + error codes |
| PRD v4.1 — Security | `docs/prd/09-security.md` | Auth flow, STRIDE, audit events |
| PRD v4.1 — Testing | `docs/prd/10-testing.md` | TC-01..TC-22, load test, mutation test |
| PRD v4.1 — Deployment | `docs/prd/11-deployment.md` | Docker Compose, CI/CD, backup |
| PRD v4.1 — Monitoring | `docs/prd/12-monitoring.md` | Observability, log retention, postmortem |
| PRD v4.1 — Roadmap | `docs/prd/13-roadmap.md` | Sprint Fase 0–3 |
| PRD v4.1 — Risk Register | `docs/prd/14-risk-register.md` | R-01..R-18 + Tech Debt |
| PRD v4.1 — Appendix (dokumen ini) | `docs/prd/15-appendix.md` | Checklist, biaya, kontak |
| ADR-001..ADR-016 | `docs/decisions/ADR-*.md` | Architecture Decision Records |
| Deployment Guide v3.1 | `deployment_guide_ngemiloh.md` | Referensi konfigurasi lama (kompatibel sebagian besar, schema perlu update ke v4.1) |
| Runbook | `/docs/runbook.md` | Prosedur rollback dan incident response *(dibuat saat Fase 0)* |
| DR Log | `/docs/DR_log.md` | Log hasil DR test bulanan *(dibuat saat pertama kali DR test)* |
| Postmortems | `/docs/postmortems/*.md` | Satu file per insiden (lihat template `12-monitoring.md §16.6`) |
| PRD v4.0 (arsip) | `PRD_Ngemiloh_POS_v4_0.md` | Versi sebelumnya — referensi historis |

---

## E. Panduan Setup Cepat (Developer Baru)

Target: **< 30 menit** dari `git clone` sampai aplikasi jalan lokal.

```bash
# 1. Clone
git clone https://github.com/org/ngemiloh-pos.git
cd ngemiloh-pos

# 2. Copy env
cp .env.example .env.local
# Edit .env.local: isi DB_PASSWORD, REDIS_PASSWORD, PIN_PEPPER_SECRET (boleh random untuk dev)

# 3. Jalankan semua service
make setup      # atau: docker compose up -d --build

# 4. Jalankan migration + seed
make migrate    # prisma migrate deploy (via DIRECT_DATABASE_URL)
make seed       # prisma db seed

# 5. Verifikasi
curl http://localhost:3000/health
# Respons: {"status":"ok","version":"4.1.0","timestamp":"..."}

# 6. Buka aplikasi
# POS:    http://localhost:5173/pos
# Admin:  http://localhost:5173/admin
# Login kasir: PIN 123456 (dari seed)
# Login SA: nabilah@dev.test / password sesuai .env.local
```

---

*PRD Ngemiloh POS v4.1 — 15 Juni 2026*
*Semua perubahan dari v4.0 tercatat di `00-overview.md §CR Log`. Perubahan selanjutnya melalui CR formal yang sama.*
