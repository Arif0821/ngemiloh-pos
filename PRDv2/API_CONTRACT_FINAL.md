# API CONTRACT — Ngemiloh POS FINAL

> **Status:** FINAL (2026-06-16)
> **Base:** Audit langsung dari `backend/src/**/*.controller.ts`
> **Canonical source:** PRD_Ngemiloh_POS_FINAL.md

---

## 1. Response Format

Semua response API mengikuti format:

```typescript
// Success
{ success: true, data: T }

// Error
{ success: false, message: string }
```

---

## 2. Auth Endpoints

### `POST /api/v1/auth/login` — Login (Kasir & Admin)

**Request:**
```json
{
  "username": "admin@ngemiloh.com",  // email untuk admin
  "email": "admin@ngemiloh.com",    // alternatif
  "pin": "SuperAdminP@ssw0rd123!",   // password admin (field name: pin)
  "password": "SuperAdminP@ssw0rd123!"
}
```

> **Catatan:** Backend menerima `pin` atau `password` untuk admin login. Frontend mengirim `pin: password` (sesuai field name). Kasir login menggunakan endpoint terpisah di bawah.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Admin",
    "username": "admin@ngemiloh.com",
    "role": "superadmin",
    "is_active": true
  }
}
```

**Cookies set:**
- `access_token` (HttpOnly, Secure in production, SameSite=Strict, 8h)
- `refresh_token` (HttpOnly, Secure, SameSite=Strict, 7d)
- `csrf_token` (non-HttpOnly, Secure, SameSite=Strict, 8h)

**Rate limit:** 5 req / 10 menit per IP (ThrottlerGuard)

---

### `POST /api/v1/auth/login/cashier` — Login Kasir (PIN 4 digit)

**Request:**
```json
{
  "pin": "1234"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Kasir 1",
    "username": "kasir1",
    "role": "kasir",
    "is_active": true
  }
}
```

**Catatan:** Endpoint ini dari `orders.controller.ts` route `POST api/v1/orders/shift/start` — kasir login digabung dengan shift start. Token JWT 20 jam (D-02).

---

### `POST /api/v1/auth/logout` — Logout

**Headers:** `Authorization: Bearer <token>` + `X-CSRF-Token` (cookie)

**Response (200):**
```json
{ "success": true, "message": "Logged out successfully" }
```

**Effect:** Clear all auth cookies, revoke refresh token in DB.

---

### `GET /api/v1/auth/me` — Current User

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Admin",
    "role": "superadmin"
  }
}
```

---

## 3. Products

### `GET /api/v1/products` — Daftar Produk

**Headers:** `Authorization: Bearer <token>`

**Query params:**
- `category_id` (optional): filter by category
- `include_modifiers=true` (optional): include modifier groups

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Cimol Keju",
      "category_id": "uuid",
      "base_price": 15000,
      "image_url": "/uploads/abc123.webp",
      "is_active": true,
      "is_out_of_stock": false,
      "modifier_groups": [
        {
          "id": "uuid",
          "name": "Level Pedas",
          "is_required": true,
          "max_selections": 1,
          "options": [
            {
              "id": "uuid",
              "name": "Extra Pedas",
              "additional_price": 2000
            }
          ]
        }
      ]
    }
  ]
}
```

---

### `GET /api/v1/categories` — Daftar Kategori

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": [
    { "id": "uuid", "name": "Makanan", "sort_order": 0, "is_active": true },
    { "id": "uuid", "name": "Minuman", "sort_order": 1, "is_active": true }
  ]
}
```

---

### `POST /api/v1/admin/products` — Create Product (Admin)

**Headers:** `Authorization: Bearer <token>` + `X-CSRF-Token` + `Role: superadmin`

**Content-Type:** `multipart/form-data`

**Body fields:**
- `name` (string, required)
- `category_id` (UUID, required)
- `base_price` (number, required)
- `image` (file, optional, max 5MB, WebP auto-converted)

**Response (201):**
```json
{ "success": true, "data": { ...product } }
```

---

### `PATCH /api/v1/admin/products/:id` — Update Product (Admin)

**Headers:** `Authorization: Bearer <token>` + `X-CSRF-Token` + `Role: superadmin`

**Body:** `{ name?, category_id?, base_price?, image_url?, is_active?, is_out_of_stock? }`

**Response (200):**
```json
{ "success": true, "data": { ...updatedProduct } }
```

---

### `DELETE /api/v1/admin/products/:id` — Delete Product (Admin)

**Headers:** `Authorization: Bearer <token>` + `X-CSRF-Token` + `Role: superadmin`

**Response (200):**
```json
{ "success": true, "data": { ...deletedProduct } }
```

---

### Modifier Group & Option (Admin)

| Method | Endpoint | Body |
|--------|----------|------|
| POST | `/api/v1/admin/products/:id/modifier-groups` | `{ name, is_required, max_selections, sort_order }` |
| POST | `/api/v1/admin/modifier-groups/:id/options` | `{ name, additional_price, sort_order }` |
| PATCH | `/api/v1/admin/modifier-groups/:id` | `{ name?, is_required?, max_selections?, is_active? }` |
| PATCH | `/api/v1/admin/modifier-options/:id` | `{ name?, additional_price?, is_active? }` |

---

## 4. Orders

### `POST /api/v1/orders` — Create Order

**Headers:** `Authorization: Bearer <token>` + `X-CSRF-Token`

**Request:**
```json
{
  "client_uuid": "uuid-v4-from-frontend",
  "payment_method": "cash" | "qris" | "split",
  "client_final_price": 16500,
  "discount_total": 1500,
  "discount_id": "uuid (optional)",
  "cash_amount": 20000,
  "qris_amount": 0,
  "items": [
    {
      "product_id": "uuid",
      "quantity": 1,
      "modifiers": [{ "option_id": "uuid" }]
    }
  ]
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "client_uuid": "uuid-v4",
    "final_price": 16500,
    "payment_method": "cash",
    "payment_status": "pending",
    "qr_string": "...",
    "qris_expiry_at": "ISO8601",
    "items": [...],
    "cashier": { "id": "uuid", "name": "Kasir 1" }
  }
}
```

---

### `GET /api/v1/orders` — Order History

**Headers:** `Authorization: Bearer <token>`

**Query params:** `page` (default 1), `limit` (default 50, max 100)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "orders": [...],
    "total": 150,
    "page": 1,
    "limit": 50
  }
}
```

---

### `GET /api/v1/orders/:id/status` — Check Order Status (Polling)

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "status": "completed",
    "payment_status": "settlement"
  }
}
```

---

### `GET /api/v1/orders/:id/sse` — Order Status SSE

**Headers:** `Authorization: Bearer <token>`

**Response:** Server-Sent Events stream

```json
data: { "orderId": "uuid", "status": "completed" }
data: { "type": "ping", "message": "heartbeat" }  // every 30s
```

**Note:** SSE disabled buffering (`flush_interval -1`) di Caddy.

---

### `POST /api/v1/orders/sync-batch` — Sync Offline Orders

**Headers:** `Authorization: Bearer <token>` + `X-CSRF-Token`

**Request:**
```json
{
  "orders": [
    {
      "client_uuid": "uuid",
      "payment_method": "cash",
      "client_final_price": 16500,
      "items": [...]
    }
  ]
}
```

**Response (200):**
```json
{
  "success": true,
  "data": [
    { "client_uuid": "uuid", "status": "success", "id": "server-uuid" },
    { "client_uuid": "uuid", "status": "error", "message": "..." }
  ]
}
```

---

### `POST /api/v1/admin/transactions/:id/void` — Void Transaction (Admin)

**Headers:** `Authorization: Bearer <token>` + `X-CSRF-Token` + `Role: superadmin`

**Request:**
```json
{ "reason": "Barang tidak tersedia" }
```

**Response (200):**
```json
{ "success": true, "data": { ...voidedOrder } }
```

---

### `PATCH /api/v1/admin/transactions/:id/flag` — Flag Transaction (Admin)

**Headers:** `Authorization: Bearer <token>` + `X-CSRF-Token` + `Role: superadmin`

**Request:**
```json
{ "status": "Valid" | "Perlu Cek" }
```

**Response (200):**
```json
{ "success": true, "data": { ...flaggedOrder } }
```

---

### `GET /api/v1/admin/reports/export` — Export CSV (Admin)

**Headers:** `Authorization: Bearer <token>` + `Role: superadmin`

**Query params:** `startDate`, `endDate` (ISO 8601)

**Response:** CSV file download

**Rate limit:** 5 req / jam

---

## 5. Shift / Cash Register

### `GET /api/v1/admin/finance/cash/current` — Check Open Shift

**Headers:** `Authorization: Bearer <token>` + `Role: kasir|superadmin`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "cashier_id": "uuid",
    "shift_date": "2026-06-16",
    "shift_start": "ISO8601",
    "opening_balance": 500000,
    "status": "open"
  }
}
// Jika tidak ada shift aktif: data: null
```

---

### `POST /api/v1/admin/finance/cash/open` — Open Shift

**Headers:** `Authorization: Bearer <token>` + `X-CSRF-Token` + `Role: kasir|superadmin`

**Request:**
```json
{ "opening_balance": 500000 }
```

**Response (201):**
```json
{ "status": "success", "data": { ...shift } }
```

---

### `POST /api/v1/admin/finance/cash/close` — Close Shift

**Headers:** `Authorization: Bearer <token>` + `X-CSRF-Token` + `Role: kasir|superadmin`

**Request:**
```json
{ "closing_balance": 750000 }
```

**Response (200):**
```json
{ "status": "success", "data": { ...closedShift } }
```

---

### `GET /api/v1/orders/shift` — Shift Summary (Kasir)

**Headers:** `Authorization: Bearer <token>`

**Query params:** `kasir_id` (optional, untuk superadmin)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "total_transactions": 45,
    "total_revenue": 675000,
    "total_cash": 500000,
    "total_qris": 175000,
    "opening_balance": 500000,
    "closing_balance": 1175000
  }
}
```

---

## 6. Discounts

### `GET /api/v1/admin/discounts` — List Discounts

**Headers:** `Authorization: Bearer <token>` + `Role: superadmin`

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "uuid",
      "name": "Diskon 10%",
      "type": "percentage",
      "value": 10,
      "max_discount": 5000,
      "scope": "all_products",
      "is_active": true,
      "applicable_days": [1, 2, 3, 4, 5, 6, 7]
    }
  ]
}
```

---

### `POST /api/v1/admin/discounts` — Create Discount (Admin)

**Headers:** `Authorization: Bearer <token>` + `X-CSRF-Token` + `Role: superadmin`

**Request:**
```json
{
  "name": "Diskon 10%",
  "type": "percentage",
  "value": 10,
  "max_discount": 5000,
  "scope": "all_products",
  "valid_from": "ISO8601",
  "valid_until": "ISO8601",
  "applicable_days": [1, 2, 3, 4, 5, 6, 7]
}
```

---

### `PATCH /api/v1/admin/discounts/:id` — Update Discount (Admin)

**Headers:** `Authorization: Bearer <token>` + `X-CSRF-Token` + `Role: superadmin`

---

### `DELETE /api/v1/admin/discounts/:id` — Delete Discount (Admin)

**Headers:** `Authorization: Bearer <token>` + `X-CSRF-Token` + `Role: superadmin`

---

## 7. Feature Flags

### `GET /api/v1/flags` — Get Active Flags (Kasir)

**Headers:** `Authorization: Bearer <token>`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "QRIS_PAYMENT": true,
    "SPLIT_PAYMENT": true
  }
}
```

**Rate limit:** 60 req / menit

---

### `GET /api/v1/flags/admin` — Get All Flags (Admin)

**Headers:** `Authorization: Bearer <token>` + `Role: superadmin`

---

### `POST /api/v1/flags/toggle` — Toggle Flag (Admin)

**Headers:** `Authorization: Bearer <token>` + `X-CSRF-Token` + `Role: superadmin`

**Request:**
```json
{ "name": "QRIS_PAYMENT", "is_enabled": false }
```

---

## 8. Inventory (Admin)

### `GET /api/v1/admin/inventory` — List Raw Materials

**Headers:** `Authorization: Bearer <token>` + `Role: superadmin`

**Response (200):**
```json
{
  "status": "success",
  "data": [
    {
      "id": "uuid",
      "name": "Tepung Tapioka",
      "purchase_unit": "kg",
      "current_stock": 25,
      "min_stock": 10,
      "cost_per_unit": 15000
    }
  ]
}
```

---

### `GET /api/v1/admin/inventory/low-stock` — Low Stock Alert

**Headers:** `Authorization: Bearer <token>` + `Role: superadmin`

**Response (200):**
```json
{
  "status": "success",
  "data": [
    { "id": "uuid", "name": "Tepung Tapioka", "current_stock": 5, "min_stock": 10 }
  ]
}
```

---

### `POST /api/v1/admin/inventory/materials` — Create Raw Material

**Headers:** `Authorization: Bearer <token>` + `X-CSRF-Token` + `Role: superadmin`

**Request:**
```json
{
  "name": "Tepung Tapioka",
  "purchase_unit": "kg",
  "purchase_qty": 25,
  "usage_unit": "g",
  "conversion_factor": 1000,
  "current_stock": 25,
  "min_stock": 10,
  "cost_per_unit": 15000,
  "supplier": "Toko Bahan"
}
```

---

### `PATCH /api/v1/admin/inventory/materials/:id` — Update Raw Material

**Headers:** `Authorization: Bearer <token>` + `X-CSRF-Token` + `Role: superadmin`

---

### `POST /api/v1/admin/inventory/adjust` — Adjust Stock

**Headers:** `Authorization: Bearer <token>` + `X-CSRF-Token` + `Role: superadmin`

**Request:**
```json
{ "id": "uuid", "qty": 5, "type": "in" | "out" | "adjustment" | "waste", "notes": "Restock dari supplier" }
```

---

### `POST /api/v1/admin/inventory/opname` — Stock Opname (Bulk)

**Headers:** `Authorization: Bearer <token>` + `X-CSRF-Token` + `Role: superadmin`

**Request:**
```json
{
  "items": [
    { "id": "uuid", "actual_stock": 20 },
    { "id": "uuid", "actual_stock": 15 }
  ]
}
```

---

### `POST /api/v1/admin/inventory/bom` — Create BOM Recipe

**Headers:** `Authorization: Bearer <token>` + `X-CSRF-Token` + `Role: superadmin`

**Request:**
```json
{
  "product_id": "uuid",
  "modifier_option_id": "uuid (optional)",
  "raw_material_id": "uuid",
  "quantity_per_serving": 0.05
}
```

---

### `DELETE /api/v1/admin/inventory/bom/:id` — Delete BOM Recipe

**Headers:** `Authorization: Bearer <token>` + `X-CSRF-Token` + `Role: superadmin`

---

## 9. Finance (Admin)

### `GET /api/v1/admin/finance/kpi` — Dashboard KPI

**Headers:** `Authorization: Bearer <token>` + `Role: superadmin`

**Query params:** `date` (ISO 8601, default: today)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "revenue": 675000,
    "orderCount": 45,
    "avgOrderValue": 15000,
    "cashTotal": 500000,
    "qrisTotal": 175000
  }
}
```

---

### `GET /api/v1/admin/finance/opex` — Operational Expenses

**Headers:** `Authorization: Bearer <token>` + `Role: superadmin`

**Query params:** `month`, `year`

---

### `POST /api/v1/admin/finance/opex` — Create Operational Expense

**Headers:** `Authorization: Bearer <token>` + `X-CSRF-Token` + `Role: superadmin`

**Request:**
```json
{ "category": "Sewa", "description": "Sewa Juni", "amount": 500000, "expense_date": "2026-06-01" }
```

---

### `GET /api/v1/admin/finance/profit-share` — Profit Share Report

**Headers:** `Authorization: Bearer <token>` + `Role: superadmin`

**Query params:** `month`, `year`

---

### `POST /api/v1/admin/finance/profit-share/close` — Close Period

**Headers:** `Authorization: Bearer <token>` + `X-CSRF-Token` + `Role: superadmin`

**Request:** `{ "month": 6, "year": 2026 }`

---

### `POST /api/v1/admin/finance/profit-share/pay` — Pay Profit Share

**Headers:** `Authorization: Bearer <token>` + `X-CSRF-Token` + `Role: superadmin`

**Request:**
```json
{ "month": 6, "year": 2026, "proof": "bukti-transfer.jpg", "notes": "Transfer BCA" }
```

---

### `GET /api/v1/admin/finance/assets` — List Assets

---

### `POST /api/v1/admin/finance/assets` — Create Asset

---

### `PATCH /api/v1/admin/finance/assets/:id` — Update Asset

---

### `GET /api/v1/admin/finance/analytics` — Analytics

**Query params:** `period` (`daily` | `weekly` | `monthly`)

---

## 10. Users (Admin)

### `GET /api/v1/admin/users/cashiers` — List Cashiers

---

### `POST /api/v1/admin/users/cashiers` — Create Cashier

**Request:**
```json
{ "name": "Kasir 2", "username": "kasir2", "pin": "5678" }
```

---

### `PATCH /api/v1/admin/users/cashiers/:id/reset-pin` — Reset PIN

**Request:** `{ "pin": "9999" }`

---

### `PATCH /api/v1/admin/users/cashiers/:id/toggle-status` — Toggle Active

**Request:** `{ "is_active": false }`

---

## 11. Audit Logs (Admin)

### `GET /api/v1/admin/audit-logs` — Audit Logs

**Headers:** `Authorization: Bearer <token>` + `Role: superadmin`

**Query params:** `actor_id`, `action`, `date_from`, `date_to`, `page`

**Response (200):**
```json
{
  "success": true,
  "data": [...logs],
  "total": 500,
  "page": 1
}
```

---

### `POST /api/v1/admin/audit-logs/archive` — Archive Old Logs

**Headers:** `Authorization: Bearer <token>` + `Role: superadmin`

---

## 12. Store Info (Public)

### `GET /api/v1/store-info` — Info Toko untuk Struk

**No auth required** — data publik (nama toko, WA)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "store_name": "Ngemiloh",
    "store_address": "Jalan Raya No. 1, Jakarta",
    "store_phone": "021-12345678",
    "store_whatsapp": "081234567890"
  }
}
```

---

## 13. Webhooks

### `POST /api/v1/webhooks/midtrans` — Midtrans Payment Webhook

**No auth required** (IP whitelist + signature verification)

**Request:** Midtrans callback body

**Response (200):**
```json
{ "status": "ok" }
```

---

## 14. Rate Limits Summary

| Endpoint Pattern | Limit |
|----------------|-------|
| General API | 100 req/menit |
| Login (`/auth/login`) | 5 req/10 menit per IP |
| Auth refresh | 10 req/menit |
| Export CSV | 5 req/jam |
| Stock opname | 10 req/menit |
| Flags read | 60 req/menit |
| Flags toggle | 30 req/menit |

---

## 15. CSRF Protection

Semua mutating request (POST/PUT/PATCH/DELETE) wajib membawa header:

```
X-CSRF-Token: <token dari cookie csrf_token>
```

Token diambil dari cookie `csrf_token` yang di-set saat login.

---

*Document generated: 2026-06-16*
*Source: Audit langsung dari `backend/src/**/*.controller.ts`*
