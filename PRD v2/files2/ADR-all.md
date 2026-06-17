# ADR-001 — Formula Diskon: Dari base_price Saja (Opsi A)

**Status:** ✅ ACCEPTED  
**Versi:** v3.0  
**Tanggal:** (v3.0 — sebelum Juni 2026)

---

## Konteks

Sistem mempunyai dua mekanisme yang mengubah harga: modifier (menaikkan harga via tambahan topping/variasi) dan diskon (menurunkan harga). Perlu dikunci secara eksplisit bagaimana keduanya berinteraksi agar tidak ambigu.

Dua opsi utama yang dipertimbangkan:
- **Opsi A:** Diskon dari `base_price` saja. Modifier di-add setelah diskon. `final_price = (base_price − discount) + sum(modifiers)`
- **Opsi B:** Diskon dari total termasuk modifier. `final_price = (base_price + sum(modifiers)) × (1 − discount_pct)`

## Keputusan

**Opsi A dipilih.** Diskon HANYA dari `base_price`. Modifier adalah add-on yang selalu ditambahkan setelah diskon diterapkan pada harga dasar.

## Alasan

1. **Komunikasi ke pelanggan:** "Diskon 10% untuk harga dasar produk" lebih mudah dijelaskan daripada "diskon 10% untuk total termasuk topping"
2. **Testability:** Unit test per komponen lebih mudah — `discount_amount`, `discounted_base`, `modifier_total`, dan `final_price` masing-masing bisa diverifikasi secara independen
3. **Keputusan bisnis owner:** Dikonfirmasi tertulis bahwa modifier (topping, variasi) adalah "add-on premium" yang tidak mendapat diskon
4. **Snapshot:** `order_items` menyimpan `discount_amount`, `discounted_base`, `modifier_total`, dan `final_price` secara eksplisit → audit trail yang jelas

## Contoh

```
Macaroni Mateng base_price = Rp 9.000
Diskon: 10% dari base_price

discount_amount  = 9.000 × 10% = Rp 900
discounted_base  = 9.000 - 900 = Rp 8.100
modifier_total   = Bumbu Keju (1.500) + Saus BBQ (2.500) = Rp 4.000
final_price      = 8.100 + 4.000 = Rp 12.100  ✅
subtotal (qty=2) = 12.100 × 2 = Rp 24.200

Bug v3.0 (diskon dipotong dua kali): 11.600 — sudah diperbaiki dengan ADR ini.
```

## Trade-off

- Unit test WAJIB untuk semua kombinasi (termasuk TC-01 & mutation test Stryker)
- Formula tidak bisa diubah tanpa migrasi data historis (semua `order_items` snapshot sudah ikuti formula ini)

---

# ADR-002 — SvelteKit adapter-static via Caddy

**Status:** ✅ ACCEPTED  
**Versi:** v3.0  
**Tanggal:** (v3.0)

---

## Konteks

Pilihan framework frontend dan cara serving-nya. Kandidat: Next.js (SSR/SSG), SvelteKit (SSR/SSG/static), React SPA.

## Keputusan

**SvelteKit dengan `adapter-static`** — build menjadi static HTML/CSS/JS yang di-serve langsung oleh Caddy.

## Alasan

1. **No Node server untuk frontend:** SvelteKit static + Caddy file_server → tidak perlu container Node tambahan untuk frontend, menghemat RAM VPS
2. **Bundle size kecil:** SvelteKit menghasilkan bundle lebih kecil dari Next.js untuk aplikasi CRUD seperti POS
3. **Deployment sederhana:** Build artifact adalah folder `/build` — bisa di-serve oleh web server apapun
4. **Client-side routing tetap bekerja:** Caddyfile dikonfigurasi dengan `try_files {path} /pos/index.html` untuk SPA fallback
5. **`[v4.1 — CR-001]`** Menggantikan referensi "Next.js" yang keliru di v4.0 — SvelteKit adalah keputusan final sejak v3.0

## Trade-off

- SSR tidak tersedia (static only) — tidak masalah karena POS adalah authenticated app, tidak butuh SEO
- Build ulang diperlukan setiap ada perubahan frontend (sudah via CI/CD)

---

# ADR-003 — Redis untuk Session, Cache, Rate Limit, BullMQ, Circuit Breaker

**Status:** ✅ ACCEPTED (updated v4.0, updated v4.1)  
**Versi:** v4.1

---

## Konteks

Redis digunakan sebagai multi-purpose in-memory store.

## Keputusan

**Single Redis instance** untuk semua keperluan in-memory: session auth, cache response, rate limit counters, BullMQ job queue, circuit breaker state (baru v4.1).

## Alasan

1. **Konsolidasi:** Daripada memisahkan Redis per fungsi (session Redis, cache Redis), satu instance dengan key namespace yang jelas cukup untuk skala 1 outlet
2. **BullMQ:** Library job queue yang membutuhkan Redis — tidak perlu tambahan message broker
3. **Rate limit:** Sliding window counter per-session, ringan di Redis
4. **Circuit breaker (v4.1):** `midtrans:fail_count` + `midtrans:degraded` — 2 key saja, tidak signifikan
5. **Overhead minimal:** ~128MB RAM (dikonfigurasi `maxmemory 128mb`)

## Trade-off

- Redis menjadi single point of failure. Mitigasi: AOF persistence, monitoring, fast restart
- Tidak scalable untuk multi-server tanpa Redis Cluster. Cukup untuk 1 VPS
- Semua session hilang jika Redis crash. Mitigasi: AOF + kasir login ulang mudah (PIN)

---

# ADR-004 — NestJS + TypeScript (bukan Go)

**Status:** ✅ ACCEPTED  
**Versi:** v3.0

---

## Keputusan

Backend menggunakan **NestJS + TypeScript**, bukan Go atau Express/Fastify murni.

## Alasan

1. **Ekosistem:** NestJS punya guard, interceptor, pipe, decorator — cocok untuk RBAC yang sudah ada di PRD
2. **Prisma integration:** Prisma ORM punya first-class NestJS support
3. **BullMQ:** `@nestjs/bull` tersedia
4. **TypeScript:** Type safety mengurangi bug runtime, terutama untuk kalkulasi harga
5. **Developer familiarity:** Tim sudah familiar

## Trade-off

- NestJS lebih heavy dari Express murni. Untuk 5 concurrent users di 1 VPS: tidak masalah
- Go dipertimbangkan ulang di Fase 3 jika ada bottleneck nyata (ADR-004 revisit)

---

# ADR-005 (revisi) — Tidak Partisi Tabel orders di Fase 1–2

**Status:** ✅ ACCEPTED (REVISED v4.1 — menggantikan "partisi tahunan" v4.0)  
**Versi:** v4.1  
**CR:** CR-003

---

## Konteks

PRD v4.0 punya kontradiksi internal: ringkasan eksekutif menyebut partisi "bulanan", tapi skema SQL dan ADR-005 v4.0 mengimplementasikan partisi "tahunan" (`orders_2026`, `orders_2027`). Deployment guide v3.1 mencatat masalah praktis: "Migration gagal karena `orders` partitioned table — Prisma tidak bisa buat partitioned table langsung, butuh raw SQL manual setelah `prisma migrate`."

## Keputusan

**Tabel `orders` TIDAK dipartisi di Fase 1–2.** Tabel biasa (non-partitioned) dengan index yang optimal.

## Alasan

1. **Volume data tidak membutuhkan partisi:**
   ```
   Estimasi realistis: ~100 transaksi/hari × 365 = 36.500 baris/tahun
   Dalam 10 tahun: ~365.000 baris orders
   PostgreSQL menangani ini dengan mudah menggunakan index — tanpa partisi
   ```
2. **Partisi justified pada >5–50 juta baris:** Di skala ini, partisi justru menambah complexity tanpa manfaat performa nyata (sesuai panduan SDLC §2.1–2.2 dan prinsip Knuth)
3. **Menghilangkan bug migration Prisma:** Prisma tidak bisa create partitioned table langsung — memerlukan raw SQL manual, rawan error
4. **Menghilangkan FR-PART-01 + cron job:** Satu modul lebih sedikit, timeline Fase 0 lebih ringan

## Index Pengganti

Index berikut menggantikan fungsi partisi untuk query laporan:
```sql
CREATE INDEX idx_orders_date ON orders(client_created_at DESC);
CREATE INDEX idx_orders_date_month ON orders(DATE_TRUNC('month', client_created_at));
CREATE INDEX idx_orders_cashier_date ON orders(cashier_id, client_created_at DESC);
```

## Exit Criteria (Re-Evaluasi Partisi)

Implementasikan partisi range bulanan di Fase 3+ **HANYA JIKA** salah satu:
1. Tabel `orders` melampaui **5 juta baris**, ATAU
2. P95 query laporan bulanan **> 500ms** setelah index dioptimalkan, ATAU
3. Bisnis berkembang ke **multi-outlet** dengan volume gabungan tinggi

Monitoring: `GET /admin/system-health` menampilkan `table_rows.orders` dan `table_rows.order_items`.

## Trade-off

- Jika di masa depan partisi dibutuhkan, perlu migration yang lebih hati-hati (Expand-Contract) dari tabel non-partisi ke partitioned table. Tapi ini masalah masa depan — YAGNI.

---

# ADR-006 — Modifier System: Groups + Options + Snapshot

**Status:** ✅ ACCEPTED  
**Versi:** v3.0

---

## Keputusan

Modifier dimodelkan sebagai **modifier groups** (kelompok) dan **modifier options** (pilihan dalam kelompok). Setiap order item menyimpan **snapshot** nama dan harga modifier saat order dibuat.

## Alasan

1. **Fleksibilitas:** 1 produk bisa punya multiple group (Level Pedas, Topping, Ukuran)
2. **Required vs optional:** `is_required` per group — kasir wajib pilih sebelum tambah ke keranjang
3. **Snapshot:** `option_name_snapshot` + `additional_price_at_time` di `order_item_modifiers` → harga historis tidak berubah meski modifier diedit

## Aturan Wajib

Setiap modifier group WAJIB punya opsi "Tanpa [X]" (harga Rp 0) — otomatis dibuat sistem saat group dibuat (PROD-06).

---

# ADR-007 — Session-Based Auth (Menggantikan JWT)

**Status:** ✅ ACCEPTED  
**Versi:** v4.0

---

## Konteks

v3.0 menggunakan JWT di HttpOnly Cookie (TTL 8 jam) + CSRF Double Submit Cookie + tabel `revoked_tokens`. Terlalu kompleks untuk kebutuhan 1 outlet, 2 tipe user.

## Keputusan

**Session-based auth via Redis** — session ID di cookie, data user di Redis.

## Alasan

1. **Instant revocation:** Logout = hapus session dari Redis. JWT harus menunggu expire atau pakai blacklist
2. **Kasir UX:** Kasir tidak perlu re-login setiap 8 jam. Session permanent sampai logout/tutup shift
3. **Force-logout:** SA bisa invalidate semua session kasir instan (misal saat reset PIN)
4. **Simplicity:** Hapus tabel `revoked_tokens`, hapus refresh token, hapus CSRF token
5. **Overhead minimal:** Redis sudah ada untuk BullMQ. Session ~100 bytes per user

## Trade-off

- Setiap request = 1 Redis lookup (<1ms)
- Redis crash = semua user re-login. Mitigasi: AOF persistence
- Tidak horizontal scalable (butuh shared Redis). Cukup untuk 1 VPS

---

# ADR-008 — CSRF: SameSite=Strict + Origin Header Check

**Status:** ✅ ACCEPTED  
**Versi:** v4.0

---

## Keputusan

Hapus CSRF Double Submit Cookie. Ganti dengan `SameSite=Strict` + server-side Origin header check.

## Alasan

1. `SameSite=Strict` mencegah browser mengirim cookie pada cross-site request
2. Single domain (path-based routing) — tidak ada cross-origin API call legitimate
3. Origin header check sebagai defense-in-depth
4. Frontend lebih simpel — tidak perlu baca CSRF token dari cookie dan attach ke header
5. Browser support >97% global

## Trade-off

- `SameSite=Strict` tidak mengirim cookie bahkan saat navigasi dari link external. OK karena app POS tidak di-link dari site lain
- Pre-rendering/SSR butuh handling khusus — tidak berlaku karena pakai `adapter-static`

---

# ADR-009 — Flexible Payment (Order dan Pembayaran Terpisah)

**Status:** ✅ ACCEPTED  
**Versi:** v4.0

---

## Keputusan

Order dibuat TANPA metode pembayaran (`payment_method = NULL`). Pembayaran adalah langkah terpisah setelah order terbentuk.

## Alasan

1. **Split payment UX:** Kasir bisa lihat total dulu, baru memutuskan split tunai/QRIS berapa
2. **Offline mode:** Order offline dibuat tanpa khawatir payment method (selalu tunai saat offline)
3. **QRIS flow:** Order tersimpan → generate QR → menunggu pembayaran → webhook settle
4. **Method switching:** Metode bisa diubah selama `payment_status = 'pending'` (pelanggan berubah pikiran)

## Flow

```
POST /orders → order_status='completed', payment_status='pending'
POST /orders/:id/pay/{method} → proses pembayaran
(QRIS) Webhook → payment_status='settled'
```

## Trade-off

- 2 API call per transaksi (bukan 1). UX lebih natural, latency total tetap <1 detik

---

# ADR-010 — Dual Order/Payment Status

**Status:** ✅ ACCEPTED  
**Versi:** v4.0

---

## Keputusan

Tabel `orders` memisahkan `order_status` dan `payment_status` sebagai dua kolom independen.

## Alasan

- `order_status` merefleksikan lifecycle order (completed, voided, cancelled, pending_sync, sync_failed)
- `payment_status` merefleksikan proses pembayaran (pending, settled, expired, failed)
- Keduanya bisa berubah independen (mis. order = completed, payment = pending saat menunggu QRIS)
- Void tidak perlu mengubah payment_status (cukup order_status = 'voided')

---

# ADR-011 — Biznet Gio Cloud (bukan IDCloudHost/Vultr)

**Status:** ✅ ACCEPTED  
**Versi:** v4.0

---

## Keputusan

VPS provider: **Biznet Gio Cloud** (Rp 210.000/bulan, 4.44GB RAM, 4 vCPU, 60GB SSD).

## Alasan

- Harga lebih murah dari IDCloudHost untuk spek yang sama
- Datacenter di Indonesia (latensi ke pelanggan lebih rendah)
- Sudah dikontrak — tidak perlu migrasi

## Trade-off (Acknowledged)

- Kurang populer dari Vultr/DigitalOcean → dokumentasi komunitas lebih sedikit
- Mitigasi: `11-deployment.md` tidak ada instruksi yang spesifik Biznet (semua portable via Docker Compose)

---

# ADR-012 — Multi-Kasir Profit Share via Proporsi Transaksi

**Status:** ✅ ACCEPTED  
**Versi:** v4.0

---

## Keputusan

Bagi hasil kasir dihitung berdasarkan **proporsi jumlah transaksi** masing-masing kasir terhadap total transaksi periode tersebut.

## Formula

```
kasir_share_pct    = (jumlah_trx_kasir / total_trx_semua_kasir) × 100%
kasir_share_amount = total_kasir_pool × kasir_share_pct
```

## Alasan

- Lebih adil daripada pembagian rata (kasir dengan lebih banyak transaksi dapat lebih)
- Lebih mudah dihitung dan diaudit daripada proporsi revenue (yang bisa dipengaruhi jam ramai/sepi)
- Owner sudah konfirmasi formula ini

---

# ADR-013 — Modular Monolith (Struktur Folder per Domain)

**Status:** ✅ ACCEPTED  
**Versi:** v4.1 (baru)  
**CR:** CR-010

---

## Konteks

PRD v4.0 tidak pernah mendefinisikan bagaimana kode NestJS disusun secara internal. Tanpa keputusan eksplisit, developer bisa membuat folder structure yang tidak konsisten.

## Keputusan

**Modular Monolith** — satu aplikasi NestJS, dipecah menjadi modul per-domain bisnis (auth, shift, orders, products, discounts, dst).

## Alasan (Decision Framework)

| Kriteria | Nilai untuk Ngemiloh |
|----------|---------------------|
| Tim > 8 orang di area berbeda? | Tidak (1–2 dev) |
| Domain bisnis kompleks & berubah-ubah? | Tidak (POS domain well-understood) |
| Scaling berbeda drastis antar modul? | Tidak (1 outlet) |
| Butuh independent deployment per modul? | Tidak (1 VPS) |

→ Modular Monolith sudah optimal. Clean Architecture 4-layer penuh akan menambah boilerplate tanpa manfaat nyata untuk timeline 14 hari.

## Satu Pengecualian: Hexagonal untuk Modul payment/

Modul `payment/` mengisolasi Midtrans SDK di balik interface `PaymentGateway`. Modul `orders/` hanya berinteraksi via interface, bukan SDK langsung — supaya unit test tidak butuh Midtrans sandbox sungguhan.

## Trade-off

- Jika Fase 3 butuh microservices → refactor diperlukan. Tapi modul yang sudah terisolasi per-domain memudahkan ekstraksi.

---

# ADR-014 — Circuit Breaker Midtrans via Redis Counter

**Status:** ✅ ACCEPTED  
**Versi:** v4.1 (baru)  
**CR:** CR-010, CR-015

---

## Konteks

v4.0 hanya punya fallback UX pasif: tombol QRIS disabled saat `navigator.onLine = false`. Tidak ada deteksi kegagalan Midtrans yang terjadi saat jaringan internet aktif (mis. Midtrans down, timeout).

## Keputusan

**Circuit breaker berbasis Redis counter** — tanpa library external:
- 3 kegagalan `createQris()` dalam 5 menit → set key `midtrans:degraded = '1'` (TTL 5 menit)
- Saat `midtrans:degraded` aktif → `GET /products` mengembalikan `qris_available: false` → UI sembunyikan tombol QRIS + tampilkan banner
- Auto-recovery setelah 5 menit (TTL expire)

## Alasan

1. **Re-use infrastruktur existing:** Redis sudah ada, tidak tambah library/dependency
2. **Konsep sesuai (CLOSED→OPEN→HALF-OPEN):** State OPEN = `midtrans:degraded` ada. HALF-OPEN implisit: saat key expire, request berikutnya mencoba Midtrans lagi (natural retry)
3. **UX graceful degradation:** Kasir tidak perlu tahu detail teknis — hanya lihat "QRIS gangguan, pakai Tunai"

## Trade-off

- Threshold hardcoded (3 dalam 5 menit) — cukup untuk deteksi kegagalan nyata vs transient error

---

# ADR-015 — Format Response API: Object-Direct + Error Envelope

**Status:** ✅ ACCEPTED  
**Versi:** v4.1 (baru)  
**CR:** CR-005

---

## Konteks

v4.0 punya dua format response yang berkonflik:
- Section 9 (draft lama): `{ "success": true, "data": {...} }`
- Section 11 (API contract final): object langsung untuk sukses, `{ statusCode, error, message, details, timestamp, path }` untuk error

## Keputusan

**Section 11 sebagai standar final:**
- Sukses single resource: object langsung `{ "id": "...", "field": "...", ... }`
- Sukses list: `{ "data": [...], "meta": {"page", "per_page", "total"} }`
- Error: `{ "statusCode", "error", "message", "details", "timestamp", "path" }`

## Alasan

Section 11 lebih spesifik: sudah punya tabel kode error lengkap (ORDER_ALREADY_PAID, CASH_INSUFFICIENT, dll.) yang langsung dipetakan ke HTTP status. Mengganti ke format `{success,...}` generik berarti membuang tabel kode error yang sudah baik tanpa manfaat.

## Trade-off

- Tidak ada `"success": true/false` wrapper — response sukses langsung ke data. Frontend harus cek HTTP status code (bukan field success). Ini adalah best practice REST.

---

# ADR-016 — Format Nomor Transaksi: TRX-YYYYMMDD-[cashier_letter][seq3]

**Status:** ✅ ACCEPTED  
**Versi:** v4.1 (formal)  
**CR:** CR-002

---

## Konteks

v4.0 punya dua format nomor transaksi yang berkonflik:
- Glosarium + Business Rules + User Journey + contoh struk: `TRX-YYYYMMDD-[cashier_letter][seq3]` (contoh: `TRX-20260612-A001`)
- Skema SQL 10.7 + API contract 11.6: `TRX-YYYYMMDD-K[XX]-[4digit]` (contoh: `TRX-20260614-K01-0042`)

## Keputusan

**Format A: `TRX-YYYYMMDD-[cashier_letter][seq3digit]`** adalah format final.

Contoh:
- `TRX-20260615-A001` (kasir A, transaksi pertama hari itu)
- `TRX-20260615-A002` (kasir A, transaksi kedua)
- `TRX-20260615-B001` (kasir B, transaksi pertama — namespace terpisah)

## Alasan

1. **UX & struk fisik:** Nomor ini juga berfungsi sebagai nomor antrian yang dipanggil ke pelanggan ("Antrian A-001!"). Format pendek lebih mudah dibaca dan diucapkan dari `K01-0042`
2. **Volume realistis:** Seq 3 digit (001–999) sudah lebih dari cukup (realistis < 150 transaksi/kasir/hari)
3. **Konsistensi field:** `cashier_letter` (A–Z) sudah didefinisikan di FR-CSH-01. Format A langsung memanfaatkannya
4. **Frekuensi:** Format A muncul di 7+ lokasi berbeda (Glosarium, Business Rules, User Journey, contoh struk — semua customer-facing), Format B hanya di 3 lokasi teknis (schema comment, API example, test case)

## Implementasi

```typescript
// Format: TRX-YYYYMMDD-[cashier_letter][seq:03d]
// seq: Redis counter INCR per kasir per hari, reset via key TTL (midnight)
const transactionNumber =
  `TRX-${date.toFormat('yyyyMMdd')}-${cashierLetter}${String(seq).padStart(3, '0')}`;
```

## Trade-off

- Seq 3 digit = max 999 transaksi/kasir/hari. Jika suatu saat ada kasir dengan >999 transaksi/hari, extend ke 4 digit dan dokumentasikan sebagai CR.
