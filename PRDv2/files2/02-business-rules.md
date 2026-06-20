# 02. Business Rules Master List

*[← 01-stakeholders-rbac.md](./01-stakeholders-rbac.md) | [→ 03-journeys-flows.md](./03-journeys-flows.md)*

---

> **Versi:** 4.1 — Perubahan dari v4.0 ditandai dengan tag **`[v4.1]`** beserta nomor CR yang relevan.
>
> File ini adalah **satu-satunya sumber kebenaran** untuk aturan bisnis. Functional Requirements (`04-functional-reqs.md`), Database Schema (`07-database.md`), dan API Contract (`08-api-contract.md`) mengacu ke sini — bukan sebaliknya.

---

## 6.1 Aturan Autentikasi (AUTH)

| ID | Rule | Detail |
|----|------|--------|
| AUTH-01 | Login kasir menggunakan PIN | Endpoint: `POST /auth/login/cashier`. Payload: `{ pin: string }`. PIN 4–6 digit, unik per kasir, di-hash (bcrypt) di database. |
| AUTH-02 | Login admin menggunakan email + password | Endpoint: `POST /auth/login/admin`. Payload: `{ email: string, password: string }`. Password di-hash (bcrypt). |
| AUTH-03 | Session kasir tanpa batas waktu | Session aktif sampai kasir melakukan logout atau tutup shift. Disimpan di Redis dengan key `sess:cashier:{sessionId}`. |
| AUTH-04 | Session admin expire 24 jam | TTL 24 jam di Redis. Key: `sess:admin:{sessionId}`. Setelah expire, admin harus login ulang. |
| AUTH-05 | Satu session aktif per pengguna | Saat login, session lama (jika ada) di-invalidate. Mencegah multi-device session. |
| AUTH-06 | CSRF protection via SameSite + Origin | Cookie session di-set dengan `SameSite=Strict`, `HttpOnly=true`, `Secure=true` (saat HTTPS). Server memvalidasi header `Origin` pada setiap mutating request (POST/PUT/PATCH/DELETE). |
| AUTH-07 | Rate limit login | Maksimal 5 request per 10 menit per IP untuk semua endpoint `/auth/login/*`. |
| AUTH-08 | Logout menghapus session | `POST /auth/logout` menghapus session dari Redis dan menghapus cookie di browser. |

---

## 6.2 Aturan Shift & Kas (SHIFT)

| ID | Rule | Detail |
|----|------|--------|
| SHIFT-01 | Kas awal wajib sebelum transaksi | Setelah login, kasir WAJIB input kas awal sebelum bisa membuat transaksi apapun. Jika belum input, tampilkan modal wajib yang tidak bisa di-dismiss. |
| SHIFT-02 | Carry-over otomatis | Jika ada shift sebelumnya pada hari yang sama (oleh kasir manapun), `closing_balance` shift terakhir otomatis menjadi kas awal shift baru. Kasir TIDAK boleh mengubah nilai carry-over — field kas awal menjadi `readonly` dan menampilkan sumber carry-over. |
| SHIFT-03 | Carry-over tidak ada = input manual | Jika tidak ada shift sebelumnya hari itu, kasir input kas awal secara manual. Nilai harus ≥ 0. |
| SHIFT-04 | Multiple shift per hari | Sistem mengizinkan lebih dari satu shift dalam satu hari. Setiap shift mendapat `shift_number` incremental (per hari). |
| SHIFT-05 | Tutup shift = rekonsiliasi | Saat tutup shift, sistem menampilkan ringkasan: kas awal, total penjualan tunai, total penjualan QRIS, pengeluaran, kas akhir (expected), dan kasir diminta input kas fisik aktual untuk menghitung selisih. |
| SHIFT-06 | Login ≥ 17:00 → set waktu auto-close | Jika kasir login pada pukul 17:00 WIB atau setelahnya, kasir WAJIB menentukan waktu rencana penutupan (`planned_close_at`). Format input: tanggal dan jam. |
| SHIFT-07 | Auto-close = planned + 1 jam buffer | `auto_close_at = planned_close_at + 1 jam`. Jika shift masih terbuka saat `auto_close_at` tercapai, sistem menutup shift secara otomatis via BullMQ job. |
| SHIFT-08 | Warning 90 menit sebelum auto-close | Sistem menampilkan notifikasi peringatan di UI POS 90 menit sebelum `auto_close_at`. Notifikasi bersifat persistent (tidak auto-dismiss). |
| SHIFT-09 | `shift_late_threshold` configurable | Batas waktu "telat tutup shift" dapat dikonfigurasi superadmin dari `/admin/settings`. Default: 30 menit setelah `planned_close_at`. |
| SHIFT-10 | Kolom shift **`[v4.1 — CR-004]`** | `id`, `cashier_id`, `shift_number`, `opening_balance`, `closing_balance`, `actual_cash`, `discrepancy`, `planned_close_at`, `auto_close_at`, `opened_at`, `closed_at`, `is_auto_closed`, `carry_over_from_shift_id`, `notes`, `created_at`, `updated_at`. ~~`outlet_id`~~ dihapus — field ini menggantung tanpa tabel `outlets`; multi-outlet ditambahkan via migration Expand-Contract saat Fase 3 (lihat `00-overview.md` CR-004). |
| SHIFT-11 | Logout vs tutup shift | Logout dan tutup shift adalah aksi terkoordinasi. Kasir harus tutup shift sebelum bisa logout. Jika kasir mencoba logout tanpa tutup shift, tampilkan prompt untuk tutup shift terlebih dahulu. |

---

## 6.3 Aturan Transaksi & Pembayaran (TRX)

| ID | Rule | Detail |
|----|------|--------|
| TRX-01 | Nomor transaksi **`[v4.1 — CR-002, ADR-016]`** | Format: `TRX-YYYYMMDD-[cashier_letter][seq3digit]`. `cashier_letter` = huruf unik kasir (A, B, C, …) dari kolom `users.cashier_letter`. `seq` = 3 digit sequence number, reset per hari per kasir. Contoh: `TRX-20260612-A001`, `TRX-20260612-A002`, `TRX-20260612-B001`. Berfungsi sekaligus sebagai **nomor antrian pelanggan**. Format ini berlaku identik untuk transaksi online maupun offline (OFFL-08). |
| TRX-02 | Nomor transaksi online = offline | Format sama. Suffix `cashier_letter` mencegah konflik antar kasir. Sequence di-generate di client (untuk offline) dan divalidasi/di-reconcile saat sync. |
| TRX-03 | Order status terpisah dari payment status **`[v4.1 — CR-013]`** | `order_status` enum: `completed`, `voided`, `cancelled`, `pending_sync`, **`sync_failed`** (ditambahkan v4.1 — state ini sudah disebutkan OFFL-04 tapi belum ada di enum v4.0). `payment_status` enum: `pending`, `settled`, `expired`, `failed`. Keduanya independen. State machine `sync_failed` → lihat diagram di `06-architecture.md §6.5`. |
| TRX-04 | Flexible payment | Order dibuat TANPA metode pembayaran. Setelah order terbentuk, kasir memilih metode bayar. Metode bisa diubah selama `payment_status = 'pending'`. |
| TRX-05 | Metode pembayaran | 3 metode: `cash` (tunai), `qris` (QRIS via Midtrans), `split` (kombinasi tunai + QRIS). |
| TRX-06 | Pembayaran tunai — preset nominal | UI menampilkan tombol preset: 5K, 10K, 20K, 50K, 100K + input manual + tombol "Uang Pas". Preset nominal dapat dikustomisasi dari `/admin/settings`. |
| TRX-07 | Pembayaran tunai — kembalian | `cash_change = cash_received - total_amount`. `cash_received` harus ≥ `total_amount`. Jika kasir tekan "Uang Pas", `cash_received = total_amount`, `cash_change = 0`. |
| TRX-08 | Pembayaran QRIS — countdown 15 menit | Setelah generate QR code, countdown 15 menit dimulai. Jika expired sebelum pelanggan bayar → `payment_status = 'expired'`. |
| TRX-09 | QRIS expired → Buat QR Baru | Jika QR expired, kasir bisa men-generate QR baru (request baru ke Midtrans) untuk order yang sama. Order ID tetap, `payment_status` kembali ke `pending`, Midtrans `transaction_id` baru. |
| TRX-10 | Split payment flow | 1) Kasir input porsi tunai → 2) Input uang diterima untuk porsi tunai → 3) Hitung kembalian → 4) Generate QR untuk sisa (total − porsi tunai). Kedua porsi harus settled agar `payment_status = 'settled'`. |
| TRX-11 | Void transaksi | Hanya superadmin yang bisa void. Defense-in-depth: CHECK constraint di DB + validasi di NestJS service layer. Void hanya bisa dilakukan pada transaksi dengan `order_status = 'completed'`. Endpoint dilindungi idempotency lock (`06-architecture.md §6.4`) — void 2× pada order sama menghasilkan `ORDER_ALREADY_VOIDED` (409), bukan error tak terduga. |
| TRX-12 | Max qty per item = 50 | Maksimal quantity per line item adalah 50 unit. Jika pelanggan pesan lebih, arahkan untuk menghubungi owner. Validasi di frontend dan backend. |
| TRX-13 | Kolom tambahan orders **`[v4.1 — CR-006]`** | `cash_received` (DECIMAL), `cash_change` (DECIMAL), `payment_method` (enum: cash/qris/split), `order_status`, `payment_status`, `client_created_at` (TIMESTAMPTZ), `synced_at` (TIMESTAMPTZ), **`payment_settled_at`** (TIMESTAMPTZ). ~~`settled_at`~~ → dikoreksi menjadi `payment_settled_at` sesuai kolom DB final. |
| TRX-14 | Merge cart item | Jika produk + modifier identik ditambahkan ke keranjang, qty di-merge (ditambahkan). Jika modifier berbeda, menjadi line item terpisah. |
| TRX-15 | Edit modifier dari keranjang | Sebelum pembayaran, kasir bisa tap item di keranjang untuk membuka popup modifier ulang. Setelah edit, jika kombinasi produk+modifier baru sudah ada di keranjang, qty di-merge. |
| TRX-16 | Tidak ada catatan pesanan | Sistem tidak menyediakan field catatan/notes per item atau per order. |

---

## 6.4 Aturan Produk & Modifier (PROD)

| ID | Rule | Detail |
|----|------|--------|
| PROD-01 | Produk > 20 | Sistem mendukung lebih dari 20 produk. Owner input sendiri dari dashboard admin. Tidak ada hard limit (batasan praktis ~70 produk karena foto). |
| PROD-02 | Kolom produk | `id`, `name`, `description` (TEXT, opsional), `base_price` (DECIMAL), `image_url`, `category_id`, `is_active` (BOOLEAN), `sort_order`, `estimated_hpp` (DECIMAL, nullable), `hpp_source` (enum: `manual_estimate`/`bom_calculated`), `new_base_price` (DECIMAL, nullable), `new_price_effective_from` (DATE, nullable), `created_at`, `updated_at`. |
| PROD-03 | Foto produk | Upload ke VPS lokal. Diproses oleh Sharp: konversi ke WebP, resize 600×600 (cover/crop), max file size 500KB. Disajikan via Caddy static. Maksimal ~70 foto (constraint disk space VPS). |
| PROD-04 | Scheduled price change | Owner mengisi `new_base_price` dan `new_price_effective_from`. Tanggal efektif minimal H+1. Cron job BullMQ berjalan setiap hari pukul 00:01 WIB: query semua produk WHERE `new_price_effective_from = TODAY`. Untuk setiap produk: `base_price = new_base_price`, lalu set `new_base_price = NULL`, `new_price_effective_from = NULL`. |
| PROD-05 | Modifier group | Setiap group memiliki: `id`, `name`, `is_required` (BOOLEAN), `max_selection` (INT), `sort_order`. Group wajib (`is_required = true`) harus dipilih oleh kasir sebelum item bisa ditambahkan ke keranjang. |
| PROD-06 | Modifier item wajib "Tanpa [X]" | Setiap modifier group WAJIB memiliki minimal satu opsi "Tanpa [X]" dengan harga Rp 0. Contoh: modifier group "Level Pedas" harus punya opsi "Tanpa Pedas" (Rp 0). Ini menjadi default jika kasir tidak memilih modifier lain. |
| PROD-07 | Harga total item | `item_total = (base_price + SUM(modifier_prices)) × qty`. Modifier bisa menambah harga (positif) atau gratis (Rp 0). Modifier tidak boleh mengurangi harga (negatif). |
| PROD-08 | Arsip produk | Produk tidak dihapus permanen, hanya diarsipkan (`is_active = false`). Produk yang diarsipkan tidak muncul di POS tapi tetap ada di data historis transaksi. |

---

## 6.5 Aturan Diskon (DISC)

| ID | Rule | Detail |
|----|------|--------|
| DISC-01 | Scope diskon | `scope` enum: `all` (berlaku untuk semua produk) atau `product` (berlaku untuk produk tertentu via junction table `discount_products`). |
| DISC-02 | Junction table `discount_products` | `discount_id` (FK), `product_id` (FK). Hanya diisi jika `scope = 'product'`. |
| DISC-03 | Tipe diskon | `type` enum: `percentage` (persentase) atau `fixed` (nominal tetap dalam Rupiah). |
| DISC-04 | Applicable days — bitmask | `applicable_days` SMALLINT menggunakan bitmask: 1=Senin, 2=Selasa, 4=Rabu, 8=Kamis, 16=Jumat, 32=Sabtu, 64=Minggu. Contoh: berlaku Senin–Jumat = 1+2+4+8+16 = 31. Berlaku setiap hari = 127. |
| DISC-05 | Periode diskon | `start_date` (DATE) dan `end_date` (DATE, nullable). Jika `end_date NULL`, diskon berlaku tanpa batas waktu (sampai dinonaktifkan manual). |
| DISC-06 | Diskon aktif | Diskon aktif jika: `is_active = true` AND `start_date ≤ today` AND (`end_date IS NULL OR end_date ≥ today`) AND `(applicable_days & (1 << (day_of_week - 1))) > 0`. |
| DISC-07 | Aplikasi diskon otomatis | Diskon yang memenuhi syarat otomatis diterapkan di POS. Kasir tidak perlu input kode diskon. |
| DISC-08 | Kalkulasi diskon **`[v4.1 — CR-008]`** | Jika `type = 'percentage'`: `discount_amount = item_subtotal × (value / 100)`, dibatasi oleh `max_discount` jika ada (kolom baru v4.1): `discount_amount = MIN(item_subtotal × (value/100), max_discount ?? ∞)`. Jika `type = 'fixed'`: `discount_amount = value`. Diskon tidak boleh melebihi subtotal item (`DISCOUNT_EXCEEDS_SUBTOTAL` → 422 jika terjadi, lihat `08-api-contract.md`). |
| DISC-09 | Satu diskon per item | Setiap item dalam order hanya bisa mendapat satu diskon — diskon terbesar yang diterapkan. Tidak ada stacking. |

---

## 6.6 Aturan HPP & Bagi Hasil (HPP)

| ID | Rule | Detail |
|----|------|--------|
| HPP-01 | Fase 1A: `estimated_hpp` | Owner input `estimated_hpp` (DECIMAL) manual per produk. `hpp_source = 'manual_estimate'`. Digunakan untuk kalkulasi profit kasar sebelum BOM tersedia. |
| HPP-02 | Fase 1B: BOM-calculated HPP | Setelah BOM diimplementasi, HPP dihitung otomatis: `hpp = SUM(bom_items.quantity_per_unit × raw_materials.price_per_unit)`. `hpp_source = 'bom_calculated'`. Skema tabel `raw_materials`/`bom_items` tersedia di `07-database.md`. |
| HPP-03 | Profit per item | `profit = selling_price - hpp - discount_amount`. Jika `hpp` belum tersedia (NULL), profit tidak dihitung (tampilkan "N/A"). |
| HPP-04 | Gross profit margin | `gross_margin = ((revenue - total_hpp) / revenue) × 100%`. |
| HPP-05 | Bagi hasil — formula dasar | Bagi hasil dihitung dari profit bersih (setelah HPP). Formula konfigurabel oleh owner dari settings. Default: owner 60%, kasir pool 40% (lihat OPEN-02 di `00-overview.md`). |
| HPP-06 | Bagi hasil multi-kasir | Jika ada lebih dari satu kasir, porsi kasir dibagi berdasarkan proporsi jumlah transaksi. Tabel `profit_share_details`: `id`, `period_start`, `period_end`, `cashier_id`, `transaction_count`, `total_revenue`, `total_hpp`, `total_profit`, `share_percentage`, `share_amount`, `created_at`. |
| HPP-07 | Proporsi jumlah transaksi | `kasir_share_pct = (jumlah_trx_kasir / total_trx_semua_kasir) × 100%`. `kasir_share_amount = total_kasir_pool × kasir_share_pct`. |

---

## 6.7 Aturan Struk (RCPT)

| ID | Rule | Detail |
|----|------|--------|
| RCPT-01 | Konten struk | Tanggal & waktu (WIB), nomor transaksi (= nomor antrian, format `TRX-YYYYMMDD-[cashier_letter][seq3]`), daftar item pesanan (nama produk + modifier + qty + subtotal), total bayar, jenis pembayaran (Tunai/QRIS/Split), informasi tunai (diterima + kembalian) jika relevan. |
| RCPT-02 | TIDAK ada di struk | Logo Halal, QR code, nomor sertifikat. |
| RCPT-03 | Lebar kertas | Configurable: 58mm atau 80mm. Diatur oleh superadmin dari settings. Layout menyesuaikan otomatis. |
| RCPT-04 | Cetak struk | Kasir bisa cetak struk setelah pembayaran selesai (`payment_status = 'settled'`). Opsi cetak ulang tersedia dari riwayat transaksi shift aktif. |

---

## 6.8 Aturan Offline (OFFL)

| ID | Rule | Detail |
|----|------|--------|
| OFFL-01 | Deteksi koneksi | Sistem mendeteksi status koneksi via `navigator.onLine` + heartbeat ping ke server setiap 30 detik. |
| OFFL-02 | Simpan di IndexedDB | Saat offline, transaksi lengkap (full cart detail termasuk items, modifiers, qty, harga, diskon) disimpan di IndexedDB via Dexie.js. |
| OFFL-03 | Dual timestamp | `client_created_at`: waktu pembuatan transaksi di client (browser) — digunakan untuk laporan keuangan dan urutan kronologis. `synced_at`: waktu berhasil disinkronkan ke server — digunakan untuk pencatatan kas register. |
| OFFL-04 | 2-layer retry | **Layer 1:** 3 percobaan dengan exponential backoff: 5 detik, 15 detik, 45 detik. **Layer 2:** Jika Layer 1 gagal total, retry setiap 5 menit selama maksimal 2 jam. Setelah 2 jam tanpa berhasil, tandai `order_status = 'sync_failed'` (TRX-03) dan minta intervensi manual. Diagram state machine lengkap di `06-architecture.md §6.5`. |
| OFFL-05 | Modal ringkasan sync | Saat koneksi pulih dan ada transaksi `pending_sync`, tampilkan modal: jumlah transaksi pending, total nominal, detail per transaksi. Kasir konfirmasi sebelum batch sync dimulai. |
| OFFL-06 | Badge counter | Badge counter di header POS: jumlah transaksi belum tersinkronisasi. Kuning = `pending_sync`, Merah = `sync_failed`. |
| OFFL-07 | Detail status sync | Kasir bisa melihat detail status sinkronisasi setiap transaksi: `pending_sync`, `syncing`, `synced`, `sync_failed`. Termasuk timestamp percobaan terakhir dan error message jika gagal. |
| OFFL-08 | Nomor transaksi offline | Format sama: `TRX-YYYYMMDD-[cashier_letter][seq3]`. Sequence di-generate di client. Server memvalidasi saat sync — jika ada konflik sequence, server melakukan re-sequence. |
| OFFL-09 | Pembayaran offline | Saat offline, HANYA pembayaran tunai yang diizinkan (QRIS memerlukan koneksi ke Midtrans). `payment_method = 'cash'`, `payment_status = 'settled'` langsung di client. |
| OFFL-10 | Hard block 500, warning 400 | Transaksi offline ke-401 sampai ke-499 dalam satu shift: tampilkan warning persisten. Transaksi offline ke-500: kasir diblok melakukan transaksi baru sampai sync berhasil. |

---

## 6.9 Aturan Umum (GEN)

| ID | Rule | Detail |
|----|------|--------|
| GEN-01 | Timezone | Hardcode `Asia/Jakarta` (WIB, UTC+7). Database menyimpan semua timestamp dalam UTC (`TIMESTAMPTZ`). UI selalu menampilkan dalam WIB. |
| GEN-02 | Mata uang | Seluruh nominal dalam Rupiah (IDR). Tidak ada pembulatan — selalu bilangan bulat. Disimpan sebagai `DECIMAL(12,0)`. |
| GEN-03 | Rate limiting | Diterapkan per-session (bukan per-IP global untuk endpoint POS). Lihat tabel di 6.10. Sliding window algorithm via NestJS throttler. |
| GEN-04 | ~~Partisi tabel orders~~ **`[v4.1 — DIHAPUS, CR-003]`** | ~~Tabel `orders` dipartisi berdasarkan range bulanan.~~ **Dihapus di v4.1.** Tabel `orders` tidak dipartisi di Fase 1–2 (volume ~36.500 baris/tahun tidak memerlukan partisi; exit criteria & rencana partisi masa depan di ADR-005 revisi dan `05-nonfunctional-reqs.md §5.3`). |
| GEN-05 | System logs | Tabel `system_logs`: `id`, `severity` (info/warning/error/critical), `log_type`, `source`, `message`, `metadata` (JSONB), `created_at`. Dapat dilihat di `/admin/system-logs`. |
| GEN-06 | System health **`[v4.1]`** | Endpoint `/admin/system-health` menampilkan: status PostgreSQL (pool stats), status Redis (memory, clients), disk usage, memory usage, uptime, active sessions, pending sync count, last cron executions, **row count `orders`/`order_items`** (tambahan v4.1 — visibilitas terhadap exit criteria partisi, `05-nonfunctional-reqs.md §5.3`). |
| GEN-07 | Responsive design | Seluruh halaman (POS dan admin dashboard) fully responsive. Breakpoints: mobile (< 768px), tablet (768px–1024px), desktop (> 1024px). POS dioptimasi untuk tablet landscape. |
| GEN-08 | POS header | Menampilkan: nama kasir yang login, status koneksi (🟢 Online / 🔴 Offline), jumlah transaksi hari ini (shift aktif), badge pending sync (OFFL-06). |
| GEN-09 | `qris_available` flag **`[v4.1 — baru]`** | `GET /products` menyertakan field `"qris_available": boolean` pada response. Nilainya `false` saat circuit breaker Midtrans aktif (`06-architecture.md §6.3`) ATAU `feature_flags.QRIS_PAYMENT = false`. QRIS tersedia hanya jika keduanya `true`. |

---

## 6.10 Tabel Rate Limit

> **`[v4.1 — CR-007]`** Rate limit `POST /orders` distandarkan ke **30/menit** (v4.0 ada inkonsistensi: 30 di 6.10 dan 60 di bagian lain — distandarkan ke 30 yang lebih ketat). Seluruh limit berlaku **per-session**, bukan per-IP global, kecuali endpoint auth.

| Endpoint | Limit | Window | Catatan |
|----------|-------|--------|---------|
| `/auth/login/*` | 5 req | 10 menit | Per-IP. Mencegah brute force. |
| `POST /orders` | **30 req** | 1 menit | Per-session. = 1 order/2 detik sustained, jauh di atas kapasitas input manual. |
| `POST /orders/sync-batch` | 10 req | 1 menit | Per-session. |
| `POST /payment/qris/create` | 10 req | 1 menit | Per-session. |
| `POST /admin/orders/:id/void` | 5 req | 10 menit | Per-session (superadmin only). |
| `GET /admin/reports/export` | 5 req | 1 jam | Per-session. |
| `POST /admin/products`, `PUT`, `PATCH` | 20 req | 1 menit | Per-session. |
| Semua endpoint lainnya | 100 req | 1 menit | Default. |

---

*Lanjut ke: [`03-journeys-flows.md`](./03-journeys-flows.md) (Tahap 7) — atau loncat ke [`04-functional-reqs.md`](./04-functional-reqs.md) untuk implementasi detail.*
