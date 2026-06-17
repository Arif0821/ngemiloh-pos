# PRD Ngemiloh POS v5.0 — FINAL (Single Source of Truth)

> **Status:** Draft aktif — disusun dari analisis PRD v4.0, deployment guide lama, blueprint frontend, struk referensi, DAN audit langsung terhadap kode di `github.com/Arif0821/ngemiloh-pos`.
> **Menggantikan:** `PRD_Ngemiloh_POS_v4_0.md`, `deployment_guide_ngemiloh.md` (keduanya **deprecated** setelah PRD ini selesai).
> **Tujuan:** Spesifikasi tunggal, final, tanpa fase — siap dieksekusi langsung oleh Arif & Claude Code AI untuk deploy minggu ini.

---

## 0.1 Snapshot Proyek (Fakta, bukan rencana)

| Item | Nilai |
|---|---|
| VPS | MS 4.4 — 4 GB RAM, 4 vCPU, 60 GB Disk, Ubuntu 24.04 |
| IP VPS | `103.150.227.117` |
| Domain | Belum ada → pakai `103-150-227-117.nip.io` (gratis, otomatis resolve ke IP di atas) |
| Repo | `https://github.com/Arif0821/ngemiloh-pos` |
| Status implementasi | Kode SUDAH ADA, dibangun mengikuti PRD v3.0. Beberapa bagian sudah lebih maju dari v3 (BOM/Raw Material, Finance/Shift, dll) |
| Email bisnis | `nabilah.fnb@gmail.com` (juga dipakai utk kode OTP admin & alert sistem) |
| Midtrans | Sandbox: siap. Production: verifikasi ~1 minggu lagi → pakai `MIDTRANS_ENV` switch, tidak perlu redeploy |
| Kasir aktif | 1 (bisa bertambah — arsitektur harus mendukung multi-akun kasir dari awal) |
| Jenis order | Takeaway saja (tidak ada konsep meja/dine-in) |
| Platform target | Kasir: Tablet Android / PC Windows (browser). Admin: HP/Tablet/PC |

---

## 0.2 Master Decisions Log

Setiap keputusan berikut **mengikat** untuk seluruh PRD v5 dan kode. Jika ada bagian PRD v4.0/dokumen lama yang bertentangan dengan tabel ini, **tabel ini yang berlaku**.

| ID | Keputusan | Alasan / Dampak |
|---|---|---|
| **D-01** | **Auth tetap JWT** (bukan migrasi ke session Redis seperti rencana v4.0), tapi **disederhanakan drastis**: refresh-token + endpoint `/auth/refresh` + retry-loop frontend **DIHAPUS TOTAL**. | Kode JWT sudah jalan (ADR-0003). Refresh-loop adalah sumber kompleksitas/bug. RevokedToken table tetap dipakai, hanya untuk logout/security-revoke. |
| **D-02** | **Kasir login** (`/login`, PIN saja, dari admin): 1 access token, **tidak ada refresh**, expiry **20 jam** (cover shift lintas tengah malam). Tidak ada idle-lock. | Sesuai permintaan Arif — "PIN cukup 1, tidak perlu token tambahan". |
| **D-03** | **Admin login** (`/login-admin`, email+password): setelah kredensial valid, sistem kirim **kode OTP 6-digit ke email bisnis**, expiry **10 menit**, ada tombol "Kirim Ulang Kode". Setelah OTP benar → 1 session token, **tidak ada refresh**, expiry **12 jam**. Logout → login berikutnya kirim OTP baru. | Memanfaatkan `email.service.ts` yang sudah ada. Memberi 2FA nyata untuk akses data finansial tanpa kompleksitas session/refresh. |
| **D-04** | **HTTPS via Caddy**: Caddyfile diubah dari `:80 { }` → blok domain `103-150-227-117.nip.io { }` agar Caddy auto-issue sertifikat Let's Encrypt. | **Kemungkinan akar masalah utama**: cookie `Secure=true` (di-set saat `NODE_ENV=production`) tidak tersimpan di browser jika koneksi HTTP. Tanpa fix ini, login admin/kasir berpotensi gagal persist (terlihat seperti "anomali random"). |
| **D-05** | `FRONTEND_URL` & semua URL absolut di env disamakan ke `https://103-150-227-117.nip.io`. Saat domain asli dibeli, hanya ganti Caddyfile + env — tidak ada perubahan kode. | Konsistensi CORS/cookie origin. |
| **D-06** | **PgBouncer dihapus** dari arsitektur (kode aktual sudah direct-connect ke Postgres). | 1 service lebih sedikit = lebih sedikit titik kegagalan Docker/Coolify. Skala 1-3 kasir tidak butuh connection pooling terpisah. |
| **D-07** | **Printer**: ganti dari Web Bluetooth + ESC/POS raw bytes → **HTML Print Dialog** (`window.print()` + CSS `@media print`, toggle 80mm/58mm). | Web Bluetooth rawan putus (diakui di blueprint frontend baru). HTML print dialog 100% kompatibel Windows & Android (via RawBT). |
| **D-08** | **Frontend offline storage tetap Dexie** (sudah terimplementasi rapi: tabel `products`/`orders`/`cart` + index `sync_status`). `idb-keyval` dari blueprint baru **tidak dipakai** — Dexie sudah memenuhi prinsip KISS dengan kapabilitas lebih. | Hindari downgrade tanpa manfaat. |
| **D-09** | **Shift = unit business-date**. `CashRegister.shift_date` di-set saat `openShift()` (anchor ke tanggal buka shift). Semua laporan/agregasi per-hari **HARUS** filter berdasarkan rentang waktu shift (`shift_start`..`shift_end`/now), **BUKAN** `created_at::date = today`. | Order lintas tengah malam (shift buka jam 8 pagi, tutup jam 1 dini hari besoknya) tetap tercatat di hari shift dibuka. Pola ini **sudah benar** di `closeShift()` — hanya perlu didokumentasikan & dipastikan konsisten di semua laporan. |
| **D-10** | **Tabel `Order` ditambah field `customer_name`** (string, nullable) — nama panggilan pelanggan untuk dipanggil saat pesanan siap (takeaway). | Kebutuhan struk baru (D-12), belum ada di skema. |
| **D-11** | **Multi-akun kasir** harus bisa dibuat dari Admin Panel sejak awal (bukan "nanti"). Profit-share 40% tetap dihitung otomatis oleh sistem (kode finance yang ada), **ditambah** kolom "Jumlah Transaksi per Kasir" di laporan bulanan sebagai pembanding pembukuan manual Arif. | Mendukung skenario Arif/keluarga gantian jadi kasir 2/3/dst. |
| **D-12** | **Format struk baru** (lihat Part 1) — header "NGEMILOH", waktu lengkap (detik), No. Transaksi, Kasir, Pelanggan, item+modifier (mengikuti gaya indentasi referensi), Subtotal/Diskon/Total, blok pembayaran kondisional (Tunai/QRIS/Split), footer Instagram + placeholder QR pengaduan. | Sesuai referensi struk yang diberikan Arif, diadaptasi ke skema Ngemiloh. |
| **D-13** | **Tidak ada "Jenis Order"/meja/dine-in** di manapun (skema, struk, UI). Semua order = takeaway. | Sesuai konfirmasi Arif. |
| **D-14** | **Idempotency**: pola "state-check + row lock" (bukan idempotency-key generic) untuk semua endpoint state-changing (`payment`, `void`, `ubah metode bayar`, webhook). Jika state sudah di target, return state saat ini (no-op), dibungkus `SELECT ... FOR UPDATE`. | Cukup untuk skala 1-3 kasir, selaras state machine yang sudah didesain, tanpa infra tambahan. |
| **D-15** | **Tidak ada label Fase** di seluruh dokumen. Bagian roadmap = **checklist implementasi terurut** untuk eksekusi langsung (Arif full-time + Claude Code). | Permintaan eksplisit Arif — semua fitur tuntas dalam satu spesifikasi. |
| **D-16** | **BOM/HPP & Raw Material, Profit-Share multi-kasir**: masuk scope penuh (kode sudah mengimplementasikan sebagian besar — `inventory` & `finance` module sudah ada). | Konsisten dengan D-15; tinggal verifikasi kelengkapan saat deep-dive. |
| **D-17** | **RCPT-02 (v4.0) di-supersede**: struk v5 BOLEH menampilkan QR code (khusus link pengaduan) + handle Instagram. Yang TETAP dilarang: logo Halal & nomor sertifikat halal (alasan compliance, tidak berubah). | Selaras referensi struk Minarko + permintaan eksplisit Arif (poin 8). |
| **D-18** | **SHIFT-06/07 (v4.0) disesuaikan**: `planned_close_at` jadi OPSIONAL (tidak wajib diisi saat login meski ≥17:00). Jika kosong, default `auto_close_at = (shift_date + 1) 04:00 WIB`. | v4.0 mewajibkan input + auto-close 23:00 jika login≥17:00 — berisiko menutup paksa shift yang sah berjalan lintas tengah malam (skenario Arif poin 4). Default 04:00 memberi ruang aman, tetap jadi safety-net jika kasir lupa. |

---

## 0.3 Item yang Masih Menunggu Input Arif (non-blocking — bisa menyusul)

- Alamat outlet untuk header struk.
- Handle Instagram resmi (placeholder saat ini: `@ngemiloh.id`).
- Link/QR pengaduan (disebut "menyusul" — slot di struk sudah disiapkan, kosong dulu).
- Konfirmasi makna "jenis pesanan" di poin #8 jika bukan yang diasumsikan di D-12 (lihat draf struk).

---

## 0.4 Status Penyusunan Dokumen

- [x] Part 0 — Document Control & Decisions Log
- [x] Part 1 — Business Rules & Functional Requirements
- [ ] Part 2 — Database Schema
- [ ] Part 3 — API Contract
- [ ] Part 4 — Frontend Architecture
- [ ] Part 5 — Infrastructure & Deployment
- [ ] Part 6 — Bug/Fix Checklist & Testing

---

# PART 1 — Business Rules & Functional Requirements

> **Catatan**: Semua aturan di bawah ini menggantikan seksi 6 dan 9 dari PRD v4.0. Setiap baris yang diberi tag `⚠️ PERUBAHAN` atau `🆕 BARU` berarti berbeda dari v4.0 atau kode saat ini — inilah yang HARUS diimplementasikan/diperbaiki.

---

## 1.1 Sistem Role & RBAC

Sistem hanya memiliki **2 role**. Tidak ada role lain.

| Role | Login | Akses |
|---|---|---|
| `kasir` | PIN 4–6 digit | Halaman POS saja: transaksi, cetak struk, lihat riwayat shift aktif |
| `superadmin` | Email + password  | Semua: admin dashboard, CRUD produk/kasir, laporan, pengaturan, void, bagi hasil |

**Permission Matrix:**

| Fitur | Kasir | Superadmin |
|---|---|---|
| Buat order | ✅ | ✅ |
| Bayar order (tunai/QRIS/split) | ✅ | ✅ |
| Cetak struk | ✅ | ✅ |
| Lihat riwayat (shift aktif) | ✅ | ✅ |
| Void transaksi | ❌ | ✅ |
| CRUD produk | ❌ | ✅ |
| CRUD modifier/kategori | ❌ | ✅ |
| CRUD kasir | ❌ | ✅ |
| Lihat/export laporan | ❌ | ✅ |
| Konfigurasi bagi hasil | ❌ | ✅ |
| Konfigurasi diskon | ❌ | ✅ |
| Konfigurasi BOM/HPP | ❌ | ✅ |
| System health & logs | ❌ | ✅ |
| Settings aplikasi | ❌ | ✅ |

---

## 1.2 Business Rules Master List

### AUTH — Autentikasi

| ID | Rule | Detail | Status |
|---|---|---|---|
| AUTH-01 | Login kasir via PIN | Endpoint: `POST /auth/login`. Payload: `{ pin: string }`. PIN 4–6 digit numerik, unik per kasir, di-hash (bcrypt + pepper via `PIN_PEPPER_SECRET`). Sistem akan mencari kasir yang PIN-nya cocok. | ✅ Ada di kode |
| AUTH-02 | Login admin — step 1: email + password | Endpoint: `POST /auth/login`. Payload: `{ email: string, password: string }`. Password min 16 karakter, wajib ada huruf besar/kecil/angka/simbol. Setelah valid → kirim kode OTP 6-digit ke email bisnis, **jangan** langsung issue token. | ✅ Parsial (tidak ada OTP step) |
| AUTH-03 | ⚠️ PERUBAHAN — Login admin — step 2: verifikasi OTP | Endpoint: `POST /auth/verify-otp`. Payload: `{ otp: string }`. OTP 6-digit numerik, expired 10 menit, satu kali pakai. Setelah valid → issue `access_token`, set HttpOnly cookie. | 🆕 Belum ada |
| AUTH-04 | ⚠️ PERUBAHAN — Kirim ulang OTP | Endpoint: `POST /auth/resend-otp`. Hanya bisa dipanggil setelah step 1 berhasil (session OTP temp masih ada di Redis). Kirim OTP baru, invalidate OTP lama. Rate limit: 3 req / 10 menit per IP. | 🆕 Belum ada |
| AUTH-05 | ⚠️ PERUBAHAN — Token kasir: 20 jam, TANPA refresh | `access_token` kasir expiry **20 jam** (cover shift lintas tengah malam). **Tidak ada `refresh_token`**. Kasir tidak perlu re-login selama shift. | ⚠️ Kode saat ini: 8h + refresh 7d |
| AUTH-06 | ⚠️ PERUBAHAN — Token admin: 12 jam, TANPA refresh | `access_token` admin expiry **12 jam**. **Tidak ada `refresh_token`**. Setelah expired → harus login ulang (OTP baru dikirim). | ⚠️ Kode saat ini: 8h + refresh 7d |
| AUTH-07 | HttpOnly cookie, Secure, SameSite | Token disimpan di HttpOnly cookie: `access_token`, `Secure=true`, `SameSite=Strict`, `Path=/`. **HTTPS wajib** (via fix Caddyfile nip.io — D-04). | ⚠️ HTTPS belum aktif |
| AUTH-08 | CSRF — Double Submit Cookie | Setiap login → generate token CSRF random (32 bytes hex) → set di cookie `X-CSRF-Token` (non-HttpOnly, Secure, SameSite=Strict). Setiap mutating request (POST/PUT/PATCH/DELETE) → validasi header `X-CSRF-Token` = cookie `X-CSRF-Token`. Frontend baca cookie → kirim di header. | ✅ Ada di kode |
| AUTH-09 | Brute force protection — IP & akun | IP lockout setelah 5x gagal dalam 10 menit → locked 30 menit. Akun locked setelah 5x gagal → locked 30 menit → kirim email alert ke `nabilah.fnb@gmail.com`. | ✅ Ada di kode |
| AUTH-10 | Satu session aktif per pengguna | Saat login berhasil (setelah OTP untuk admin), token lama dimasukkan ke `RevokedToken` (invalidate). Hanya 1 token aktif per pengguna. | ✅ Ada di kode |
| AUTH-11 | Logout | `POST /auth/logout` → masukkan `access_token` ke `RevokedToken` (hash SHA-256) → hapus cookies. Kasir: cek shift masih terbuka → jika ya, return error "Tutup shift terlebih dahulu". | ✅ Ada di kode |
| AUTH-12 | ⚠️ HAPUS — Refresh token | Endpoint `/auth/refresh`, method `refreshToken()` di service, `JWT_REFRESH_SECRET`, `JWT_REFRESH_EXPIRES`, dan semua refresh logic di frontend (`api.client.ts`) **DIHAPUS TOTAL**. `RevokedToken` table **dipertahankan** (masih dipakai untuk logout revocation). | ⚠️ Ada di kode — HARUS DIHAPUS |
| AUTH-13 | 🆕 Force PIN change setelah reset | Setelah superadmin reset PIN kasir, flag `must_change_pin = true` di tabel `users`. Saat kasir login berikutnya, tampilkan halaman "Ganti PIN Baru" yang tidak bisa di-skip. Setelah kasir input PIN baru → set `must_change_pin = false`. Audit log: `PIN_RESET` (oleh SA) + `PIN_CHANGED` (oleh kasir). | 🆕 Field ada di schema (`must_change_pin`) |

---

### SHIFT — Shift & Kas

| ID | Rule | Detail | Status |
|---|---|---|---|
| SHIFT-01 | Kas awal wajib sebelum transaksi | Setelah login, kasir WAJIB selesaikan flow "Buka Shift" sebelum bisa membuat transaksi. Modal tidak bisa di-dismiss. | ✅ Ada di kode |
| SHIFT-02 | Carry-over otomatis | Jika ada shift sebelumnya di hari yang sama (outlet yang sama, kasir manapun) dan sudah ditutup → `opening_balance = last_shift.closing_balance`. Field jadi read-only di UI, tampilkan info sumber carry-over. | ✅ Ada di kode |
| SHIFT-03 | Carry-over tidak ada → input manual | Jika tidak ada shift sebelumnya, kasir input kas awal (≥ 0). | ✅ Ada di kode |
| SHIFT-04 | Multiple shift per hari | Boleh lebih dari 1 shift per hari. Setiap shift mendapat `shift_number` = jumlah shift hari ini + 1 (per outlet). | ✅ Ada di kode |
| SHIFT-05 | Tutup shift → rekonsiliasi kas | UI tampilkan ringkasan: kas awal, total penjualan tunai, total penjualan QRIS, kas akhir (expected). Kasir input `actual_cash` (kas fisik di laci) → sistem hitung `discrepancy = actual_cash - expected_closing`. | ✅ Ada di kode |
| SHIFT-06 | ⚠️ PERUBAHAN — Auto-close: planned_close_at OPSIONAL | `planned_close_at` boleh tidak diisi (tidak wajib meski login ≥ 17:00). Jika tidak diisi → `auto_close_at = (shift_date + 1 hari) 04:00 WIB` (safety net). Jika diisi → `auto_close_at = planned_close_at + 1 jam`. | ⚠️ v4.0: wajib jika login ≥ 17:00 |
| SHIFT-07 | Auto-close via BullMQ | Saat `auto_close_at` tercapai dan shift masih terbuka → tutup shift otomatis, `is_auto_closed = true`, `actual_cash = NULL`. Invalidate session JWT kasir (masukkan token ke `RevokedToken`). Log di `system_logs` (level: warn). | ✅ Ada di kode |
| SHIFT-08 | Warning 90 menit sebelum auto-close | BullMQ job terjadwal 90 menit sebelum `auto_close_at` → kirim SSE event ke UI POS kasir. Tampilkan notifikasi persistent. | ✅ Ada di kode |
| SHIFT-09 | **Unit business-date = shift, BUKAN tanggal kalender** | Semua laporan/agregasi per-hari menggunakan rentang waktu shift (`opened_at`..`closed_at/now`), **BUKAN** `created_at::date`. Order jam 00:30 pada shift yang dibuka hari sebelumnya = tetap masuk laporan hari shift dibuka. **Aturan ini berlaku di SEMUA query laporan.** | ✅ Sudah benar di kode |
| SHIFT-10 | Logout kasir wajib tutup shift | Jika kasir coba logout dan shift masih terbuka → tampilkan prompt "Tutup shift terlebih dahulu". Tidak bisa bypass. | ✅ Ada di kode |
| SHIFT-11 | 🆕 Laporan jumlah transaksi per kasir di shift | Pada summary tutup shift dan laporan shift admin: tampilkan `transaction_count` per kasir (untuk pembukuan bagi hasil manual Arif). | 🆕 Perlu ditambah ke output FR-SHIFT-02 |

---

### TRX — Transaksi & Pembayaran

| ID | Rule | Detail | Status |
|---|---|---|---|
| TRX-01 | Format nomor transaksi | `TRX-YYYYMMDD-[HurufKasir][Seq3digit]`. `HurufKasir` = field `cashier_letter` di tabel `users` (A, B, C...). `Seq` = 3-digit counter, reset per hari per kasir. Contoh: `TRX-20260614-A001`. Berlaku untuk online maupun offline. | ✅ Ada di skema, perlu verifikasi generation logic |
| TRX-02 | 🆕 Field customer_name di order | Order memiliki field `customer_name` (VARCHAR 50, nullable). Kasir isi nama panggilan pelanggan opsional. Ditampilkan di struk dan bisa dipanggil saat pesanan siap. | 🆕 Belum ada di schema — TAMBAHKAN |
| TRX-03 | Order status terpisah dari payment status | `order_status`: `pending`, `completed`, `voided`, `cancelled`, `pending_sync`. `payment_status`: `pending`, `settled`, `expired`, `failed`. Independen. | ✅ Ada di kode |
| TRX-04 | Flexible payment — metode dipilih setelah order dibuat | Order dibuat `POST /orders` → `payment_status = 'pending'`, `payment_method` belum diset. Kasir pilih metode bayar di langkah berikutnya. Metode bisa diubah selama `payment_status = 'pending'`. | ✅ Ada di kode |
| TRX-05 | 3 metode pembayaran | `cash` (tunai), `qris` (QRIS via Midtrans), `split` (tunai + QRIS). | ✅ Ada di kode |
| TRX-06 | Pembayaran tunai — nominal & kembalian | Preset tombol: 5K, 10K, 20K, 50K, 100K + input manual + tombol "Uang Pas". `cash_received ≥ total_amount`. `cash_change = cash_received - total_amount`. "Uang Pas" → `cash_received = total_amount`, `cash_change = 0`. | ✅ Ada di kode |
| TRX-07 | Pembayaran QRIS — countdown 15 menit | Generate QR Midtrans → countdown 15 menit di UI. Jika expired → `payment_status = 'expired'`. Kasir bisa generate QR baru (`payment_status` kembali ke `pending`, Midtrans `transaction_id` baru). | ✅ Ada di kode |
| TRX-08 | Split payment flow | 1) Kasir input porsi tunai → 2) Input uang diterima (porsi tunai) → 3) Hitung kembalian porsi tunai → 4) Generate QR untuk sisa (`total - porsi_tunai`). QRIS sisa harus settled agar `payment_status = 'settled'`. | ✅ Ada di kode |
| TRX-09 | Void — hanya Superadmin | `POST /admin/orders/:id/void`. Validasi di dua layer: (1) NestJS Guard cek role `superadmin`, (2) DB CHECK constraint. Void hanya bisa untuk `order_status = 'completed'`. | ✅ Ada di kode |
| TRX-10 | State-check idempotency + row lock | Setiap endpoint state-changing (`/orders/:id/payment`, `void`, ubah metode bayar, webhook Midtrans) WAJIB: (1) `SELECT ... FOR UPDATE` pada baris order terkait, (2) cek state sebelum proses. Jika sudah di target state → return state saat ini (no-op, 200 OK). | ⚠️ Perlu verifikasi konsistensi di semua service |
| TRX-11 | Max qty per item = 50 | Validasi di frontend DAN backend. | ✅ Ada di kode |
| TRX-12 | Merge cart item | Produk + modifier identik → qty di-merge. Modifier berbeda → line item terpisah. | ✅ Ada di kode |
| TRX-13 | Tidak ada catatan per item | Tidak ada field notes/catatan per item atau per order. Modifier popup sudah cukup. | ✅ Sesuai blueprint baru |
| TRX-14 | Offline: hanya tunai | Saat `navigator.onLine = false` atau heartbeat ping gagal → hanya metode `cash` yang aktif. QRIS memerlukan koneksi ke Midtrans. | ✅ Ada di kode |
| TRX-15 | Webhook Midtrans idempotency | Jika `payment_status` order sudah `settled` saat webhook datang → return 200 OK tanpa reprocess. Normal (Midtrans retry adalah standar). | ⚠️ Perlu verifikasi di webhook handler |

---

### PROD — Produk & Modifier

| ID | Rule | Detail | Status |
|---|---|---|---|
| PROD-01 | Tidak ada hard limit produk | Praktis ~70 produk (constraint disk foto). Owner input sendiri dari admin. | ✅ |
| PROD-02 | Upload foto produk | Sharp → WebP 600×600, max 500KB, simpan ke `/static/products/{uuid}.webp`. Foto lama dihapus saat update. Disajikan via Caddy static. | ✅ Ada di kode |
| PROD-03 | Harga total item | `item_total = (base_price + SUM(modifier_prices)) × qty`. Modifier tidak boleh negatif. | ✅ |
| PROD-04 | Modifier group wajib & opsional | `is_required = true` → kasir wajib pilih sebelum tambah ke keranjang. `max_selection` menentukan berapa opsi bisa dipilih. | ✅ Ada di kode |
| PROD-05 | Modifier wajib punya opsi "Tanpa [X]" | Setiap modifier group wajib punya ≥ 1 opsi default Rp 0. Ini dipakai jika kasir tidak pilih modifier opsional. | ✅ |
| PROD-06 | Arsip produk (tidak hapus) | `is_active = false`. Tidak muncul di POS tapi tetap di data historis transaksi. | ✅ |
| PROD-07 | Scheduled price change | `new_base_price` + `new_price_effective_from` (min H+1). BullMQ cron 00:01 WIB apply perubahan. Satu jadwal per produk. | ✅ Ada di kode |
| PROD-08 | Out of stock toggle | `is_out_of_stock = true` → produk tampil di POS (bisa dilihat) tapi tidak bisa ditambah ke keranjang (tombol disabled). | ✅ Ada di skema |

---

### DISC — Diskon

| ID | Rule | Detail | Status |
|---|---|---|---|
| DISC-01 | Diskon diterapkan ke base_price | Diskon dihitung dari `base_price` saja, bukan dari total termasuk modifier. `discounted_base = base_price × (1 - discount_pct/100)`. `item_total = (discounted_base + SUM(modifiers)) × qty`. | ✅ Ada di kode |
| DISC-02 | Tipe diskon | `percentage` (%) atau `fixed` (nominal Rp). | ✅ Ada di skema |
| DISC-03 | Periode aktif | `start_date`, `end_date`, `applicable_days` (array INT: 0=Minggu, 1=Senin, ..., 6=Sabtu). | ✅ Ada di skema |
| DISC-04 | Cron aplikasi diskon | BullMQ cron tiap menit cek diskon yang harusnya aktif/nonaktif. Flag `manually_disabled = true` → cron **tidak** meng-override balik ke aktif. | ✅ Ada di kode |
| DISC-05 | Kasir tidak bisa ubah diskon | Diskon hanya bisa dibuat/diedit oleh Superadmin. Kasir hanya melihat efek diskon di total harga. | ✅ |

---

### RCPT — Struk Pelanggan

| ID | Rule | Detail | Status |
|---|---|---|---|
| RCPT-01 | Lebar kertas | `58mm` atau `80mm`. Dikonfigurasi per-kasir via dropdown di UI POS (tersimpan di `settings` atau `localStorage`). Layout otomatis menyesuaikan. | ✅ (perlu ganti ke HTML print) |
| RCPT-02 | ⚠️ PERUBAHAN — Teknologi cetak | **HTML Print Dialog** (`window.print()` + CSS `@media print`) menggantikan Web Bluetooth + ESC/POS. Kompatibel: Windows (USB/BT driver bawaan) dan Android (via RawBT app). | ⚠️ Kode saat ini: Web Bluetooth ESC/POS |
| RCPT-03 | Konten struk (format final) | Lihat spesifikasi lengkap di bawah (1.3). | 🆕 Format baru |
| RCPT-04 | Cetak setelah settled | Struk hanya bisa dicetak setelah `payment_status = 'settled'`. Ada opsi cetak ulang dari riwayat transaksi shift aktif. | ✅ |
| RCPT-05 | Tidak ada logo Halal | Logo Halal dan nomor sertifikat halal **tidak** ditampilkan di struk. | ✅ |
| RCPT-06 | 🆕 Footer Instagram | Baris footer: nama akun Instagram (dari `settings.store_instagram`). QR pengaduan: placeholder — akan diisi kemudian (slot sudah disiapkan). | 🆕 |

---

### HPP — Harga Pokok Penjualan & Bagi Hasil

| ID | Rule | Detail | Status |
|---|---|---|---|
| HPP-01 | Estimated HPP (manual) | Owner input `estimated_hpp` per produk dari admin panel. `hpp_source = 'manual_estimate'`. Dipakai untuk kalkulasi profit sementara sebelum BOM. | ✅ Ada di kode |
| HPP-02 | BOM HPP (otomatis) | BOM: daftar bahan baku + qty per unit + harga per unit per produk. `bom_hpp = SUM(qty_per_unit × price_per_unit)`. Setelah BOM diisi → `hpp_source = 'bom_calculated'`, override `estimated_hpp`. | ✅ Ada di kode |
| HPP-03 | Profit per item | `profit = selling_price - hpp`. Jika `hpp = NULL` → tampilkan "N/A" di laporan. | ✅ |
| HPP-04 | Formula bagi hasil | Owner input `owner_percentage` (%) dan `cashier_pool_percentage` (%) di settings. Contoh default: **Owner 60%, Kasir pool 40%**. `net_profit = total_revenue - total_hpp`. `owner_share = net_profit × owner_pct`. `cashier_pool = net_profit × cashier_pool_pct`. | ✅ Ada di kode |
| HPP-05 | Bagi hasil multi-kasir | Per kasir: `share_pct = trx_count_kasir / total_trx_semua_kasir`. `share_amount = cashier_pool × share_pct`. Tersimpan di `profit_share_details`. | ✅ Ada di kode |
| HPP-06 | 🆕 Kolom jumlah transaksi per kasir di laporan bulanan | Laporan profit-share menampilkan: nama kasir, jumlah transaksi, total revenue kontribusi, share %, share amount (Rp). Untuk validasi pembukuan manual Arif. | ✅ Ada di kode (verifikasi kolom) |

---

### OFFL — Offline Mode

| ID | Rule | Detail | Status |
|---|---|---|---|
| OFFL-01 | Deteksi koneksi | `navigator.onLine` + heartbeat ping ke `/health` setiap 30 detik. | ✅ Ada di kode |
| OFFL-02 | Simpan transaksi offline di Dexie (IndexedDB) | Seluruh data transaksi: item, modifier, qty, harga, diskon. Tersimpan di tabel Dexie `orders` dengan `sync_status = 'pending'`. | ✅ Ada di kode |
| OFFL-03 | Dual timestamp | `client_created_at` (waktu di browser, untuk laporan keuangan). `synced_at` (waktu berhasil sync ke server). | ✅ Ada di skema |
| OFFL-04 | Retry: exponential backoff + layer 2 | Layer 1: retry 3x (5s, 15s, 45s). Layer 2: retry tiap 5 menit sampai 2 jam. Setelah 2 jam: `sync_status = 'failed'` → minta intervensi manual. | ✅ Ada di kode |
| OFFL-05 | Modal konfirmasi saat sync | Saat koneksi pulih dan ada pending transaksi → tampilkan modal: jumlah pending, total nominal, detail. Kasir konfirmasi → batch sync. | ✅ Ada di kode |
| OFFL-06 | Badge counter pending | Header POS: badge kuning (pending) atau merah (failed) menunjukkan jumlah transaksi belum sync. | ✅ Ada di kode |

---

### RPT — Laporan

| ID | Rule | Detail | Status |
|---|---|---|---|
| RPT-01 | Laporan harian | `GET /admin/reports/daily?date=YYYY-MM-DD`. Output: `total_revenue`, `total_transactions`, `total_cash`, `total_qris`, `total_split`, `total_discount`, `total_void`, `avg_transaction_value`, `top_products[]`, `hourly_breakdown[]`. **Semua waktu dalam WIB. Filter berbasis rentang shift, bukan `created_at::date`.** | ✅ Ada di kode |
| RPT-02 | Laporan periodik | `GET /admin/reports/periodic?start_date=&end_date=&group_by=day/week/month`. Output: per periode: revenue, transaksi, avg value, growth %. | ✅ Ada di kode |
| RPT-03 | Laporan shift | `GET /admin/reports/shifts?start_date=&end_date=&cashier_id=`. Per shift: kasir, buka/tutup, durasi, kas awal/akhir/aktual, selisih, jumlah transaksi, is_auto_closed. | ✅ Ada di kode |
| RPT-04 | Export laporan | `GET /admin/reports/export?type=...&format=csv/pdf&start_date=&end_date=`. Rate limit: 5 req / 1 jam. | ✅ Ada di kode |
| RPT-05 | Laporan profitabilitas | `GET /admin/reports/profitability?start_date=&end_date=`. Per produk: qty_sold, revenue, hpp_per_unit, hpp_source, total_hpp, gross_profit, gross_margin_pct. Summary: total_revenue, total_hpp, total_gross_profit, overall_margin_pct. | ✅ Ada di kode |

---

### CSH — Manajemen Kasir

| ID | Rule | Detail | Status |
|---|---|---|---|
| CSH-01 | CRUD kasir dari admin panel | Create: `name`, `pin` (4–6 digit), `cashier_letter` (A–Z, unik). Sistem hash PIN dengan bcrypt + pepper. | ✅ Ada di kode |
| CSH-02 | Reset PIN kasir | Superadmin generate PIN baru (random 4-digit otomatis, **tidak dipilih SA**) → tampil sekali di layar → `must_change_pin = true` → invalidate session kasir aktif. | ⚠️ Kode: SA input PIN baru manual |
| CSH-03 | Toggle aktif/nonaktif kasir | Nonaktifkan: `is_active = false`, invalidate session, tutup shift otomatis jika aktif. | ✅ Ada di kode |
| CSH-04 | Multi-akun kasir (unlimited) | Tidak ada batas jumlah akun kasir yang bisa dibuat. Cocok untuk rotasi anggota keluarga/karyawan. | ✅ Ada di kode |

---

### GEN — Aturan Umum

| ID | Rule | Detail | Status |
|---|---|---|---|
| GEN-01 | Timezone: Asia/Jakarta (WIB, UTC+7) | DB simpan dalam UTC (`TIMESTAMPTZ`). Konversi ke WIB di application layer. UI selalu tampilkan WIB. | ✅ |
| GEN-02 | Mata uang: IDR, bilangan bulat | Semua nominal = integer (Rp), disimpan `DECIMAL(12,0)`. Tidak ada desimal sen. | ✅ |
| GEN-03 | Rate limiting | NestJS throttler, sliding window per IP. Lihat tabel rate limit (1.4). | ✅ |
| GEN-04 | Partisi tabel `orders` | Range bulanan berdasarkan `created_at`. BullMQ cron setiap 1 Desember buat 12 partisi tahun depan. Idempotent (skip jika sudah ada). | ✅ Ada di kode |
| GEN-05 | System logs | Tabel `system_logs`: level (info/warn/error), source, message, metadata (JSONB). | ✅ |
| GEN-06 | Responsive | POS: dioptimasi untuk tablet landscape (min 768px). Admin dashboard: mobile/tablet/desktop. | ✅ |
| GEN-07 | Kode wajib simpel | Tidak ada abstraksi berlebihan. Jika ada pilihan: pilih yang lebih sedikit baris kode dan lebih mudah dibaca. | Prinsip aktif |

---

### SET — Pengaturan Aplikasi

| Key | Tipe | Default | Keterangan |
|---|---|---|---|
| `shift_late_threshold` | INT (menit) | 30 | Batas telat tutup shift setelah `planned_close_at` |
| `cash_presets` | JSON array | [5000,10000,20000,50000,100000] | Preset tombol nominal tunai |
| `receipt_paper_width` | ENUM | '80mm' | Lebar kertas struk |
| `store_name` | STRING | 'Ngemiloh' | Nama brand di struk |
| `store_address` | STRING | '' | Alamat di struk |
| `store_instagram` | STRING | '' | Handle IG di footer struk (contoh: `@ngemiloh.id`) |
| `owner_profit_pct` | INT | 60 | Persentase bagi hasil owner |
| `cashier_pool_pct` | INT | 40 | Persentase bagi hasil pool kasir |

---

### Rate Limit Tabel

| Endpoint | Limit | Window |
|---|---|---|
| `/auth/login` | 5 req | 10 menit per IP |
| `/auth/verify-otp` | 5 req | 10 menit per IP |
| `/auth/resend-otp` | 3 req | 10 menit per IP |
| `/orders` (POST) | 30 req | 1 menit per IP |
| `/orders/sync-batch` | 10 req | 1 menit per IP |
| `/payment/qris/create` | 10 req | 1 menit per IP |
| `/admin/orders/:id/void` | 5 req | 10 menit per IP |
| `/admin/reports/export` | 5 req | 1 jam per IP |
| `/admin/products` (POST/PUT) | 20 req | 1 menit per IP |
| Semua endpoint lain | 100 req | 1 menit per IP |

---

## 1.3 Spesifikasi Struk Final

### Format Visual (80mm — lebar cetak 72mm, font Courier New/monospace)

```
          NGEMILOH
       Jl. [Alamat Outlet]
================================
Waktu  : 14/06/2026 19:34:07
No Trx : TRX-20260614-A001
Kasir  : Vivi
Pelgn  : Budi
--------------------------------
1x Mie Tek-tek          15.000
1x Petarung Solo-Knyang 35.000
    + Wortel
    + Dimsum
    + Es Teh
--------------------------------
Subtotal 2 Item         50.000
Diskon                       0
TOTAL                   50.000
================================
Tunai              Rp 100.000
Total Bayar        Rp  50.000
Kembalian          Rp  50.000
================================
      Terima kasih!
      IG: @ngemiloh.id
================================
```

### Catatan format:
- **Header**: Nama brand `NGEMILOH` (besar, tengah), alamat outlet dari `settings.store_address`
- **Waktu**: `DD/MM/YYYY HH:MM:SS` (WIB, termasuk detik)
- **No Trx**: = nomor urut transaksi, format `TRX-YYYYMMDD-[HurufKasir][Seq3]`
- **Pelanggan**: field `customer_name` dari order. Jika `NULL` → baris ini **tidak ditampilkan** (bukan "Pelgn: -")
- **Item**: nama produk snapshot (dari `product_name_snapshot`), qty × harga satuan, subtotal per baris. Modifier ditampilkan baris indentasi di bawah item (`    + NamaModifier`)
- **Diskon**: jika `discount_total = 0` → baris Diskon **tidak ditampilkan**
- **Blok pembayaran**:
  - Tunai: tampilkan "Tunai", "Total Bayar", "Kembalian"
  - QRIS: tampilkan "QRIS", "Total Bayar", "Status: LUNAS"
  - Split: tampilkan "Tunai", "QRIS", "Total Bayar", "Kembalian (tunai)"
- **Footer**: "Terima kasih!" + handle IG dari `settings.store_instagram`
- **QR Pengaduan**: placeholder → jika `settings.complaint_url` diisi, tampilkan QR. Saat ini kosong.

### Format 58mm (lebar cetak 48mm):
- Sama, hanya teks lebih pendek (crop nama produk di baris 16 karakter jika perlu)
- Modifier: baris `+ [nama]` saja tanpa indentasi spasi

---

## 1.4 User Journey Kritis

### Journey A: Kasir — Buka Shift & Transaksi

```
1. Buka URL → Halaman Login POS
2. Input PIN → POST /auth/login → terima cookie access_token (20h)
3. Cek must_change_pin:
   - true → halaman "Ganti PIN" (wajib, tidak bisa skip)
   - false → lanjut
4. GET /shifts/current:
   - Shift sudah terbuka → langsung ke halaman POS
   - Belum ada shift → Modal "Buka Shift":
     * Carry-over: tampilkan jumlah + sumber (read-only)
     * Tidak ada carry-over: input kas awal (≥ 0)
     * Input optional: planned_close_at
     * Tombol "Mulai Jualan"
5. POST /shifts/open → redirect ke halaman POS

[Proses transaksi]
6. Pilih produk → popup modifier (jika ada grup required)
7. Produk masuk keranjang
8. Input customer_name (opsional, bisa kosong)
9. Tombol "BAYAR" → modal pilih metode:
   a. Tunai: input uang diterima → hitung kembalian → konfirmasi
   b. QRIS: GET /payment/qris/create → tampilkan QR + countdown 15 menit
   c. Split: input porsi tunai dulu → QR untuk sisa
10. POST /orders (buat order) → POST /orders/:id/payment
11. payment_status = 'settled' → tampilkan struk → window.print()
12. Kembali ke POS (keranjang kosong)
```

### Journey B: Admin — Login dengan OTP

```
1. Buka URL /admin → Halaman Login Admin
2. Input email + password → POST /auth/login
3. Jika valid → "Kode OTP dikirim ke nabilah.fnb@gmail.com"
4. Halaman input OTP 6-digit + tombol "Kirim Ulang Kode"
5. Input OTP → POST /auth/verify-otp
6. Jika valid → terima cookie access_token (12h) → redirect ke /admin/dashboard
7. Sesi expired → logout otomatis → ulangi dari langkah 1
```

### Journey C: Kasir — Tutup Shift & Logout

```
1. Tombol "Tutup Shift" di POS
2. Tampilkan ringkasan: kas awal, total penjualan tunai, total QRIS,
   kas akhir expected, jumlah transaksi hari ini
3. Kasir input kas fisik aktual (actual_cash)
4. POST /shifts/:id/close → tampilkan selisih kas
5. Konfirmasi → shift tertutup
6. Tombol "Logout" → POST /auth/logout → akses_token direvoke → redirect ke halaman login
```

### Journey D: Offline Mode

```
1. Koneksi putus → badge merah di header POS
2. Transaksi berlanjut → hanya metode "Tunai" yang tersedia (QRIS disable)
3. Transaksi tersimpan di Dexie (IndexedDB), sync_status = 'pending'
4. Badge counter: "3 belum sync"
5. Koneksi kembali → modal konfirmasi sync: "3 transaksi pending - Rp 75.000"
6. Kasir konfirmasi → POST /orders/sync-batch (batch)
7. Jika sukses → sync_status = 'synced'
8. Jika gagal (stok habis dll) → sync_status = 'failed' → tab "Error Sync" untuk cek manual
```
