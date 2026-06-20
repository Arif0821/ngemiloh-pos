# 04. Functional Requirements

*[← 03-journeys-flows.md](./03-journeys-flows.md) | [→ 05-nonfunctional-reqs.md](./05-nonfunctional-reqs.md)*

---

> **Versi:** 4.1 — Perubahan dari v4.0 ditandai **`[v4.1]`** + nomor CR.
>
> **Format response** (`08-api-contract.md §CR-005, ADR-015`): sukses single resource = object langsung; sukses list = `{ "data": [...], "meta": {...} }`; error = `{ "statusCode", "error", "message", "details", "timestamp", "path" }`.

---

## 9.1 Modul Autentikasi (FR-AUTH)

### FR-AUTH-01: Login Kasir

| Atribut | Detail |
|---------|--------|
| **Endpoint** | `POST /auth/login/cashier` |
| **Akses** | Public |
| **Input** | `{ "pin": "1234" }` (string, 4–6 digit numerik) |
| **Proses** | 1. Validasi format PIN (4–6 digit numerik). 2. Cari kasir dengan PIN yang cocok (bcrypt compare). 3. Pastikan kasir `is_active = true`. 4. Cek session aktif → jika ada, invalidate session lama (AUTH-05). 5. Buat session baru di Redis: key `sess:cashier:{uuid}`, value `{ cashier_id, name, role: 'cashier', cashier_letter }` **`[v4.1 — CR-004: outlet_id dihapus dari payload]`**, TTL = unlimited (AUTH-03). 6. Set HTTP-only cookie: `session_id={uuid}`, `SameSite=Strict`, `HttpOnly=true`, `Secure=true` (HTTPS), `Path=/`. |
| **Output `[v4.1 — CR-005]`** | `{ "cashier_id": "uuid", "name": "Rina", "role": "cashier", "cashier_letter": "A" }` |
| **Error** | 401: PIN salah atau kasir tidak aktif. 429: Rate limit exceeded. |
| **Rate Limit** | 5 req / 10 menit per-IP. |

### FR-AUTH-02: Login Admin

| Atribut | Detail |
|---------|--------|
| **Endpoint** | `POST /auth/login/admin` |
| **Akses** | Public |
| **Input** | `{ "email": "nabilah.fnb@gmail.com", "password": "..." }` |
| **Proses** | 1. Validasi format email. 2. Cari admin berdasarkan email. 3. Bcrypt compare password. 4. Cek session lama → invalidate jika ada. 5. Buat session di Redis: key `sess:admin:{uuid}`, value `{ admin_id, name, email, role: 'superadmin' }`, TTL = 24 jam (AUTH-04). 6. Set HTTP-only cookie sama seperti kasir. |
| **Output `[v4.1 — CR-005]`** | `{ "admin_id": "uuid", "name": "Nabilah", "email": "nabilah.fnb@gmail.com", "role": "superadmin" }` |
| **Error** | 401: Email/password salah. 429: Rate limit exceeded. |
| **Rate Limit** | 5 req / 10 menit per-IP. |

### FR-AUTH-03: Logout

| Atribut | Detail |
|---------|--------|
| **Endpoint** | `POST /auth/logout` |
| **Akses** | Kasir, Superadmin |
| **Proses** | 1. Ambil `session_id` dari cookie. 2. Jika role = kasir, cek apakah shift masih terbuka → jika ya, return error `SHIFT_NOT_OPEN` (400). 3. Hapus session dari Redis. 4. Hapus cookie dari browser. |
| **Output `[v4.1 — CR-005]`** | `{ "message": "Logout berhasil" }` |
| **Error** | 400 `SHIFT_NOT_OPEN`: Shift kasir masih terbuka. 401: Session tidak valid. |

### FR-AUTH-04: Session Validation (Guard)

| Atribut | Detail |
|---------|--------|
| **Tipe** | NestJS Guard — berjalan sebelum setiap protected endpoint |
| **Proses** | 1. Ambil `session_id` dari cookie. 2. Lookup di Redis. 3. Tidak ditemukan/expired → 401. 4. Valid → attach user context ke request. 5. Mutating request (POST/PUT/PATCH/DELETE) → validasi header `Origin` (AUTH-06). |
| **Cache** | Session data di-cache in-memory 60 detik untuk kurangi Redis roundtrip. |

### FR-AUTH-05: Role Guard

| Atribut | Detail |
|---------|--------|
| **Tipe** | NestJS Guard (decorator-based) |
| **Proses** | Validasi `role` dari session terhadap decorator `@Roles('superadmin')` atau `@Roles('cashier', 'superadmin')`. Return 403 jika tidak sesuai. |

---

## 9.2 Modul Shift & Kas (FR-SHIFT)

### FR-SHIFT-01: Buka Shift / Input Kas Awal

| Atribut | Detail |
|---------|--------|
| **Endpoint** | `POST /shifts/open` |
| **Akses** | Kasir, Superadmin |
| **Input** | `{ "opening_balance": 0, "planned_close_at": "2026-06-15T23:00:00+07:00" }` (`planned_close_at` opsional kecuali login ≥ 17:00 WIB) |
| **Proses** | 1. Validasi kasir belum punya shift terbuka. 2. Cek shift terakhir hari ini: a) Ada → `opening_balance = last_shift.closing_balance` (carry-over, SHIFT-02), input client di-ignore, set `carry_over_from_shift_id`. b) Tidak ada → gunakan `opening_balance` dari input (≥ 0, SHIFT-03). 3. Generate `shift_number` = count shifts hari ini + 1. 4. Jika login ≥ 17:00 WIB → `planned_close_at` wajib (SHIFT-06). `auto_close_at = planned_close_at + 1 jam` (SHIFT-07). 5. Simpan shift, `opened_at = NOW()`. 6. Schedule BullMQ jobs: auto-close + warning 90 menit (SHIFT-08). |
| **Output `[v4.1 — CR-005]`** | `{ "shift_id": "uuid", "shift_number": 1, "opening_balance": 150000, "carry_over_from": null, "planned_close_at": null, "auto_close_at": null }` |
| **Error** | 400: Shift sudah terbuka / `planned_close_at` wajib tapi tidak diisi. 401: Not authenticated. |

### FR-SHIFT-02: Tutup Shift

| Atribut | Detail |
|---------|--------|
| **Endpoint** | `POST /shifts/:id/close` |
| **Akses** | Kasir (shift sendiri), Superadmin |
| **Input** | `{ "actual_cash": 285000, "notes": "..." }` |
| **Proses** | 1. Validasi shift milik kasir & masih terbuka. 2. Hitung `closing_balance = opening_balance + total_cash_sales` (SUM orders tunai/split completed dalam shift ini). 3. `discrepancy = actual_cash - closing_balance`. 4. Update shift: `closed_at = NOW()`, `is_auto_closed = false`, kolom rekonsiliasi. 5. Cancel BullMQ auto-close job. |
| **Output `[v4.1 — CR-005]`** | `{ "shift_id": "uuid", "opening_balance": 150000, "closing_balance": 285000, "total_cash_sales": 135000, "total_qris_sales": 75000, "actual_cash": 285000, "discrepancy": 0, "transaction_count": 12, "closed_at": "2026-06-15T22:45:00Z" }` |

### FR-SHIFT-03: Auto-Close Shift (BullMQ Job)

| Atribut | Detail |
|---------|--------|
| **Tipe** | BullMQ Scheduled Job |
| **Trigger** | Saat `auto_close_at` tercapai (SHIFT-07) |
| **Proses** | 1. Cek shift masih terbuka → jika sudah ditutup, skip. 2. Hitung `closing_balance` (sama seperti tutup manual). 3. Update shift: `is_auto_closed = true`, `actual_cash = NULL`. 4. Invalidate session kasir dari Redis. 5. Catat di `system_logs` (severity: warning). |

### FR-SHIFT-04: Cek Status Shift

| Atribut | Detail |
|---------|--------|
| **Endpoint** | `GET /shifts/current` |
| **Akses** | Kasir, Superadmin |
| **Output** | Jika shift terbuka: data shift aktif lengkap. Jika tidak ada: `{ "has_open_shift": false, "carry_over": { "available": true, "amount": 150000, "from_shift_id": "uuid" } }` — digunakan frontend untuk tampilan modal kas awal. |

### FR-SHIFT-05: Warning 90 Menit Sebelum Auto-Close

| Atribut | Detail |
|---------|--------|
| **Tipe** | BullMQ Scheduled Job + Server-Sent Events (SSE) |
| **Trigger** | 90 menit sebelum `auto_close_at` |
| **Proses** | Kirim notifikasi ke UI POS kasir via SSE channel `/shifts/events`. Notifikasi persistent. Konten: *"Shift akan ditutup otomatis pada {auto_close_at}. Selesaikan transaksi dan tutup shift segera."* |

---

## 9.3 Modul Produk (FR-PROD)

### FR-PROD-01: List Produk (POS)

| Atribut | Detail |
|---------|--------|
| **Endpoint** | `GET /products` |
| **Akses** | Kasir, Superadmin |
| **Output** | `{ "data": [ { "id": "uuid", "name": "Cimol Keju", "base_price": 8000, "image_url": "/static/products/uuid.webp", "category_id": "uuid", "category_name": "Makanan", "modifier_groups": [...] } ], "qris_available": true }` **`[v4.1 — GEN-09]`** — field `qris_available` baru. |
| **Cache** | Response di-cache Redis 5 menit. Invalidasi eksplisit saat ada perubahan produk/diskon/kategori. Cache IndexedDB di client untuk offline access. |

### FR-PROD-02: CRUD Produk (Admin)

| Atribut | Detail |
|---------|--------|
| **Endpoints** | `POST /admin/products`, `GET /admin/products`, `GET /admin/products/:id`, `PUT /admin/products/:id`, `PATCH /admin/products/:id/archive`, `PATCH /admin/products/:id/unarchive` |
| **Akses** | Superadmin |
| **Create** | Input: `name` (wajib, unik di antara produk aktif), `description` (opsional), `base_price` (wajib, ≥ 0), `image` (file, opsional), `category_id` (wajib), `estimated_hpp` (opsional). Foto: Sharp → WebP 600×600 max 500KB → `/static/products/{uuid}.webp`. Invalidasi cache Redis `GET /products`. |
| **Archive** | Set `is_active = false`. Produk tidak muncul di POS. Reverse: `PATCH unarchive` → `is_active = true`. |
| **Rate Limit** | 20 req / 1 menit. |

### FR-PROD-03: Scheduled Price Change (Admin)

| Atribut | Detail |
|---------|--------|
| **Endpoint** | `PUT /admin/products/:id/schedule-price` |
| **Input** | `{ "new_base_price": 9000, "new_price_effective_from": "2026-06-16" }` |
| **Validasi** | `new_base_price > 0`. `new_price_effective_from ≥ besok (H+1)`. Satu jadwal per produk (tidak boleh ada `new_price_effective_from` pending). |
| **Cron** | BullMQ cron `0 1 * * *` (00:01 WIB) — apply semua produk dengan `new_price_effective_from = TODAY`. Log di `system_logs`. Invalidasi cache Redis. |
| **Output** | `{ "product_id": "uuid", "current_price": 8000, "new_price": 9000, "effective_from": "2026-06-16" }` |

### FR-PROD-04: CRUD Modifier Group & Items (Admin)

| Atribut | Detail |
|---------|--------|
| **Endpoints** | `POST /admin/products/:id/modifier-groups`, `PUT /admin/modifier-groups/:id`, `DELETE /admin/modifier-groups/:id`, `POST /admin/modifier-groups/:id/items`, `PUT /admin/modifier-items/:id`, `DELETE /admin/modifier-items/:id` |
| **Akses** | Superadmin |
| **Create Group** | Input: `name`, `is_required`, `max_selection` (default: 1), `sort_order`. Saat group dibuat, sistem auto-generate item "Tanpa {name}" dengan price = 0 (PROD-06). |
| **Delete** | Soft-delete (`is_active = false`) jika sudah digunakan di transaksi historis. Hard delete hanya jika belum ada di `order_item_modifiers`. |

### FR-PROD-05: CRUD Kategori (Admin)

| Atribut | Detail |
|---------|--------|
| **Endpoints** | `POST /admin/categories`, `GET /admin/categories`, `PUT /admin/categories/:id`, `DELETE /admin/categories/:id` |
| **Akses** | Superadmin |
| **Delete** | Ditolak jika masih ada produk aktif di kategori tersebut. |

---

## 9.4 Modul Transaksi (FR-TRX)

### FR-TRX-01: Buat Order

| Atribut | Detail |
|---------|--------|
| **Endpoint** | `POST /orders` |
| **Akses** | Kasir, Superadmin |
| **Input** | `{ "items": [ { "product_id": "uuid", "qty": 2, "modifier_item_ids": ["uuid-1", "uuid-2"] } ], "client_uuid": "unique-client-generated-uuid" }` — `client_uuid` untuk idempotency (TC-08). |
| **Proses** | 1. Validasi shift terbuka. 2. Validasi setiap item: produk aktif, qty 1–50, modifier valid, required groups terpenuhi. 3. Hitung harga per item (PROD-07). 4. Cek & aplikasikan diskon (DISC-06, DISC-08, DISC-09). 5. `total_amount = SUM(item_totals) - SUM(discounts)`. 6. Generate nomor transaksi: `TRX-{YYYYMMDD}-{cashier_letter}{seq:03d}` (TRX-01). 7. Simpan order: `order_status = 'completed'`, `payment_status = 'pending'`, `payment_method = NULL`. 8. Simpan `order_items` + `order_item_modifiers`. |
| **Output `[v4.1 — CR-005]`** | `{ "order_id": "uuid", "transaction_number": "TRX-20260615-A001", "items": [...], "total_amount": 27900, "discounts": [...], "order_status": "completed", "payment_status": "pending" }` |
| **Error** | 400: Validasi gagal (produk tidak aktif, qty out of range, modifier tidak valid). 403 `SHIFT_NOT_OPEN`: Shift belum dibuka. 429: Rate limit. |
| **Rate Limit** | **30 req / 1 menit** per-session. |

### FR-TRX-02: Pembayaran Tunai

| Atribut | Detail |
|---------|--------|
| **Endpoint** | `POST /orders/:id/pay/cash` |
| **Akses** | Kasir, Superadmin |
| **Input** | `{ "cash_received": 50000 }` |
| **Proses** | 1. `SELECT ... FOR UPDATE` pada row order (idempotency lock, `06-architecture.md §6.4`). 2. Validasi `payment_status IN ('pending', 'expired')`. 3. `cash_received ≥ total_amount`. 4. `cash_change = cash_received - total_amount`. 5. Update: `payment_method = 'cash'`, `payment_status = 'settled'`, `cash_received`, `cash_change`, **`payment_settled_at = NOW()`** `[v4.1 — CR-006]`. |
| **Output** | `{ "order_id": "uuid", "total_amount": 27900, "cash_received": 50000, "cash_change": 22100, "payment_status": "settled", "payment_settled_at": "2026-06-15T10:35:00Z" }` |
| **Error** | 409 `ORDER_ALREADY_PAID`: Order sudah dibayar. 422: `cash_received` kurang dari total. |

### FR-TRX-03: Pembayaran QRIS

| Atribut | Detail |
|---------|--------|
| **Endpoint** | `POST /payment/qris/create` |
| **Akses** | Kasir, Superadmin |
| **Input** | `{ "order_id": "uuid", "amount": 27900 }` |
| **Proses** | 1. Cek `qris_available` (circuit breaker + feature flag, GEN-09). 2. Validasi order `payment_status IN ('pending', 'expired')`. 3. Request ke Midtrans via `PaymentGateway` interface (bukan SDK langsung — `06-architecture.md §6.1`). 4. Update order: `payment_method = 'qris'`, `payment_status = 'pending'`. 5. Return QR data + expiry (15 menit). |
| **Output** | `{ "qr_url": "...", "qr_data": "...", "expires_at": "2026-06-15T10:50:00Z", "midtrans_transaction_id": "MID-..." }` |
| **Error** | 503 `QRIS_DEGRADED`: Circuit breaker aktif — sarankan tunai. |
| **Rate Limit** | 10 req / 1 menit. |
| **Webhook** | Midtrans callback → `POST /payment/webhook/midtrans`. Validasi SHA512 signature (13.5), update `payment_status = 'settled'`, `payment_settled_at = NOW()`, trigger notifikasi via SSE. |

### FR-TRX-04: Split Payment

| Atribut | Detail |
|---------|--------|
| **Endpoint** | `POST /orders/:id/pay/split` |
| **Akses** | Kasir, Superadmin |
| **Input** | `{ "cash_portion": 10000, "cash_received": 10000 }` |
| **Proses** | 1. `SELECT ... FOR UPDATE` (idempotency lock). 2. Validasi `payment_status IN ('pending', 'expired')`. `0 < cash_portion < total_amount`. 3. `qris_portion = total_amount - cash_portion`. `cash_change = cash_received - cash_portion` (harus ≥ 0). 4. Update order: `payment_method = 'split'`, `cash_received`, `cash_change`, `cash_portion`, `qris_portion`. 5. Internal call ke logika QRIS untuk `qris_portion`. 6. `payment_status = 'pending'` sampai QRIS portion settled via webhook. |
| **Output** | `{ "order_id": "uuid", "cash_portion": 10000, "cash_received": 10000, "cash_change": 0, "qris_portion": 17900, "qr_url": "...", "expires_at": "..." }` |

### FR-TRX-05: Void Transaksi (Admin)

| Atribut | Detail |
|---------|--------|
| **Endpoint** | `POST /admin/orders/:id/void` |
| **Akses** | Superadmin only |
| **Input** | `{ "reason": "Pesanan dibatalkan atas permintaan pelanggan" }` |
| **Proses** | 1. `SELECT ... FOR UPDATE` (idempotency lock — `06-architecture.md §6.4`). 2. Validasi `order_status = 'completed'` (TRX-11). 3. Update `order_status = 'voided'`. 4. Catat di `audit_logs`: `voided_by`, `voided_at`, `void_reason`. 5. Log di `system_logs`. 6. Adjustment kas shift jika tunai/split. |
| **Error** | 409 `ORDER_ALREADY_VOIDED`: Order sudah di-void sebelumnya. 422: `order_status` bukan `completed`. |
| **Rate Limit** | 5 req / 10 menit. |

### FR-TRX-06: Sync Batch (Offline → Server) `[v4.1 — dipertegas]`

| Atribut | Detail |
|---------|--------|
| **Endpoint** | `POST /orders/sync-batch` |
| **Akses** | Kasir, Superadmin |
| **Input** | Array of offline orders — full detail: items, modifiers, qty, harga, diskon, `client_created_at`, `transaction_number`. |
| **Proses** | Setiap order diproses dalam **DB transaction-nya sendiri** (semantik per-order, bukan per-batch) `[v4.1]`: 1. Validasi data integrity. 2. Validasi produk exist (bukan `is_active` — produk yang di-archive setelah order dibuat tetap diterima, TC-17). 3. **Validasi `client_created_at` dalam rentang waktu shift kasir (±5 menit clock drift)** `[v4.1 — threat model §09-security.md]`. 4. Cek konflik `transaction_number` → re-sequence jika perlu (OFFL-08). 5. Simpan order, `synced_at = NOW()`, `order_status = 'completed'`. |
| **Partial failure** | Order yang valid **tetap commit** meski order lain dalam batch gagal. Order gagal tetap `pending_sync` di IndexedDB dengan detail error per-order (OFFL-07). `[v4.1]` |
| **Output** | `{ "synced_count": 3, "failed_count": 1, "results": [ { "transaction_number": "TRX-20260615-A003", "status": "synced" }, { "transaction_number": "TRX-20260615-A004", "status": "failed", "error": "client_created_at out of shift range" } ] }` |
| **Rate Limit** | 10 req / 1 menit. |

### FR-TRX-07: Riwayat Transaksi (POS)

| Atribut | Detail |
|---------|--------|
| **Endpoint** | `GET /orders?shift_id={id}&page=1&limit=20` |
| **Akses** | Kasir (shift sendiri), Superadmin |
| **Output** | `{ "data": [ { "transaction_number": "TRX-20260615-A001", "items_summary": "Cimol Keju ×2, Basreng ×1", "total_amount": 27900, "payment_method": "cash", "payment_status": "settled", "order_status": "completed", "created_at": "..." } ], "meta": { "page": 1, "per_page": 20, "total": 12 } }` |

### FR-TRX-08: Ubah Metode Pembayaran

| Atribut | Detail |
|---------|--------|
| **Endpoint** | `PATCH /orders/:id/payment-method` |
| **Input** | `{ "payment_method": "cash" }` |
| **Validasi** | `payment_status IN ('pending', 'expired')` — hanya sebelum settled. |
| **Proses** | Reset: clear `cash_received`, `cash_change`, `midtrans_transaction_id`. Set `payment_method` baru, `payment_status = 'pending'`. |

---

## 9.5 Modul Diskon (FR-DISC)

### FR-DISC-01: CRUD Diskon (Admin)

| Atribut | Detail |
|---------|--------|
| **Endpoints** | `POST /admin/discounts`, `GET /admin/discounts`, `GET /admin/discounts/:id`, `PUT /admin/discounts/:id`, `PATCH /admin/discounts/:id/toggle` |
| **Akses** | Superadmin |
| **Create/Update** | Input: `name`, `type` (`percentage`/`fixed`), `value`, **`max_discount`** (nullable, khusus percentage — `[v4.1 — CR-008]`), `scope` (`all`/`product`), `product_ids[]` (jika scope = product), `applicable_days` (SMALLINT bitmask), `start_date`, `end_date` (nullable), `is_active`. |
| **Delete** | Soft-delete: `is_active = false`. Diskon yang digunakan di historis tidak boleh dihapus permanen. |

### FR-DISC-02: Aplikasi Diskon Otomatis (POS)

| Atribut | Detail |
|---------|--------|
| **Trigger** | Saat item ditambahkan ke keranjang / saat `POST /orders`. |
| **Proses** | 1. Query diskon aktif hari ini (DISC-06). 2. Per item: cek scope `all` / `product` (via `discount_products`). 3. Pilih diskon terbesar jika ada multiple (DISC-09). 4. Kalkulasi `discount_amount` (DISC-08 dengan `max_discount` jika ada). |

---

## 9.6 Modul Struk (FR-RCPT)

### FR-RCPT-01: Generate Struk

| Atribut | Detail |
|---------|--------|
| **Endpoint** | `GET /orders/:id/receipt` |
| **Akses** | Kasir, Superadmin |
| **Validasi** | `payment_status = 'settled'`. |
| **Output** | `{ "transaction_number": "TRX-20260615-A001", "date": "15 Juni 2026, 10:35 WIB", "cashier_name": "Rina", "items": [ { "name": "Cimol Keju", "modifiers": ["Pedas Sedang"], "qty": 2, "subtotal": 18000 } ], "subtotal": 27900, "discount": { "name": "Weekday 10%", "amount": 2790 }, "total": 25110, "payment_method": "Tunai", "cash_received": 30000, "cash_change": 4890, "paper_width": "58mm" }` |

### FR-RCPT-02: Konfigurasi Lebar Struk

| Atribut | Detail |
|---------|--------|
| **Endpoint** | `PUT /admin/settings` (via key `receipt_paper_width`) |
| **Input** | `{ "key": "receipt_paper_width", "value": "80mm" }` |
| **Akses** | Superadmin |

---

## 9.7 Modul HPP & Bagi Hasil (FR-HPP)

### FR-HPP-01: Input Estimated HPP (Fase 1A)

| Atribut | Detail |
|---------|--------|
| **Endpoint** | `PUT /admin/products/:id/hpp` |
| **Input** | `{ "estimated_hpp": 3500 }` |
| **Akses** | Superadmin |
| **Proses** | Update: `estimated_hpp = input`, `hpp_source = 'manual_estimate'`. |

### FR-HPP-02: BOM Management (Fase 1B)

| Atribut | Detail |
|---------|--------|
| **Endpoints** | `POST /admin/raw-materials`, `GET /admin/raw-materials`, `PUT /admin/raw-materials/:id`, `POST /admin/products/:id/bom`, `GET /admin/products/:id/bom`, `PUT /admin/bom-items/:id`, `DELETE /admin/bom-items/:id` |
| **Akses** | Superadmin |
| **Kalkulasi** | `bom_hpp = SUM(bom_items.quantity_per_unit × raw_materials.price_per_unit)`. Update produk: `hpp_source = 'bom_calculated'`. Schema: `07-database.md`. |

### FR-HPP-03: Laporan Profitabilitas

| Atribut | Detail |
|---------|--------|
| **Endpoint** | `GET /admin/reports/profitability?start_date=&end_date=` |
| **Akses** | Superadmin |
| **Output** | `{ "data": { "by_product": [ { "product_name": "Cimol Keju", "qty_sold": 150, "revenue": 1200000, "hpp_per_unit": 3500, "hpp_source": "manual_estimate", "total_hpp": 525000, "gross_profit": 675000, "gross_margin_pct": 56.25 } ], "summary": { "total_revenue": 5000000, "total_hpp": 2000000, "total_gross_profit": 3000000, "overall_margin_pct": 60.0 } } }` |

### FR-HPP-04: Konfigurasi & Perhitungan Bagi Hasil

| Atribut | Detail |
|---------|--------|
| **Endpoints** | `GET /admin/profit-sharing/config`, `PUT /admin/profit-sharing/config`, `GET /admin/profit-sharing?period_start=&period_end=`, `POST /admin/profit-sharing/calculate` |
| **Akses** | Superadmin |
| **Config** | `{ "owner_percentage": 60, "cashier_pool_percentage": 40 }` (default HPP-05). |
| **Calculate** | HPP-06/07 — simpan ke `profit_share_logs` + `profit_share_details`. Rekalkukasi boleh sampai periode di-mark paid (profit_share_logs.is_paid = true). |

---

## 9.8 Modul Laporan (FR-RPT)

### FR-RPT-01: Laporan Harian

| Atribut | Detail |
|---------|--------|
| **Endpoint** | `GET /admin/reports/daily?date=2026-06-15` |
| **Output** | `{ "data": { "total_revenue": 1250000, "total_transactions": 47, "total_cash": 850000, "total_qris": 300000, "total_split": 100000, "total_discount": 45000, "total_void": 1, "avg_transaction_value": 26595, "top_products": [...], "hourly_breakdown": [...] } }` |

### FR-RPT-02: Laporan Periodik

| Atribut | Detail |
|---------|--------|
| **Endpoint** | `GET /admin/reports/periodic?start_date=&end_date=&group_by=day` |
| **Output** | `{ "data": [ { "period_label": "2026-06-15", "revenue": 1250000, "transactions": 47, "avg_value": 26595, "growth_pct": 5.2 } ], "meta": { ... } }` |

### FR-RPT-03: Laporan Shift

| Atribut | Detail |
|---------|--------|
| **Endpoint** | `GET /admin/reports/shifts?start_date=&end_date=&cashier_id=` |
| **Output** | `{ "data": [ { "shift_number": 1, "cashier_name": "Rina", "opened_at": "...", "closed_at": "...", "duration_minutes": 480, "opening_balance": 150000, "closing_balance": 285000, "actual_cash": 285000, "discrepancy": 0, "transaction_count": 12, "is_auto_closed": false } ], "meta": { ... } }` |

### FR-RPT-04: Export Laporan

| Atribut | Detail |
|---------|--------|
| **Endpoint** | `GET /admin/reports/export?type=daily&format=csv&start_date=&end_date=` |
| **Akses** | Superadmin |
| **Output** | File download (CSV atau PDF). |
| **Rate Limit** | 5 req / 1 jam. |

---

## 9.9 Modul Kasir Management (FR-CSH)

### FR-CSH-01: CRUD Kasir (Admin)

| Atribut | Detail |
|---------|--------|
| **Endpoints** | `POST /admin/cashiers`, `GET /admin/cashiers`, `GET /admin/cashiers/:id`, `PUT /admin/cashiers/:id`, `PATCH /admin/cashiers/:id/reset-pin`, `PATCH /admin/cashiers/:id/toggle-active` |
| **Akses** | Superadmin |
| **Create** | Input: `name`, `pin` (4–6 digit), `cashier_letter` (unik, A–Z). Validasi PIN unik. Hash bcrypt. |
| **Reset PIN** | Input: `{ "new_pin": "5678" }`. Hash & update. Invalidate session kasir aktif. |
| **Toggle Active** | Nonaktifkan → invalidate session + auto-close shift jika terbuka. |

---

## 9.10 Modul Settings (FR-SET)

### FR-SET-01: CRUD Settings

| Atribut | Detail |
|---------|--------|
| **Endpoints** | `GET /admin/settings`, `PUT /admin/settings` |
| **Akses** | Superadmin |
| **Daftar Settings** | |

| Key | Tipe | Default | Deskripsi |
|-----|------|---------|-----------|
| `shift_late_threshold` | INT (menit) | 30 | Batas waktu telat tutup shift |
| `cash_presets` | JSON array | [5000,10000,20000,50000,100000] | Preset tombol pembayaran tunai |
| `receipt_paper_width` | ENUM | `'58mm'` | Lebar kertas struk |
| `store_name` | STRING | `'Ngemiloh'` | Nama toko di struk |
| `store_address` | STRING | `''` | Alamat di struk |

---

## 9.11 Modul System Monitoring (FR-SYS)

### FR-SYS-01: System Logs

| Atribut | Detail |
|---------|--------|
| **Endpoint** | `GET /admin/system-logs?level=&source=&start_date=&end_date=&page=&limit=` |
| **Akses** | Superadmin |
| **Output** | `{ "data": [ { "id": "uuid", "severity": "warning", "log_type": "shift_event", "source": "shift.service", "message": "Shift #3 auto-closed", "metadata": {...}, "created_at": "..." } ], "meta": { "page": 1, "per_page": 50, "total": 234 } }` |
| **Sumber Log** | Auto-close shift, scheduled price change, sync batch, void, BullMQ cron, rate limit violation, circuit breaker Midtrans. |

### FR-SYS-02: System Health `[v4.1]`

| Atribut | Detail |
|---------|--------|
| **Endpoint** | `GET /admin/system-health` |
| **Akses** | Superadmin |
| **Output** | `{ "postgresql": { "status": "healthy", "pool": { "total": 20, "active": 3, "idle": 17 } }, "redis": { "status": "healthy", "memory_mb": 45, "clients": 5 }, "disk": { "total_gb": 60, "used_gb": 12, "pct": 20 }, "memory": { "total_gb": 4.44, "used_gb": 2.1, "pct": 47 }, "uptime": "15d 3h", "sessions": { "cashier": 1, "admin": 1 }, "pending_sync_count": 0, "table_rows": { "orders": 1250, "order_items": 3400 }, "last_cron": { "price_change": "2026-06-15T17:01:00Z" } }` — **`table_rows.orders` & `table_rows.order_items` baru v4.1** (GEN-06) untuk visibilitas exit criteria partisi. |

### FR-SYS-03: Health Check (Internal/Loadbalancer)

| Atribut | Detail |
|---------|--------|
| **Endpoint** | `GET /health` (public) — dipantau UptimeRobot |
| **Output** | `{ "status": "ok", "timestamp": "2026-06-15T10:35:00Z" }` |
| **Endpoint Detail** | `GET /health/detailed` (protected — superadmin) — sama dengan FR-SYS-02 di atas |

---

> **`[v4.1 — CR-003]`** Modul Partisi Otomatis (**FR-PART-01**) **dihapus sepenuhnya** dari v4.1. `GEN-04` juga dihapus. Lihat `00-overview.md CR-003` dan `05-nonfunctional-reqs.md §5.3` untuk detail exit criteria re-evaluasi partisi di masa depan. BullMQ cron job untuk partisi (`0 0 1 12 *`) tidak diimplementasikan.

---

*Lanjut ke: [`07-database.md`](./07-database.md) — Skema final 19 tabel, ERD, seed data, Prisma schema (Tahap 4).*
