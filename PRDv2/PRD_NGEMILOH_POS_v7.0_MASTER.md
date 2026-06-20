# PRD NGEMILOH POS — v7.0 (MASTER + CODE-AUDITED)

> **Status:** MASTER — Single Source of Truth
> **Tanggal:** 17 Juni 2026
> **Sumber:** Audit langsung kode (`frontend/src/` + `backend/src/`) + PRD v5.0 + PRD MASTER FINAL
> **Menggantikan:** `PRD_Ngemiloh_POS_v6.0_CODE_AUDITED.md`, `PRD_MASTER_FINAL_NGEMILOH_POS.md`, `PRD_Ngemiloh_POS_v5.md`
> **Nota:** Setiap klaim merujuk ke file:baris kode aktual

---

## 0. Snapshot Proyek

| Item | Nilai |
|------|-------|
| VPS | MS 4.4 — 4 GB RAM, 4 vCPU, 60 GB Disk, Ubuntu 24.04 |
| Domain | `103-150-227-117.nip.io` (Let's Encrypt via Caddy) |
| Repo | `https://github.com/Arif0821/ngemiloh-pos` |
| Backend | NestJS 11 + Prisma 6 + PostgreSQL 16 + Redis 7 |
| Frontend | SvelteKit 2 + Svelte 5.55.2 (Runes) + Tailwind CSS 4 |
| Email bisnis | `nabilah.fnb@gmail.com` |
| Kasir aktif | 1 (arsitektur mendukung multi-kasir) |
| Jenis order | Takeaway only |
| Midtrans | Sandbox (switch via `MIDTRANS_ENV`) |

---

## 1. Master Decisions Log (D-01 .. D-18)

| ID | Keputusan | Status Kode | Catatan |
|----|-----------|------------|---------|
| **D-01** | JWT tanpa refresh token. `RevokedToken` untuk logout/revoke saja. | ✅ SELESAI | Tidak ada `/auth/refresh` endpoint |
| **D-02** | Kasir: PIN 4–6 digit, JWT 20 jam, tanpa refresh. | ✅ SELESAI | `auth.service.ts:185` |
| **D-03** | Admin: email + password → OTP email → verify → JWT 12 jam. **2-step flow.** | ✅ SELESAI | OTP endpoint ada: verify-otp, resend-otp |
| **D-04** | HTTPS via Caddy + nip.io. | ✅ SELESAI | Caddyfile sudah dikonfigurasi |
| **D-05** | Semua URL env → `https://103-150-227-117.nip.io`. | ⚠️ PARTIAL | `FRONTEND_URL` env var, tidak hardcoded |
| **D-06** | PgBouncer dihapus. NestJS connect langsung Postgres. | ✅ SELESAI | `DATABASE_URL` langsung ke postgres |
| **D-07** | Printer: HTML Print Dialog (`window.print()`) + Bluetooth fallback. | ✅ SELESAI | Dual print: Bluetooth + Browser |
| **D-08** | Offline storage: Dexie.js (bukan idb-keyval). | ✅ SELESAI | 3 tabel: products, orders, cart |
| **D-09** | Shift = business date. Filter `shift_start..shift_end`, BUKAN `created_at`. | ✅ SELESAI | `CashRegister.shift_date` ada |
| **D-10** | `Order.customer_name` (VARCHAR 50, nullable). | ✅ SELESAI | Schema + DTO ada |
| **D-11** | Multi-kasir + profit-share 40% + jumlah transaksi per kasir. | ⚠️ PARTIAL | ProfitShareLog ada, breakdown per kasir perlu dicek |
| **D-12** | Format struk baru: NGEMILOH, waktu, TRX, Kasir, Pelanggan, item+modifier, Subtotal/Diskon/Total, blok pembayaran, footer IG. | ✅ SELESAI | `pos/print/+page.svelte` ada |
| **D-13** | Semua order = takeaway. | ✅ SELESAI | Tidak ada field meja/dine-in |
| **D-14** | Idempotency via `client_uuid` @unique + handle P2002. | ✅ SELESAI | Tidak ada `SELECT ... FOR UPDATE` — rely pada constraint |
| **D-15** | Tidak ada label Fase. Roadmap = checklist terurut. | ✅ AKTIF | Diadopsi di dokumen ini |
| **D-16** | BOM/HPP + RawMaterial + profit-share multi-kasir masuk scope. | ⚠️ PARTIAL | Schema ada, detail perlu verifikasi |
| **D-17** | Struk boleh tampilkan QR pengaduan + IG handle. | ✅ AKTIF | Placeholder: `@ngemiloh.id` |
| **D-18** | `planned_close_at` opsional. Default auto-close = `shift_date + 1 hari 04:00 WIB`. | ❌ BELUM ADA | Tidak ada di kode Finance |

---

## 2. Gap Analysis: Kode vs PRD v5

### 2.1 Sudah Benar (Tidak Perlu Action)

| Item | Kode | Lokasi |
|------|------|--------|
| Trust but Verify (tidak throw on discrepancy) | ✅ Benar | `orders.service.ts:251-257` |
| `verification_status` field | ✅ Terpakai | `orders.service.ts:296` |
| `synced_from_offline` field | ✅ Terpakai (createOrderWithCache) | `orders.service.ts:596` |
| QRIS offline → `pending_sync` | ✅ Benar | `orders.service.ts:447-450` |
| TINGGI-04 discount formula | ✅ Benar | `pos.store.svelte.ts:95-108` |
| JWT kasir 20h / admin 12h | ✅ Benar | `auth.service.ts:185,352` |
| No refresh token endpoint | ✅ Benar | Tidak ada `/auth/refresh` |
| ApiClient singleton + 401 handling | ✅ Benar | `api.client.ts:32-50, 147-153` |
| Printer return boolean | ✅ Benar | `printer.service.ts` |
| ModalManager + modals/ refactoring | ✅ SELESAI | `ModalManager.svelte` + `modals/` |
| SuccessModal dual print buttons | ✅ ADA | `modals/SuccessModal.svelte:115-146` |
| Dexie 3 tabel | ✅ Benar | `db.ts` |
| CSRF middleware aktif | ✅ Aktif | `csrf.middleware.ts` |
| Rate limiting (ThrottlerGuard) | ✅ Aktif | `app.module.ts` |
| Audit logging interceptor | ✅ Aktif | `app.module.ts` |
| `order_number` generation | ✅ ADA | `orders.service.ts:91-104` |
| `customer_name` di DTO | ✅ ADA | `create-order.dto.ts:62` |
| `cash_received` di DTO | ✅ ADA | `create-order.dto.ts:72` |
| OTP endpoints (verify-otp, resend-otp) | ✅ ADA | `auth.controller.ts:182, 171` |
| `change-pin` endpoint | ✅ ADA | `auth.controller.ts:129` |
| Shift = business date (shift_date) | ✅ Benar | Schema `CashRegister.shift_date` |
| Order partition by month | ✅ Benar | Schema dengan `@@index` |

### 2.2 CRITICAL — Belum Ada di Kode

#### 🚨 C-01: `planned_close_at`, `auto_close_at`, `shift_number`, `carry_over`

**PRD v5:** D-18 + SHIFT-06/07 mensyaratkan field ini di `CashRegister`.

**Kode aktual:** Tidak ada di `finance.dto.ts`, `finance.service.ts`, maupun schema Prisma.

**Yang ada sekarang:**
```typescript
// finance.dto.ts — OpenShiftDto
{ opening_balance: number }  // hanya ini

// finance.dto.ts — CloseShiftDto
{ closing_balance: number }  // hanya ini
```

**Yang PRD v5 minta:**
```typescript
// OpenShiftDto — yang seharusnya:
{ opening_balance: number, planned_close_at?: string }

// CloseShiftDto — yang seharusnya:
{ actual_cash: number, notes?: string }
```

**Gap di service:**
- `openShift()` tidak menghitung `shift_number`, `auto_close_at`, `carry_over_from_shift_id`
- `closeShift()` tidak menghitung `system_cash_total`, `discrepancy`

**Effort:** Medium — perlu update schema + DTO + service + cron

---

#### 🚨 C-02: `system_cash_total` dan `discrepancy` tidak dihitung

**PRD v5:** SHIFT-05 mensyaratkan:
```
system_cash_total = opening_balance + SUM(cash/split.cash_amount dari orders shift ini)
discrepancy = actual_cash - system_cash_total
```

**Kode aktual:** `closeShift()` menerima `closing_balance` langsung dari client, tidak ada kalkulasi server-side.

**Effort:** Medium — service logic

---

#### 🚨 C-03: `ProfitShareDetail` table tidak ada

**PRD v5:** Profit-share per kasir perlu breakdown per kasir (`ProfitShareDetail`).

**Kode aktual:** Schema tidak punya tabel `profit_share_details`. `ProfitShareLog` hanya untuk monthly aggregate.

**Effort:** Medium — schema + migration + service

---

### 2.3 MODERATE — Kurang / Perlu Verifikasi

#### ⚠️ M-01: `SELECT ... FOR UPDATE` tidak ada

PRD D-14 mensyaratkan `SELECT ... FOR UPDATE` untuk semua endpoint state-changing. Kode aktual rely pada `@unique` constraint + handle P2002.

**Verdict:** Acceptable untuk 1–3 kasir. Tidak perlu diperbaiki unless scale up.

---

#### ⚠️ M-02: `shift_number` tidak ada di schema/service

`openShift()` tidak menghitung urutan shift per hari.

**Effort:** Low — tambahkan counter query + update schema

---

#### ⚠️ M-03: `cashier_letter` belum ada di schema User

PRD v5 (Part 2.2) mensyaratkan `cashier_letter` (A–Z) di tabel `User` untuk format `order_number`.

**Verifikasi cepat:**
```bash
grep -n "cashier_letter" backend/prisma/schema.prisma
```

**Effort:** Low — tambah field + seed + DTO

---

#### ⚠️ M-04: `LocalCartItem.items: unknown[]` terlalu generic

**Lokasi:** `frontend/src/lib/domain/models/types.ts`

```typescript
interface LocalCartItem {
  id: string;
  items: unknown[];  // ⚠️
}
```

**Effort:** Low — definisikan tipe yang tepat

---

#### ⚠️ M-05: Shift check hanya sekali (no polling)

**Lokasi:** `frontend/src/routes/pos/+page.svelte:73`

`check_shift()` dipanggil sekali di `onMount`. Tidak ada polling.

**Dampak:** Jika shift ditutup dari admin panel, kasir tidak tahu.

**Effort:** Low — tambah `$effect` polling 60 detik

---

### 2.4 Frontend Bugs dari Code Audit

#### 🚨 F-01: 6 Field `$state` Tidak Reactive

**Lokasi:** `frontend/src/lib/stores/pos.store.svelte.ts:37-44`

```typescript
// ❌ SALAH — bukan reactive state Svelte 5
show_open_shift_modal = $state(false)
show_close_shift_modal = $state(false)
has_open_shift = $state(true)
opening_balance = $state(DEFAULT_OPENING_BALANCE)
closing_balance = $state(0)
is_checking_shift = $state(true)
selected_modifiers = $state({})
```

Deklarasi `= $state(value)` (tanpa `$state = value`) membuat field ini **flat class fields**, bukan reactive state. UI tidak re-render saat nilai berubah.

**Yang sudah benar:** `show_payment_modal`, `show_success_modal`, `is_waiting_qris`, `last_order_details`, dll.

**Effort:** Low — perbaiki deklarasi syntax

---

#### 🚨 F-02: Legacy `Modals.svelte` Dead Code (723 baris)

**Lokasi:** `frontend/src/lib/components/pos/Modals.svelte`

File ini mengimport `posStore`, `posService`, `printerService` (camelCase), tapi store/export menggunakan `pos_store`, `pos_service`, `printer_service` (snake_case). Semua binding → `undefined`.

**Konteks:** File ini TIDAK di-import oleh manapun. `pos/+page.svelte` mount `ModalManager.svelte` yang sudah benar. Ini dead code.

**Effort:** Zero-risk — hapus file

---

#### ⚠️ F-03: `show_open_shift_modal` tidak pernah di-set

Field ada di store tapi tidak pernah dimutasi. Kondisi `ModalManager.svelte:14` pakai `!has_open_shift` langsung, bukan via flag toggle.

**Effort:** Low — hapus field atau gunakan secara konsisten

---

## 3. Frontend Architecture (Code-Audited)

### 3.1 Folder Structure

```
frontend/src/
├── lib/
│   ├── components/
│   │   └── pos/
│   │       ├── CartSidebar.svelte      ✅ Aktif
│   │       ├── ProductList.svelte    ✅ Aktif
│   │       ├── ModalManager.svelte    ✅ Aktif (47 lines) — mount di +page.svelte
│   │       ├── Modals.svelte         ⚠️ DEAD CODE (723 lines, camelCase imports, hapus)
│   │       └── modals/               ✅ Aktif
│   │           ├── ShiftModal.svelte   ✅
│   │           ├── ModifierModal.svelte ✅
│   │           ├── PaymentModal.svelte  ✅
│   │           ├── QrisWaitModal.svelte ✅
│   │           ├── SuccessModal.svelte  ✅ (dual print buttons ✅)
│   │           └── HistoryModal.svelte  ✅
│   ├── services/
│   │   ├── api.client.ts             ✅ Singleton, CSRF, 401→redirect
│   │   ├── pos.service.ts           ✅
│   │   └── printer.service.ts       ✅ Returns boolean
│   ├── stores/
│   │   └── pos.store.svelte.ts      ⚠️ 6 field tidak reactive (F-01)
│   ├── db.ts                         ✅ Dexie 3 tabel
│   └── domain/models/
│       └── types.ts                  ⚠️ LocalCartItem.items: unknown[]
└── routes/
    ├── login/+page.svelte           ✅ PIN login
    ├── login-admin/+page.svelte     ✅ Email + pass → OTP → verify
    ├── pos/
    │   ├── +page.svelte             ⚠️ Shift check sekali (M-05)
    │   └── print/+page.svelte       ✅ window.print(), 58mm/80mm
    └── admin/
        └── +layout.svelte           ✅ Role guard
```

### 3.2 PosStore — Bug F-01 Detail

**Lokasi:** `pos.store.svelte.ts:37-44`

Fix yang diperlukan:

```typescript
// ❌ SEBELUM (baris 37-44):
show_open_shift_modal = $state(false)
show_close_shift_modal = $state(false)
has_open_shift = $state(true)
opening_balance = $state(DEFAULT_OPENING_BALANCE)
closing_balance = $state(0)
is_checking_shift = $state(true)
selected_modifiers = $state({})

// ✅ SESUDAH — reactive class field:
show_open_shift_modal = false   // reactive field declaration
show_close_shift_modal = false
has_open_shift = true
opening_balance = DEFAULT_OPENING_BALANCE
closing_balance = 0
is_checking_shift = true
selected_modifiers = {}
```

> **Nota:** Dalam class dengan `$state()` proxy, field declaration `name = false` (tanpa `$state()` call) sudah reactive karena proxy interceptor handle property assignment. Pattern `name = $state(false)` di atas terlihat seperti constructor call tapi sebenarnya adalah property assignment dengan expression `$state(false)`. Ini tidak reactive. Gunakan `name = false` untuk field primitive.

### 3.3 API Client

**File:** `src/lib/services/api.client.ts`

| Fitur | Status | Detail |
|-------|--------|--------|
| Singleton pattern | ✅ | `_instance`, `getInstance()`, `reset()` |
| CSRF token | ✅ | Cookie `csrf_token` → header `X-CSRF-Token` |
| 401 redirect | ✅ | Hapus token → `/login` atau `/login-admin` |
| Timeout 30s | ✅ | AbortController |
| Base URL | ✅ | `VITE_API_URL` env var |
| Token route split | ✅ | `/admin/*` → `admin_token`, lainnya → `access_token` |

---

## 4. Backend Architecture (Code-Audited)

### 4.1 Module Structure

```
backend/src/
├── auth/                    # ✅ OTP + JWT + PIN + guards
├── orders/                  # ✅ Trust but Verify + idempotency
├── products/                # ✅ CRUD + modifiers
├── inventory/               # ✅ RawMaterial, BOM, StockMovement
├── finance/                 # ⚠️ Shift: missing planned_close, auto_close, shift_number
├── discounts/               # ✅
├── users/                   # ✅ Cashier management
├── flags/                   # ✅ Feature flags
├── audit/                   # ✅ Global interceptor
├── email/                   # ✅ OTP email
├── prisma/                  # ✅
└── app.module.ts            # ✅ ThrottlerGuard + AuditInterceptor aktif
```

### 4.2 Prisma Schema — Status per Entity

| Entity | Status | Catatan |
|--------|--------|---------|
| `User` | ⚠️ Kurang | Tidak ada `cashier_letter` |
| `Order` | ✅ Lengkap | `order_number`, `customer_name`, `verification_status`, `synced_from_offline` |
| `OrderItem` | ✅ Lengkap | TINGGI-04: `discount_amount` dari `base_price` saja, `modifier_total` terpisah |
| `CashRegister` | ⚠️ Kurang | Tidak ada `planned_close_at`, `auto_close_at`, `shift_number`, `carry_over_from_shift_id`, `is_auto_closed` |
| `Product` | ✅ | Semua field ada |
| `Discount` | ✅ | `max_discount` cap ada |
| `RawMaterial` | ✅ | Lengkap |
| `BomRecipe` | ✅ | Lengkap |
| `StockMovement` | ✅ | Lengkap |
| `ProfitShareLog` | ✅ | Ada |
| `ProfitShareDetail` | ❌ Tidak ada | Tabel baru perlu dibuat |
| `SystemLog` | ❌ Tidak ada | Tabel baru perlu dibuat |

### 4.3 Schema yang Perlu Diubah

#### `User` — Tambah `cashier_letter`

```prisma
model User {
  // ... existing fields ...
  cashier_letter String? @unique @db.Char(1)  // A-Z, hanya kasir
  // ... relations ...
}
```

#### `CashRegister` — Tambah 5 field baru

```prisma
model CashRegister {
  // ... existing fields ...
  shift_number            Int     @default(1)           // urutan shift hari ini
  carry_over_from_shift_id String? @db.Uuid              // FK ke shift sebelumnya
  is_auto_closed          Boolean @default(false)
  planned_close_at        DateTime? @db.Timestamptz      // opsional
  auto_close_at           DateTime? @db.Timestamptz     // default: shift_date + 1 hari 04:00 WIB

  @@index([cashier_id, shift_date(sort: Desc)])
  @@index([status])
}
```

#### Tabel Baru: `ProfitShareDetail`

```prisma
model ProfitShareDetail {
  id                  String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  profit_share_log_id String   @db.Uuid
  cashier_id          String   @db.Uuid
  transaction_count   Int
  total_revenue       Decimal  @db.Decimal(14, 0)
  share_percentage    Decimal  @db.Decimal(5, 2)
  share_amount       Decimal  @db.Decimal(14, 0)
  created_at          DateTime @default(now()) @db.Timestamptz

  profit_share_log ProfitShareLog @relation(fields: [profit_share_log_id], references: [id])
  cashier          User           @relation(fields: [cashier_id], references: [id])

  @@unique([profit_share_log_id, cashier_id])
}
```

#### Tabel Baru: `SystemLog`

```prisma
model SystemLog {
  id         BigInt   @id @default(autoincrement())
  level      String  @db.VarChar(10)    // info|warn|error
  source     String  @db.VarChar(100)
  message    String  @db.Text
  metadata   Json?   @db.JsonB
  created_at DateTime @default(now()) @db.Timestamptz

  @@index([level, created_at(sort: Desc)])
  @@index([source, created_at(sort: Desc)])
}
```

---

## 5. Business Rules (Code-Audited)

### 5.1 TINGGI-04 — Kalkulasi Diskon ✅

**Lokasi:** `frontend/src/lib/stores/pos.store.svelte.ts:95-108`

Diskon HANYA dari `base_price`. Modifier tidak ikut didiskon.

```typescript
// ✅ BENAR — tidak pernah include modifier_total
this.cart.reduce((sum, item) => {
  const discount = this.getBestDiscountForProduct(item);
  if (!discount) return sum;
  const base_total = Number(item.base_price) * item.quantity;
  return sum + (discount.type === 'percentage'
    ? base_total * (Number(discount.value) / 100)
    : Number(discount.value) * item.quantity);
}, 0);
```

### 5.2 Trust but Verify ✅

**Lokasi:** `backend/src/orders/application/services/orders.service.ts:251-257`

```typescript
let vStatus = 'Valid';
if (diffPct > thresholdPct) {
  this.logger.warn(`[Trust but Verify] Discrepancy: ${client_uuid}...`);
  vStatus = 'Perlu Cek';  // ✅ Tidak throw, hanya flag
}
// ✅ Store dengan harga kasir
total_amount: clientFinalPrice
```

### 5.3 QRIS Offline → `pending_sync` ✅

**Lokasi:** `orders.service.ts:447-450`

```typescript
if (orderData.payment_method === PaymentMethod.qris) {
  orderData.status = 'pending_sync';  // ✅ QRIS offline tidak ditolak
}
```

---

## 6. Auth Flow (Code-Audited)

### 6.1 Kasir Login

```
POST /api/v1/auth/login
Body: { username: string, pin: string }
Response: { success: true, data: { id, name, role, is_active } }
Cookie: access_token (HttpOnly, 20h)
```

### 6.2 Admin Login (2-Step)

```
Step 1: POST /api/v1/auth/login
Body: { email: string, password: string }
Response: { success: true, data: { message: "Kode OTP dikirim" } }

Step 2: POST /api/v1/auth/verify-otp
Body: { email: string, otp: string }
Response: { success: true, data: { id, name, role } }
Cookie: access_token (HttpOnly, 12h)

Step 3 (optional): POST /api/v1/auth/resend-otp
Body: { email: string }
```

> **Nota:** D-03 di PRD MASTER FINAL menyatakan "tanpa OTP" — itu obsolete. Kode implementasi PAKAI OTP (2-step). **Kode adalah source of truth.**

---

## 7. API Endpoints (Complete, Code-Audited)

### 7.1 Auth ✅

| Method | Endpoint | Status |
|--------|---------|--------|
| POST | `/api/v1/auth/login` | ✅ |
| POST | `/api/v1/auth/verify-otp` | ✅ ADA |
| POST | `/api/v1/auth/resend-otp` | ✅ ADA |
| POST | `/api/v1/auth/change-pin` | ✅ ADA |
| POST | `/api/v1/auth/logout` | ✅ |
| GET | `/api/v1/auth/me` | ✅ |
| POST | `/auth/refresh` | ✅ DIHAPUS |

### 7.2 Orders ✅

| Method | Endpoint | Status |
|--------|---------|--------|
| POST | `/api/v1/orders` | ✅ |
| POST | `/api/v1/orders/sync-batch` | ✅ Trust but Verify |
| GET | `/api/v1/orders` | ✅ |
| GET | `/api/v1/orders/:id/status` | ✅ |
| GET | `/api/v1/orders/:id/sse` | ✅ |
| POST | `/api/v1/webhooks/midtrans` | ✅ |

### 7.3 Shift ⚠️

| Method | Endpoint | Status |
|--------|---------|--------|
| POST | `/api/v1/pos/shift/start` | ✅ Basic |
| GET | `/api/v1/pos/shift/status` | ✅ |
| GET | `/api/v1/admin/finance/cash/current` | ✅ |
| POST | `/api/v1/admin/finance/cash/open` | ⚠️ Missing planned_close, auto_close, shift_number |
| POST | `/api/v1/admin/finance/cash/close` | ⚠️ Missing system_cash_total, discrepancy |

### 7.4 Products ✅

| Method | Endpoint | Status |
|--------|---------|--------|
| GET | `/api/v1/products` | ✅ |
| GET | `/api/v1/categories` | ✅ |
| POST | `/api/v1/admin/products` | ✅ |
| PATCH | `/api/v1/admin/products/:id` | ✅ |
| DELETE | `/api/v1/admin/products/:id` | ✅ |

### 7.5 Admin ⚠️

| Method | Endpoint | Status |
|--------|---------|--------|
| POST | `/api/v1/admin/transactions/:id/void` | ✅ |
| PATCH | `/api/v1/admin/transactions/:id/flag` | ✅ |
| GET | `/api/v1/admin/reports/export` | ✅ |
| GET | `/api/v1/admin/discounts` | ✅ |
| GET | `/api/v1/admin/finance/kpi` | ✅ |
| GET | `/api/v1/admin/finance/profit-share` | ⚠️ Tidak ada breakdown per kasir |
| POST | `/api/v1/admin/finance/profit-share/close` | ⚠️ Tidak simpan ProfitShareDetail |
| GET | `/api/v1/admin/inventory` | ✅ |
| GET | `/api/v1/admin/users/cashiers` | ✅ |
| POST | `/api/v1/admin/users/cashiers` | ⚠️ Missing cashier_letter di DTO |

---

## 8. Master Fix Checklist

### 8.1 Priority 1 — Critical Bugs (Wajib sebelum production)

| # | Fix | File | Effort | Status |
|---|-----|------|--------|--------|
| **F1** | Perbaiki 6 field `$state` agar reactive | `pos.store.svelte.ts:37-44` | Low | TODO |
| **F2** | Hapus `Modals.svelte` dead code | `frontend/src/lib/components/pos/Modals.svelte` | Low | TODO |
| **F3** | Hapus atau gunakan `show_open_shift_modal` konsisten | `pos.store.svelte.ts:37` | Low | TODO |
| **F4** | Tambah `cashier_letter` ke schema + seed + DTO | `schema.prisma`, `seed.ts`, DTO | Low | TODO |
| **F5** | Verifikasi `SELECT ... FOR UPDATE` untuk race condition | `orders.service.ts` | Low | Acceptable |

### 8.2 Priority 2 — Schema & Backend Gaps

| # | Fix | File | Effort |
|---|-----|------|--------|
| **F6** | Tambah 5 field ke `CashRegister` | `schema.prisma` + migration |
| **F7** | Buat tabel `ProfitShareDetail` | `schema.prisma` + migration |
| **F8** | Buat tabel `SystemLog` | `schema.prisma` + migration |
| **F9** | Update `openShift()` service: shift_number, auto_close, carry_over | `finance.service.ts` |
| **F10** | Update `closeShift()` service: system_cash_total, discrepancy | `finance.service.ts` |
| **F11** | Update `OpenShiftDto`: tambah `planned_close_at?` | `finance.dto.ts` |
| **F12** | Update `CloseShiftDto`: rename `closing_balance` → `actual_cash` | `finance.dto.ts` |
| **F13** | Generate auto_close_at default: shift_date + 1 hari 04:00 WIB | `finance.service.ts` |
| **F14** | Schedule BullMQ job untuk auto-close shift | `finance.cron.ts` |
| **F15** | Tambah `cashier_letter` di DTO create kasir | `users.dto.ts` |

### 8.3 Priority 3 — Frontend Improvements

| # | Fix | File | Effort |
|---|-----|------|--------|
| **F16** | Shift polling setiap 60 detik | `pos/+page.svelte` |
| **F17** | Fix `LocalCartItem.items: unknown[]` → tipe tepat | `types.ts` |
| **F18** | Verifikasi profit-share breakdown per kasir | `finance.service.ts` |

---

## 9. Testing Checklist

### Auth
- [ ] Login kasir → JWT 20h
- [ ] Login admin → OTP email → verify → JWT 12h
- [ ] 5x salah PIN → lockout 30 menit
- [ ] Logout kasir saat shift terbuka → error "Tutup shift dulu"
- [ ] Refresh token (tidak ada) → langsung logout setelah expiry

### Shift
- [ ] Buka shift → `shift_number` increment per hari
- [ ] Carry-over dari shift sebelumnya (jika ada)
- [ ] Tanpa `planned_close_at` → `auto_close_at` = besok 04:00 WIB
- [ ] Tutup shift → `discrepancy` = input - system_cash_total

### Transaksi
- [ ] Order cash → `cash_received` + `cash_change` tersimpan
- [ ] Order QRIS offline → `pending_sync` status
- [ ] Trust but Verify → discrepancy → `verification_status = 'Perlu Cek'`
- [ ] `order_number` format: `TRX-YYYYMMDD-A001`

### Print
- [ ] Bluetooth print success → struk keluar
- [ ] Bluetooth fail → alert + tombol Browser Print aktif
- [ ] Browser print → window.print() → RawBT (Android)

### Offline
- [ ] Offline → transaksi tersimpan di Dexie
- [ ] Online → sync-batch → `synced_from_offline = true`
- [ ] Trust but Verify → harga kasir dipakai, flag review

---

## 10. Konstanta

**File:** `frontend/src/lib/utils/format.ts`

| Konstanta | Nilai | Status |
|-----------|-------|--------|
| `QRIS_COUNTDOWN_SECONDS` | `900` | ✅ 15 menit |
| `DEFAULT_OPENING_BALANCE` | `500000` | ✅ Rp 500.000 |
| `FLAG_REFRESH_INTERVAL_MS` | `60000` | ✅ 1 menit |
| `MIN_QRIS_PAYMENT` | `1000` | ✅ Rp 1.000 |

---

## 11. Pending Items

- Alamat outlet → placeholder `(menyusul)` di struk
- Instagram resmi → `@ngemiloh.id`
- QR pengaduan → slot kosong

---

## 12. Referensi Kode

| Komponen | Lokasi |
|----------|--------|
| PosStore | `frontend/src/lib/stores/pos.store.svelte.ts` |
| ApiClient | `frontend/src/lib/services/api.client.ts` |
| PosService | `frontend/src/lib/services/pos.service.ts` |
| PrinterService | `frontend/src/lib/services/printer.service.ts` |
| ModalManager | `frontend/src/lib/components/pos/ModalManager.svelte` |
| SuccessModal | `frontend/src/lib/components/pos/modals/SuccessModal.svelte` |
| Print Page | `frontend/src/routes/pos/print/+page.svelte` |
| Dexie DB | `frontend/src/lib/db.ts` |
| Prisma Schema | `backend/prisma/schema.prisma` |
| Orders Service | `backend/src/orders/application/services/orders.service.ts` |
| Auth Service | `backend/src/auth/application/services/auth.service.ts` |
| Auth Controller | `backend/src/auth/presentation/auth.controller.ts` |
| Finance Service | `backend/src/finance/application/services/finance.service.ts` |
| Finance DTO | `backend/src/finance/presentation/dto/finance.dto.ts` |
| CreateOrder DTO | `backend/src/orders/presentation/dto/create-order.dto.ts` |

---

*Dokumen PRD v7.0 MASTER — Hasil audit kode langsung + cross-reference PRD v5 + PRD MASTER FINAL. Tanggal: 17 Juni 2026.*