# 13. Sprint Roadmap & Fase Implementasi

*[← 12-monitoring.md](./12-monitoring.md) | [→ 14-risk-register.md](./14-risk-register.md)*

---

> **`[v4.1]`** Roadmap ini menghapus task partisi tabel `orders` (CR-003 — FR-PART-01 dihapus) dan memperbarui referensi format nomor transaksi (CR-002). Task "Init SvelteKit" dipertahankan (CR-001 — bukan Next.js).

## Overview Timeline

```
Fase 0    ─── Hari 1–3   ──── Setup & Infrastructure
Fase 1A   ─── Hari 4–14  ──── Soft Launch (Tunai Only)
Fase 1B   ─── Minggu 3–8 ──── Full MVP (QRIS, Modifier, BOM, Diskon, Bluetooth)
Fase 1.5  ─── Minggu 9–10 ─── Polling → SSE + Optimasi
Fase 2    ─── Bulan 3–5  ──── Advanced (FIFO, Loyalitas)
Fase 3    ─── Bulan 6+   ──── Scale (Multi-Outlet, Delivery, Partisi Revisit)
```

---

## Fase 0 — Setup & Infrastructure (Hari 1–3)

```
HARI 1:
□ Setup VPS Biznet Gio (IP: 103.150.227.117)
□ Install Ubuntu 24.04 + Docker + Coolify
□ Beli domain + konfigurasi DNS (A record → 103.150.227.117)
□ Setup Caddy + auto SSL (Let's Encrypt)
□ Setup GitHub repo + branch strategy (main → production, develop → staging)
□ Setup GitHub Actions CI pipeline (lint, test, coverage, Gitleaks)  [v4.1]

HARI 2:
□ Docker Compose: postgres + pgbouncer + redis + nestjs-api + caddy
□ Init NestJS project + TypeScript strict mode
□ Init SvelteKit project + adapter-static (BUKAN Next.js — CR-001)
□ Setup Prisma schema v4.1 (semua 20 tabel final — CR-003: tidak ada PARTITION BY)
□ Konfigurasi PgBouncer (transaction mode, pool 20)
  → DATABASE_URL wajib: ?pgbouncer=true&connection_limit=1  [v4.1 — KRITIS]
□ Konfigurasi Redis (AOF, password, maxmemory 128MB)

HARI 3:
□ Prisma migrate deploy (semua tabel v4.1, tidak ada partisi)
□ Seed data:
  - Superadmin: Nabilah (nabilah.fnb@gmail.com)  [v4.1 — OPEN-01]
  - 5 kategori: Macaroni, Basreng, Mie Kremes, Tempe Goreng, Pilus
  - 12 feature flags (semua OFF)
  - Settings default (shift threshold, preset nominal, lebar struk, dll)
□ Health check endpoint: /health (public) + /health/detailed (SA)
□ Docker health check semua service (start_period=120s)
□ Backup script + Backblaze B2 setup + test upload
□ UptimeRobot monitoring setup (alert email nabilah.fnb@gmail.com)
□ Sentry error tracking setup (backend + frontend)
□ Test akhir: docker compose up → semua service healthy → /health return {"status":"ok"}
```

---

## Fase 1A — Soft Launch, Tunai Only (Hari 4–14)

| Hari | Deliverable | Detail |
|------|-------------|--------|
| **4–5** | **Auth Session + RBAC** | Login kasir (PIN, bcrypt + pepper) via `/auth/login/cashier`. Login SA via `/auth/login/admin`. Session Redis (kasir: no TTL, SA: 24 jam). SessionGuard + RolesGuard. Rate limit per-user. Ganti PIN. Logout + session destroy. `user_sessions:{userId}:*` untuk force-logout. |
| **4–5** | **CRUD Produk + Kategori** | CRUD kategori. CRUD produk + upload foto (Sharp → WebP 600×600 max 500KB). Soft delete (`is_active=false`). List produk untuk POS (cache Redis 5 menit, invalidasi eksplisit). |
| **6–7** | **POS Grid + Keranjang** | Grid produk (foto, nama, harga, badge HABIS, badge OFFLINE). Tap → tambah ke keranjang (tanpa modifier di tahap ini). Keranjang: +/−/× per item, total realtime. Responsive mobile-first. Tap target ≥44×44px. |
| **8–9** | **Pembayaran Tunai + Flexible Payment** | `POST /orders` tanpa metode bayar → `payment_status='pending'`. `POST /orders/:id/pay/cash` → kembalian otomatis. Preset nominal (5K/10K/20K/50K/100K + Uang Pas). Nomor transaksi: `TRX-YYYYMMDD-[cashier_letter][seq3]` (CR-002). Success screen + opsi struk. Idempotency lock (SELECT FOR UPDATE, CR-004/6.4). |
| **8–9** | **Offline Mode** | Service Worker + IndexedDB (Dexie.js). Transaksi offline masuk IndexedDB. Max 500 pending (OFFL-10). Sync otomatis saat online. Idempotency via `client_uuid`. Banner ONLINE/OFFLINE. Badge kuning/merah pending sync. 2-layer retry (OFFL-04). State `sync_failed` (CR-013). |
| **10–11** | **Dashboard Superadmin** | KPI cards: revenue hari ini, jumlah transaksi, rata-rata, top produk. Grafik penjualan 7 hari. List transaksi + filter + pagination. Export CSV (rate limit 5/jam). Void transaksi (dengan idempotency lock). |
| **10–11** | **Shift & Cash Register** | Buka shift: modal kas awal (carry-over otomatis atau manual). Tutup shift: input saldo aktual → sistem hitung discrepancy. Multi-shift per hari. Auto-close (BullMQ). Warning 90 menit (SSE). SA view semua shift. |
| **12** | **Feature Flags + Settings + Email + System Health** | Toggle feature flags via dashboard. Settings: threshold shift, preset nominal, lebar struk, store name. Email notifikasi: void alert, discrepancy, login IP baru, circuit breaker. System health endpoint (termasuk row count orders/order_items — GEN-06 v4.1). |
| **13** | **Testing & Bug Fix** | Test di perangkat Android nyata (RAM 2–3GB, Android 9+). Fix semua critical bug. Load test k6 (5 VU, P95 < 500ms — target realistis v4.1). TC-01 sampai TC-16 wajib lulus. Mutation test modul pricing (Stryker, score ≥70%). |
| **14** | **🚀 SOFT LAUNCH** | Deploy ke production via Coolify. Smoke test otomatis post-deploy (CI). Test transaksi nyata Rp 1.000. Brief kasir (demo session ≥2 jam). Rollback plan siap (`/docs/runbook.md`). UptimeRobot aktif. Developer on-call 24/7 minggu pertama. |

---

## Fase 1B — Full MVP (Minggu 3–8)

| Minggu | Deliverable | Detail |
|--------|-------------|--------|
| **3–4** | **QRIS + Split Payment** | Integrasi Midtrans via `PaymentGateway` interface (bukan SDK langsung — ADR-013/6.1). Webhook handler (SHA512 + timingSafeEqual). Circuit breaker Midtrans via Redis (ADR-014/6.3). SSE fallback + polling. 9 sandbox test cases. Split payment flow. TC-17–TC-20 (v4.1). Feature flag: `QRIS_PAYMENT`, `SPLIT_PAYMENT`. |
| **5** | **Modifier System** | CRUD modifier groups + options. Auto-create "Tanpa [X]" (PROD-06). Popup di POS: pilih modifier wajib sebelum tambah ke keranjang. Formula: `final_price = discounted_base + modifier_total` (ADR-001). Snapshot harga di `order_item_modifiers`. Feature flag: `MODIFIER_POPUP`. |
| **6** | **BOM + HPP (Fase 1B)** | CRUD bahan baku (`raw_materials`) + `bom_items`. Kalkulasi `bom_hpp` otomatis. `hpp_source = 'bom_calculated'`. P&L dashboard update dengan HPP akurat. Feature flag: `BOM_HPP`. *Catatan: skema `raw_materials`/`bom_items` sudah ada sejak Fase 0 (v4.1 — CR-011) — tidak ada kejutan migration.* |
| **7** | **Sistem Diskon + Bluetooth Printer** | CRUD diskon: percentage (+ max_discount v4.1)/fixed, scope all/product, bitmask hari. Auto-apply di POS. Ambil diskon terbesar (DISC-09). Bluetooth printer: Web Bluetooth API + ESC/POS commands. Feature flag: `DISCOUNT_MODULE`, `BLUETOOTH_PRINTER`. |
| **8** | **Analytics Lengkap + Bagi Hasil + UAT** | P&L lengkap (revenue − HPP − opex − depresiasi). Bagi hasil 60/40 default, proporsi per kasir. `profit_share_details` multi-kasir. Mark-paid lock. UAT dengan kasir + owner (Nabilah). Bug fix final pre-release. |

---

## Fase 1.5 — Realtime (Minggu 9–10)

| Item | Detail |
|------|--------|
| **Polling → SSE** | Ganti `setInterval` 60 detik di dashboard dengan Server-Sent Events. NestJS `@Sse()`. Heartbeat 30 detik. Auto-reconnect exponential backoff. Feature flag: `SSE_REALTIME`. |
| **Dashboard Auto-Refresh** | SSE push untuk: KPI update saat ada transaksi baru, QRIS settlement notification, pending sync count update. |
| **Optimasi Frontend** | Lazy loading foto produk. Prefetch data saat idle. Performance audit Lighthouse >80. Bundle size review (target < 200KB JS gzip). |

---

## Fase 2 — Advanced Features (Bulan 3–5)

| Item | Detail |
|------|--------|
| **FIFO Costing** | GRN (Goods Receipt Note) untuk bahan baku. Batch tracking. FIFO HPP otomatis. Stock opname digital. |
| **HPP Akurat** | HPP dari BOM × FIFO batch price. Food cost % per produk. Alert jika FC% > 60%. |
| **Stock Opname** | Input fisik stok mingguan. Sistem hitung selisih vs sistem. Laporan waste. |
| **Loyalitas Pelanggan** | Nomor HP → poin per transaksi. Redeem poin → diskon. *Catatan: modul ini mengumpulkan PII — wajib tambahkan consent, kebijakan retensi, dan right to erasure (UU PDP, `05-nonfunctional-reqs.md §5.6`).* Feature flag: `LOYALTY_MODULE`. |

---

## Fase 3 — Scale (Bulan 6+)

| Item | Detail |
|------|--------|
| **Multi-Outlet** | Tambah tabel `outlets`. Migration Expand-Contract: tambah `outlet_id` (nullable dulu) ke `users`, `cash_registers`, `orders`, `products`. Cross-outlet reporting. Centralized product catalog. Feature flag: — |
| **Partisi Tabel `orders`** | Re-evaluasi hanya jika exit criteria terpenuhi: tabel >5 juta baris ATAU P95 query laporan >500ms setelah index optimal (`05-nonfunctional-reqs.md §5.3`, ADR-005 revisi). Implementasikan range bulanan (`PARTITION BY RANGE (client_created_at)`). |
| **Delivery Channel** | GoFood/GrabFood/ShopeeFood integration. Separate pricing. Feature flag: `DELIVERY_CHANNEL`. |
| **Refund API** | Midtrans refund API (bukan manual cash). Partial refund. Refund tracking via `order_refunds`. |
| **API v2** | Jika public API diperlukan atau multi-outlet mengubah contract secara breaking → `/api/v2/`. |
| **Performa Backend** | Evaluasi: NestJS → Go untuk bottleneck jika traffic naik signifikan (ADR-004 revisit). |

---

*Lanjut ke: [`14-risk-register.md`](./14-risk-register.md)*
