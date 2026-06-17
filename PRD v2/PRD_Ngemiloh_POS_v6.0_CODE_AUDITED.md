# PRD NGEMILOH POS — v6.0 (CODE-AUDITED)

> **Status:** ACTIVE — Gap Analysis + Fix Checklist
> **Tanggal:** 17 Juni 2026
> **Sumber:** Audit langsung kode (`frontend/src/` + `backend/src/`) + cross-reference PRD v5.0 + PRD MASTER FINAL + v7.0 MASTER
> **Menggantikan:** `PRD_Ngemiloh_POS_FINAL.md`, `PRD_MASTER_FINAL_NGEMILOH_POS.md`
> **Catatan:** Dokumen ini adalah hasil audit mendalam, TIDAK lagi berdasarkan asumsi. Setiap pernyataan merujuk ke lokasi kode aktual.
>
> **Dokumen terkait:**
> - `PRD_NGEMILOH_POS_v7.0_MASTER.md` — Master document terbaru (single source of truth) dengan semua gap yang sudah dipetakan.
> - `PRD v5.3.md` (PRD v2 folder) — checklist P0-P1 dari analisis PRD v5.

---

## 0. Snapshot Proyek

| Item | Nilai | Sumber |
|------|-------|--------|
| VPS | MS 4.4 — 4 GB RAM, 4 vCPU, 60 GB Disk | Dokumen |
| Domain | `103-150-227-117.nip.io` | Dokumen |
| Repo | `https://github.com/Arif0821/ngemiloh-pos` | Dokumen |
| Backend | NestJS 11 + Prisma 6 + PostgreSQL 16 | `package.json` |
| Frontend | SvelteKit 2 + Svelte 5.55.2 (Runes) | `package.json` |
| Kasir aktif | 1 | Dokumen |
| Jenis order | Takeaway only | Dokumen |

---

## 1. Gap Analysis: Dokumen vs Kode

### 1.1 Critical Fixes Required (Bug P0–P1)

#### 🚨 P0 — `Modals.svelte` Gagal Import (camelCase vs snake_case)

**Lokasi:** `frontend/src/lib/components/pos/Modals.svelte` (723 baris, **DEAD CODE**)

**Masalah:** File ini mengimport `posStore`, `posService`, `printerService` (camelCase), tetapi yang diexport dari modul sebenarnya adalah `pos_store`, `pos_service`, `printer_service` (snake_case). Semua binding bernilai `undefined`.

**Konteks:** File ini TIDAK digunakan oleh POS page. `pos/+page.svelte:167` mengimport `ModalManager.svelte` yang sudah menggunakan snake_case. `Modals.svelte` adalah legacy file yang tidak pernah di-deprecate/dihapus.

**Tindakan:** Hapus `frontend/src/lib/components/pos/Modals.svelte`.

---

#### 🚨 P0 — 6 Field `$state` Tidak Reactive

**Lokasi:** `frontend/src/lib/stores/pos.store.svelte.ts:37-44`

**Kode salah:**
```typescript
// Baris 37-44 — DEKLARASI SALAH
show_open_shift_modal = $state(false)    // ❌ bukan $state
show_close_shift_modal = $state(false)   // ❌ bukan $state
has_open_shift = $state(true)            // ❌ bukan $state
opening_balance = $state(DEFAULT_OPENING_BALANCE)  // ❌ bukan $state
closing_balance = $state(0)              // ❌ bukan $state
is_checking_shift = $state(true)        // ❌ bukan $state
```

**Seharusnya:**
```typescript
show_open_shift_modal = false  // reactive field, bukan class field
// atau gunakan bentuk yang benar
```

**Dampak:** `has_open_shift` adalah flat class field, BUKAN reactive state. Jika `pos_service.check_shift()` mengubahnya, UI yang bergantung pada nilai ini TIDAK akan re-render. Modal shift tidak akan muncul/tutup dengan benar.

**Catatan:** `ModalManager.svelte:14` mengecek `!pos_store.has_open_shift && !pos_store.is_checking_shift` — kondisi ini mungkin tidak trigger dengan benar.

**Tindakan:** Perbaiki deklarasi 6 field tersebut agar menjadi reactive state Svelte 5.

---

#### 🚨 P1 — Legacy `Modals.svelte` SuccessModal Hanya Punya Tombol Bluetooth

**Lokasi:** `frontend/src/lib/components/pos/Modals.svelte:638-641`

**Kode:**
```svelte
<button onclick={printReceipt} class="...">CETAK STRUK</button>
```

Hanya satu tombol. Tidak ada tombol "PRINT BROWSER" sebagai fallback.

**Konteks:** File ini tidak digunakan (dead code), tetapi jika suatu hari diaktifkan, fitur printer fallback hilang.

**Tindakan:** File sudah tidak digunakan. Pastikan `ModalManager.svelte` yang aktif menggunakan `SuccessModal.svelte` di folder `modals/` (yang sudah punya dual print button).

---

#### 🚨 P1 — `show_open_shift_modal` Tidak Pernah Di-set

**Lokasi:** `frontend/src/lib/stores/pos.store.svelte.ts:37`

Field `show_open_shift_modal` ada di store tapi tidak pernah di-set ke `true` di manapun. Kondisi di `ModalManager.svelte:14` menggunakan `!has_open_shift && !is_checking_shift` secara langsung, BUKAN via flag toggle.

**Tindakan:** Hapus field yang tidak terpakai atau gunakan secara konsisten jika memang dibutuhkan.

---

### 1.2 Medium Priority Gaps

#### ⚠️ M1 — Field `order_number` vs `transaction_number`

**Lokasi:** `backend/prisma/schema.prisma:203`

PRD mendefinisikan `transaction_number` (format `TRX-YYYYMMDD-A001`), tetapi schema Prisma menggunakan nama field `order_number`.

**Tindakan:** Konfirmasi nama field yang digunakan secara konsisten di seluruh stack (schema → service → API response).

---

#### ⚠️ M2 — Tidak Ada `SELECT ... FOR UPDATE` untuk Idempotency

**Lokasi:** `backend/src/orders/application/services/orders.service.ts:107-113, 508-514`

PRD mensyaratkan `SELECT ... FOR UPDATE` untuk mencegah race condition saat idempotency check. Implementasi saat ini hanya pakai `findOrderByClientUuid()` biasa tanpa pessimistic locking.

**Dampak:** Jika 2 request dengan `client_uuid` sama arrive bersamaan, kedua-duanya mungkin lewat cek `if (existingOrder)` karena belum ada row. Meskipun Prisma constraint `@unique` akan mencegah duplikat di DB layer, response untuk request kedua bisa error 500 (bukan idempotent graceful).

**Tindakan:** Tambahkan `SELECT ... FOR UPDATE` di dalam transaction sebelum cek existensi. Atau rely pada constraint `@unique` + handle `P2002` error dengan graceful return (sudah ada di `createOrderWithCache`).

---

#### ⚠️ M3 — Admin Login Pake OTP (Bukan "Tanpa OTP" Sesuai D-03)

**Lokasi:** `backend/src/auth/application/services/auth.service.ts:101`

PRD_Ngemiloh_POS_FINAL.md D-03 menyatakan: *"Admin login: email + password langsung (Opsi A, tanpa OTP step)"*.

Kode aktual: `POST /api/v1/auth/login` → kirim OTP ke email → `POST /api/v1/auth/verify-otp` → JWT.

**Implementasi:** 2-step (login → OTP → verify → JWT). Token expiry 12h setelah verifikasi OTP.

**Tindakan:** Apakah D-03 perlu di-revisi (OTP memang ada), atau kode perlu diubah (hapus OTP)? Dokumen PRD tidak sinkron dengan implementasi. Keputusan: **Kode adalah source of truth**, D-03 di PRD perlu direvisi menjadi "Admin login: email + password + OTP verification".

---

#### ⚠️ M4 — Shift Check Hanya Sekali (Tidak Ada Polling)

**Lokasi:** `frontend/src/routes/pos/+page.svelte:73`

`check_shift()` dipanggil sekali di `onMount`. Tidak ada polling berkala.

**Dampak:** Jika shift ditutup dari admin panel sementara POS tablet running, kasir tidak akan tahu sampai dia coba bertransaksi.

**Tindakan:** Tambahkan periodic check (misal setiap 60 detik) atau long-polling endpoint.

---

#### ⚠️ M5 — CORS nip.io Tidak Hardcoded

**Lokasi:** `backend/src/main.ts:43-47`

```typescript
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:4173',
  process.env.FRONTEND_URL,  // Harus diset manual
].filter(Boolean);
```

PRD menyatakan `103-150-227-117.nip.io` sebagai default, tapi tidak di-hardcode.

**Tindakan:** Tambahkan fallback hardcoded atau pastikan `FRONTEND_URL` di-set di env production.

---

#### ⚠️ M6 — Cart Type Menggunakan `unknown[]`

**Lokasi:** `frontend/src/lib/domain/models/types.ts`

```typescript
interface LocalCartItem {
  id: string;
  items: unknown[];  // ⚠️ terlalu generic
}
```

**Tindakan:** Definisikan tipe yang tepat untuk items di cart.

---

### 1.3 Items yang Sudah Benar (vs PRD)

| Item | Status | Lokasi |
|------|--------|--------|
| Trust but Verify (tidak throw on discrepancy) | ✅ BENAR | `orders.service.ts:251-257` |
| `verification_status` field | ✅ TERPAKAI | `orders.service.ts:296` |
| `synced_from_offline` field | ✅ TERPAKAI (createOrderWithCache) | `orders.service.ts:596` |
| QRIS offline → `pending_sync` | ✅ BENAR | `orders.service.ts:447-450` |
| TINGGI-04 discount formula | ✅ BENAR | `pos.store.svelte.ts:95-108` |
| JWT kasir 20h | ✅ BENAR | `auth.service.ts:185` |
| JWT admin 12h | ✅ BENAR | `auth.service.ts:352` |
| No refresh token | ✅ BENAR | Tidak ada `/auth/refresh` endpoint |
| **Admin OTP login (verify-otp, resend-otp, change-pin)** | ✅ ADA | `auth.controller.ts:182, 171, 129` |
| ApiClient singleton + 401 handling | ✅ BENAR | `api.client.ts:32-50, 147-153` |
| Printer return boolean | ✅ BENAR | `printer.service.ts` |
| ModalManager refactoring | ✅ SELESAI | `ModalManager.svelte` + `modals/` |
| SuccessModal dual print buttons | ✅ ADA | `modals/SuccessModal.svelte:115-146` |
| Dexie 3 tabel | ✅ BENAR | `db.ts` |
| CSRF middleware | ✅ AKTIF | `csrf.middleware.ts` |
| Rate limiting (ThrottlerGuard) | ✅ AKTIF | `app.module.ts` |
| Audit logging interceptor | ✅ AKTIF | `app.module.ts` |
| **`order_number` generation** | ✅ ADA | `orders.service.ts:91-104` |
| **`customer_name` di DTO** | ✅ ADA | `create-order.dto.ts:62` |
| **`cash_received` di DTO** | ✅ ADA | `create-order.dto.ts:72` |
| `shift_date` (business date anchor) | ✅ BENAR | Schema `CashRegister` |

---

### 1.4 Critical Gaps dari PRD v5 (SHIFT Module)

#### 🚨 G-01: `planned_close_at`, `auto_close_at`, `shift_number`, `carry_over` TIDAK ADA

**PRD v5:** D-18 + SHIFT-06/07 + BUG-S02 mensyaratkan 5 field baru di `CashRegister`.

**Kode aktual:** `finance.service.ts` dan `finance.dto.ts` tidak punya field ini.

```typescript
// finance.dto.ts — OpenShiftDto (saat ini):
{ opening_balance: number }  // hanya ini

// finance.dto.ts — CloseShiftDto (saat ini):
{ closing_balance: number }  // hanya ini
```

**Yang seharusnya ada:**
- `OpenShiftDto`: `{ opening_balance, planned_close_at? }`
- `CloseShiftDto`: `{ actual_cash, notes? }`
- `CashRegister`: `shift_number`, `carry_over_from_shift_id`, `is_auto_closed`, `planned_close_at`, `auto_close_at`

**Effort:** Medium — schema + migration + DTO + service + cron

---

#### 🚨 G-02: `system_cash_total` dan `discrepancy` Tidak Dihitung

**PRD v5:** SHIFT-05 mensyaratkan kalkulasi server-side.

**Kode aktual:** `closeShift()` menerima `closing_balance` langsung dari client tanpa kalkulasi.

**Effort:** Medium

---

#### 🚨 G-03: `ProfitShareDetail` Table Tidak Ada

**PRD v5:** Profit-share breakdown per kasir butuh tabel terpisah.

**Kode aktual:** Schema tidak punya `profit_share_details`.

**Effort:** Medium

---

#### 🚨 G-04: `SystemLog` Table Tidak Ada

**PRD v5:** System monitoring butuh tabel `system_logs`.

**Kode aktual:** Tidak ada.

**Effort:** Low

---

### 1.5 Schema yang Perlu Diubah

#### `CashRegister` — Tambah 5 field

```prisma
shift_number            Int     @default(1)
carry_over_from_shift_id String? @db.Uuid
is_auto_closed          Boolean @default(false)
planned_close_at        DateTime? @db.Timestamptz
auto_close_at           DateTime? @db.Timestamptz
```

#### `User` — Tambah `cashier_letter`

```prisma
cashier_letter String? @unique @db.Char(1)  // A-Z, hanya kasir
```

#### Tabel baru: `ProfitShareDetail` + `SystemLog`

---

### 1.6 DTO yang Perlu Diubah

#### `OpenShiftDto` — Tambah `planned_close_at?`

```typescript
opening_balance: number
planned_close_at?: string  // ISO date, opsional
```

#### `CloseShiftDto` — Rename `closing_balance` → `actual_cash`

```typescript
actual_cash: number  // bukan closing_balance
notes?: string
```
| Shift = business date | ✅ BENAR | `CashRegister.shift_date` |

---

## 2. Frontend Architecture (v6.0 — Code-Audited)

### 2.1 Tech Stack

| Layer | Teknologi | Versi | Lokasi |
|-------|-----------|-------|--------|
| Framework | SvelteKit | 2.x | `frontend/package.json` |
| UI Framework | Svelte | **5.55.2** (Runes) | `frontend/package.json` |
| Styling | Tailwind CSS | 4.x | `frontend/package.json` |
| Offline Storage | Dexie.js | 3.x | `frontend/src/lib/db.ts` |
| HTTP Client | Custom ApiClient | singleton | `frontend/src/lib/services/api.client.ts` |
| Printer | Web Bluetooth API + HTML Print | browser-native | `frontend/src/lib/services/printer.service.ts` |

### 2.2 Folder Structure

```
frontend/src/
├── lib/
│   ├── components/
│   │   └── pos/
│   │       ├── CartSidebar.svelte      ✅ Aktif
│   │       ├── ProductList.svelte      ✅ Aktif
│   │       ├── ModalManager.svelte     ✅ Aktif (47 lines) ← mount di +page.svelte
│   │       ├── Modals.svelte           ⚠️ DEAD CODE (723 lines, camelCase, unused)
│   │       └── modals/                 ✅ Aktif
│   │           ├── ShiftModal.svelte   ✅ (mode: open | close)
│   │           ├── ModifierModal.svelte ✅
│   │           ├── PaymentModal.svelte  ✅
│   │           ├── QrisWaitModal.svelte ✅
│   │           ├── SuccessModal.svelte  ✅ (dual print buttons)
│   │           └── HistoryModal.svelte  ✅
│   ├── services/
│   │   ├── api.client.ts               ✅ Singleton, CSRF, 401→redirect
│   │   ├── pos.service.ts              ✅ Semua business logic
│   │   └── printer.service.ts          ✅ Returns boolean
│   ├── stores/
│   │   └── pos.store.svelte.ts         ⚠️ 6 field $state tidak reactive
│   ├── db.ts                           ✅ Dexie 3 tabel
│   └── domain/models/
│       └── types.ts                    ⚠️ LocalCartItem.items: unknown[]
└── routes/
    ├── login/
    │   └── +page.svelte                ✅ Username + PIN → JWT 20h
    ├── login-admin/
    │   └── +page.svelte                ✅ Email + pass → OTP → verify → JWT 12h
    ├── pos/
    │   ├── +page.svelte                ✅ Mount ProductList + CartSidebar + ModalManager
    │   │                                 ⚠️ Shift check hanya sekali (no polling)
    │   └── print/
    │       └── +page.svelte            ✅ window.print(), 58mm/80mm toggle, pelanggan/dapur
    └── admin/
        └── +layout.svelte              ✅ Role guard superadmin
```

### 2.3 State Management (PosStore)

**File:** `src/lib/stores/pos.store.svelte.ts`
**Pattern:** Class singleton Svelte 5 Runes

#### ⚠️ CRITICAL: 6 Field Tidak Reactive

Lokasi: `pos.store.svelte.ts:37-44`

Field berikut TIDAK reactive (bukan `$state` yang benar):

```typescript
class PosStore {
  // ❌ SALAH — bukan reactive state
  show_open_shift_modal = $state(false)
  show_close_shift_modal = $state(false)
  has_open_shift = $state(true)
  opening_balance = $state(DEFAULT_OPENING_BALANCE)
  closing_balance = $state(0)
  is_checking_shift = $state(true)

  // ✅ BENAR — reactive
  is_offline = $state(false)
  show_payment_modal = $state(false)
  show_success_modal = $state(false)
  // ... dll
}
```

**Semua field lain** (`show_payment_modal`, `show_success_modal`, `cart`, `is_waiting_qris`, `last_order_details`, dll) sudah benar reactive.

#### $derived Computations

| Komputasi | Status | Lokasi |
|-----------|--------|--------|
| `modifier_total` | ✅ Benar | Hanya `additional_price` |
| `discount_total` | ✅ TINGGI-04 | Baris 95-108, hanya dari `base_price` |
| `cart_total` | ✅ Benar | `before_discount - discount` |
| `cash_change` | ✅ Benar | `cash_amount - cart_total` |

### 2.4 API Client

**File:** `src/lib/services/api.client.ts`

| Fitur | Status | Detail |
|-------|--------|--------|
| Singleton pattern | ✅ | `_instance`, `getInstance()`, `reset()` |
| CSRF token | ✅ | Cookie `csrf_token` → header `X-CSRF-Token` |
| 401 redirect | ✅ | Hapus token → `/login` atau `/login-admin` |
| Timeout 30s | ✅ | AbortController |
| Base URL | ⚠️ | Hardcoded `https://103-150-227-117.nip.io` sebagai fallback |
| Token route split | ✅ | `/admin/*` → `admin_token`, lainnya → `access_token` |

### 2.5 Print Receipt

**Dua metode tersedia:**

1. **Bluetooth ESC/POS** (`printer.service.ts`):
   - `connect_and_print(receiptData: string): Promise<boolean>`
   - Returns `true` on success, `false` on failure/error
   - Tidak throw — error tertangkap dan return `false`

2. **HTML Print Dialog** (`routes/pos/print/+page.svelte`):
   - `window.print()` via dedicated route
   - Toggle: 58mm / 80mm
   - Toggle: struk Pelanggan / Dapur

**SuccessModal** (`modals/SuccessModal.svelte`) memiliki DUA tombol:
- Line 115-129: Tombol hijau "PRINT BLUETOOTH"
- Line 132-146: Tombol abu "PRINT BROWSER" → `/pos/print`

---

## 3. Backend Architecture (v6.0 — Code-Audited)

### 3.1 Tech Stack

| Layer | Teknologi | Lokasi |
|-------|-----------|--------|
| Runtime | Node.js 20+ | `backend/package.json` |
| Framework | NestJS 11 | `backend/package.json` |
| ORM | Prisma 6 | `backend/package.json` |
| Database | PostgreSQL 16 | `docker-compose.yml` |
| Cache | Redis 7 | `docker-compose.yml` |
| Queue | BullMQ 5 | `backend/package.json` |
| Auth | JWT + Passport | `backend/src/auth/` |
| Security | Helmet, CSRF, Throttler | `app.module.ts` |

### 3.2 Module Structure

```
backend/src/
├── auth/                    # JWT, PIN, OTP, guards
├── orders/                  # Order processing, sync-batch, SSE
├── products/                # Product + category CRUD
├── inventory/               # RawMaterial, BOM, StockMovement
├── finance/                 # KPI, shifts, profit share, assets, OPEX
├── discounts/               # Discount management
├── users/                   # Cashier + customer management
├── flags/                   # Feature flags
├── audit/                   # Audit logging
├── email/                   # OTP email
├── prisma/                  # Prisma service
├── common/
│   └── redis/               # Redis module
└── app.module.ts            # Root: 14 imports
```

### 3.3 Database Schema (Prisma — Single Source of Truth)

> **PENTING:** Schema Prisma adalah source of truth. Dokumen PRD menyesuaikan.

#### Enum Definitions

```prisma
enum Role { kasir, superadmin }
enum DiscountType { percentage, fixed_amount }
enum DiscountScope { all_products, category, specific_product }
enum PaymentMethod { cash, qris, split }
enum OrderStatus { completed, voided, pending_sync }
enum RegisterStatus { open, closed }
enum StockMovementType { in, out, adjustment, waste }
enum RefundMethod { cash, transfer, original_payment, manual_cash, store_credit }
```

#### Core Tables

**`User`** — Kasir & Admin
```prisma
model User {
  id                 String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name               String    @db.VarChar(100)
  username           String    @unique @db.VarChar(50)
  email              String?   @unique @db.VarChar(150)
  pin_hash           String?   @db.VarChar(72)    // bcrypt(kode + pepper)
  password_hash      String?   @db.VarChar(72)    // bcrypt(admin)
  role               Role
  is_active          Boolean   @default(true)
  must_change_pin    Boolean   @default(false)
  failed_login_count Int       @default(0) @db.SmallInt
  locked_until       DateTime? @db.Timestamptz
  last_login_at      DateTime? @db.Timestamptz
  created_at         DateTime  @default(now()) @db.Timestamptz
  updated_at         DateTime  @updatedAt

  orders             Order[]
  cash_registers     CashRegister[]
  // ... more relations

  @@index([role])
}
```

**`Order`** — transaksi
```prisma
model Order {
  id                   String        @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  cashier_id           String        @db.Uuid
  client_uuid          String        @unique @db.Uuid  // Idempotency key
  order_number         String?       @unique @db.VarChar(20)  // ⚠️ Nama field: order_number, BUKAN transaction_number
  customer_name        String?       @db.VarChar(50)   // Nama pelanggan antrean
  total_amount         Decimal       @db.Decimal(12, 2)
  discount_total       Decimal       @default(0) @db.Decimal(12, 2)
  cogs_total           Decimal       @default(0) @db.Decimal(12, 2)
  payment_method       PaymentMethod @default(cash)
  cash_amount          Decimal       @default(0) @db.Decimal(12, 2)
  qris_amount          Decimal       @default(0) @db.Decimal(12, 2)
  payment_gateway      String?       @db.VarChar(20)
  payment_gateway_ref  String?       @db.VarChar(100)
  payment_status       String?       @db.VarChar(30)
  qris_expiry_at       DateTime?     @db.Timestamptz
  payment_settled_at   DateTime?     @db.Timestamptz
  payment_raw_response String?       @db.Text
  status               OrderStatus   @default(completed)
  voided_by            String?       @db.Uuid
  voided_at            DateTime?     @db.Timestamptz
  void_reason          String?       @db.Text
  synced_from_offline  Boolean       @default(false)
  verification_status  String?       @db.VarChar(20)   // 'Valid' | 'Perlu Cek'
  client_created_at    DateTime      @db.Timestamptz
  created_at           DateTime      @default(now()) @db.Timestamptz

  cashier User @relation("CashierOrders", fields: [cashier_id], references: [id])
  voider  User? @relation("VoidedOrders", fields: [voided_by], references: [id])
  items   OrderItem[]

  @@index([cashier_id, status, created_at(sort: Desc)])
  @@index([client_created_at(sort: Desc)])
  @@index([status])
}
```

**`OrderItem`** — item pesanan
```prisma
model OrderItem {
  id                    String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  order_id              String   @db.Uuid
  product_id            String   @db.Uuid
  product_name_snapshot String   @db.VarChar(100)
  base_price            Decimal  @db.Decimal(12, 2)   // Harga SAAT order
  discount_amount       Decimal  @default(0) @db.Decimal(12, 2)  // TINGGI-04: dari base_price saja
  discount_id           String?  @db.Uuid
  discounted_base       Decimal  @db.Decimal(12, 2)   // base_price - discount_amount
  modifier_total        Decimal  @default(0) @db.Decimal(12, 2)  // TIDAK didiskon
  final_price           Decimal  @db.Decimal(12, 2)
  quantity              Int      @db.SmallInt
  subtotal              Decimal  @db.Decimal(12, 2)

  order     Order @relation(fields: [order_id], references: [id], onDelete: Cascade)
  product   Product @relation(fields: [product_id], references: [id])
  discount  Discount? @relation(fields: [discount_id], references: [id])
  modifiers OrderItemModifier[]

  @@index([order_id])
}
```

**`CashRegister`** — shift
```prisma
model CashRegister {
  id                String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  cashier_id        String         @db.Uuid
  shift_date        DateTime       @db.Date   // Business date (D-09)
  shift_start       DateTime       @default(now()) @db.Timestamptz
  shift_end         DateTime?      @db.Timestamptz
  opening_balance   Decimal        @default(500000) @db.Decimal(12, 2)
  closing_balance   Decimal?       @db.Decimal(12, 2)
  system_cash_total Decimal?       @db.Decimal(12, 2)
  discrepancy       Decimal?       @db.Decimal(12, 2)
  status            RegisterStatus @default(open)
  notes             String?        @db.Text

  cashier User @relation(fields: [cashier_id], references: [id])

  // ⚠️ Unique constraint [cashier_id, shift_date] ada di migration, BUKAN di schema Prisma
  @@index([cashier_id, shift_date(sort: Desc)])
  @@index([status])
}
```

---

## 4. Business Rules (Code-Audited)

### 4.1 Kalkulasi Harga — TINGGI-04 ✅

**Lokasi:** `frontend/src/lib/stores/pos.store.svelte.ts:95-108`

Diskon dihitung dari `base_price` SAJA. Modifier/topping TIDAK ikut didiskon.

```typescript
// pos.store.svelte.ts — discountTotal $derived
this.cart.reduce((sum, item) => {
  const discount = this.getBestDiscountForProduct(item);
  if (!discount) return sum;
  const base_total = Number(item.base_price) * item.quantity;
  return sum + (discount.type === 'percentage'
    ? base_total * (Number(discount.value) / 100)
    : Number(discount.value) * item.quantity);
}, 0);
```

### 4.2 Trust but Verify ✅

**Lokasi:** `backend/src/orders/application/services/orders.service.ts:251-257`

Backend **tidak menolak** transaksi saat ada diskrepansi harga. Accept harga kasir, flag untuk review.

```typescript
let vStatus = 'Valid';
if (diffPct > thresholdPct) {
  this.logger.warn(
    `[createOrder] [Trust but Verify] Discrepancy on Order ${data.client_uuid}...`,
  );
  vStatus = 'Perlu Cek';  // ✅ Tidak throw, hanya flag
}
```

### 4.3 QRIS Offline → `pending_sync` ✅

**Lokasi:** `backend/src/orders/application/services/orders.service.ts:447-450`

```typescript
if (orderData.payment_method === PaymentMethod.qris) {
  orderData.status = 'pending_sync';  // ✅ QRIS offline tidak ditolak
}
```

### 4.4 Shift = Business Date ✅

`CashRegister.shift_date` di-set saat `openShift()`. Laporan agregasi filter `shift_start..shift_end`.

---

## 5. Auth Flow (Code-Audited)

### 5.1 Kasir Login (PIN 4 digit)

```
POST /api/v1/auth/login
Body: { username: string, pin: string }

Response 200:
{ success: true, data: { id, name, username, role, is_active } }

Effect: Set cookie access_token (HttpOnly, 20h), redirect ke /pos
```

### 5.2 Admin Login (Email + Password + OTP)

**Step 1:** Login biasa → kirim OTP ke email
```
POST /api/v1/auth/login
Body: { username: email, pin: password }

Response: { success: true, require_otp: true, ... }
```

**Step 2:** Verifikasi OTP → dapat JWT
```
POST /api/v1/auth/verify-otp
Body: { email, otp_code }

Response 200: { success: true, data: { ...user, token } }
JWT expiry: 12h
```

> ⚠️ **Dokumen PRD D-03 menyatakan "tanpa OTP" tapi kode implementasi PAKAI OTP.** Kode adalah source of truth.

---

## 6. API Endpoints (Code-Audited)

### 6.1 Auth

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/v1/auth/login` | Login kasir/admin → kirim OTP (admin) |
| POST | `/api/v1/auth/verify-otp` | Verifikasi OTP → JWT admin 12h |
| POST | `/api/v1/auth/logout` | Revoke token |
| GET | `/api/v1/auth/me` | Current user |

### 6.2 Orders

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/v1/orders` | Create order |
| POST | `/api/v1/orders/sync-batch` | Sync offline orders (Trust but Verify) |
| GET | `/api/v1/orders` | Order history (paginated) |
| GET | `/api/v1/orders/:id/status` | Check QRIS status (polling) |
| GET | `/api/v1/orders/:id/sse` | SSE stream untuk QRIS status |
| POST | `/api/v1/webhooks/midtrans` | Midtrans callback |

### 6.3 Shift

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/v1/pos/shift/start` | Buka shift (kasir login) |
| GET | `/api/v1/pos/shift/status` | Cek shift aktif |
| GET | `/api/v1/orders/shift` | Ringkasan shift (total_transaksi, revenue) |
| GET | `/api/v1/admin/finance/cash/current` | Current shift (admin) |
| POST | `/api/v1/admin/finance/cash/open` | Buka shift (admin) |
| POST | `/api/v1/admin/finance/cash/close` | Tutup shift |

### 6.4 Products

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/v1/products` | Daftar produk (+ modifiers) |
| GET | `/api/v1/categories` | Daftar kategori |
| POST | `/api/v1/admin/products` | Create product (multipart) |
| PATCH | `/api/v1/admin/products/:id` | Update product |
| DELETE | `/api/v1/admin/products/:id` | Delete product |

### 6.5 Admin

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| POST | `/api/v1/admin/transactions/:id/void` | Void transaksi |
| PATCH | `/api/v1/admin/transactions/:id/flag` | Flag 'Valid' / 'Perlu Cek' |
| GET | `/api/v1/admin/reports/export` | Export CSV |
| GET | `/api/v1/admin/discounts` | Daftar diskon |
| POST | `/api/v1/admin/discounts` | Create diskon |
| GET | `/api/v1/admin/finance/kpi` | Dashboard KPI |
| GET | `/api/v1/admin/inventory` | Daftar bahan baku |
| GET | `/api/v1/flags` | Feature flags (kasir) |

---

## 7. Security (Code-Audited)

| Layer | Implementasi | Lokasi |
|-------|-------------|--------|
| JWT Auth | Passport JWT, 20h kasir / 12h admin | `auth.service.ts:185,352` |
| CSRF | Cookie `csrf_token` + header `X-CSRF-Token` | `csrf.middleware.ts` |
| Rate Limit | 100/min umum, 5/10min login | `app.module.ts` (ThrottlerGuard) |
| IP Lockout | 5 failed → 30min lock | `IpLockout` model + middleware |
| Audit Log | Global interceptor on mutating requests | `app.module.ts` (AuditInterceptor) |
| Security Headers | Helmet middleware | `main.ts` |
| Input Validation | class-validator DTOs | Controller DTOs |

---

## 8. Infrastructure

### 8.1 Docker Services

```yaml
postgres:16-alpine      # Database (1G RAM)
redis:7-alpine          # Cache + BullMQ (128M RAM)
nestjs-api              # Backend (512M RAM)
ngemiloh-frontend       # Static SvelteKit (64M RAM)
caddy:2-alpine          # Reverse proxy (64M RAM)
```

**Tanpa PgBouncer** — NestJS connect langsung ke Postgres (`connection_limit=1`).

### 8.2 Caddy Configuration

Domain: `{$DOMAIN}` → `103-150-227-117.nip.io`

SSE buffering disabled (`flush_interval -1`) untuk endpoint `/api/v1/orders/*/sse`.

---

## 9. Fixes yang Harus Dilakukan

### Prioritas 1 (Wajib sebelum production)

| # | Fix | Lokasi | Effort |
|---|-----|--------|--------|
| F1 | Perbaiki 6 field `$state` agar reactive | `pos.store.svelte.ts:37-44` | Low |
| F2 | Hapus `Modals.svelte` (dead code, salah import) | `frontend/src/lib/components/pos/Modals.svelte` | Low |
| F3 | Hapus atau gunakan `show_open_shift_modal` secara konsisten | `pos.store.svelte.ts:37` | Low |
| F4 | Konfirmasi nama field `order_number` vs `transaction_number` | `schema.prisma` | **Done ✅** |
| F5 | Verifikasi unique constraint `[cashier_id, shift_date]` di migration | `backend/prisma/migrations/` | **Done ✅** |
| F6 | Tambah `cashier_letter` ke schema User + DTO | `schema.prisma`, `users.dto.ts` | Low |

### Prioritas 2 (PRD v5 Gaps — Schema & Backend Shift)

| # | Fix | Lokasi | Effort |
|---|-----|--------|--------|
| F7 | **Tambah 5 field ke `CashRegister`** (shift_number, carry_over, auto_close, planned_close_at) | `schema.prisma` | Medium |
| F8 | **Buat tabel `ProfitShareDetail`** | `schema.prisma` | Medium |
| F9 | **Buat tabel `SystemLog`** | `schema.prisma` | Low |
| F10 | **Update `openShift()`**: shift_number, auto_close_at, carry_over | `finance.service.ts` | Medium |
| F11 | **Update `closeShift()`**: system_cash_total, discrepancy (server-side calc) | `finance.service.ts` | Medium |
| F12 | Update `OpenShiftDto`: tambah `planned_close_at?` | `finance.dto.ts` | Low |
| F13 | Update `CloseShiftDto`: rename `closing_balance` → `actual_cash` | `finance.dto.ts` | Low |
| F14 | Generate auto_close_at default: shift_date + 1 hari 04:00 WIB | `finance.service.ts` | Low |
| F15 | Schedule BullMQ job auto-close shift (90min warning + auto-close) | `finance.cron.ts` | Medium |
| F16 | Tambahkan `SELECT ... FOR UPDATE` untuk idempotency | `orders.service.ts` | Low |

### Prioritas 3 (Frontend Improvements)

| # | Fix | Lokasi | Effort |
|---|-----|--------|--------|
| F17 | Shift polling setiap 60 detik | `pos/+page.svelte` | Low |
| F18 | Fix `LocalCartItem.items: unknown[]` → tipe tepat | `types.ts` | Low |
| F19 | Verifikasi profit-share breakdown per kasir | `finance.service.ts` | Medium |
| F20 | **Revisi D-03**: admin login PAKAI OTP (kode adalah source of truth) | Dokumen PRD | **Done ✅** |

---

## 10. Konstanta

**File:** `frontend/src/lib/utils/format.ts`

| Konstanta | Nilai | Keterangan |
|-----------|-------|------------|
| `QRIS_COUNTDOWN_SECONDS` | `900` | 15 menit |
| `DEFAULT_OPENING_BALANCE` | `500000` | Rp 500.000 |
| `FLAG_REFRESH_INTERVAL_MS` | `60000` | 1 menit |
| `MIN_QRIS_PAYMENT` | `1000` | Rp 1.000 |

---

## 11. Pending Items (dari Dokumen)

- Alamat outlet → placeholder `(menyusul)`
- Instagram resmi → `@ngemiloh.id`
- QR pengaduan → slot kosong di struk

---

## 12. Referensi Kode

| Dokumen | Lokasi |
|---------|--------|
| PosStore | `frontend/src/lib/stores/pos.store.svelte.ts` |
| ApiClient | `frontend/src/lib/services/api.client.ts` |
| PosService | `frontend/src/lib/services/pos.service.ts` |
| PrinterService | `frontend/src/lib/services/printer.service.ts` |
| ModalManager | `frontend/src/lib/components/pos/ModalManager.svelte` |
| SuccessModal | `frontend/src/lib/components/pos/modals/SuccessModal.svelte` |
| Dexie DB | `frontend/src/lib/db.ts` |
| Types | `frontend/src/lib/domain/models/types.ts` |
| Prisma Schema | `backend/prisma/schema.prisma` |
| Orders Service | `backend/src/orders/application/services/orders.service.ts` |
| Auth Service | `backend/src/auth/application/services/auth.service.ts` |
| App Module | `backend/src/app.module.ts` |
| CSRF Middleware | `backend/src/auth/middleware/csrf.middleware.ts` |

---

*Dokumen ini hasil audit kode langsung pada 17 Juni 2026. Setiap pernyataan merujuk ke file dan baris kode aktual. Gap analysis dilakukan dengan membandingkan kode vs dokumen PRD sebelumnya.*