# 📋 PRD — Ngemiloh POS v4.1

![Status](https://img.shields.io/badge/Status-Draft-orange)
![Versi](https://img.shields.io/badge/Versi-4.1-blue)
![Tanggal](https://img.shields.io/badge/Tanggal-15%20Juni%202026-green)
![Stack](https://img.shields.io/badge/Stack-NestJS%20%7C%20SvelteKit%20%7C%20PostgreSQL%20%7C%20Redis-purple)
![Infra](https://img.shields.io/badge/Infra-Biznet%20Gio%20VPS-red)

---

## Cara Membaca PRD v4.1 Ini

Mulai v4.1, PRD **dipecah menjadi 16 file** (lihat [Peta Dokumen](#peta-dokumen) di bawah) plus folder `docs/decisions/` untuk Architecture Decision Records (ADR). Perubahan ini diambil karena v4.0 (1 file, 4.482 baris) sudah melewati ambang batas yang nyaman untuk dinavigasi maupun untuk *blast radius* satu kali edit.

Dokumen ini (`00-overview.md`) adalah **pintu masuk**: berisi changelog lengkap, peta seluruh dokumen, glosarium, dan ringkasan eksekutif. Setiap file lain merujuk balik ke sini untuk istilah & keputusan arsitektur tingkat tinggi.

> Dokumen kerja `REKOMENDASI_PRD_Ngemiloh_v4.1.md` (memo analisis A–P) adalah **working paper** yang menjadi dasar seluruh keputusan di v4.1. Setelah PRD v4.1 selesai, memo tersebut menjadi arsip/referensi historis — isinya sudah dipecah & ditempatkan ke file-file final di bawah.

---

## Peta Dokumen

| # | File | Isi | Status |
|---|------|-----|--------|
| 00 | `00-overview.md` | Changelog, Glosarium, Ringkasan Eksekutif, Peta Dokumen (file ini) | ✅ Selesai |
| 01 | `01-stakeholders-rbac.md` | Stakeholder, User Persona, Role & RBAC | ⏳ Tahap 7 |
| 02 | `02-business-rules.md` | Business Rules Master List (AUTH, SHIFT, TRX, PROD, DISC, HPP, RCPT, OFFL, GEN) | ⏳ Tahap 3 |
| 03 | `03-journeys-flows.md` | User Journey, App Flow & Navigasi | ⏳ Tahap 7 |
| 04 | `04-functional-reqs.md` | Functional Requirements (FR-*) seluruh modul | ⏳ Tahap 3 |
| 05 | `05-nonfunctional-reqs.md` | **(Baru)** NFR, SLA/SLO/Error Budget, DoR/DoD | ⏳ Tahap 2 |
| 06 | `06-architecture.md` | **(Baru)** Pola arsitektur, caching, circuit breaker, idempotency, Offline-First Architecture | ⏳ Tahap 2 |
| 07 | `07-database.md` | Skema final, ERD, seed data, Prisma schema | ⏳ Tahap 4 |
| 08 | `08-api-contract.md` | API Contract + tabel kode error | ⏳ Tahap 5 |
| 09 | `09-security.md` | Security Design + Threat Model (STRIDE ringkas) | ⏳ Tahap 5 |
| 10 | `10-testing.md` | Testing Strategy + kasus uji baru | ⏳ Tahap 5 |
| 11 | `11-deployment.md` | Infrastruktur & Deployment (rekonsiliasi dgn deployment guide) | ⏳ Tahap 6 |
| 12 | `12-monitoring.md` | Maintenance & Monitoring, log retention, postmortem | ⏳ Tahap 6 |
| 13 | `13-roadmap.md` | Sprint Roadmap / Fase Implementasi | ⏳ Tahap 7 |
| 14 | `14-risk-register.md` | Risk Register | ⏳ Tahap 7 |
| 15 | `15-appendix.md` | Pre-launch checklist, Tech Debt, Biaya, Kontak | ⏳ Tahap 7 |
| — | `docs/decisions/ADR-001..016` | Architecture Decision Records (1 file/ADR) | ⏳ Tahap 8 |

*(Penomoran "Tahap" mengacu pada rencana kerja N3 di memo rekomendasi.)*

---

## Changelog

| Versi | Tanggal | Penulis | Ringkasan Perubahan |
|-------|---------|---------|---------------------|
| v1.0 | — | — | Konsep awal POS sederhana |
| v2.0 | — | — | Penambahan fitur QRIS, laporan dasar |
| v3.0 | — | — | JWT auth, CSRF double submit cookie, 5 produk hardcode, PWA |
| v4.0 | 14 Juni 2026 | Tim Ngemiloh | Migrasi ke session-based auth (Redis), flexible payment flow, split payment, shift & kas management overhaul, BOM/HPP Fase 1B, scheduled price change, offline sync 2-layer retry, multi-kasir ready, responsive redesign, system health & logs, partisi otomatis, penghapusan PWA (diganti SW offline sync), CSRF diganti SameSite+Origin check |
| **v4.1** | **15 Juni 2026** | **Tim Ngemiloh + Review Konsistensi** | **Perbaikan 8 inkonsistensi internal v4.0 (lihat CR-001–008), pengisian gap struktural yang dijanjikan Daftar Isi v4.0 namun hilang (NFR, Arsitektur, Offline-First — CR-009–011), pemecahan dokumen menjadi 16 file + ADR terpisah (CR-014), serta sejumlah penyempurnaan testing/security/deployment terkalibrasi skala bisnis (CR-012–015)** |

### Detail Perubahan v4.0 → v4.1

1. **Konsistensi stack**: Seluruh referensi "Next.js" dikoreksi menjadi **SvelteKit** (sudah jadi keputusan final di ADR-002 v3.0, tapi badge & glosarium v4.0 belum terupdate).
2. **Nomor transaksi**: Section 10 (skema DB) & 11 (API contract) v4.0 sempat menyimpang ke format `K01-0042`. Dikoreksi kembali ke format yang **sudah benar sejak Glosarium & Business Rules v4.0**: `TRX-YYYYMMDD-[cashier_letter][seq3digit]`, contoh `TRX-20260612-A001`.
3. **Partisi tabel `orders` dihapus** untuk Fase 1–2. v4.0 punya kontradiksi bulanan-vs-tahunan; setelah dihitung ulang (≈36.500 baris/tahun untuk 1 outlet), partisi adalah *premature optimization* dan jadi sumber bug migration di deployment guide. Exit-criteria untuk partisi di masa depan didokumentasikan di ADR-005 (revisi).
4. **`outlet_id` dihapus** dari seluruh FR & skema (muncul di beberapa FR v4.0 tapi tidak ada di skema final/tabel `outlets`). Multi-outlet (Fase 3) akan ditambahkan via migration Expand-Contract saat dibutuhkan.
5. **Format response API** distandarkan mengikuti Section 11 v4.0 (object-direct untuk sukses + error envelope `{statusCode, error, message, details, timestamp, path}`) — lebih detail & sudah punya tabel kode error lengkap dibanding pola `{success,...}` generik di Section 9.
6. **Section baru — Non-Functional Requirements** (`05-nonfunctional-reqs.md`): dijanjikan di Daftar Isi v4.0 (sebagai bagian 10) tapi hilang total dari isi. Sekarang berisi target performa, availability, SLA/SLO/error budget, kapasitas, dan DoR/DoD yang dikalibrasi ke skala 1 outlet/1 VPS.
7. **Section baru — Arsitektur** (`06-architecture.md`): mendefinisikan pola Modular Monolith untuk backend NestJS (struktur folder per-domain), strategi caching eksplisit, circuit breaker Midtrans berbasis Redis, idempotency untuk endpoint pembayaran/void, dan **Offline-First Architecture** sebagai diagram & state machine formal (sebelumnya tersebar di business rules tanpa diagram terpadu — juga dijanjikan Daftar Isi v4.0 sebagai bagian 14, hilang dari isi).
8. **Database**: tambah kolom `discounts.max_discount`, tambah nilai enum `order_status = 'sync_failed'`, definisikan tabel `raw_materials`/`bom_items` sekarang (bukan ditunda "supplement Fase 1B"), Prisma schema diperbarui agar sinkron dengan skema final.
9. **Testing & Security**: tambah mini threat-model STRIDE untuk 4 flow kritis, mutation testing (Stryker) untuk modul pricing/diskon, 4 kasus uji baru (TC-17–20), Gitleaks di CI, pernyataan lingkup UU PDP, aksesibilitas minimal-viable, smoke test post-deploy otomatis.
10. **Struktur dokumen**: PRD dipecah dari 1 file menjadi 16 file tematik + `docs/decisions/` untuk ADR (1 file per ADR), mengikuti pola `/docs/` di panduan SDLC.

### CR Log v4.1 — Perbaikan Inkonsistensi Internal

| CR# | Perubahan | Alasan | Bagian Terdampak | Ref. ADR |
|-----|-----------|--------|-------------------|----------|
| CR-001 | Hapus referensi "Next.js", standar ke **SvelteKit** | Next.js sisa draft lama; SvelteKit sudah final di ADR-002 & seluruh deployment guide | 00 (glosarium, badge), 06 | ADR-002 (existing) |
| CR-002 | Koreksi Section 10/11 ke format nomor transaksi `TRX-YYYYMMDD-[Huruf][Seq3]` | Glosarium & Business Rules v4.0 sudah benar; Section 10/11 yang menyimpang | 02, 04, 07, 08 | ADR-016 |
| CR-003 | Hapus partisi tabel `orders` untuk Fase 1–2 | Volume data (~36.500 baris/th) tidak butuh partisi; menghindari bug migration Prisma | 04 (hapus FR-PART-01), 07, 13 | ADR-005 (revisi) |
| CR-004 | Hapus `outlet_id` dari seluruh FR & skema | Single-outlet saat ini; field menggantung tanpa tabel `outlets` | 04, 07 | — |
| CR-005 | Standarkan format response API ke pola Section 11 (object-direct + error envelope) | Section 11 lebih detail, sudah punya tabel kode error lengkap | 04 (update contoh output), 08 | ADR-015 |
| CR-006 | `settled_at` → `payment_settled_at` | Selaraskan nama field dengan kolom DB final | 04 | — |
| CR-007 | Rate limit `POST /orders` distandarkan ke **30/menit** (bukan 60) | Konsisten antar-bagian; 30/menit = 1 order/2 detik *sustained* sudah jauh di atas kapasitas input manual | 09 | — |
| CR-008 | Tambah kolom `discounts.max_discount` + CHECK constraint | Disebut di DISC-08 & API contract tapi hilang dari skema SQL | 07 | — |

### CR Log v4.1 — Penambahan Baru (Gap Struktural & Penyempurnaan)

| CR# | Perubahan | Alasan | Bagian Terdampak | Ref. ADR |
|-----|-----------|--------|-------------------|----------|
| CR-009 | Section baru: **Non-Functional Requirements** | Dijanjikan TOC v4.0 (bagian 10), hilang total dari isi | 05 (baru) | — |
| CR-010 | Section baru: **Arsitektur** (Modular Monolith, caching, circuit breaker, idempotency, Offline-First) | Dijanjikan TOC v4.0 (bagian 11 & 14), hilang dari isi | 06 (baru) | ADR-013, ADR-014 |
| CR-011 | Definisikan tabel `raw_materials`/`bom_items` sekarang | Hindari kejutan migration Fase 1B; ERD lengkap sebelum coding | 07 | — |
| CR-012 | Tambah kode error: `ORDER_ALREADY_VOIDED`, `QRIS_DEGRADED`, `DISCOUNT_EXCEEDS_SUBTOTAL`, `SHIFT_NOT_OPEN` | Melengkapi tabel kode error utk skenario yang sudah dibahas tapi belum punya kode | 08 | — |
| CR-013 | Tambah nilai enum `order_status = 'sync_failed'` | OFFL-04 sudah menyebut state ini, belum ada di skema | 04, 07 | — |
| CR-014 | PRD dipecah 1 file (4.482 baris) → 16 file + folder ADR | Maintainability — 1 file melewati ambang batas navigasi & blast-radius edit | Struktur dokumen | — |
| CR-015 | Tambahan terkalibrasi: threat model STRIDE ringkas, mutation testing pricing, idempotency lock pembayaran/void, smoke test post-deploy, Gitleaks di CI, pernyataan lingkup UU PDP, a11y minimal-viable, log retention formal, postmortem template, CR-log (pola dokumen ini) | Mengisi gap panduan SDLC, dikalibrasi ke skala 1 outlet/1 VPS — bukan disalin mentah | 06, 08, 09, 10, 11, 12 | ADR-014, ADR-015 |

---

## Item yang Diasumsikan / Perlu Konfirmasi

Beberapa keputusan di v4.1 diambil berdasarkan **mayoritas bukti** di dalam dokumen v4.0 sendiri (lihat memo Bagian O). Berikut yang masih ditandai terbuka — koreksi kapan saja, perubahannya hanya berdampak lokal (nama/kontak), tidak mengubah arsitektur:

| # | Item | Asumsi yang Dipakai di v4.1 | Bukti Pendukung | Cara Koreksi |
|---|------|------------------------------|------------------|----------------|
| OPEN-01 | Identitas Owner/Superadmin: **"Nabilah"** vs **"Arif"** | Distandarkan ke **Nabilah** sebagai nama persona Owner/Superadmin di seluruh dokumen (`01-stakeholders-rbac.md`, seed data `07-database.md`, kontak `15-appendix.md`). Email tetap `nabilah.fnb@gmail.com`. | "Nabilah" muncul konsisten di Stakeholder (4.1), Persona (4.2), Email Bisnis (3.4), & Asumsi (3.5) — 4 lokasi independen. "Arif" hanya di seed data (10.20) & Appendix kontak — 2 lokasi, kemungkinan sisa draft/placeholder dev. | Jika "Arif" adalah co-owner/admin teknis riil (bukan kesalahan), beri tahu — saya tambahkan sebagai *Persona 2* terpisah (mis. "Arif — Admin Teknis") di `01-stakeholders-rbac.md` & sebagai akun superadmin kedua di seed data, **tanpa** mengubah Nabilah. |
| OPEN-02 | Bagi hasil owner/kasir **60/40** | Dipertahankan apa adanya sebagai nilai default di `settings` seed (`07-database.md`) — tidak diubah, hanya dikonfirmasi masih berlaku. | Konsisten di seed data & roadmap v4.0. | Jika sudah berubah, beri tahu nilai baru — saya update di seed + `13-roadmap.md`. |
| OPEN-03 | Progres domain & status Midtrans production | Diasumsikan **belum ada perubahan** (domain belum dibeli, Midtrans masih sandbox) — placeholder `{domain}` & status sandbox dipertahankan. | Sesuai 3.4/3.5 v4.0. | Jika sudah ada domain riil atau Midtrans sudah production, beri tahu — saya update `00` (3.4), `11-deployment.md`, dan checklist migrasi production di `15-appendix.md`. |

---

## Glosarium

| Istilah | Definisi |
|---------|----------|
| **POS** | Point of Sale — sistem titik penjualan digital untuk memproses transaksi di warung jajanan. |
| **Superadmin** | Pemilik usaha (owner) yang memiliki akses penuh ke dashboard admin, manajemen produk, laporan, dan konfigurasi sistem. Superadmin juga dapat login ke POS sebagai backup kasir. |
| **Kasir** | Operator POS yang menangani transaksi penjualan harian. Login menggunakan PIN unik. |
| **Shift** | Periode kerja kasir, dimulai saat login + input kas awal dan berakhir saat tutup shift. Satu hari dapat memiliki lebih dari satu shift. |
| **Kas Awal** | Modal uang tunai yang diinput oleh kasir sebelum memulai transaksi pada shift tersebut. Bisa berasal dari input manual (shift pertama hari itu) atau carry-over otomatis dari shift sebelumnya. |
| **Carry-Over** | Mekanisme otomatis membawa saldo penutupan (closing balance) shift sebelumnya menjadi kas awal shift berikutnya. Kasir tidak boleh mengubah nilai carry-over. |
| **Closing Balance** | Saldo kas akhir shift, dihitung dari kas awal + total penjualan tunai − pengeluaran. |
| **Auto-Close** | Mekanisme penutupan shift otomatis berdasarkan waktu yang direncanakan kasir (`planned_close_at`) ditambah buffer 1 jam. |
| **Session** | Mekanisme autentikasi berbasis server-side session yang disimpan di Redis. Session kasir tidak memiliki batas waktu (berakhir saat logout/tutup shift); session superadmin expire 24 jam. |
| **Session ID** | Identifier unik yang di-generate server dan disimpan dalam HTTP-only cookie. Digunakan untuk mengidentifikasi session pengguna. |
| **Redis** | In-memory data store untuk session, cache, rate-limit counter, circuit breaker state, dan message broker BullMQ. |
| **SameSite=Strict** | Atribut cookie yang mencegah browser mengirim cookie pada cross-site request, menggantikan mekanisme CSRF token. |
| **Origin Header Check** | Validasi server-side yang memastikan header `Origin` pada request sesuai domain yang diizinkan. Dipakai bersama `SameSite=Strict`. |
| **RBAC** | Role-Based Access Control — sistem kontrol akses berdasarkan peran pengguna (superadmin atau kasir). |
| **QRIS** | Quick Response Code Indonesian Standard — standar pembayaran digital nasional menggunakan QR code. |
| **Midtrans** | Payment gateway untuk memproses pembayaran QRIS. Status: sandbox aktif, production belum aktif. |
| **Flexible Payment** | Mekanisme di mana order dibuat terlebih dahulu tanpa metode pembayaran. Kasir memilih cara bayar setelah order terbentuk. Metode bisa diubah selama `payment_status = 'pending'`. |
| **Split Payment** | Pembayaran campuran tunai dan QRIS dalam satu transaksi. |
| **Order Status** | Status siklus hidup pesanan: `completed`, `voided`, `cancelled`, `pending_sync`, **`sync_failed`** (baru di v4.1 — lihat CR-013 & `06-architecture.md`). |
| **Payment Status** | Status pembayaran pesanan: `pending`, `settled`, `expired`, `failed`. |
| **Void** | Pembatalan transaksi yang sudah selesai oleh superadmin, dengan defense-in-depth constraint (validasi di level DB + NestJS) dan dilindungi idempotency lock (`06-architecture.md`). |
| **BOM** | Bill of Materials — daftar bahan baku & komposisi yang dibutuhkan untuk membuat satu unit produk. Lihat juga `raw_materials`/`bom_items` di `07-database.md`. |
| **HPP** | Harga Pokok Penjualan — biaya langsung untuk memproduksi satu unit produk. |
| **hpp_source** | Enum sumber perhitungan HPP: `manual_estimate` atau `bom_calculated`. |
| **estimated_hpp** | Nilai HPP estimasi manual sebagai fallback sebelum BOM tersedia (Fase 1A). |
| **FIFO** | First In, First Out — metode valuasi inventaris bahan baku. |
| **Bagi Hasil** | Mekanisme pembagian keuntungan owner & kasir. Default 60/40 (lihat OPEN-02). Untuk multi-kasir, proporsi dihitung dari jumlah transaksi masing-masing kasir. |
| **Modifier** | Variasi/tambahan pada produk (level pedas, topping, ukuran). Setiap modifier group wajib punya opsi "Tanpa [X]" (harga Rp 0). |
| **Modifier Group** | Kelompok modifier terkait, bisa wajib (required) atau opsional. |
| **Scheduled Price Change** | Perubahan harga terjadwal via `new_base_price` + `new_price_effective_from` (minimal H+1), dieksekusi cron BullMQ. |
| **Bitmask** | Teknik bitwise untuk menyimpan multiple boolean dalam satu integer — dipakai untuk `applicable_days` diskon (1=Sen … 64=Min). |
| **IndexedDB** | Database sisi browser untuk menyimpan data transaksi offline (full cart detail) sebelum sinkronisasi. |
| **Service Worker** | Script background browser untuk offline data sync. Bukan PWA — hanya sinkronisasi data. |
| **2-Layer Retry** | Strategi retry sinkronisasi offline: Layer 1 = 3 percobaan (5s/15s/45s); Layer 2 = setiap 5 menit maks. 2 jam. Diagram state machine lengkap di `06-architecture.md`. |
| **Dual Timestamp** | `client_created_at` (waktu pembuatan di client, dipakai laporan keuangan) & `synced_at` (waktu sinkronisasi server, dipakai kas register). |
| **Partisi (Tabel `orders`)** | Teknik pembagian tabel berdasarkan rentang waktu. **Tidak diimplementasikan di v4.1** (lihat CR-003) — exit criteria & rencana implementasi masa depan didokumentasikan di ADR-005 (revisi). |
| **BullMQ** | Library job queue berbasis Redis. Dipakai untuk: scheduled price change, auto-close shift, backup harian, pembersihan log lama (`12-monitoring.md`). |
| **Caddy** | Web server/reverse proxy — serving API NestJS dan static build SvelteKit, serta foto produk. |
| **Sharp** | Library Node.js untuk kompres foto produk ke WebP 600×600, maks 500KB. |
| **WebP** | Format gambar terkompresi untuk foto produk. |
| **VPS** | Virtual Private Server — Biznet Gio Cloud. |
| **WIB** | Waktu Indonesia Barat (UTC+7), hardcode untuk seluruh tampilan UI. Database menyimpan UTC. |
| **Rate Limiting** | Pembatasan jumlah request per endpoint per satuan waktu, per-session (bukan global) — lihat `09-security.md`. |
| **Defense-in-Depth** | Strategi keamanan berlapis — validasi di multiple level (database constraint + application logic). |
| **Preset Nominal** | Tombol nominal uang siap pakai (5K/10K/20K/50K/100K) untuk input tunai, dapat dikustomisasi dari settings. |
| **NestJS** | Framework backend Node.js untuk API server. |
| **SvelteKit** | Framework frontend (mode `adapter-static`) untuk UI POS & dashboard admin — di-serve sebagai static file oleh Caddy. *(v4.1: menggantikan referensi "Next.js" yang keliru — lihat CR-001)* |
| **PostgreSQL** | Database relasional utama. |
| **Nomor Transaksi** | Identifier unik transaksi format `TRX-YYYYMMDD-[cashier_letter][seq3digit]`, contoh `TRX-20260612-A001`. `cashier_letter` = huruf unik A–Z per kasir (FR-CSH-01); `seq` = urutan harian per kasir, reset tiap hari, 3 digit (001–999). Berfungsi sekaligus sebagai nomor antrian pelanggan. *(v4.1: format diseragamkan — lihat CR-002, ADR-016)* |
| **Modular Monolith** | Pola arsitektur backend v4.1: satu aplikasi NestJS, dipecah jadi modul per-domain bisnis (auth, shift, orders, products, dst), tanpa overhead microservices. Detail di `06-architecture.md` (ADR-013). |
| **Circuit Breaker (Midtrans)** | Mekanisme deteksi gangguan Midtrans via counter Redis — jika ≥3 kegagalan QRIS dalam 5 menit, sistem menandai QRIS "degraded" sementara & menyarankan tunai. Detail di `06-architecture.md` (ADR-014). |
| **Idempotency Lock** | Penguncian baris (`SELECT ... FOR UPDATE`) pada `orders` saat proses pembayaran/void, untuk mencegah double-processing akibat double-tap. Detail di `06-architecture.md`. |
| **SLO / Error Budget** | Service Level Objective & anggaran downtime yang diizinkan (99.5%/bulan ≈ 3,6 jam). Detail di `05-nonfunctional-reqs.md`. |
| **STRIDE** | Framework klasifikasi ancaman keamanan (Spoofing, Tampering, Repudiation, Information Disclosure, Denial of Service, Elevation of Privilege) — dipakai untuk mini threat-model 4 flow kritis di `09-security.md`. |
| **ADR** | Architecture Decision Record — dokumen 1-halaman per keputusan arsitektur penting, disimpan di `docs/decisions/`. |

---

## Ringkasan Eksekutif

### Latar Belakang

Ngemiloh adalah bisnis warung jajanan yang memerlukan sistem POS digital untuk mengelola operasional penjualan harian. Sistem dioperasikan oleh kasir di outlet dan dimonitor oleh superadmin (owner) melalui dashboard admin.

Versi 4.1 adalah **revisi konsistensi & pelengkap** dari v4.0 — bukan perubahan keputusan bisnis besar. Fokusnya:
- **Konsistensi internal**: menghilangkan 8 kontradiksi yang ditemukan saat review (lihat CR-001–008).
- **Kelengkapan struktural**: mengisi 2 bagian yang dijanjikan Daftar Isi v4.0 tapi hilang total dari isi — Non-Functional Requirements & Arsitektur/Offline-First (CR-009–010).
- **Maintainability dokumen**: memecah 1 file raksasa menjadi 16 file tematik + ADR terpisah (CR-014), agar PRD sendiri tidak menjadi technical debt.
- **Kalibrasi, bukan kepatuhan buta**: setiap rekomendasi dari panduan SDLC dievaluasi terhadap skala riil bisnis (1 outlet, 1 VPS 4.44GB, tim 1–2 developer) — sebagian diadopsi penuh, sebagian disederhanakan, sebagian eksplisit dinyatakan "out of scope" dengan alasan (lihat `05-nonfunctional-reqs.md` & `09-security.md`).

### Tujuan Produk

| # | Tujuan | Metrik Keberhasilan |
|---|--------|---------------------|
| 1 | Memproses seluruh transaksi penjualan harian secara digital | 100% transaksi tercatat di sistem (online atau offline-sync) |
| 2 | Mendukung pembayaran tunai dan QRIS (termasuk split payment) | Seluruh metode pembayaran dapat diproses tanpa error |
| 3 | Menyediakan laporan keuangan harian yang akurat dan real-time | Selisih laporan vs kas fisik < Rp 1.000 |
| 4 | Menjamin keberlangsungan operasional saat koneksi internet terputus | Transaksi offline tersinkronisasi 100% saat koneksi pulih |
| 5 | Memberikan visibilitas penuh kepada owner atas performa bisnis | Dashboard menampilkan revenue, HPP, profit margin, dan bagi hasil |
| 6 | Mendukung manajemen produk yang fleksibel oleh owner | Owner dapat menambah/edit/arsip > 20 produk beserta modifier dan harga terjadwal |
| 7 | Menjamin akuntabilitas kas melalui sistem shift yang ketat | Setiap shift memiliki kas awal, kas akhir, dan rekonsiliasi yang tercatat |
| 8 | Siap untuk skalabilitas multi-kasir dan multi-outlet | Arsitektur mendukung penambahan kasir tanpa refactor; multi-outlet via migration terdokumentasi (ADR, lihat CR-004) |

### Keputusan Arsitektur Utama (v4.1)

| Keputusan | Dipilih | Alasan | Status v4.1 |
|-----------|---------|--------|-------------|
| Autentikasi | Session-based (Redis) | Lebih sederhana dari JWT; session bisa di-invalidate langsung dari server | Tetap (v4.0) |
| CSRF Protection | `SameSite=Strict` + Origin header check | Cukup aman untuk single-domain deployment | Tetap (v4.0) |
| **Frontend Framework** | **SvelteKit (`adapter-static`)** | Bundle kecil, tanpa Node server tambahan — Caddy serve static langsung, cocok VPS 4.44GB RAM | **Diperjelas v4.1 (CR-001)** |
| Payment Flow | Flexible (order first, pay later) | Sesuai kebutuhan operasional riil di lapangan | Tetap (v4.0) |
| Foto Storage | VPS lokal (Caddy static) | Cukup untuk ~70 foto produk, hemat biaya cloud storage | Tetap (v4.0) |
| Image Processing | Sharp → WebP 600×600, maks 500KB | Optimal kecepatan loading & disk usage | Tetap (v4.0) |
| Job Queue | BullMQ (Redis) | Redis sudah ada untuk session, BullMQ terintegrasi natural | Tetap (v4.0) |
| **Database Partitioning** | **Tidak dipartisi (Fase 1–2)** | ~36.500 baris/tahun tidak butuh partisi; exit criteria didokumentasikan untuk Fase 3+ | **Diubah v4.1 (CR-003, ADR-005 revisi)** |
| **Pola Arsitektur Backend** | **Modular Monolith** (modul per-domain) | Tim kecil, domain CRUD-heavy, timeline ketat — Clean Architecture penuh berlebihan | **Baru v4.1 (CR-010, ADR-013)** |
| **Format Response API** | Object-direct (sukses) + error envelope `{statusCode, error, message, details, timestamp, path}` | Lebih informatif dari pola `{success,...}` generik; sudah punya tabel kode error lengkap | **Diperjelas v4.1 (CR-005, ADR-015)** |
| **Circuit Breaker Midtrans** | Redis counter-based (ringan) | Re-use infrastruktur existing (Redis, feature flag, email alert) — tanpa library baru | **Baru v4.1 (CR-010, ADR-014)** |
| Timezone | Hardcode Asia/Jakarta (WIB) | Single-timezone business | Tetap (v4.0) |

### Infrastruktur

| Komponen | Spesifikasi |
|----------|-------------|
| VPS Provider | Biznet Gio Cloud |
| IP VPS | 103.150.227.117 |
| RAM | 4.44 GB |
| vCPU | 4 core |
| Disk | 60 GB |
| OS | Ubuntu 24.04 LTS |
| Biaya | Rp 210.000/bulan |
| Domain | Belum ada — akan dibeli sendiri. Sistem dirancang fleksibel untuk domain apapun (lihat OPEN-03). |
| Email Bisnis | nabilah.fnb@gmail.com |
| Midtrans | Sandbox aktif, production belum aktif (lihat OPEN-03) |
| Web Server | Caddy (reverse proxy + static file serving) |
| Database | PostgreSQL (latest stable) |
| Cache & Session Store | Redis (latest stable) |
| Runtime | Node.js (LTS) |

### Batasan & Asumsi

**Batasan:**
- Single VPS deployment (bukan distributed/cloud-native).
- Satu outlet aktif saat ini; arsitektur siap multi-outlet via migration terdokumentasi saat dibutuhkan (lihat CR-004).
- 1 kasir aktif saat ini (arsitektur siap multi-kasir dari awal).
- Midtrans production belum aktif — QRIS baru bisa diuji di sandbox.
- Domain belum tersedia — pengembangan dan testing menggunakan IP langsung.
- Maksimal ~70 foto produk (constraint disk space VPS).
- **Tabel `orders` tidak dipartisi** — akan direvisit jika tabel >5 juta baris ATAU P95 query laporan bulanan >500ms (lihat `05-nonfunctional-reqs.md` & ADR-005 revisi).

**Asumsi:**
- Kasir menggunakan perangkat dengan browser modern (Chrome/Edge/Firefox terbaru), Android 9+ RAM 2–3GB.
- Koneksi internet tersedia sebagian besar waktu operasional (offline adalah fallback, bukan mode utama).
- Owner memiliki akses ke email nabilah.fnb@gmail.com untuk notifikasi dan reset password.
- Setiap kasir memiliki perangkat sendiri untuk mengakses POS.
- Jam operasional warung bervariasi, sehingga sistem shift harus fleksibel.
- ~50–150 transaksi/hari (1 outlet) — dasar seluruh kalkulasi kapasitas & NFR di `05-nonfunctional-reqs.md`.

---

*Lanjut ke: [`05-nonfunctional-reqs.md`](./05-nonfunctional-reqs.md) (Tahap 2) — atau lihat [Peta Dokumen](#peta-dokumen) untuk navigasi lengkap.*
