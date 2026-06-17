# 05. Non-Functional Requirements

*[← 00-overview.md](./00-overview.md) | [→ 06-architecture.md](./06-architecture.md)*

---

> **Konteks (lihat CR-009 di `00-overview.md`):** Bagian ini dijanjikan di Daftar Isi v4.0 (sebagai bagian 10) tapi hilang total dari isi dokumen. Seluruh angka di bawah **bukan template generik** dari panduan SDLC — masing-masing dihitung/dikalibrasi terhadap skala riil Ngemiloh: **1 outlet, ~50–150 transaksi/hari, 1 VPS 4.44GB RAM/4 vCPU, tim 1–2 developer.**

---

## 5.1 Target Performa (Response Time)

| Kategori Endpoint | Contoh | P95 | P99 |
|---|---|---|---|
| Read — list/detail (cached Redis) | `GET /products`, `GET /admin/settings` | < 300ms | < 600ms |
| Read — dashboard/report (agregasi DB) | `GET /admin/dashboard/*`, `GET /admin/reports/*` | < 500ms | < 1.000ms |
| Write — transaksi | `POST /orders`, `POST /orders/:id/payment` | < 500ms | < 1.000ms |
| Write — admin CRUD | `POST/PATCH /admin/products`, `/admin/discounts` | < 400ms | < 800ms |
| Auth | `POST /auth/login/cashier`, `/auth/login/admin` | < 500ms (termasuk hashing PIN/password) | < 1.000ms |
| Webhook Midtrans | `POST /payment/qris/webhook` | < 1.000ms (selalu balas `200` lebih dulu, proses notifikasi async via BullMQ) | — |
| `sync-batch` (per-order, bukan per-request) | `POST /orders/sync-batch` | < 500ms per order di dalam batch | < 1.000ms |

**Cara verifikasi:** k6 load test (lihat `10-testing.md`) dengan target 5 virtual user (VU) — bukan 50/100 VU seperti template umum, karena realistis maksimum 5 kasir bersamaan (lihat 5.3).

---

## 5.2 Availability — SLA / SLO / Error Budget

```
SLI : % request API selesai < 500ms (diukur dari access log + /health/detailed)
SLO : 99.5% uptime backend per bulan
Error Budget : 0,5% × 30 hari × 24 jam = 3,6 jam/bulan
```

**Pemisahan penting — Availability Backend vs Availability Operasional:**

| Lapisan | Target | Alasan |
|---|---|---|
| **Backend/API** (VPS, PostgreSQL, Redis) | **99.5%/bulan** (≈3,6 jam downtime/bulan) | Single VPS tanpa redundansi — 99.9% (≈43 menit/bulan) butuh HA/multi-region, di luar scope & budget (Rp 210rb/bulan) |
| **Operasional Kasir (efektif)** | **mendekati 100%** | **Offline-First Architecture** (`06-architecture.md`) menyerap downtime backend — kasir tetap bisa input transaksi tunai saat backend down, sync otomatis saat pulih |

> Implikasi: tim **tidak perlu over-invest** pada uptime backend (no Kubernetes, no multi-region) karena dampak ke operasional harian sudah dimitigasi di layer aplikasi. Ini adalah keputusan arsitektur yang disengaja, bukan kompromi tersembunyi.

**Kebijakan Error Budget (disederhanakan untuk tim 1–2 dev — bukan proses SRE formal):**

| Sisa Budget Bulan Ini | Tindakan |
|---|---|
| > 50% | Deploy normal sesuai roadmap |
| < 50% | Tunda deploy non-kritis (fitur baru), fokus stabilitas/bugfix |
| 0% (habis) | Freeze deploy fitur baru. Wajib root-cause + postmortem (`12-monitoring.md`) sebelum lanjut |

**Burn-rate alert (via UptimeRobot, tanpa tooling tambahan):**
- Downtime kontinu **> 30 menit** → alert "critical" (email ke `nabilah.fnb@gmail.com` + kontak developer)
- Akumulasi downtime **> 1,8 jam** (50% budget) dalam 1 bulan → trigger review mingguan jadwal deploy

---

## 5.3 Skalabilitas & Kapasitas

### Target Concurrent Users

| Aktor | Target Concurrent | Catatan |
|---|---|---|
| Kasir (POS) | hingga **5 sesi bersamaan** | Saat ini 1 aktif; arsitektur (Modular Monolith + session Redis) sudah cukup tanpa perubahan untuk 5 |
| Superadmin (Dashboard) | 1 sesi | Owner |
| **Total** | **6 koneksi aktif** | Basis kalkulasi pool DB di bawah |

### Connection Pool (PgBouncer)

```
Formula umum: pool_size = (jumlah_core × 2) + 1
            = (4 × 2) + 1 = 9

Konfigurasi v4.0/v4.1: pool_size = 20 (buffer 2x dari minimum)
→ Cukup untuk 6 koneksi aktif + headroom untuk BullMQ workers + admin query
```

### Pertumbuhan Data (basis keputusan "tidak partisi" — CR-003)

| Tabel | Estimasi baris/tahun | Estimasi 5 tahun | Estimasi 10 tahun |
|---|---|---|---|
| `orders` | ~36.500 (100/hari) | ~182.500 | ~365.000 |
| `order_items` | ~100.000 (avg 2,7 item/order) | ~500.000 | ~1.000.000 |
| `audit_logs` | bervariasi, volume kecil (1 outlet) | < 50.000 | < 100.000 |

**Exit criteria re-evaluasi partisi** (mengacu ADR-005 revisi): implementasikan partisi `orders` (range bulanan) **HANYA JIKA** salah satu berikut terpenuhi:
1. Tabel `orders` melampaui **5 juta baris**, ATAU
2. P95 query laporan bulanan **> 500ms** setelah index dioptimalkan (lihat 5.1), ATAU
3. Bisnis berkembang ke **multi-outlet** dengan volume gabungan signifikan.

`FR-SYS-02` (`/admin/system-health`) menampilkan row count `orders`/`order_items` agar SA punya visibilitas progres terhadap kriteria #1.

---

## 5.4 Disk Budget (VPS 60GB)

| Komponen | Estimasi Pemakaian | Catatan |
|---|---|---|
| OS + Docker images (NestJS, SvelteKit build, PostgreSQL, Redis, Caddy, PgBouncer) | ~10 GB | Image size bervariasi per build |
| PostgreSQL data (10 tahun, lihat 5.3) | < 2 GB | Tanpa partisi tetap performant di skala ini |
| Foto produk (≤70 × 500KB WebP) | ~35 MB | Sesuai batasan §3.5 |
| Redis persistence (RDB/AOF) | < 500 MB | Data kecil: session + cache + counter |
| Docker logs (rotated) | ~1 GB | `max-size`/`max-file` di docker-compose |
| Backup lokal sementara (sebelum upload ke storage offsite) | ~2–5 GB buffer | Lihat `11-deployment.md` |
| **Total terpakai (estimasi 10 tahun)** | **~15–20 GB** | |
| **Sisa buffer dari 60GB** | **~40 GB+** | Ruang aman untuk pertumbuhan tak terduga |

---

## 5.5 Keamanan (Ringkasan — detail di `09-security.md`)

| Aspek | Target | Catatan |
|---|---|---|
| OWASP Top 10 | Tercakup penuh | Lihat tabel mitigasi di `09-security.md` |
| **PCI-DSS** | **Tidak relevan** | Kredensial pembayaran (kartu/QRIS) **tidak pernah disimpan atau melewati server merchant** — seluruhnya di-hosting Midtrans. Ngemiloh tidak masuk lingkup PCI-DSS. |
| Rate limiting | Per-session (bukan global) | Lihat CR-007 — `POST /orders` = 30/menit/sesi |
| Secret management | `.env` + Gitleaks di CI | Lihat `09-security.md` |

---

## 5.6 Compliance — UU PDP

> *Sistem v4.0–v4.1 TIDAK mengumpulkan data pribadi pelanggan (transaksi anonim). Data pribadi yang diproses terbatas pada data internal staf (nama kasir, PIN ter-hash) — bukan kategori data sensitif UU PDP (NIK, biometrik, kesehatan, data finansial pihak ketiga). Kewajiban UU PDP untuk Fase 1–2: minimal.*
>
> ***Flag untuk Fase 2 (Loyalitas Pelanggan):*** *modul ini akan mengumpulkan nomor HP pelanggan (PII). Saat diimplementasikan, WAJIB: (1) consent eksplisit saat pendaftaran, (2) kebijakan retensi & hak hapus data (right to erasure), (3) masking nomor HP di log.*

---

## 5.7 Maintainability

### Code Coverage — Bertahap per Modul

| Modul | Fase 1A (Hari ke-14) | Fase 1B+ (Minggu ke-8) | Alasan |
|---|---|---|---|
| `auth/`, `shift/`, `orders/` (logika pembayaran), `discounts/` (kalkulasi harga) | **≥ 85%** | **≥ 95%** | Modul *uang* dengan riwayat bug nyata (TC-01: v3.0 salah hitung Rp 11.600 vs Rp 12.100) — risiko tinggi → coverage tinggi sejak awal |
| Modul lain (`products`, `reports`, `settings`, `cashiers`, dst) | ≥ 60% | ≥ 80% | CRUD standar, risiko lebih rendah |
| **Global** | **≥ 70%** | **≥ 80%** | Selaras panduan SDLC §19.1 pada Fase 1B+ |

### Onboarding Developer Baru

Target: **< 30 menit** dari `git clone` sampai aplikasi jalan lokal (`docker compose up` + `make seed`). Diverifikasi sebagai bagian DoD untuk setiap perubahan ke `docker-compose.yml`/`Makefile` (lihat 5.12).

---

## 5.8 Portabilitas

100% berbasis Docker Compose. **Tidak ada panggilan API yang spesifik ke Biznet Gio** di dalam kode aplikasi — mitigasi terhadap trade-off vendor yang kurang umum (dicatat sebagai ADR-011 di v4.0). Migrasi ke VPS provider lain = `docker compose up` di server baru + restore backup.

---

## 5.9 Browser & Device Support

| Platform | Target |
|---|---|
| Desktop (Dashboard Admin) | Chrome, Edge, Firefox — 2 versi terakhir |
| Mobile/Tablet (POS Kasir) | Android 9+, RAM 2–3GB, Chrome/Edge terbaru |

---

## 5.10 Aksesibilitas — Minimal-Viable (Bukan WCAG AA Penuh)

Target aksesibilitas: subset praktis WCAG 2.1 yang relevan untuk POS tablet:
1. Tap target **≥ 44×44px** untuk seluruh tombol interaktif POS.
2. Kontras warna teks **≥ 4.5:1**.
3. Form modal kas awal/tutup shift: setiap input punya `<label>` yang terhubung (`for`/`id`).

**WCAG AA penuh (screen reader, keyboard navigation lengkap) di luar scope** — perangkat kasir adalah touchscreen, bukan assistive-tech use case utama. Akan direview ulang jika ada kebutuhan kasir dengan disabilitas spesifik.

---

## 5.11 Internasionalisasi (i18n) — Out of Scope

Tidak ada struktur i18n (`locales/*.json`). Seluruh string hardcode Bahasa Indonesia, 1 mata uang (IDR). Jika ekspansi ke region non-id-ID terjadi (di luar roadmap saat ini), ini menjadi technical debt yang didaftarkan saat itu — keputusan ini transparan, bukan kelalaian.

---

## 5.12 Definition of Ready (DoR) & Definition of Done (DoD)

Versi ringkas untuk tim 1–2 developer (bukan ritual Scrum penuh):

### DoR — sebelum mulai mengerjakan task
- [ ] Acceptance criteria jelas, mengacu ID Business Rule (mis. "TRX-07") atau ID FR.
- [ ] Jika ada perubahan skema DB → migration plan ditulis, termasuk apakah perlu pola Expand-Contract.
- [ ] Jika menyentuh modul payment/shift/auth → kasus uji kritis terkait (`10-testing.md`) sudah diidentifikasi.

### DoD — sebelum task ditandai selesai
- [ ] Unit test ditulis & lulus; coverage modul tidak turun dari threshold (5.7).
- [ ] Tidak ada error linter/type-check (`npm run lint`, `tsc --noEmit`).
- [ ] Untuk endpoint baru/berubah: contoh request/response ditambahkan ke `08-api-contract.md`.
- [ ] Untuk perubahan UI: di-test di Chrome desktop **dan** minimal 1 device Android low-end.
- [ ] Di-deploy ke staging & smoke-test manual: `/health/detailed` OK + 1 transaksi end-to-end (cash & QRIS sandbox).

---

## 5.13 Catatan untuk `14-risk-register.md` (akan digabung di Tahap 7)

Tiga risiko baru yang muncul dari proses penyusunan v4.1 ini sendiri, perlu ditambahkan ke Risk Register utama:

| # | Risiko | Probabilitas | Impact | Mitigasi |
|---|---|---|---|---|
| R-16 | Dokumentasi PRD makin besar & tidak terbaca seiring waktu | Tinggi | Sedang | Struktur multi-file (CR-014) + setiap file punya batas topik jelas |
| R-17 | Inkonsistensi spek baru muncul lagi karena PRD dikerjakan bertahap multi-sesi | Sedang | Sedang | CR Log (`00-overview.md`) + checklist konsistensi (format nomor transaksi, nama field, dll) sebelum merge perubahan PRD |
| R-18 | `feature_flags` menumpuk ("flag debt") — 12 flag seed, tanpa tanggal cabut | Sedang | Rendah | Review kuartalan flag yang sudah 100% rollout; pertimbangkan kolom `target_removal_at` opsional |

---

*Lanjut ke: [`06-architecture.md`](./06-architecture.md) — Pola arsitektur, caching, circuit breaker, idempotency, dan Offline-First Architecture.*
