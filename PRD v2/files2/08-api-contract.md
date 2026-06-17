# 08. API Contract Final

*[← 07-database.md](./07-database.md) | [→ 09-security.md](./09-security.md)*

---

> **Versi:** 4.1 — Perubahan dari v4.0 ditandai **`[v4.1]`** + nomor CR.

## Konvensi Umum

| Item | Nilai |
|------|-------|
| Base URL | `https://{domain}/api/v1` |
| Auth | Session Cookie (`HttpOnly`, `Secure`, `SameSite=Strict`) |
| Format | REST JSON |
| Content-Type | `application/json` (kecuali file upload: `multipart/form-data`) |
| Pagination | `?page=1&limit=50` (default). Max `limit=100` |
| Date format | ISO 8601: `2026-06-15T10:30:00+07:00` |
| Timezone tampilan | WIB (UTC+7) di semua respons |

---

## Format Response Standard `[v4.1 — CR-005, ADR-015]`

### Sukses — Resource Tunggal / Command
```json
{ "id": "...", "field": "...", ... }
```

### Sukses — List
```json
{
  "data": [ { ... }, { ... } ],
  "meta": { "page": 1, "per_page": 50, "total": 143 }
}
```

### Error (semua 4xx/5xx)
```json
{
  "statusCode": 400,
  "error": "CASH_INSUFFICIENT",
  "message": "Uang diterima kurang dari total tagihan.",
  "details": { "cash_received": 25000, "total_amount": 27900 },
  "timestamp": "2026-06-15T10:35:00.000Z",
  "path": "/api/v1/orders/abc-123/pay/cash"
}
```

---

## Tabel Kode Error Lengkap `[v4.1 — tambahan CR-012]`

| Kode | HTTP | Modul | Kapan |
|------|------|-------|-------|
| `INVALID_CREDENTIALS` | 401 | Auth | PIN atau password salah |
| `ACCOUNT_LOCKED` | 403 | Auth | Akun terkunci ≥5 gagal login |
| `ACCOUNT_DISABLED` | 403 | Auth | Akun dinonaktifkan SA |
| `RATE_LIMITED` | 429 | Auth, Global | Terlalu banyak request |
| **`SHIFT_NOT_OPEN`** | 403 | Shift, Orders | Kasir belum buka shift / tidak ada shift aktif — **formalkan kode v4.1** |
| `SHIFT_ALREADY_OPEN` | 400 | Shift | Kasir sudah punya shift terbuka |
| `ORDER_NOT_FOUND` | 404 | Orders | Order ID tidak ditemukan |
| `ORDER_ALREADY_PAID` | 409 | Orders | Pembayaran sudah settled (idempotency) |
| **`ORDER_ALREADY_VOIDED`** | 409 | Orders | Void dipanggil 2× pada order yang sama **[v4.1 — CR-012]** |
| `ORDER_VOIDED` | 422 | Orders | Aksi tidak bisa dilakukan pada order yang di-void |
| `CASH_INSUFFICIENT` | 422 | Orders | `cash_received < cash_amount` |
| `SPLIT_CASH_EXCEEDS_TOTAL` | 422 | Orders | Porsi tunai split ≥ total_amount |
| `PAYMENT_GATEWAY_ERROR` | 503 | Payment | Midtrans tidak bisa diakses (umum) |
| **`QRIS_DEGRADED`** | 503 | Payment | Circuit breaker aktif ≥3 kegagalan dalam 5 menit **[v4.1 — CR-012]** |
| `QRIS_EXPIRED` | 409 | Payment | QR code sudah expired |
| **`DISCOUNT_EXCEEDS_SUBTOTAL`** | 422 | Orders | Nilai diskon melebihi subtotal item **[v4.1 — CR-012]** |
| `PRODUCT_NOT_FOUND` | 404 | Products | Product ID tidak ada di DB |
| `PRODUCT_INACTIVE` | 422 | Products | Produk sudah diarsipkan |
| `QUANTITY_EXCEEDED` | 422 | Products | Qty > 50 per line item (TRX-12) |
| `MODIFIER_REQUIRED` | 422 | Products | Required modifier group belum dipilih |
| `MODIFIER_NOT_FOUND` | 404 | Products | Modifier option ID tidak valid |
| `PRICE_SCHEDULE_EXISTS` | 409 | Products | Sudah ada scheduled price change untuk produk ini |
| `CATEGORY_HAS_PRODUCTS` | 409 | Categories | Hapus kategori yang masih punya produk aktif |
| `CLIENT_UUID_DUPLICATE` | 409 | Orders | `client_uuid` sudah ada di DB (order sudah pernah dibuat) |
| `SYNC_TIMESTAMP_INVALID` | 422 | Orders | `client_created_at` di luar rentang shift aktif ±5 menit **[v4.1]** |
| `VOID_REASON_TOO_SHORT` | 422 | Orders | `void_reason` < 10 karakter |
| `FORBIDDEN` | 403 | Auth | Role tidak punya akses endpoint |
| `VALIDATION_ERROR` | 400 | Global | Validasi DTO gagal (field wajib tidak ada, format salah, dll) |
| `INTERNAL_SERVER_ERROR` | 500 | Global | Error server tidak terduga |

---

## 11.1 Auth

| Method | Endpoint | Auth | Request | Response |
|--------|----------|------|---------|----------|
| POST | `/auth/login/cashier` | Public | `{ "pin": "1234" }` | 200: cookie + `{ "id", "name", "role", "cashier_letter", "must_change_pin" }` |
| POST | `/auth/login/admin` | Public | `{ "email": "...", "password": "..." }` | 200: cookie + `{ "id", "name", "role", "email" }` |
| POST | `/auth/logout` | Session | — | 200: `{ "message": "Logout berhasil" }` |
| GET | `/auth/me` | Session | — | 200: `{ "id", "name", "role", "username", "email?", "cashier_letter?", "must_change_pin" }` |
| POST | `/auth/change-pin` | Session (kasir) | `{ "current_pin": "1234", "new_pin": "5678" }` | 200: `{ "message": "PIN berhasil diubah" }` |

**Login Kasir — Detail Flow:**
```
POST /auth/login/cashier
├── Rate limit: 5 gagal / 10 menit per user (Redis counter)
├── Lookup: role='kasir' AND is_active=true
├── Bcrypt verify(pepper:pin:pepper, pin_hash)
├── Gagal → failed_login_count++ → jika ≥5: locked_until=NOW()+10min
│           → log system_logs(security_alert) → 401 INVALID_CREDENTIALS
└── Berhasil → reset counter → Create Redis session (no TTL)
             → Set-Cookie: session_id={uuid}; HttpOnly; Secure; SameSite=Strict
             → log audit_logs(USER_LOGIN)
             → 200 { id, name, role: "kasir", cashier_letter: "A", must_change_pin: false }
```

---

## 11.2 Produk & Kategori

| Method | Endpoint | Auth | Keterangan |
|--------|----------|------|-----------|
| GET | `/products?include_modifiers=true` | Kasir/SA | List produk aktif + modifier + diskon aktif. Cache Redis 5 menit. Sertakan `qris_available: bool` **[v4.1 — GEN-09]** |
| GET | `/products/:id` | Kasir/SA | Detail produk + modifier + diskon |
| GET | `/categories` | Kasir/SA | List kategori aktif |
| POST | `/admin/products` | SA | `multipart/form-data`: `{name, base_price, category_id, description?, image?, estimated_hpp?}` |
| PATCH | `/admin/products/:id` | SA | Partial update. Audit log perubahan harga |
| DELETE | `/admin/products/:id` | SA | Soft delete (`is_active=false`). 409 jika ada `order_items` |
| POST | `/admin/products/:id/schedule-price` | SA | `{ "new_base_price": 9000, "new_price_effective_from": "2026-06-16" }` |
| POST | `/admin/categories` | SA | `{ "name": "Macaroni", "sort_order": 1 }` |
| PATCH | `/admin/categories/:id` | SA | `{ "name?", "sort_order?", "is_active?" }` |
| DELETE | `/admin/categories/:id` | SA | 409 `CATEGORY_HAS_PRODUCTS` jika masih ada produk aktif |

**Response GET `/products`** `[v4.1 — CR-005, GEN-09]`:
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Macaroni Mateng",
      "category": { "id": "uuid", "name": "Macaroni" },
      "base_price": 9000,
      "image_url": "/static/products/uuid.webp",
      "is_out_of_stock": false,
      "description": "Macaroni goreng renyah dengan bumbu pilihan",
      "estimated_hpp": 3500,
      "hpp_source": "manual_estimate",
      "active_discount": {
        "id": "uuid",
        "name": "Promo Weekend 10%",
        "type": "percentage",
        "value": 10,
        "max_discount": null,
        "calculated_amount": 900
      },
      "modifier_groups": [
        {
          "id": "uuid",
          "name": "Pilih Bumbu Tabur",
          "is_required": true,
          "max_selections": 1,
          "options": [
            { "id": "uuid", "name": "Bumbu Keju", "additional_price": 1500 },
            { "id": "uuid", "name": "Bumbu Balado", "additional_price": 1500 },
            { "id": "uuid", "name": "Tanpa Bumbu", "additional_price": 0 }
          ]
        }
      ]
    }
  ],
  "meta": { "total": 5 },
  "qris_available": true
}
```

---

## 11.3 Modifier

| Method | Endpoint | Auth | Request | Keterangan |
|--------|----------|------|---------|-----------|
| POST | `/admin/products/:id/modifier-groups` | SA | `{ "name", "is_required", "max_selections", "sort_order?" }` | Auto-create "Tanpa {name}" (PROD-06) |
| PATCH | `/admin/modifier-groups/:id` | SA | `{ "name?", "is_required?", "max_selections?", "is_active?" }` | — |
| DELETE | `/admin/modifier-groups/:id` | SA | — | 409 jika ada `order_item_modifiers` |
| POST | `/admin/modifier-groups/:id/options` | SA | `{ "name", "additional_price", "sort_order?" }` | — |
| PATCH | `/admin/modifier-options/:id` | SA | `{ "name?", "additional_price?", "is_active?", "sort_order?" }` | — |
| DELETE | `/admin/modifier-options/:id` | SA | — | 409 jika ada `order_item_modifiers` |

---

## 11.4 Diskon `[v4.1 — CR-008]`

| Method | Endpoint | Auth | Keterangan |
|--------|----------|------|-----------|
| GET | `/admin/discounts?is_active=true` | SA | List diskon + filter |
| GET | `/admin/discounts/:id` | SA | Detail + linked products |
| POST | `/admin/discounts` | SA | Buat diskon baru (lihat body di bawah) |
| PATCH | `/admin/discounts/:id` | SA | Partial update + audit log |
| DELETE | `/admin/discounts/:id` | SA | 409 jika `is_active=true` |

**Request POST `/admin/discounts`** `[v4.1 — tambah max_discount]`:
```json
{
  "name": "Promo Weekend 10%",
  "type": "percentage",
  "value": 10,
  "max_discount": 5000,
  "scope": "product",
  "applicable_days": 96,
  "valid_from": "2026-07-01T00:00:00+07:00",
  "valid_to": "2026-07-31T23:59:59+07:00",
  "product_ids": ["uuid-macaroni", "uuid-basreng"]
}
```
> `max_discount: 5000` → diskon 10% dengan cap Rp 5.000. Misal subtotal Rp 30.000 → 10% = Rp 3.000 (di bawah cap, pakai Rp 3.000). Subtotal Rp 60.000 → 10% = Rp 6.000 (melebihi cap, pakai Rp 5.000).

---

## 11.5 Orders — Flexible Payment `[v4.1 — CR-002, CR-005]`

| Method | Endpoint | Auth | Keterangan |
|--------|----------|------|-----------|
| POST | `/orders` | Kasir/SA | Buat order (tanpa metode bayar). Rate limit 30/menit. |
| POST | `/orders/:id/pay/cash` | Kasir/SA | Bayar tunai |
| POST | `/orders/:id/pay/qris` | Kasir/SA | Buat QR code QRIS |
| POST | `/orders/:id/pay/split` | Kasir/SA | Split tunai + QRIS |
| PATCH | `/orders/:id/payment-method` | Kasir/SA | Ubah metode bayar (sebelum settled) |
| POST | `/orders/sync-batch` | Kasir/SA | Batch sync offline |
| GET | `/orders?shift_id=&page=&limit=` | Kasir/SA | Riwayat transaksi shift |
| GET | `/orders/:id` | Kasir/SA | Detail order |
| GET | `/orders/:id/receipt` | Kasir/SA | Data struk (settled only) |
| GET | `/admin/transactions?from=&to=&cashier_id=&method=&status=&page=` | SA | Semua transaksi + filter |
| GET | `/admin/transactions/:id` | SA | Detail lengkap + items + modifiers + refunds |
| POST | `/admin/orders/:id/void` | SA | `{ "reason": "... ≥10 karakter ..." }` |
| POST | `/admin/orders/:id/refund` | SA | `{ "amount", "refund_method", "notes?" }` |

**Request POST `/orders`:**
```json
{
  "items": [
    {
      "product_id": "uuid-macaroni",
      "quantity": 2,
      "modifier_option_ids": ["uuid-bumbu-keju", "uuid-saus-bbq"]
    }
  ],
  "client_uuid": "550e8400-e29b-41d4-a716-446655440000",
  "client_created_at": "2026-06-15T10:30:00+07:00"
}
```

**Response POST `/orders`** `[v4.1 — CR-002: format nomor transaksi dikoreksi]`:
```json
{
  "order_id": "uuid-order",
  "transaction_number": "TRX-20260615-A001",
  "total_amount": 27900,
  "discount_total": 900,
  "order_status": "completed",
  "payment_status": "pending",
  "items": [
    {
      "id": "uuid-item",
      "product_name": "Macaroni Mateng",
      "base_price": 9000,
      "discount_amount": 900,
      "discounted_base": 8100,
      "modifiers": [
        { "name": "Bumbu Keju", "price": 1500 },
        { "name": "Saus BBQ", "price": 2500 }
      ],
      "modifier_total": 4000,
      "final_price": 12100,
      "quantity": 2,
      "subtotal": 24200
    }
  ]
}
```

> **Catatan kalkulasi (TC-01 fix dari v3.0):** `base_price=9000` - `discount=900` = `discounted_base=8100` + `modifier=4000` = `final_price=12100` × `qty=2` = `subtotal=24200`. Nilai `final_price = Rp 12.100` (bukan Rp 11.600 — bug lama v3.0).

**Request POST `/orders/:id/pay/cash`:**
```json
{ "cash_received": 30000 }
```

**Response POST `/orders/:id/pay/cash`:**
```json
{
  "order_id": "uuid",
  "payment_method": "cash",
  "payment_status": "settled",
  "total_amount": 27900,
  "cash_received": 30000,
  "cash_change": 2100,
  "payment_settled_at": "2026-06-15T10:35:00+07:00"
}
```

**Request POST `/orders/:id/pay/split`:**
```json
{ "cash_portion": 15000, "cash_received": 15000 }
```

**Response POST `/orders/:id/pay/split`:**
```json
{
  "order_id": "uuid",
  "payment_method": "split",
  "payment_status": "pending",
  "cash_amount": 15000,
  "cash_received": 15000,
  "cash_change": 0,
  "qris_amount": 12900,
  "qr_string": "00020101...",
  "qris_expiry_at": "2026-06-15T10:50:00+07:00"
}
```

**Response POST `/orders/sync-batch`** `[v4.1 — semantik per-order]`:
```json
{
  "synced_count": 4,
  "failed_count": 1,
  "results": [
    { "client_uuid": "uuid-1", "transaction_number": "TRX-20260615-A003", "status": "synced" },
    { "client_uuid": "uuid-2", "transaction_number": "TRX-20260615-A004", "status": "synced" },
    { "client_uuid": "uuid-3", "transaction_number": "TRX-20260615-A005", "status": "synced" },
    { "client_uuid": "uuid-4", "transaction_number": "TRX-20260615-A006", "status": "synced" },
    {
      "client_uuid": "uuid-5",
      "transaction_number": "TRX-20260615-A007",
      "status": "failed",
      "error": "SYNC_TIMESTAMP_INVALID",
      "detail": "client_created_at (2026-06-14T22:45:00Z) di luar rentang shift aktif"
    }
  ]
}
```

---

## 11.6 Payment QRIS

| Method | Endpoint | Auth | Keterangan |
|--------|----------|------|-----------|
| POST | `/payment/qris/create` | Kasir/SA | `{ "order_id", "amount" }` → `{ "qr_string", "qris_expiry_at" }` |
| GET | `/payment/qris/status/:orderId` | Kasir/SA | `{ "payment_status", "order_status" }` (polling fallback jika SSE tidak tersedia) |
| POST | `/payment/webhook/midtrans` | Public (signature SHA512) | **SELALU return 200.** Validasi signature sebelum proses. |
| GET | `/payment/stream/:cashierId` | Kasir SSE | Push events: `PAYMENT_SUCCESS`, `PAYMENT_FAILED`, `PAYMENT_EXPIRED`. Heartbeat 30s. |

**Webhook Handler — alur:**
```
POST /payment/webhook/midtrans
├── Return 200 IMMEDIATELY (sebelum proses apapun — Midtrans tidak menunggu)
├── Verify SHA512: sha512(order_id + status_code + gross_amount + MIDTRANS_SERVER_KEY)
│   └── Gagal → log system_logs(security_alert, warning) → return (no-op)
├── Idempotency: cek payment_status sudah settled?
│   └── Sudah → return (no-op)
├── SELECT ... FOR UPDATE pada orders row (idempotency lock)
├── Update: payment_status='settled', payment_settled_at=NOW(), payment_raw_response=body
├── Untuk split: tandai qris_portion settled, cek apakah keseluruhan order settled
├── Push SSE ke channel kasir
├── log audit_logs(PAYMENT_SETTLED)
└── Catat ke circuit breaker: onCreateQrisSuccess() → reset fail counter
```

> **[v4.1]** Tambahan: berhasil menerima webhook → reset circuit breaker fail counter (Midtrans pulih).

---

## 11.7 Shift & Kas

| Method | Endpoint | Auth | Keterangan |
|--------|----------|------|-----------|
| POST | `/shift/open` | Kasir/SA | `{ "opening_balance": 0, "planned_close_at?": "..." }` |
| POST | `/shift/close` | Kasir/SA | `{ "actual_cash": 285000, "notes?": "..." }` |
| GET | `/shift/current` | Kasir/SA | Detail shift aktif + carry-over info |
| GET | `/admin/cash-registers?from=&to=&cashier_id=&page=` | SA | List semua shift |
| GET | `/admin/cash-registers/:id` | SA | Detail shift + transaksi + rekonsiliasi |

---

## 11.8 Analytics & Dashboard

| Method | Endpoint | Auth | Keterangan |
|--------|----------|------|-----------|
| GET | `/admin/dashboard/summary?date=` | SA | KPI cards harian (revenue, transaksi, rata-rata) |
| GET | `/admin/analytics/revenue?from=&to=&group_by=day\|week\|month` | SA | Tren revenue + MoM/WoW |
| GET | `/admin/analytics/products?from=&to=` | SA | Top 5 produk by qty & revenue |
| GET | `/admin/analytics/peak-hours?date=` | SA | Distribusi penjualan per jam |
| GET | `/admin/analytics/profit-loss?from=&to=` | SA | P&L: revenue − HPP − opex − depresiasi = net profit |

---

## 11.9 Bagi Hasil (Profit Share)

| Method | Endpoint | Auth | Keterangan |
|--------|----------|------|-----------|
| GET | `/admin/profit-share/config` | SA | Konfigurasi persentase |
| PUT | `/admin/profit-share/config` | SA | `{ "owner_percentage": 60, "cashier_pool_percentage": 40 }` |
| GET | `/admin/profit-share?year=2026` | SA | List per bulan |
| GET | `/admin/profit-share/:month` | SA | Detail + breakdown per kasir |
| POST | `/admin/profit-share/:month/calculate` | SA | Hitung / recalculate (sampai `is_paid=true`) |
| POST | `/admin/profit-share/:month/mark-paid` | SA | `{ "cashier_id", "paid_amount" }` — lock recalculation |

---

## 11.10 BOM & HPP (Fase 1B)

| Method | Endpoint | Auth | Keterangan |
|--------|----------|------|-----------|
| GET | `/admin/raw-materials` | SA | List bahan baku |
| POST | `/admin/raw-materials` | SA | `{ "name", "unit", "price_per_unit" }` |
| PUT | `/admin/raw-materials/:id` | SA | Update nama/harga/unit |
| GET | `/admin/products/:id/bom` | SA | BOM produk + kalkulasi HPP |
| POST | `/admin/products/:id/bom` | SA | `{ "items": [{ "raw_material_id", "quantity_per_unit" }] }` |
| PATCH | `/admin/bom-items/:id` | SA | Update quantity |
| DELETE | `/admin/bom-items/:id` | SA | Hapus 1 bahan dari BOM |
| GET | `/admin/products/:id/hpp` | SA | Perbandingan: `estimated_hpp` vs `bom_calculated` |

---

## 11.11 Admin Umum

| Method | Endpoint | Auth | Keterangan |
|--------|----------|------|-----------|
| GET | `/admin/feature-flags` | SA | List semua flags |
| PATCH | `/admin/feature-flags/:name` | SA | `{ "is_enabled": true }` — audit log |
| GET/PUT | `/admin/settings` | SA | GET: semua settings. PUT: `{ "key": "value", ... }` |
| GET | `/admin/users` | SA | List kasir + superadmin |
| POST | `/admin/users` | SA | `{ "name", "username", "pin", "cashier_letter", "role": "kasir" }` |
| PATCH | `/admin/users/:id` | SA | Update nama, status, cashier_letter |
| POST | `/admin/users/:id/reset-pin` | SA | `{ "new_pin" }` → force logout semua session kasir |
| GET | `/admin/opex?from=&to=` | SA | List biaya operasional |
| POST | `/admin/opex` | SA | `{ "category", "description?", "amount", "expense_date" }` |
| GET | `/admin/assets` | SA | List aset + depresiasi |
| POST | `/admin/assets` | SA | `{ "name", "purchase_price", "useful_life_months", "purchase_date" }` |
| GET | `/admin/audit-log?from=&to=&actor=&action=&page=` | SA | Audit trail immutable |
| GET | `/admin/system-logs?type=&severity=&from=&to=&page=` | SA | System logs |
| GET | `/admin/reports/export?type=transactions\|products\|pnl&from=&to=&format=csv` | SA | Export CSV. Rate limit: 5/jam. |

---

## 11.12 System Health

| Method | Endpoint | Auth | Keterangan |
|--------|----------|------|-----------|
| GET | `/health` | Public | `{ "status": "ok", "version": "4.1.0", "timestamp": "..." }` — dipantau UptimeRobot |
| GET | `/health/detailed` | SA | PostgreSQL pool, Redis memory, disk, memory, uptime, sessions, pending sync, **row count orders/order_items** `[v4.1]` |

---

## 11.13 API Versioning & Deprecation Policy

Seluruh endpoint menggunakan prefix `/api/v1/`. Saat `/v2` dibutuhkan (kemungkinan Fase 3, multi-outlet):
- Header `Deprecation: true` dan `Sunset: {tanggal}` ditambahkan ke respons endpoint `/v1` yang akan dihapus.
- Minimal **3 bulan** sebelum endpoint dihapus.
- Pengumuman di changelog PRD dan (jika ada) dokumentasi API eksternal.

---

*Lanjut ke: [`09-security.md`](./09-security.md)*
