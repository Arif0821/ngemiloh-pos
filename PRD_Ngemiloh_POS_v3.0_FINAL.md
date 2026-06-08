# 📋 PRD — Internal POS & Management System
## Ngemiloh F&B · Versi 3.0 FINAL

![Status](https://img.shields.io/badge/Status-APPROVED%20%E2%80%94%20SIAP%20CODING-brightgreen)
![Version](https://img.shields.io/badge/Versi-3.0%20FINAL-blue)
![Stack](https://img.shields.io/badge/Stack-NestJS%20%7C%20SvelteKit%20%7C%20PostgreSQL-informational)
![Updated](https://img.shields.io/badge/Updated-1%20Juni%202026-orange)

> **Single Source of Truth** — Dokumen ini adalah panduan definitif seluruh sistem POS Ngemiloh.  
> Semua keputusan teknis dan bisnis **sudah final dan dikunci**. Perubahan hanya via proses Change Request (CR) formal.

---

## 📑 Daftar Isi

| # | Seksi | Keterangan |
|---|-------|-----------|
| — | [Changelog](#changelog) | Riwayat versi |
| — | [Glosarium](#glosarium) | Istilah teknis A–Z |
| 1 | [Ringkasan Eksekutif](#1-ringkasan-eksekutif) | Konteks bisnis & sistem |
| 2 | [Stakeholder & Persona](#2-stakeholder--user-persona) | Siapa yang menggunakan |
| 3 | [Role & RBAC](#3-sistem-role--rbac) | Hak akses 2 role |
| 4 | [Business Rules](#4-business-rules-master-list) | 24 aturan bisnis terkunci |
| 5 | [User Journey](#5-user-journey) | Alur kerja kasir & superadmin |
| 6 | [App Flow](#6-app-flow--navigasi) | Peta navigasi lengkap |
| 7 | [Functional Requirements](#7-functional-requirements) | 60+ kebutuhan fungsional |
| 8 | [Non-Functional Requirements](#8-non-functional-requirements) | Performa, keandalan, keamanan |
| 9 | [Tech Stack](#9-tech-stack-final) | 17 teknologi terkunci |
| 10 | [Database Schema](#10-database-schema-final) | 20 tabel + index + constraints |
| 11 | [API Contract](#11-api-contract-final) | 30+ endpoint REST |
| 12 | [Infrastruktur](#12-infrastruktur--deployment) | Docker, CI/CD, backup |
| 13 | [Security Design](#13-security-design) | Auth, PIN, webhook |
| 14 | [Sprint Roadmap](#14-sprint-roadmap) | 14 hari soft launch + 5 bulan |
| 15 | [Testing Strategy](#15-testing-strategy) | Unit, E2E, load test |
| 16 | [Risk Register](#16-risk-register) | 12 risiko + mitigasi |
| 17 | [ADR](#17-architecture-decision-records) | 6 keputusan arsitektur |
| 18 | [Appendix](#18-appendix) | Checklist + Technical Debt |

---

## Changelog

| Versi | Tanggal | Perubahan Utama |
|-------|---------|----------------|
| v1.0 | Mei 2026 | PRD awal: NFR, API Contract, Security, Testing, Risk Register |
| v2.0 | Mei 2026 | Revisi: 2 role, QRIS foto, diskon, analytics, bagi hasil |
| v2.1 | Mei 2026 | Implementasi komentar v2.0, 26 bahan baku, Bluetooth printer |
| **v3.0** | **1 Jun 2026** | **FINAL: Modifier system, split payment, FIFO, feature flags, ADR, sprint roadmap 14 hari, glosarium, full service stack, formula diskon Opsi A, DB schema v3** |

---

## Glosarium

| Istilah | Definisi |
|---------|---------|
| **ACID** | Atomicity, Consistency, Isolation, Durability — properti integritas transaksi database |
| **ADR** | Architecture Decision Record — dokumen keputusan arsitektur beserta konteks dan alasan |
| **adapter-static** | SvelteKit build mode menghasilkan file HTML/CSS/JS statis — tidak butuh Node.js container |
| **Base Price** | Harga dasar produk sebelum modifier. Diskon dihitung HANYA dari base price (Opsi A) |
| **Bcrypt** | Algoritma hashing satu arah untuk PIN dan password. Cost factor = 12 di production |
| **BOM** | Bill of Materials — daftar bahan baku + takaran per porsi produk |
| **Break-even** | Titik impas revenue minimum. Ngemiloh: **Rp 84.500/hari** |
| **BullMQ** | Library job queue berbasis Redis untuk async processing di Node.js |
| **BYOD** | Bring Your Own Device — kasir pakai HP Android pribadi untuk POS |
| **Caddy** | Reverse proxy modern dengan HTTPS otomatis via Let's Encrypt |
| **CI/CD** | Continuous Integration/Deployment — GitHub Actions: push → test → deploy otomatis |
| **Clean Architecture** | Pola arsitektur: Domain → Application → Infrastructure → Presentation |
| **Coolify** | PaaS open-source self-hosted untuk manage Docker container di VPS |
| **ESC/POS** | Protokol printer thermal receipt standard. Digunakan via Web Bluetooth API |
| **FC%** | Food Cost Percentage = (HPP ÷ Harga Jual) × 100%. Target Ngemiloh: GM 30–60% |
| **Feature Flag** | Toggle on/off fitur tanpa redeploy. Superadmin kelola dari dashboard |
| **FIFO Costing** | First In First Out — harga batch pertama masuk digunakan untuk HPP |
| **Foodpail** | Kemasan kotak jajanan. Rp 1.450/pcs (Rp 14.500/ikat 10 pcs) |
| **GRN** | Goods Receipt Note — pencatatan penerimaan bahan baku dari supplier |
| **HPP** | Harga Pokok Penjualan — total biaya bahan baku per unit produk |
| **Idempotency** | Operasi yang sama dijalankan berkali-kali → hasil sama. `client_uuid` menjamin ini |
| **IndexedDB** | Database NoSQL built-in browser untuk menyimpan antrian transaksi offline |
| **JWT** | JSON Web Token — token auth. Disimpan di HttpOnly Cookie (8 jam) |
| **Laba Bersih** | Revenue − HPP − Opex − Depresiasi. Basis bagi hasil Owner 60% / Kasir 40% |
| **MDR** | Merchant Discount Rate. QRIS Midtrans: **0%** untuk transaksi ≤ Rp 500K (merchant mikro) |
| **Modifier** | Pilihan varian produk yang mengubah komposisi dan harga. Contoh: bumbu + saus |
| **NIB** | Nomor Induk Berusaha dari OSS. Diperlukan untuk daftar merchant Midtrans |
| **Opex** | Operational Expenses — biaya tetap bulanan: sewa, listrik, gas, kemasan |
| **PgBouncer** | Connection pooler PostgreSQL. Daur ulang koneksi idle |
| **PIN** | 4 digit kode kasir. Bcrypt cost=12 + pepper sebelum disimpan ke DB |
| **PPh Final UMKM** | **Tidak berlaku** untuk Ngemiloh — omset < Rp 500 juta/tahun (PP 55/2022) |
| **QRIS** | Quick Response Code Indonesian Standard. Implementasi via Midtrans |
| **RBAC** | Role-Based Access Control. Ngemiloh: 2 role (kasir, superadmin) |
| **Redis** | In-memory DB untuk cache, BullMQ queue, rate limit, token blacklist |
| **Settlement** | Transfer dana dari Midtrans ke rekening bank merchant (T+1 atau T+2) |
| **SLA** | Service Level Agreement. Uptime target: **99.5%/bulan** |
| **Soft Launch** | Buka bisnis dengan fitur minimal, upgrade bertahap. Target: **14 hari** |
| **Split Payment** | Satu transaksi dibayar sebagian tunai + sebagian QRIS |
| **SSE** | Server-Sent Events — push notifikasi server→browser untuk QRIS sukses |
| **Technical Debt** | Shortcut teknis yang sengaja diambil, harus di-refactor nanti |
| **UUID v4** | Primary key format. 36 karakter unik global via `gen_random_uuid()` |
| **Void** | Pembatalan transaksi sukses. Tidak hapus data, hanya ubah status ke `voided` |
| **VPS** | Virtual Private Server. Ngemiloh: **4GB RAM, 4 vCPU, 60GB SSD** |
| **Webhook** | HTTP POST otomatis dari Midtrans ke server saat pembayaran berhasil |
| **Yield Factor** | Faktor penyusutan bahan baku. Ngemiloh: **100%** (tidak ada penyusutan signifikan) |

---

## 1. Ringkasan Eksekutif

### Konteks Bisnis

| Aspek | Detail |
|-------|--------|
| **Tipe Bisnis** | Franchise/mitra jajanan. Arif = mitra pemegang outlet, bukan pemilik Ngemiloh Pusat |
| **Produk** | 5 produk: Macaroni Mateng, Basreng, Mie Kremes, Tempe Goreng, Pilus. Setiap produk: berbagai varian bumbu + saus |
| **Bahan Baku** | 26 item dari Ngemiloh Pusat. Harga bisa berubah sewaktu-waktu |
| **Tim** | 1 Superadmin (owner = Arif) + 1 Kasir (freelance). Bagi hasil: Owner 60% / Kasir 40% |
| **Keuangan** | Target Rp 500K/hari. Break-even Rp 84.500/hari. Rekening bisnis: Bank Jago |
| **Halal** | Sertifikat Halal MUI sudah ada. Ditampilkan di struk transaksi |
| **Go-Live** | Soft Launch **14 hari**. Full system **5 bulan** |

### Filosofi Sistem

> **Kasir tidak boleh terhenti karena masalah jaringan.**  
> Sistem dirancang untuk selalu menerima transaksi — online maupun offline.  
> Kasir: kecepatan & simplicity. Superadmin: visibilitas data & kontrol keuangan.

### Quick Decisions Summary

```
✅ Formula diskon    : Opsi A — dari base price saja (modifier TIDAK terkena diskon)
✅ Metode bayar      : Tunai · QRIS (Midtrans) · Split Payment
✅ Modifier system   : Popup varian bumbu+saus, harga berbeda per kombinasi
✅ 2 Role saja       : Kasir (PIN 4 digit) + Superadmin (email+password ≥16 karakter)
✅ Bagi hasil        : Owner 60% / Kasir 40% dari laba bersih, dibayar tgl 1-5 bulan
✅ PPh Final UMKM    : TIDAK berlaku (omset < Rp 500 juta/tahun — PP 55/2022)
✅ Break-even        : Rp 84.500/hari
✅ VPS               : 4GB RAM — IDCloudHost/Vultr ~Rp 250K/bulan
✅ Notifikasi        : Email via Nodemailer (gratis)
✅ 2FA               : Tidak (accepted risk — kompensasi password ≥16 karakter)
```

---

## 2. Stakeholder & User Persona

### Persona 1 — Kasir

| Atribut | Detail |
|---------|--------|
| **Status** | Freelance — 1 orang aktif |
| **Perangkat** | HP Android pribadi (BYOD), RAM 2–4GB, Android 9+, koneksi WiFi/seluler |
| **Goals** | Proses transaksi < 5 detik, tidak lemot, tetap bisa offline, cetak struk mudah |
| **Pain Points** | Sinyal tidak stabil, aplikasi ribet, antrean panjang |
| **Ekspektasi UI** | Tombol besar ≥44×44px, foto produk jelas, popup varian mudah, haptic feedback |

### Persona 2 — Superadmin (Owner / Arif)

| Atribut | Detail |
|---------|--------|
| **Perangkat** | Laptop untuk analisis, HP untuk monitoring cepat |
| **Goals** | P&L harian, bagi hasil akurat, verifikasi QRIS, kelola produk+diskon, pantau keuangan |
| **Pain Points** | Tidak tahu margin, tidak bisa pantau dari jauh, laporan manual rawan error |
| **Ekspektasi UI** | Grafik P&L harian, filter fleksibel, export CSV, toggle feature flags |

---

## 3. Sistem Role & RBAC

> ⚠️ **FINAL & LOCKED** — Hanya 2 role. Tidak ada role Admin terpisah.

### Metode Login

| Role | Login | Kredensial |
|------|-------|-----------|
| **KASIR** | Hanya `/pos` | 4 digit PIN → Bcrypt cost=12 + pepper |
| **SUPERADMIN** | Hanya `/admin/*` | Email + Password ≥16 karakter (angka + huruf kapital + simbol) |

### Permission Matrix

| Fitur | Kasir | Superadmin |
|-------|-------|-----------|
| Login POS (PIN) | ✅ | ✅ |
| Login Dashboard (email) | ❌ | ✅ |
| Proses transaksi (tunai/QRIS/split) | ✅ | ❌ |
| Cetak struk Bluetooth | ✅ | ❌ |
| Lihat riwayat transaksi | ✅ Hari ini | ✅ Semua waktu |
| Lihat P&L / laporan keuangan | ❌ | ✅ |
| Void transaksi | ❌ | ✅ |
| CRUD Produk + Modifier | ❌ | ✅ |
| Buat/edit diskon | ❌ | ✅ |
| Analytics & bagi hasil | ❌ | ✅ |
| Input biaya operasional | ❌ | ✅ |
| Toggle feature flags | ❌ | ✅ |
| Lihat audit log | ❌ | ✅ |
| Reset PIN kasir | ❌ | ✅ |
| Kelola settings sistem | ❌ | ✅ |

---

## 4. Business Rules Master List

### Keuangan

| ID | Rule | Detail |
|----|------|--------|
| **BR-K01** | Formula harga item | `final_price = (base_price − discount_from_base) + sum(modifier_additional_prices)` |
| **BR-K02** | Diskon PERCENTAGE | `discount_amount = base_price × (discount_value ÷ 100)` — tidak berlaku untuk modifier |
| **BR-K03** | Diskon FIXED | `discount_amount = min(discount_value, base_price)` — tidak melebihi base price |
| **BR-K04** | Subtotal | `subtotal = final_price × quantity` — disimpan eksplisit di DB |
| **BR-K05** | Laba bersih | `Laba Bersih = Revenue − HPP − Opex − Depresiasi` |
| **BR-K06** | Bagi hasil owner | `Porsi Owner = Laba Bersih × 60%` |
| **BR-K07** | Bagi hasil kasir | `Porsi Kasir = Laba Bersih × 40%` (1 kasir = terima seluruh 40%) |
| **BR-K08** | Periode bagi hasil | Dihitung akhir bulan. Dibayar **tanggal 1–5 bulan berikutnya** |
| **BR-K09** | Bagi hasil saat rugi | Laba Bersih ≤ 0 → notifikasi superadmin → owner bayar kasir secara kebijaksanaan |
| **BR-K10** | PPh Final UMKM | **Tidak berlaku** — omset < Rp 500 juta/tahun (PP 55/2022) |
| **BR-K11** | Depresiasi aset | Garis lurus: `Depresiasi/bulan = Nilai Aset ÷ Umur Pakai (bulan)`. Booth = Rp 0 |
| **BR-K12** | Valuasi stok | **FIFO Costing** — harga batch pertama untuk HPP |

### Operasional

| ID | Rule | Detail |
|----|------|--------|
| **BR-O01** | QRIS offline | TIDAK bisa. UI wajib tampilkan pesan dan arahkan ke tunai |
| **BR-O02** | Split payment | `cash_amount + qris_amount = total_amount` — DB CHECK constraint wajib |
| **BR-O03** | Void QRIS refund | Refund manual tunai dari kas. Sistem catat `refund_method` dan `refund_at` |
| **BR-O04** | Minimum QRIS | Konfirmasi ke Midtrans saat daftar. Default sistem: Rp 1.000 |
| **BR-O05** | Diskon tumpuk | 2+ diskon aktif untuk 1 produk → ambil nilai **TERBESAR**. Tidak kumulatif |
| **BR-O06** | Stock opname | Mingguan oleh owner. Sistem menyediakan fitur input fisik (Fase 2) |
| **BR-O07** | Kas awal shift | Kasir input nominal kas awal (default Rp 500.000) saat mulai shift |
| **BR-O08** | Setor kas | Setiap 2–3 hari. Sistem akumulasi kas, bukan hanya harian |
| **BR-O09** | Void transaksi | Hanya superadmin. Alasan min 10 karakter. Konfirmasi 2 langkah. Alert email >3 void/10 menit |
| **BR-O10** | Produk nonaktif | Tidak tampil di POS. Hard delete DILARANG jika sudah ada di `order_items` |
| **BR-O11** | Harga historis | Perubahan harga tidak mempengaruhi laporan lama. `price_at_time` di `order_items` |
| **BR-O12** | Retensi data | **3 tahun** real-time. Setelah 3 tahun: export CSV → archive dari DB aktif |

---

## 5. User Journey

### Skenario A — Kasir Melayani Pelanggan

| Step | Trigger | Aksi Kasir | Respons Sistem |
|------|---------|-----------|---------------|
| 1 | Mulai shift | Login dengan PIN 4 digit | Validasi → redirect POS. Indikator koneksi muncul |
| 2 | Tap produk | Tap gambar produk di grid | Popup modifier: Pilih Bumbu (wajib) + Pilih Saus (wajib) |
| 3 | Pilih varian | Pilih bumbu + saus → [TAMBAH KE KERANJANG] | Haptic feedback. "Macaroni — Bumbu Keju + Saus BBQ × 1 — Rp 13.000" |
| 4 | Koreksi | [+] tambah qty / [−] kurangi / [X] hapus | [−] di qty=1 otomatis jadi [X] |
| 5A | Bayar Tunai | BAYAR → Tunai → input nominal | Kembalian otomatis. Tombol aktif jika nominal ≥ total |
| 5B | Bayar QRIS | BAYAR → QRIS → tampilkan QR | QR + countdown 15 menit. SSE push pop-up saat lunas |
| 5C | Split | BAYAR → Split → input nominal tunai | Sistem hitung sisa → generate QR untuk nominal sisa |
| 6 | Sukses | Konfirmasi / QRIS settle otomatis | Haptic → success screen → cart reset → POS siap <500ms |
| 7 | Print (opsional) | Tap "Cetak Struk" | Kirim ke Bluetooth printer. Fallback: struk di layar |
| OFFLINE | Sinyal putus | Tetap melayani (tunai saja) | Banner merah OFFLINE. Transaksi masuk IndexedDB. Sync otomatis |

---

## 6. App Flow & Navigasi

### Rute Kasir

```
/pos
├── Grid produk (foto, nama, harga dasar, badge HABIS/DISKON)
├── Modifier Popup (tap produk → pilih bumbu + saus)
├── Keranjang (bottom sheet — +/−/X per item)
├── Modal Pembayaran (Tunai | QRIS | Split)
│   ├── Tunai: input nominal → kembalian otomatis
│   ├── QRIS: QR code + countdown + SSE listener + polling fallback
│   └── Split: input tunai → QR untuk sisa
├── Success Screen (summary + tombol cetak)
└── Indikator Koneksi (banner atas — hijau/merah)
```

### Rute Superadmin

```
/login                      → Form login (PIN kasir atau email SA)
/admin/dashboard            → KPI cards + grafik penjualan (auto-refresh 60 dtk)
/admin/transactions         → Riwayat + filter + detail + void
/admin/products             → CRUD produk + kategori + modifier groups + options
/admin/discounts            → Buat/edit/hapus diskon
/admin/analytics            → Grafik revenue, top produk, peak hours, P&L
/admin/profit-share         → Laporan bagi hasil bulanan + catat pembayaran kasir
/admin/cash                 → Laporan kas register per kasir/tanggal
/admin/opex                 → Input + riwayat biaya operasional
/admin/assets               → CRUD aset + jadwal depresiasi otomatis
/admin/reports              → Export CSV (rate limit: 5/jam)
/admin/users                → Manajemen kasir + reset PIN
/admin/settings/flags       → Toggle feature flags (tanpa redeploy)
/admin/settings             → Nama bisnis, Halal cert number, logo struk
/admin/audit-log            → Log semua aksi sensitif (READ-ONLY)
```

---

## 7. Functional Requirements

> Format: `[MODUL-ID]` | P0 = Blocker MVP | P1 = High (MVP) | P2 = Fase berikutnya

### 7.1 Autentikasi & RBAC

| ID | Kebutuhan | Prioritas | Acceptance Criteria |
|----|-----------|-----------|---------------------|
| AUTH-01 | Kasir login dengan PIN 4 digit. Bcrypt cost=12 + pepper | P0 | PIN plaintext tidak pernah di log/DB |
| AUTH-02 | Superadmin login email + password ≥16 karakter | P0 | Error tidak menyebut field mana yang salah |
| AUTH-03 | JWT di HttpOnly, Secure, SameSite=Strict Cookie. Expiry 8 jam | P0 | `document.cookie` kosong |
| AUTH-04 | Rate limit: 5 gagal/10 menit → lockout 30 menit | P0 | HTTP 429 + `locked_until` tersimpan di DB |
| AUTH-05 | RBAC: kasir tidak bisa akses `/admin/*` | P0 | GET /admin/dashboard token kasir → HTTP 403 |
| AUTH-06 | CSRF: Double Submit Cookie untuk POST/PATCH/DELETE | P0 | Tidak berlaku untuk GET/HEAD/OPTIONS |
| AUTH-07 | Logout invalidasi refresh token (DB `revoked_tokens` + Redis) | P0 | Refresh token lama tidak bisa dipakai setelah logout |

### 7.2 POS Kasir

| ID | Kebutuhan | Prioritas | Acceptance Criteria |
|----|-----------|-----------|---------------------|
| POS-01 | Grid produk: foto, nama, harga dasar, badge HABIS, badge DISKON | P0 | Tap produk HABIS → toast, cart tidak berubah |
| POS-02 | Tap produk → popup modifier (Pilih Bumbu wajib + Pilih Saus wajib) | P0 | Tombol TAMBAH disabled sampai semua grup wajib dipilih |
| POS-03 | Keranjang: [+][−][X] per item. Min size 44×44px | P0 | Double tap cepat tidak hasilkan qty negatif |
| POS-04 | Total harga real-time di client. Diskon: harga coret + harga setelah diskon | P0 | Server recalculate saat konfirmasi. HTTP 400 jika tidak cocok |
| POS-05 | Tombol BAYAR disabled + loading setelah 1× tap (anti double-submit) | P0 | Double tap → hanya 1 order di DB |
| POS-06 | Offline Mode: transaksi tunai → IndexedDB → sync otomatis saat online | P0 | Tidak ada duplikasi via `client_uuid` idempotency |
| POS-07 | QRIS tidak tersedia saat offline. Tampil pesan informatif | P0 | Tombol QRIS disabled dengan tooltip saat offline |
| POS-08 | Success screen + tombol "Cetak Struk" (Bluetooth printer opsional) | P1 | Fallback: struk di layar jika printer tidak terpair |

### 7.3 Modifier System

| ID | Kebutuhan | Prioritas | Acceptance Criteria |
|----|-----------|-----------|---------------------|
| MOD-01 | SA: buat modifier group per produk (nama, required, max_selections) | P0 | Satu produk bisa banyak grup |
| MOD-02 | SA: tambah modifier option (nama, harga tambahan ≥0, sort_order) | P0 | `additional_price < 0` → HTTP 400 |
| MOD-03 | Formula: `final_price = (base_price − discount) + sum(modifier_prices)` | P0 | Unit test semua kombinasi diskon + modifier |
| MOD-04 | Snapshot modifier di `order_item_modifiers` (nama + harga saat transaksi) | P0 | Laporan historis akurat walau harga modifier berubah |
| MOD-05 | Toggle aktif/nonaktif modifier option. Soft delete | P0 | Nonaktif: tidak tampil di POS, tidak pengaruhi historis |

### 7.4 Pembayaran

| ID | Kebutuhan | Prioritas | Acceptance Criteria |
|----|-----------|-----------|---------------------|
| PAY-01 | Tunai: input nominal → kembalian otomatis | P0 | `kembalian = nominal_diterima − total_amount` |
| PAY-02 | QRIS: generate QR via Midtrans API. Tampil + countdown 15 menit | P0 | Hanya saat online |
| PAY-03 | SSE push pop-up "PEMBAYARAN BERHASIL" saat webhook settlement | P0 | Polling fallback 5 detik jika SSE disconnect |
| PAY-04 | QR kadaluarsa → tampil "QR Kadaluarsa" + tombol "Buat QR Baru" | P0 | Backend update `payment_status = 'expire'` |
| PAY-05 | Split Payment: input tunai → sisa via QRIS → `cash+qris = total` | P0 | DB CHECK constraint wajib |
| PAY-06 | Webhook: verifikasi signature SHA512 wajib. Return HTTP 200 ke Midtrans | P0 | Signature invalid → log warning, DB tidak berubah |
| PAY-07 | Void QRIS: instruksi refund manual tunai dari kas. Catat di `order_refunds` | P0 | Tabel `order_refunds` mencatat semua refund |

### 7.5 Diskon

| ID | Kebutuhan | Prioritas |
|----|-----------|-----------|
| DSK-01 | SA: buat diskon (nama, tipe %, Rp, scope, tanggal, hari berlaku) | P1 |
| DSK-02 | Diskon tumpuk: ambil nilai TERBESAR. Tidak kumulatif | P1 |
| DSK-03 | POS: badge DISKON, harga coret, harga setelah diskon | P1 |
| DSK-04 | Cron job aktif/nonaktif diskon berdasarkan jadwal (setiap 5 menit) | P1 |
| DSK-05 | CSV laporan: kolom `discount_applied` dan `discount_amount` | P1 |

### 7.6 Manajemen Produk (SA)

| ID | Kebutuhan | Prioritas |
|----|-----------|-----------|
| PROD-01 | CRUD produk: nama, harga dasar, kategori, foto, status, sort_order | P0 |
| PROD-02 | Perubahan harga tidak mempengaruhi laporan historis | P0 |
| PROD-03 | Toggle stok habis: badge HABIS di POS, tidak bisa ditambah ke cart | P0 |
| PROD-04 | Hard delete DILARANG jika sudah ada di `order_items` (ON DELETE RESTRICT) | P0 |
| PROD-05 | Kelola modifier groups + options dari halaman detail produk | P0 |

### 7.7 Transaksi & Laporan (SA)

| ID | Kebutuhan | Prioritas |
|----|-----------|-----------|
| TRX-01 | Dashboard: KPI cards + grafik. Auto-refresh 60 detik | P0 |
| TRX-02 | Riwayat: filter tanggal/kasir/metode/status. Pagination 50/halaman | P0 |
| TRX-03 | Detail transaksi: item+varian+modifier+diskon+total+kasir+waktu | P0 |
| TRX-04 | Void: alasan ≥10 karakter, konfirmasi 2 langkah, alert email >3 void/10 menit | P0 |
| TRX-05 | Export CSV: kolom lengkap. Rate limit 5 export/jam | P0 |

### 7.8 Analytics & Bagi Hasil (SA)

| ID | Kebutuhan | Prioritas |
|----|-----------|-----------|
| ANA-01 | Grafik tren revenue harian/mingguan/bulanan + perbandingan MoM/WoW | P0 |
| ANA-02 | Top 5 produk terlaris (qty) dan tertinggi revenue (termasuk per varian) | P0 |
| ANA-03 | Distribusi metode bayar: pie chart Tunai vs QRIS vs Split | P0 |
| ANA-04 | Grafik peak hours per jam | P1 |
| ANA-05 | P&L bagi hasil: revenue − HPP − opex − depresiasi = laba bersih → 60/40 | P1 |
| ANA-06 | **Disclaimer wajib Fase 1**: "HPP belum tersedia. Bagi hasil dihitung dari revenue sementara." | P0 |
| ANA-07 | Margin per produk (Fase 2) — membutuhkan data BOM | P2 |

### 7.9 – 7.12 Modul Lainnya

| ID | Modul | Kebutuhan | Prioritas |
|----|-------|-----------|-----------|
| CASH-01 | Cash Register | Kasir input kas awal (default Rp 500.000) saat mulai shift | P0 |
| CASH-02 | Cash Register | Tutup shift: input kas akhir → discrepancy otomatis | P0 |
| CASH-03 | Cash Register | Alert email jika discrepancy > Rp 5.000 | P1 |
| FLAG-01 | Feature Flags | SA: toggle fitur on/off dari UI tanpa redeploy. Efektif <30 detik | P0 |
| FLAG-02 | Feature Flags | POS otomatis sesuaikan UI berdasarkan status flag | P0 |
| NOTIF-01 | Notifikasi | Email: login gagal 5×, >3 void/10 menit, server down, selisih kas | P0 |
| NOTIF-02 | Notifikasi | Reminder email tgl 1 setiap bulan untuk bagi hasil kasir | P1 |
| NOTIF-03 | Notifikasi | SSE push: PAYMENT_SUCCESS / FAILED / EXPIRED. Heartbeat 30 detik | P0 |
| AUDIT-01 | Audit Log | Semua aksi sensitif dicatat otomatis. Immutable (tidak ada DELETE/UPDATE) | P0 |
| AUDIT-02 | Audit Log | Setiap record: actor, action, entity, old_value, new_value, ip, timestamp | P0 |

---

## 8. Non-Functional Requirements

### Performa

| Metrik | Target SLO |
|--------|-----------|
| API Response Time P95 | < 200ms (GET), < 500ms (POST transaksi) |
| PWA First Contentful Paint | < 2 detik pada koneksi 3G |
| Cart update setelah tap | < 50ms (client-side state) |
| SSE QRIS notification | < 3 detik setelah webhook settlement |
| Modifier popup render | < 100ms dari tap produk |
| Concurrency | 20 kasir simultan tanpa degradasi |

### Keandalan

| Aspek | Target |
|-------|--------|
| Uptime | **99.5%/bulan** (max downtime 3j40m) |
| Offline Tolerance | Min 2 jam bertransaksi tunai tanpa internet |
| Data Durability | Nol transaksi hilang setelah konfirmasi sukses |
| Backup | Harian 02:00 WIB. Retensi 30 hari (Backblaze B2) |
| RTO | < 4 jam jika server crash total |

### Keamanan (Ringkasan)

- ✅ JWT di HttpOnly Cookie — tidak accessible via JavaScript
- ✅ PIN: Bcrypt cost=12 + pepper (`PIN_PEPPER_SECRET` dari env — **tidak boleh diubah setelah production**)
- ✅ CSRF: Double Submit Cookie pattern
- ✅ Rate limiting: 5 req/10 menit `/auth/login`
- ✅ SQL injection: Prisma parameterized queries
- ✅ Security headers: Helmet.js (CSP, X-Frame-Options: DENY, HSTS)
- ✅ Webhook: SHA512 signature verification + `timingSafeEqual`
- ✅ Audit log immutable: DB-level policy NO DELETE NO UPDATE
- ❌ 2FA superadmin: **tidak diimplementasikan** (accepted risk — password ≥16 karakter wajib)

---

## 9. Tech Stack Final

> ⚠️ Semua pilihan di bawah **FINAL & LOCKED**. Perubahan hanya via ADR baru.

| Layer | Teknologi | Versi | Keterangan |
|-------|-----------|-------|-----------|
| **Backend** | NestJS + TypeScript strict | v10 | Clean Architecture. DI container. Prisma ORM v5 |
| **Frontend** | SvelteKit + TypeScript strict | 2.x | `adapter-static` → file statis via Caddy (hemat RAM) |
| **Styling** | Tailwind CSS | v3 | Utility-first. No runtime CSS |
| **Database** | PostgreSQL | 16 | ACID. NUMERIC(12,2) untuk semua nilai uang |
| **Connection Pool** | PgBouncer | latest | Transaction mode. Max pool 20 |
| **Cache + Queue** | Redis | 7 | BullMQ queue + cache + rate limit + token blacklist. AOF persistence |
| **ORM** | Prisma | v5 | Type-safe. Prisma Migrate. Tidak ada raw DDL ke production |
| **Offline Storage** | IndexedDB via Dexie.js | — | Service Worker. Background Sync API |
| **Payment** | Midtrans QRIS Dynamic | — | MDR 0% untuk transaksi ≤ Rp 500K. Anti-Corruption Layer |
| **Realtime Fase 1** | Polling 60 detik | — | setInterval. Stop saat tab tidak aktif |
| **Realtime Fase 1.5** | SSE (Server-Sent Events) | — | NestJS `@Sse()`. Heartbeat 30 detik |
| **Printer** | Web Bluetooth API + ESC/POS | — | Chrome Android. Fallback: struk di layar |
| **Job Queue** | BullMQ + Redis | — | Queues: SYNC_OFFLINE, EXPORT_CSV, SEND_EMAIL, UPDATE_DISCOUNT, CALC_PROFIT |
| **Email** | Nodemailer + Gmail SMTP | — | Gratis. App Password Gmail |
| **Monitoring** | UptimeRobot + Sentry + Umami | — | Semua gratis/self-hosted |
| **Infrastructure** | VPS + Coolify + Docker + Cloudflare + Caddy | — | IDCloudHost/Vultr. Ubuntu 24.04 LTS |

---

## 10. Database Schema Final

> **Konvensi**: snake_case. UUID v4 via `gen_random_uuid()`. `NUMERIC(12,2)` untuk semua uang. Soft delete via `is_active`. Audit log **IMMUTABLE**.

### 10.1 users
```sql
CREATE TABLE users (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name               VARCHAR(100) NOT NULL,
  username           VARCHAR(50)  NOT NULL UNIQUE,
  email              VARCHAR(150) UNIQUE,
  pin_hash           VARCHAR(72),          -- kasir saja
  password_hash      VARCHAR(72),          -- superadmin saja
  role               VARCHAR(20)  NOT NULL CHECK (role IN ('kasir','superadmin')),
  is_active          BOOLEAN      NOT NULL DEFAULT true,
  must_change_pin    BOOLEAN      DEFAULT false,
  failed_login_count SMALLINT     DEFAULT 0,
  locked_until       TIMESTAMPTZ,
  last_login_at      TIMESTAMPTZ,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_credentials CHECK (
    (role='kasir'      AND pin_hash IS NOT NULL      AND password_hash IS NULL) OR
    (role='superadmin' AND password_hash IS NOT NULL AND pin_hash IS NULL)
  )
);
```

### 10.2 products
```sql
CREATE TABLE products (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name             VARCHAR(100)  NOT NULL,
  category_id      UUID          NOT NULL REFERENCES categories(id),
  base_price       NUMERIC(12,2) NOT NULL CHECK (base_price > 0),
  image_url        VARCHAR(255),
  is_active        BOOLEAN       NOT NULL DEFAULT true,
  is_out_of_stock  BOOLEAN       NOT NULL DEFAULT false,
  sort_order       SMALLINT      DEFAULT 0,
  created_by       UUID          REFERENCES users(id),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
```

### 10.3 product_modifier_groups & product_modifier_options
```sql
CREATE TABLE product_modifier_groups (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id     UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name           VARCHAR(50) NOT NULL,   -- "Pilih Bumbu Tabur", "Pilih Saus"
  is_required    BOOLEAN     NOT NULL DEFAULT true,
  max_selections SMALLINT    NOT NULL DEFAULT 1,
  sort_order     SMALLINT    DEFAULT 0,
  is_active      BOOLEAN     NOT NULL DEFAULT true
);

CREATE TABLE product_modifier_options (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id         UUID          NOT NULL REFERENCES product_modifier_groups(id) ON DELETE CASCADE,
  name             VARCHAR(100)  NOT NULL,   -- "Bumbu Keju", "Saus BBQ", "Chili Oil"
  additional_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (additional_price >= 0),
  sort_order       SMALLINT      DEFAULT 0,
  is_active        BOOLEAN       NOT NULL DEFAULT true,
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
```

### 10.4 orders ⚠️ Tabel Kritis
```sql
CREATE TABLE orders (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id           UUID          NOT NULL REFERENCES users(id),
  client_uuid          UUID          NOT NULL UNIQUE,   -- idempotency offline
  total_amount         NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  discount_total       NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method       VARCHAR(10)   NOT NULL DEFAULT 'cash'
                                     CHECK (payment_method IN ('cash','qris','split')),
  cash_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  qris_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_gateway      VARCHAR(20),
  payment_gateway_ref  VARCHAR(100),
  payment_status       VARCHAR(30),
  qris_expiry_at       TIMESTAMPTZ,
  payment_settled_at   TIMESTAMPTZ,
  payment_raw_response TEXT,
  status               VARCHAR(20)   NOT NULL DEFAULT 'completed'
                                     CHECK (status IN ('completed','voided','pending_sync')),
  voided_by            UUID          REFERENCES users(id),
  voided_at            TIMESTAMPTZ,
  void_reason          TEXT,
  synced_from_offline  BOOLEAN       NOT NULL DEFAULT false,
  client_created_at    TIMESTAMPTZ   NOT NULL,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_payment_amounts CHECK (
    (payment_method='cash'  AND cash_amount=total_amount  AND qris_amount=0) OR
    (payment_method='qris'  AND qris_amount=total_amount  AND cash_amount=0) OR
    (payment_method='split' AND cash_amount+qris_amount=total_amount
                            AND cash_amount>0 AND qris_amount>0)
  )
) PARTITION BY RANGE (client_created_at);

CREATE TABLE orders_2026 PARTITION OF orders FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
CREATE TABLE orders_2027 PARTITION OF orders FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');
CREATE TABLE orders_2028 PARTITION OF orders FOR VALUES FROM ('2028-01-01') TO ('2029-01-01');
```

### 10.5 order_items & order_item_modifiers
```sql
CREATE TABLE order_items (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id              UUID          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id            UUID          NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  product_name_snapshot VARCHAR(100)  NOT NULL,
  base_price            NUMERIC(12,2) NOT NULL CHECK (base_price > 0),
  discount_amount       NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_id           UUID          REFERENCES discounts(id),
  discounted_base       NUMERIC(12,2) NOT NULL,   -- = base_price - discount_amount
  modifier_total        NUMERIC(12,2) NOT NULL DEFAULT 0,
  final_price           NUMERIC(12,2) NOT NULL,   -- = discounted_base + modifier_total
  quantity              SMALLINT      NOT NULL CHECK (quantity > 0),
  subtotal              NUMERIC(12,2) NOT NULL    -- = final_price × quantity
);

CREATE TABLE order_item_modifiers (
  id                       UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id            UUID          NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
  option_id                UUID          NOT NULL REFERENCES product_modifier_options(id) ON DELETE RESTRICT,
  group_name_snapshot      VARCHAR(50)   NOT NULL,
  option_name_snapshot     VARCHAR(100)  NOT NULL,
  additional_price_at_time NUMERIC(12,2) NOT NULL CHECK (additional_price_at_time >= 0)
);
```

### 10.6 Tabel Pendukung
```sql
-- Refund void QRIS
CREATE TABLE order_refunds (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      UUID          NOT NULL REFERENCES orders(id),
  amount        NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  refund_method VARCHAR(30)   NOT NULL DEFAULT 'manual_cash',
  refunded_by   UUID          NOT NULL REFERENCES users(id),
  refunded_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  notes         TEXT
);

-- Kas register per shift
CREATE TABLE cash_registers (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cashier_id       UUID          NOT NULL REFERENCES users(id),
  shift_date       DATE          NOT NULL,
  opening_balance  NUMERIC(12,2) NOT NULL DEFAULT 500000,
  closing_balance  NUMERIC(12,2),
  system_cash_total NUMERIC(12,2),
  discrepancy      NUMERIC(12,2),
  status           VARCHAR(10)   NOT NULL DEFAULT 'open',
  notes            TEXT
);

-- Biaya operasional bulanan
CREATE TABLE operational_expenses (
  id           UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  category     VARCHAR(50)   NOT NULL,  -- 'sewa'|'listrik'|'gas'|'kemasan'|'lainnya'
  description  VARCHAR(200),
  amount       NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  expense_date DATE          NOT NULL,
  created_by   UUID          REFERENCES users(id),
  created_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- Aset dan depresiasi
CREATE TABLE assets (
  id                   UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 VARCHAR(100)  NOT NULL,
  purchase_price       NUMERIC(12,2) NOT NULL DEFAULT 0,
  useful_life_months   SMALLINT      NOT NULL,
  monthly_depreciation NUMERIC(12,2) NOT NULL,  -- purchase_price ÷ useful_life_months
  purchase_date        DATE          NOT NULL,
  is_active            BOOLEAN       NOT NULL DEFAULT true
);

-- Bagi hasil bulanan
CREATE TABLE profit_share_logs (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  period_month        DATE          NOT NULL UNIQUE,  -- selalu tgl 1
  total_revenue       NUMERIC(14,2) NOT NULL,
  total_hpp           NUMERIC(14,2) NOT NULL DEFAULT 0,  -- 0 sampai Fase 2
  total_opex          NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_depreciation  NUMERIC(14,2) NOT NULL DEFAULT 0,
  net_profit          NUMERIC(14,2) NOT NULL,
  owner_share         NUMERIC(14,2) NOT NULL,   -- net_profit × 60%
  cashier_share       NUMERIC(14,2) NOT NULL,   -- net_profit × 40%
  cashier_paid_amount NUMERIC(14,2),
  cashier_paid_at     TIMESTAMPTZ,
  cashier_paid_by     UUID          REFERENCES users(id),
  is_hpp_actual       BOOLEAN       NOT NULL DEFAULT false,
  notes               TEXT
);

-- Feature flags
CREATE TABLE feature_flags (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(100) NOT NULL UNIQUE,
  is_enabled  BOOLEAN      NOT NULL DEFAULT false,
  description TEXT,
  updated_by  UUID         REFERENCES users(id),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Settings sistem
CREATE TABLE settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT         NOT NULL,
  updated_by UUID         REFERENCES users(id),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Audit log (IMMUTABLE)
CREATE TABLE audit_logs (
  id          BIGSERIAL    PRIMARY KEY,
  actor_id    UUID         REFERENCES users(id),
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id   VARCHAR(100),
  old_value   JSONB,
  new_value   JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY no_update ON audit_logs AS RESTRICTIVE FOR UPDATE TO PUBLIC USING (false);
CREATE POLICY no_delete ON audit_logs AS RESTRICTIVE FOR DELETE TO PUBLIC USING (false);

-- JWT blacklist
CREATE TABLE revoked_tokens (
  jti        VARCHAR(36)  PRIMARY KEY,
  user_id    UUID         NOT NULL REFERENCES users(id),
  expires_at TIMESTAMPTZ  NOT NULL,
  revoked_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
```

### 10.7 Index Wajib
```sql
CREATE INDEX idx_products_category_active    ON products(category_id, sort_order)       WHERE is_active = true;
CREATE INDEX idx_modifier_groups_product     ON product_modifier_groups(product_id)     WHERE is_active = true;
CREATE INDEX idx_modifier_options_group      ON product_modifier_options(group_id, sort_order) WHERE is_active = true;
CREATE INDEX idx_discounts_active            ON discounts(is_active, valid_from)        WHERE is_active = true;
CREATE INDEX idx_orders_cashier_date         ON orders(cashier_id, client_created_at DESC);
CREATE INDEX idx_orders_date                 ON orders(client_created_at DESC);
CREATE INDEX idx_order_items_order           ON order_items(order_id);
CREATE INDEX idx_order_item_modifiers_item   ON order_item_modifiers(order_item_id);
CREATE INDEX idx_cash_registers_cashier      ON cash_registers(cashier_id, shift_date DESC);
CREATE INDEX idx_audit_logs_actor            ON audit_logs(actor_id, created_at DESC);
CREATE INDEX idx_revoked_tokens_expires      ON revoked_tokens(expires_at);
```

### 10.8 Feature Flag Seed
```sql
INSERT INTO feature_flags (name, is_enabled, description) VALUES
  ('QRIS_PAYMENT',      false, 'Aktifkan QRIS via Midtrans'),
  ('SPLIT_PAYMENT',     false, 'Aktifkan split payment tunai+QRIS'),
  ('MODIFIER_POPUP',    false, 'Aktifkan popup varian bumbu/saus'),
  ('DISCOUNT_MODULE',   false, 'Aktifkan sistem diskon'),
  ('BLUETOOTH_PRINTER', false, 'Aktifkan cetak struk Bluetooth'),
  ('SSE_REALTIME',      false, 'Aktifkan SSE (ganti polling 60s)'),
  ('LOYALTY_MODULE',    false, 'Loyalitas pelanggan (Fase 2)'),
  ('DELIVERY_CHANNEL',  false, 'Channel delivery online (Fase 2)');
```

---

## 11. API Contract Final

> Base URL: `https://api.domain.com/api/v1/` | Auth: JWT HttpOnly Cookie | Format: REST JSON

### 11.1 Auth
| Method | Endpoint | Auth | Response |
|--------|----------|------|---------|
| POST | `/auth/login` | Public | 200: JWT cookie. 401: Invalid. 429: Rate limited |
| POST | `/auth/refresh` | Cookie | 200: New cookies |
| POST | `/auth/logout` | Cookie | 200: Cookies cleared |
| GET | `/auth/me` | Cookie | `{id, name, role, must_change_pin}` |

### 11.2 Produk & Modifier
| Method | Endpoint | Auth | Keterangan |
|--------|----------|------|-----------|
| GET | `/products?include_modifiers=true` | Kasir/SA | List produk + modifier groups + active_discount |
| POST | `/admin/products` | SA | multipart: `{name, base_price, category_id, image?}` |
| PATCH | `/admin/products/:id` | SA | Partial update. Harga lama di audit_log |
| POST | `/admin/products/:id/modifier-groups` | SA | `{name, is_required, max_selections}` |
| POST | `/admin/modifier-groups/:id/options` | SA | `{name, additional_price, sort_order}` |
| PATCH | `/admin/modifier-options/:id` | SA | `{name?, additional_price?, is_active?}` |

### 11.3 Orders
| Method | Endpoint | Auth | Keterangan |
|--------|----------|------|-----------|
| POST | `/orders` | Kasir | `{items:[{product_id, qty, modifier_option_ids}], payment_method, cash_amount, qris_amount, client_uuid}` |
| POST | `/orders/sync-batch` | Kasir | Batch offline sync. Idempotent via `client_uuid` |
| GET | `/admin/transactions` | SA | Filter: from, to, cashier, method, status. Pagination 50/hal |
| GET | `/admin/transactions/:id` | SA | Detail + items + modifiers + refunds |
| POST | `/admin/orders/:id/void` | SA | `{reason}` ≥10 karakter |
| POST | `/admin/orders/:id/refund` | SA | `{amount, refund_method, notes?}` |

### 11.4 Payment QRIS
| Method | Endpoint | Auth | Keterangan |
|--------|----------|------|-----------|
| POST | `/payment/qris/create` | Kasir | `{order_id, amount}` → `{qr_string, expiry_time}` |
| GET | `/payment/qris/status/:id` | Kasir | `{payment_status, status}` (polling fallback) |
| POST | `/payment/qris/webhook` | Public (signature) | **SELALU return 200** ke Midtrans |
| GET | `/payment/stream/:cashierId` | Kasir SSE | Push: PAYMENT_SUCCESS / FAILED / EXPIRED + heartbeat 30s |

### 11.5 Analytics & Dashboard
| Method | Endpoint | Auth | Keterangan |
|--------|----------|------|-----------|
| GET | `/admin/dashboard/summary?date=` | SA | KPI cards + target progress |
| GET | `/admin/analytics/revenue?from=&to=&group_by=` | SA | Grafik tren + MoM/WoW comparison |
| GET | `/admin/analytics/products?from=&to=` | SA | Top 5 by qty + revenue |
| GET | `/admin/analytics/profit-share/:month` | SA | P&L breakdown + 60/40 bagi hasil |
| POST | `/admin/analytics/profit-share/:month/mark-paid` | SA | Catat pembayaran kasir |

### 11.6 Lainnya
| Method | Endpoint | Auth | Keterangan |
|--------|----------|------|-----------|
| GET/POST/PATCH | `/admin/discounts` | SA | CRUD diskon |
| GET | `/admin/feature-flags` | SA | List semua flags |
| PATCH | `/admin/feature-flags/:name` | SA | `{is_enabled}` toggle |
| GET | `/admin/reports/export?from=&to=` | SA | CSV. Rate limit 5/jam |
| GET | `/admin/audit-log` | SA | Paginated + filter |
| GET | `/health` | Public | `{status, database, redis, version}` |

---

## 12. Infrastruktur & Deployment

### Docker Services
| Service | Image | RAM | Keterangan |
|---------|-------|-----|-----------|
| `postgres` | `postgres:16-alpine` | 1 GB | DB utama. Volume persisten |
| `pgbouncer` | `pgbouncer/pgbouncer` | 64 MB | Connection pooler. Transaction mode. Max pool 20 |
| `redis` | `redis:7-alpine` | 128 MB | Cache + BullMQ + rate limit. AOF persistence |
| `nestjs-api` | `ngemiloh-api:latest` | 512 MB | Backend. Port 3000 internal |
| `caddy` | `caddy:2-alpine` | 64 MB | Reverse proxy + auto SSL |
| `umami` | `umami:postgresql` | 256 MB | Self-hosted analytics |
| `umami-db` | `postgres:15-alpine` | 256 MB | DB Umami |

**Total ~2.6GB → VPS 4GB RAM, 4 vCPU, 60GB SSD**  
**Provider**: IDCloudHost Jakarta (~Rp 250K/bulan) atau Vultr Tokyo (~$20/bulan)

### Environment Variables Kritis
```bash
DATABASE_URL=postgresql://ngemiloh:PASS@pgbouncer:5432/ngemiloh_db
DIRECT_DATABASE_URL=postgresql://ngemiloh:PASS@postgres:5432/ngemiloh_db
JWT_ACCESS_SECRET=<random-32-char>
JWT_REFRESH_SECRET=<random-32-char-BERBEDA>
PIN_PEPPER_SECRET=<random-32-char-JANGAN-UBAH-setelah-production>
MIDTRANS_ENV=sandbox   # → production saat go-live
MIDTRANS_SERVER_KEY_PRODUCTION=MTxxxxxxxxxxxxxxx
QRIS_EXPIRY_SECONDS=900
REDIS_URL=redis://redis:6379
EMAIL_HOST=smtp.gmail.com
EMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```
> ⚠️ **Semua di Coolify Secrets. JANGAN commit `.env` ke Git.**

### Backup
| Jenis | Jadwal | Retensi | Destination |
|-------|--------|---------|------------|
| PostgreSQL full dump | Harian 02:00 WIB | 30 hari | Backblaze B2 (AES-256) |
| Redis RDB | Setiap 1 jam | 7 snapshot | Volume Docker |
| Storage files | Mingguan | 4 backup | Backblaze B2 |
| **DR Test** | Bulanan | — | Restore ke staging → catat `DR_log.md` |

### CI/CD
```yaml
# .github/workflows/ci.yml
on: push [develop, main]
jobs:
  test: lint → npm audit → prisma migrate → jest (≥70%) → playwright E2E
  build (main only): docker build → push → trigger Coolify webhook deploy
```

---

## 13. Security Design

### Auth Flow
```
POST /auth/login → rate limit (5 gagal/10 menit → 429)
→ Bcrypt + pepper verify
→ Set JWT HttpOnly Cookie (8h) + CSRF token
→ Log USER_LOGIN ke audit_logs
→ Setiap request: AuthGuard + RolesGuard
→ Expired: POST /auth/refresh → rotate token
→ Logout: revoke refresh token → clear cookies
```

### PIN Hashing
```typescript
// PIN_PEPPER_SECRET TIDAK BOLEH diubah setelah production
const pepperedPin = `${pepper}:${pin}:${pepper}`;
return bcrypt.hash(pepperedPin, 12);
```

### Webhook Verification
```typescript
// SHA512(order_id + status_code + gross_amount + server_key)
const expected = crypto.createHash('sha512').update(raw).digest('hex');
return crypto.timingSafeEqual(Buffer.from(expected,'hex'), Buffer.from(received,'hex'));
// SELALU return HTTP 200 ke Midtrans (jangan non-200)
```

### Security Checklist
| Status | Item |
|--------|------|
| ✅ | JWT di HttpOnly Cookie (tidak accessible via JS) |
| ✅ | PIN Bcrypt cost=12 + pepper |
| ✅ | CSRF Double Submit Cookie |
| ✅ | Rate limit: 5 req/10 mnt /auth/login |
| ✅ | SQL injection: Prisma parameterized queries |
| ✅ | Security headers: Helmet.js (CSP, HSTS, X-Frame-Options: DENY) |
| ✅ | File upload: magic bytes MIME check + UUID filename |
| ✅ | Webhook: SHA512 signature + timingSafeEqual |
| ✅ | Audit log immutable (DB-level policy) |
| ❌ | 2FA superadmin (accepted risk — password ≥16 karakter wajib) |

---

## 14. Sprint Roadmap

### Fase 0 — Setup (Hari 1–3)
```
□ Daftar: VPS, GitHub, Backblaze B2, Gmail bisnis
□ Setup VPS Ubuntu 24.04 + Coolify + domain + Cloudflare
□ Init NestJS + SvelteKit + Prisma schema awal
□ Docker Compose: postgres + pgbouncer + redis + nestjs + caddy
□ Migration awal + seed: superadmin, 5 kategori, 8 feature flags (OFF)
```

### Fase 1A — Soft Launch (Hari 4–14)

| Hari | Output |
|------|--------|
| 4–5 | Auth kasir (PIN) + SA (email). JWT Cookie. RolesGuard. Rate limit |
| 4–5 | CRUD Produk + Kategori. Upload foto |
| 6–7 | POS Grid → keranjang (+/−/X) → total realtime |
| 8–9 | Pembayaran TUNAI + kembalian + simpan order |
| 8–9 | Offline Mode: IndexedDB + sync + idempotency |
| 10–11 | Dashboard SA: KPI + grafik + list transaksi + export CSV |
| 10–11 | Cash Register: kas awal + tutup shift + discrepancy |
| 12 | Feature flags UI + settings (Halal cert) + email notif |
| 13 | Test HP Android nyata. Fix semua critical bugs |
| **14** | **🚀 SOFT LAUNCH — Deploy + test Rp 1.000 nyata + brief kasir** |

### Fase 1B — Full MVP (Minggu 3–8)
| Minggu | Deliverable |
|--------|------------|
| 3–4 | QRIS Midtrans (webhook+SSE+9 sandbox test) + Split Payment |
| 5–6 | Modifier System (popup, CRUD, formula Opsi A, DB v2) |
| 7 | Sistem Diskon + Bluetooth Printer |
| 8 | Analytics P&L + bagi hasil Fase 1 (HPP=0 + disclaimer) + UAT |

### Fase 1.5 (Minggu 9–10): Polling → SSE real-time
### Fase 2 (Bulan 3–5): Bahan baku + HPP akurat + Loyalitas
### Fase 3 (Bulan 6+): Multi-outlet + Delivery + Refund API

---

## 15. Testing Strategy

| Level | Tools | Target | Kapan |
|-------|-------|--------|-------|
| Unit Test | Jest + Vitest | ≥ 70% coverage | Setiap commit (CI) |
| Integration | Supertest | ≥ 40% | Setiap PR (CI) |
| E2E | Playwright | Happy path | Pre-deploy |
| Offline | Playwright + DevTools | Wajib pass | Pre-deploy |
| Load | k6 | 20 VU, P95 < 500ms | Sebelum go-live |
| Device | HP Android RAM 2–3GB | Tiap release major | Sebelum deploy |

### 10 Critical Test Cases (Semua Wajib Lulus)
1. Formula: Macaroni Rp 9.000 − diskon 10% + Bumbu Keju Rp 1.500 + Saus BBQ Rp 2.500 = **Rp 11.600**
2. Diskon tumpuk: 10% dan 15% aktif → berlaku **15%** (terbesar)
3. Split: tunai Rp 10.000 + QRIS Rp 5.500 → `cash+qris = total` di DB
4. Offline sync: 5 transaksi offline → online → sync tanpa duplikat
5. QRIS offline: tap QRIS saat offline → pesan informatif, tidak generate QR
6. Webhook fraud: signature salah → DB tidak berubah, return 200
7. Double submit: tap BAYAR 2× cepat → **1 order saja** di DB
8. Harga historis: ubah harga → CSV lama masih tampil harga lama
9. RBAC: `/admin/*` token kasir → **HTTP 403**
10. Modifier required: tambah ke keranjang tanpa bumbu → **tombol disabled**

---

## 16. Risk Register

| Risiko | Prob | Impact | Mitigasi |
|--------|------|--------|---------|
| Data hilang (IndexedDB ter-clear) | Med | Kritis | Max 500 pending. Edukasi: jangan incognito |
| Duplikasi order sync retry | High | Kritis | `client_uuid` UNIQUE + endpoint idempotent |
| Webhook Midtrans palsu | Med | Kritis | SHA512 signature wajib. Return 200 selalu |
| Formula harga salah | High | Tinggi | Server recalculate + unit test semua kombinasi |
| QRIS offline — kasir bingung | High | Sedang | Tombol disabled + tooltip informatif |
| VPS down | Low | Kritis | Offline mode aktif. UptimeRobot <2 menit |
| Timeline terlalu optimis | High | Sedang | Soft Launch strategy |
| Bagi hasil tidak akurat (HPP=0) | High | Sedang | Disclaimer wajib di UI |
| Akun SA diretas (no 2FA) | Low | Kritis | Password ≥16 karakter + alert email IP baru |

---

## 17. Architecture Decision Records

| ADR | Keputusan | Status |
|-----|-----------|--------|
| **ADR-001** | Diskon Opsi A: dari `base_price` saja, modifier tidak terkena diskon | ✅ ACCEPTED |
| **ADR-002** | SvelteKit `adapter-static`: file statis via Caddy, hemat ~256MB RAM | ✅ ACCEPTED |
| **ADR-003** | Redis untuk cache + BullMQ + rate limit + token blacklist | ✅ ACCEPTED |
| **ADR-004** | NestJS + TypeScript (bukan Go) — satu bahasa di seluruh stack | ✅ ACCEPTED |
| **ADR-005** | PostgreSQL Range Partitioning per tahun untuk tabel `orders` | ✅ ACCEPTED |
| **ADR-006** | Modifier System: `product_modifier_groups` + `product_modifier_options` + snapshot | ✅ ACCEPTED |

<details>
<summary>Detail ADR-001 — Formula Diskon Opsi A</summary>

**Konteks**: Sistem punya modifier (naikkan harga) dan diskon (turunkan harga). Perlu dikunci interaksinya.  
**Keputusan**: `final_price = (base_price − discount) + sum(modifiers)`. Diskon HANYA dari `base_price`.  
**Alasan**: Lebih mudah dikomunikasikan ke pelanggan. Lebih mudah ditest. Keputusan bisnis owner (dikonfirmasi tertulis).  
**Trade-off**: Unit test wajib untuk semua kombinasi. Tidak bisa diubah tanpa migrasi data.
</details>

<details>
<summary>Detail ADR-004 — NestJS vs Go</summary>

**Konteks**: Go lebih cepat dan hemat resource. NestJS/TypeScript lebih familiar.  
**Keputusan**: NestJS v10 + TypeScript strict.  
**Alasan**: Satu bahasa di seluruh stack (TypeScript FE+BE). Ekosistem kaya (Prisma, BullMQ, Nodemailer). Performa cukup untuk 1 outlet.  
**Trade-off**: Jika ada bottleneck performa di Fase 3 (multi-outlet) → evaluasi migrasi Go (ADR-007 PENDING).
</details>

---

## 18. Appendix

### A. Pre-Launch Checklist
```
□ Midtrans Production disetujui. Kategori: Usaha Mikro (MDR 0%)
□ MIDTRANS_ENV=production di Coolify Secrets
□ Webhook URL production di-set + test notification berhasil
□ Server Key Production di Coolify Secrets (bukan di kode/Git)
□ Bank Jago terverifikasi di Midtrans (status: Verified)
□ SSL/HTTPS aktif dan auto-renew via Caddy
□ Backup harian terjadwal + DR test berhasil
□ UptimeRobot aktif (test: matikan server → email <2 mnt)
□ Load test k6 lulus: 20 VU, P95 < 500ms
□ Semua 10 critical test cases lulus
□ Superadmin dibuat (password ≥16 karakter)
□ Kasir dibuat. must_change_pin=true. Demo session ≥2 jam
□ Halal MUI number diinput di /admin/settings
□ NIB dari OSS sudah diurus
□ Rollback plan terdokumentasi di /docs/runbook.md
```

### B. Technical Debt Register
| ID | Deskripsi | Target Bayar |
|----|-----------|-------------|
| TD-01 | UUID v4 (bukan ULID sortable) | Fase 3 jika >500K rows |
| TD-02 | Polling 60 detik (bukan SSE dari awal) | Fase 1.5 |
| TD-03 | HPP = 0 di Fase 1 | Fase 2 |
| TD-04 | Tidak ada 2FA superadmin (accepted risk) | Review Fase 3 |
| TD-05 | Rate limit per-endpoint belum granular | Fase 2 jika ada abuse |
| TD-06 | Manual DR test | Fase 2 |
| TD-07 | No API versioning selain /v1/ | Fase 3 jika public API |
| TD-08 | Partisi baru dibuat manual | Fase 2 (cron otomatis) |

### C. Biaya Operasional Estimasi
| Item | Biaya/Bulan |
|------|------------|
| VPS 4GB IDCloudHost | Rp 250.000 |
| Domain .com | ~Rp 15.000 |
| Midtrans QRIS MDR | **Rp 0** (semua transaksi ≤ Rp 500K) |
| Email Nodemailer Gmail | Rp 0 |
| Backblaze B2 | ~Rp 15.000 |
| **TOTAL** | **~Rp 280.000/bulan** ✅ |

> Jauh di bawah budget Rp 500.000/bulan. Sisa ~Rp 220K sebagai buffer/upgrade.

---

*PRD Ngemiloh POS v3.0 FINAL · 1 Juni 2026 · Approved & Siap Coding* 🚀
