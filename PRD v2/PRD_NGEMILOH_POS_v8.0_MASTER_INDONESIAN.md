# PRD NGEMILOH POS v8.1 DRAFT - DOKUMENTASI KOMPREHENSIF
**Versi:** 8.1 Draft (Red Team Updated)
**Tanggal:** 2026-06-24
**Penulis:** Tim Engineering
**Status:** 🔄 DALAM PENGECEKAN - RED TEAM ANALYSIS FINDINGS

> **Catatan Update v8.1:**
> - Ditambahkan Section 18: Red Team Analysis Findings (20 Kegagalan Fatal)
> - Ditambahkan Section 19: Priority Action Plan (Based on Owner Decisions)
> - Updated Section 9: Fitur Masa Depan dengan findings baru
> - Semua decision berdasarkan jawaban Owner di RED_TEAM_ANALYSIS_100_QUESTIONS.md

---

## 📋 DAFTAR ISI

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Arsitektur Sistem](#2-arsitektur-sistem)
3. [Tech Stack](#3-tech-stack)
4. [Struktur Database](#4-struktur-database)
5. [Modul Backend](#5-modul-backend)
6. [Halaman Frontend](#6-halaman-frontend)
7. [API Endpoints](#7-api-endpoints)
8. [Fitur Lengkap](#8-fitur-lengkap)
9. [Fitur yang Belum/Tidak Diimplementasi](#9-fitur-yang-belumtidak-diimplementasi)
10. [Model Bisnis](#10-model-bisnis)
11. [Deployment](#11-deployment)
12. [Testing](#12-testing)
13. [Keamanan](#13-keamanan)
14. [Performa](#14-performa)
15. [Issues & Warnings](#15-issues--warnings)
16. [Caddy Configuration](#16-caddy-configuration)
17. [Roadmap](#17-roadmap)
18. [Red Team Analysis Findings](#18-red-team-analysis-findings)
19. [Priority Action Plan](#19-priority-action-plan)

---

## 1. Ringkasan Eksekutif

### 1.1 Tentang Proyek
**NGEMILOH POS** adalah sistem Point of Sale lengkap untuk bisnis snack/makanan ringan dengan model franchise khusus.

### 1.2 Capaian

| Kategori | Total | Selesai | Persentase |
|----------|-------|---------|------------|
| Modul Backend | 13 | 13 | 100% |
| Halaman Frontend | 31 | 31 | 100% |
| Database Models | 30 | 30 | 100% |
| API Controllers | 15 | 15 | 100% |
| API Endpoints | 93 | 93 | 100% |
| Unit Tests | 9 | 9 | 100% |

> **Catatan:**
> - Modul Backend = 13 modules business logic (auth, orders, products, inventory, finance, discounts, members, payment, receipts, audit, users, flags, outlets). Folders non-module: common/, dto/, email/, jobs/, prisma/, test/, types/
> - Frontend pages = 31 ( `/change-pin` dihapus - PIN kasir hanya bisa di-reset oleh admin via `/admin/cashiers`)
> - Database models = 30 (Customer dan Member aktif - Customer untuk non-member purchases, Member untuk loyalty system)

### 1.3 Tech Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│  SvelteKit 2 + Svelte 5 (Runes) + Tailwind CSS 4 + Dexie.js   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND                                   │
│  NestJS 11 + TypeScript + Prisma 5 + BullMQ                     │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │PostgreSQL│   │  Redis   │   │ Midtrans │
        │   16+    │   │   7+     │   │  QRIS    │
        └──────────┘   └──────────┘   └──────────┘
```

---

## 2. Arsitektur Sistem

### 2.1 Arsitektur Keseluruhan

```
┌────────────────────────────────────────────────────────────────────┐
│                         NGEMILOH POS                               │
├────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐          │
│  │   Kasir A   │     │   Kasir B   │     │   Kasir C   │          │
│  │  (Freelance)│     │  (Freelance)│     │  (Freelance)│          │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘          │
│         │                    │                    │                  │
│         └────────────────────┼────────────────────┘                  │
│                              │                                       │
│                              ▼                                       │
│                    ┌─────────────────┐                               │
│                    │  Caddy Reverse  │                               │
│                    │     Proxy       │                               │
│                    └────────┬────────┘                               │
│                             │                                        │
│              ┌──────────────┴──────────────┐                        │
│              ▼                              ▼                        │
│    ┌─────────────────┐          ┌─────────────────┐               │
│    │   NestJS API    │          │  SvelteKit FE   │               │
│    │   (Backend)     │          │   (Frontend)    │               │
│    └────────┬────────┘          └─────────────────┘               │
│             │                                                       │
│    ┌────────┼────────┐                                            │
│    ▼        ▼        ▼                                             │
│ ┌──────┐ ┌──────┐ ┌──────────┐                                    │
│ │Postgres│ │Redis │ │ Midtrans │                                    │
│ │  DB   │ │Cache │ │  QRIS    │                                    │
│ └──────┘ └──────┘ └──────────┘                                    │
│                                                                     │
└────────────────────────────────────────────────────────────────────┘
```

### 2.2 Arsitektur Offline-First

```
┌──────────────────┐         ┌──────────────────┐
│    ONLINE MODE   │◄───────►│   OFFLINE MODE   │
└────────┬─────────┘         └────────┬─────────┘
         │                           │
         ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│  Direct API     │         │  Dexie.js       │
│  Calls          │         │  (IndexedDB)    │
└────────┬────────┘         └────────┬────────┘
         │                           │
         ▼                           ▼
┌─────────────────┐         ┌─────────────────┐
│  PostgreSQL     │         │  Local Cache    │
│  Database       │         │  + Queue        │
└─────────────────┘         └────────┬────────┘
                                     │
                                     ▼
                           ┌─────────────────┐
                           │  Auto Sync     │
                           │  (when online) │
                           └─────────────────┘
```

### 2.3 Arsitektur Folder

#### Backend (`backend/src/`)

```
backend/src/
├── auth/                          # Authentication module
│   ├── application/
│   │   └── services/
│   │       └── auth.service.ts    # Login, JWT, OTP, PIN
│   ├── domain/
│   │   └── interfaces/
│   │       └── auth.repository.interface.ts
│   ├── infrastructure/
│   │   └── repositories/
│   │       └── prisma-auth.repository.ts
│   ├── presentation/
│   │   └── auth.controller.ts     # Auth endpoints
│   ├── decorators/
│   │   ├── public.decorator.ts
│   │   └── roles.decorator.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── roles.guard.ts
│   │   └── throttler-logger.guard.ts
│   ├── middleware/
│   │   ├── csrf.middleware.ts
│   │   └── rate-limit-logger.middleware.ts
│   ├── strategies/
│   │   └── jwt.strategy.ts
│   ├── dto/
│   │   ├── change-pin.dto.ts
│   │   ├── login.dto.ts
│   │   └── resend-otp.dto.ts
│   └── auth.module.ts
│
├── orders/                        # Order processing module
│   ├── application/
│   │   ├── dto/
│   │   └── services/
│   │       └── orders.service.ts  # Main order logic
│   ├── domain/
│   │   ├── interfaces/
│   │   │   └── order.repository.interface.ts
│   │   └── utils/
│   │       └── discount.utils.ts  # DRY discount calculation
│   ├── infrastructure/
│   │   └── repositories/
│   │       └── prisma-order.repository.ts
│   ├── presentation/
│   │   ├── dto/
│   │   │   └── create-order.dto.ts
│   │   └── orders.controller.ts   # Order endpoints (12 endpoints)
│   └── orders.module.ts
│
├── products/                      # Product catalog module
├── inventory/                     # Inventory & BOM module
├── finance/                       # Shift & profit share
├── discounts/                     # Discount campaigns
├── members/                       # Member & loyalty system
├── payment/                       # Payment gateway (Midtrans)
├── receipts/                      # Receipt generation
├── audit/                         # Audit logging
├── email/                         # Email notifications
├── users/                         # User management
├── flags/                         # Feature flags
├── outlets/                       # Multi-outlet support
├── jobs/                          # BullMQ background jobs
│
├── common/                        # Shared utilities
│   ├── utils/
│   │   ├── constants.ts          # All magic numbers
│   │   ├── cookie.ts
│   │   ├── date.ts
│   │   ├── html.ts
│   │   ├── ip.ts
│   │   └── pagination.ts
│   ├── redis/
│   │   ├── redis.module.ts
│   │   └── redis.service.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   └── interceptors/
│       └── sentry-error.interceptor.ts
│
├── dto/                           # Global DTOs
├── types/                         # Type definitions
├── prisma/                        # Prisma service
└── test/                          # Test utilities
```

#### Frontend (`frontend/src/`)

```
frontend/src/
├── routes/
│   ├── +layout.svelte             # Root layout
│   ├── +page.svelte               # Landing page
│   ├── +error.svelte              # Error page
│   │
│   ├── login/                     # Kasir login
│   │   └── +page.svelte
│   │
│   ├── login-admin/               # Admin login
│   │   ├── +page.svelte
│   │   └── verify-otp/
│   │       └── +page.svelte
│   │
│   ├── outlet-selection/           # Multi-outlet selection
│   │   └── +page.svelte
│   │
│   ├── pos/                       # Point of Sale
│   │   ├── +page.svelte
│   │   └── print/
│   │       └── +page.svelte
│   │
│   ├── shift/                     # Shift summary
│   │   └── +page.svelte
│   │
│   ├── member/                    # Member registration
│   │   └── register/
│   │       └── +page.svelte
│   │
│   └── admin/                     # Admin dashboard
│       ├── +layout.svelte
│       ├── +error.svelte
│       ├── dashboard/
│       ├── transactions/
│       ├── products/
│       ├── categories/
│       ├── inventory/
│       ├── discounts/
│       ├── shifts/
│       ├── cashiers/
│       ├── members/
│       │   ├── +page.svelte
│       │   ├── [id]/
│       │   └── analytics/
│       ├── analytics/
│       ├── profit-share/
│       ├── cash/
│       ├── opex/
│       ├── assets/
│       ├── reports/
│       ├── settings/
│       │   ├── +page.svelte
│       │   └── flags/
│       ├── audit-logs/
│       ├── system-logs/
│       └── system-health/
│
└── lib/
    ├── components/
    │   ├── pos/
    │   │   ├── ProductList.svelte        # Product grid dengan kategori
    │   │   ├── CartSidebar.svelte        # Cart dengan item & total
    │   │   ├── ModalManager.svelte       # Central modal handler
    │   │   ├── MemberLookupModal.svelte  # Cari member by phone/code
    │   │   ├── OutletSelection.svelte    # Multi-outlet selector
    │   │   └── modals/
    │   │       ├── HistoryModal.svelte    # Riwayat transaksi
    │   │       ├── ModifierModal.svelte  # Pilih modifier/topping
    │   │       ├── PaymentModal.svelte   # Pembayaran cash/qris
    │   │       ├── QrisWaitModal.svelte  # QRIS waiting screen
    │   │       ├── ShiftModal.svelte     # Open/close shift
    │   │       └── SuccessModal.svelte    # Success confirmation
    │   ├── Toast.svelte                 # Toast notifications
    │   └── ErrorBoundary.svelte          # Error wrapper
    │
    ├── services/
    │   ├── api.client.ts          # API client
    │   ├── api.client.test.ts
    │   ├── member.service.ts
    │   ├── pos.service.ts
    │   └── printer.service.ts
    │
    ├── stores/
    │   ├── pos.store.svelte.ts    # POS state (Svelte 5 Runes)
    │   ├── member.store.svelte.ts
    │   └── toast.store.svelte.ts
    │
    ├── db.ts                      # Dexie.js (IndexedDB)
    │
    ├── domain/
    │   └── models/
    │       └── types.ts
    │
    └── utils/
        ├── format.ts
        ├── a11y.ts
        ├── error.ts
        └── sanitize.ts
```

---

## 3. Tech Stack

### 3.1 Backend

| Komponen | Teknologi | Versi | Keterangan |
|----------|-----------|-------|------------|
| Framework | NestJS | 11.x | Progressive Node.js framework |
| Bahasa | TypeScript | 5.x | Strict mode enabled |
| ORM | Prisma | 5.22+ | Type-safe database access |
| Database | PostgreSQL | 16+ | Primary data store |
| Cache | Redis | 7+ | Session & data cache |
| Queue | BullMQ | 5.x | Background job processing |
| Auth | JWT + Passport | - | Access token authentication |
| API Docs | Swagger/OpenAPI | - | Via @nestjs/swagger |
| Validation | class-validator | - | DTO validation |
| Error Tracking | Sentry | 10.x | Production error monitoring |
| Payment | Midtrans | - | QRIS payment gateway |

### 3.2 Frontend

| Komponen | Teknologi | Versi | Keterangan |
|----------|-----------|-------|------------|
| Framework | SvelteKit | 2.x | Full-stack framework |
| Bahasa | Svelte | 5.x | With Runes ($state, $derived) |
| Styling | Tailwind CSS | 4.x | Utility-first CSS |
| Offline Storage | Dexie.js | 4.x | IndexedDB wrapper |
| Charts | Chart.js | 4.x | Analytics visualization |
| Image Compress | browser-image-compression | 2.x | Client-side compression |
| Error Tracking | Sentry | 10.x | Via @sentry/sveltekit |

### 3.3 Infrastructure

| Komponen | Teknologi | Keterangan |
|----------|-----------|------------|
| Container | Docker + Docker Compose | Multi-service orchestration |
| Reverse Proxy | Caddy | Automatic HTTPS, rate limiting |
| CI/CD | GitHub Actions | Automated build & deploy |
| Host | Windows 11 + Docker Desktop | Development environment |

---

## 4. Struktur Database

### 4.1 Entity Relationship Diagram (ERD)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER & AUTH                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│    ┌─────────┐         ┌─────────────┐                                 │
│    │  User   │────────<│  UserOutlet  │>────────┐                      │
│    │ (Kasir) │         └─────────────┘          │                      │
│    └────┬────┘                                 ▼                      │
│         │                               ┌──────────┐                    │
│         │         ┌─────────────┐       │  Outlet  │                    │
│         │         │CashRegister │──────┤(Cabang)  │                    │
│         │         └─────────────┘       └──────────┘                    │
│         │                                                        │
└─────────┼────────────────────────────────────────────────────────┘
          │
          │ creates
          ▼
    ┌─────────────┐         ┌─────────────┐
    │   Order     │────────<│  OrderItem  │
    │ (Transaksi) │         └─────────────┘
    └──────┬──────┘
           │
           ├─────── OrderItemModifier
           │
           ├─────── OrderRefund
           │
           ├─────── StockMovement
           │
           └─────── MemberTransaction
                        ▲
                        │
    ┌─────────┐         │
    │ Member  │─────────┘
    │(Pelanggan)
    └────┬────┘
         │
         └───────── LoyaltyTier
```

### 4.2 Model Database (30 Models)

| Model | Deskripsi | Status |
|-------|-----------|--------|
| **User** | Data kasir dan admin | ✅ |
| **Category** | Kategori produk | ✅ |
| **Product** | Produk dengan harga | ✅ |
| **ProductModifierGroup** | Grup modifier (topping) | ✅ |
| **ProductModifierOption** | Opsi modifier | ✅ |
| **Discount** | Diskon/promo | ✅ |
| **Order** | Header transaksi | ✅ |
| **OrderItem** | Item dalam transaksi | ✅ |
| **OrderItemModifier** | Modifier per item | ✅ |
| **OrderRefund** | Data refund | ✅ |
| **CashRegister** | Shift kasir | ✅ |
| **OperationalExpense** | Biaya operasional | ✅ |
| **Asset** | Aset dengan depresiasi | ✅ |
| **ProfitShareLog** | Log bagi hasil | ✅ |
| **ProfitShareDetail** | Detail bagi hasil per kasir | ✅ |
| **FeatureFlag** | Feature flags | ✅ |
| **Setting** | Pengaturan toko | ✅ |
| **AuditLog** | Log audit immutable | ✅ |
| **Outlet** | Data cabang | ✅ |
| **UserOutlet** | Assignment kasir-outlet | ✅ |
| **Customer** | Pelanggan non-member (pembelian tanpa loyalty) | ✅ Active |
| **Member** | Pelanggan dengan loyalty system (point & tier) | ✅ Active |

> **Clarification:** Customer dan Member adalah dua entitas berbeda yang aktif bersamaan:
> - **Customer** = Pelanggan yang membeli dagangan tapi TIDAK terdaftar member (tanpa loyalty)
> - **Member** = Pelanggan yang sudah mendaftar untuk loyalty system (point & tier discount)
| **RawMaterial** | Bahan baku | ✅ |
| **RawMaterialPriceHistory** | Riwayat harga bahan | ✅ |
| **BomRecipe** | Resep HPP per produk | ✅ |
| **StockMovement** | Gerakan stok | ✅ |
| **IpLockout** | Lockout IP login | ✅ |
| **SystemLog** | Log sistem | ✅ |
| **LoyaltyTier** | Tier loyalty (Bronze/Platinum) | ✅ |
| **Member** | Data member/pelanggan | ✅ |
| **MemberTransaction** | Riwayat poin member | ✅ |

### 4.3 Enum Types

```prisma
enum Role {
  kasir      // Kasir freelance
  superadmin // Administrator
}

enum DiscountType {
  percentage    // Diskon %
  fixed_amount  // Diskon nominal
}

enum DiscountScope {
  all_products      // Semua produk
  category          // Per kategori
  specific_product  // Produk tertentu
}

enum PaymentMethod {
  cash   // Tunai
  qris   // QRIS Midtrans
  split  // Gabungan
}

enum OrderStatus {
  completed    // Selesai
  voided       // Dibatalkan
  pending_sync // Menunggu sync (offline)
}

enum RegisterStatus {
  open   // Shift terbuka
  closed // Shift ditutup
}

enum StockMovementType {
  in          // Masuk
  out         // Keluar
  adjustment  // Penyesuaian
  waste       // Sisa/rusak
}

enum RefundMethod {
  cash
  transfer
  original_payment
  manual_cash
  store_credit
}
```

---

## 5. Modul Backend

### 5.1 Daftar Modul Lengkap

| Modul | Lokasi | Controllers | Services | Status |
|-------|--------|-------------|----------|--------|
| **Auth** | `src/auth/` | 1 | 1 | ✅ |
| **Orders** | `src/orders/` | 1 | 1 | ✅ |
| **Products** | `src/products/` | 1 | 1 | ✅ |
| **Inventory** | `src/inventory/` | 1 | 1 | ✅ |
| **Finance** | `src/finance/` | 1 | 1 | ✅ |
| **Discounts** | `src/discounts/` | 1 | 2 | ✅ |
| **Members** | `src/members/` | 3 | 2 | ✅ |
| **Payment** | `src/payment/` | - | 2 | ✅ |
| **Receipts** | `src/receipts/` | 1 | 1 | ✅ |
| **Audit** | `src/audit/` | 1 | 1 | ✅ |
| **Users** | `src/users/` | 1 | 1 | ✅ |
| **Flags** | `src/flags/` | 1 | 1 | ✅ |
| **Outlets** | `src/outlets/` | 1 | 1 | ✅ |

> **Catatan:** Total 13 modules business logic. Folder non-module: common/, dto/, email/, jobs/, prisma/, test/, types/

### 5.2 Detail Modul

#### 5.2.1 Auth Module

```
src/auth/
├── application/services/auth.service.ts
├── domain/interfaces/auth.repository.interface.ts
├── infrastructure/repositories/prisma-auth.repository.ts
├── presentation/auth.controller.ts
├── decorators/
│   ├── public.decorator.ts
│   └── roles.decorator.ts
├── guards/
│   ├── jwt-auth.guard.ts
│   ├── roles.guard.ts
│   └── throttler-logger.guard.ts
├── middleware/
│   ├── csrf.middleware.ts
│   └── rate-limit-logger.middleware.ts
├── strategies/jwt.strategy.ts
├── dto/
│   ├── login.dto.ts
│   ├── resend-otp.dto.ts
│   └── verify-otp.dto.ts
└── auth.module.ts
```

**Fitur:**
- Login kasir dengan PIN 4-6 digit (username dari admin + PIN)
- Login admin dengan email + password + OTP 6 digit
- JWT access token (12 jam untuk admin, 365 hari untuk kasir)
- Rate limiting per IP + User-Agent hash
- CSRF protection dengan timing-safe comparison
- Lockout setelah 5 percobaan gagal
- Token revocation via Redis blocklist

#### 5.2.2 Members Module

```
src/members/
├── application/
│   ├── dto/
│   │   ├── lookup-member.dto.ts
│   │   ├── process-points.dto.ts
│   │   └── register-member.dto.ts
│   └── services/
│       ├── member.service.ts
│       └── loyalty.service.ts
├── domain/
│   ├── interfaces/member.repository.interface.ts
│   └── models/member.entity.ts
├── infrastructure/
│   └── repositories/prisma-member.repository.ts
├── presentation/
│   ├── member.controller.ts        # Public endpoints
│   ├── pos-member.controller.ts    # POS integration
│   └── admin-member.controller.ts  # Admin management
└── members.module.ts
```

**Fitur:**
- Registrasi member via QR code
- Lookup member berdasarkan HP/kode
- Proses points earning on transaction
- Proses points redemption
- Tier calculation (Bronze/Silver/Gold/Platinum)
- Grace period sebelum tier downgrade

#### 5.2.3 Orders Module

```
src/orders/
├── application/services/orders.service.ts
├── domain/
│   ├── interfaces/order.repository.interface.ts
│   └── utils/discount.utils.ts     # DRY discount calculation
├── infrastructure/repositories/prisma-order.repository.ts
├── presentation/
│   ├── dto/create-order.dto.ts
│   └── orders.controller.ts
└── orders.module.ts
```

**Fitur:**
- Create order dengan modifier
- Discount calculation (DRY via discount.utils.ts)
- Payment processing (cash, QRIS, split)
- Void order dengan alasan
- Offline batch sync
- Member points integration
- Stock reduction via BOM

---

## 6. Halaman Frontend

### 6.1 Statistik Halaman

| Kategori | Jumlah | Status |
|----------|--------|--------|
| Landing Page | 1 | ✅ |
| Login & Auth | 3 | ✅ |
| POS & Shift | 3 | ✅ |
| Outlet Selection | 1 | ✅ |
| Member | 1 | ✅ |
| Admin Dashboard | 22 | ✅ |
| **Total** | **31** | **✅ 100%** |

> **Catatan:**
> - Login & Auth = 3 (login, login-admin, verify-otp). `/change-pin` dihapus - PIN kasir hanya bisa di-reset oleh admin.
> - POS & Shift = 3 (pos, pos/print, shift)

### 6.2 Detail Halaman

#### Landing Page (1/1)

| Route | File | Fitur | Status |
|-------|------|-------|--------|
| `/` | `+page.svelte` | Landing page | ✅ |

#### Login & Authentication (3/3)

| Route | File | Fitur | Status |
|-------|------|-------|--------|
| `/login` | `login/+page.svelte` | Login kasir (username + PIN) | ✅ |
| `/login-admin` | `login-admin/+page.svelte` | Login admin (email + password) | ✅ |
| `/login-admin/verify-otp` | `login-admin/verify-otp/+page.svelte` | Verifikasi OTP | ✅ |

> **Catatan:** `/change-pin` dihapus - PIN kasir hanya bisa di-reset oleh admin via `/admin/cashiers`. Kasir tidak bisa self-service change PIN.

#### POS & Shift (3/3)

| Route | File | Fitur | Status |
|-------|------|-------|--------|
| `/pos` | `pos/+page.svelte` | POS utama dengan cart, payment, QRIS | ✅ |
| `/pos/print` | `pos/print/+page.svelte` | Cetak receipt | ✅ |
| `/shift` | `shift/+page.svelte` | Ringkasan shift kasir | ✅ |

#### Outlet Selection (1/1)

| Route | File | Fitur | Status |
|-------|------|-------|--------|
| `/outlet-selection` | `outlet-selection/+page.svelte` | Pilih outlet sebelum POS | ✅ |

#### Member (1/1)

| Route | File | Fitur | Status |
|-------|------|-------|--------|
| `/member/register` | `member/register/+page.svelte` | Registrasi member via QR | ✅ |

#### Admin Dashboard (22/22)

| Route | File | Fitur | Status |
|-------|------|-------|--------|
| `/admin/dashboard` | `admin/dashboard/+page.svelte` | KPI, grafik, produk terlaris | ✅ |
| `/admin/transactions` | `admin/transactions/+page.svelte` | Riwayat transaksi, void, flag | ✅ |
| `/admin/products` | `admin/products/+page.svelte` | CRUD produk + modifier | ✅ |
| `/admin/categories` | `admin/categories/+page.svelte` | Manajemen kategori | ✅ |
| `/admin/inventory` | `admin/inventory/+page.svelte` | Bahan baku, BOM, Waste (tabs) | ✅ |
| `/admin/discounts` | `admin/discounts/+page.svelte` | Manajemen diskon/promo | ✅ |
| `/admin/shifts` | `admin/shifts/+page.svelte` | Riwayat shift, discrepancy | ✅ |
| `/admin/cashiers` | `admin/cashiers/+page.svelte` | CRUD kasir, PIN reset | ✅ |
| `/admin/members` | `admin/members/+page.svelte` | Manajemen member | ✅ |
| `/admin/members/[id]` | `admin/members/[id]/+page.svelte` | Detail member | ✅ |
| `/admin/members/analytics` | `admin/members/analytics/+page.svelte` | Analytics member | ✅ |
| `/admin/analytics` | `admin/analytics/+page.svelte` | Trend revenue, jam sibuk | ✅ |
| `/admin/profit-share` | `admin/profit-share/+page.svelte` | Perhitungan bagi hasil | ✅ |
| `/admin/cash` | `admin/cash/+page.svelte` | Laporan cash register | ✅ |
| `/admin/opex` | `admin/opex/+page.svelte` | Input biaya operasional | ✅ |
| `/admin/assets` | `admin/assets/+page.svelte` | Aset & depresiasi | ✅ |
| `/admin/reports` | `admin/reports/+page.svelte` | Export CSV | ✅ |
| `/admin/settings` | `admin/settings/+page.svelte` | Pengaturan toko | ✅ |
| `/admin/settings/flags` | `admin/settings/flags/+page.svelte` | Feature flags | ✅ |
| `/admin/audit-logs` | `admin/audit-logs/+page.svelte` | Audit log immutable | ✅ |
| `/admin/system-logs` | `admin/system-logs/+page.svelte` | System logs | ✅ |
| `/admin/system-health` | `admin/system-health/+page.svelte` | Monitoring status | ✅ |

---

## 7. API Endpoints

### 7.1 Daftar Controllers (15)

| # | Controller | File | Prefix | Endpoints |
|---|------------|------|--------|-----------|
| 1 | **OrdersController** | `orders.controller.ts` | `/api/v1` | 13 |
| 2 | **ProductsController** | `products.controller.ts` | `/api/v1` | 9 |
| 3 | **AuthController** | `auth.controller.ts` | `/api/v1/auth` | 6 |
| 4 | **AppController** | `app.controller.ts` | `/` | 6 |
| 5 | **FlagsController** | `flags.controller.ts` | `/api/v1/flags` | 3 |
| 6 | **AuditController** | `audit.controller.ts` | `/admin/audit-logs` | 2 |
| 7 | **ReceiptsController** | `receipts.controller.ts` | `/receipts` | 4 |
| 8 | **UsersController** | `users.controller.ts` | `/api/v1/admin/users` | 7 |
| 9 | **DiscountsController** | `discounts.controller.ts` | `/api/v1/admin/discounts` | 5 |
| 10 | **FinanceController** | `finance.controller.ts` | `/api/v1/admin/finance` | 14 |
| 11 | **InventoryController** | `inventory.controller.ts` | `/api/v1/admin/inventory` | 13 |
| 12 | **MemberController** | `member.controller.ts` | `/member` | 2 (Public) |
| 13 | **PosMemberController** | `pos-member.controller.ts` | `/pos/member` | 2 (POS) |
| 14 | **AdminMemberController** | `admin-member.controller.ts` | `/admin/members` | 3 (Admin) |
| 15 | **OutletController** | `outlet.controller.ts` | `/api/v1/outlets` | 1 |

> **Total: 93 endpoints**
> **Koreksi dari ~98:** ProductsController 10→9, InventoryController 14→13, AppController 8→6

### 7.2 Endpoint Groups

#### Authentication (`/api/v1/auth`)

| Method | Endpoint | Deskripsi | Auth |
|--------|----------|-----------|------|
| POST | `/login` | Login kasir/admin (username+PIN atau email+password) | Public |
| POST | `/verify-otp` | Verifikasi OTP admin | Public |
| POST | `/resend-otp` | Kirim ulang OTP | Public |
| POST | `/logout` | Logout (clear token) | JWT |
| GET | `/me` | Get current user | JWT |
| PATCH | `/change-pin` | Ganti PIN kasir | JWT |

#### Orders (`/api/v1`)

| Method | Endpoint | Deskripsi | Auth |
|--------|----------|-----------|------|
| POST | `/orders` | Create order | JWT (kasir) |
| POST | `/orders/sync-batch` | Sync offline orders | JWT (kasir) |
| GET | `/orders` | List orders (paginated) | JWT |
| GET | `/:id/status` | Get order status | JWT |
| GET | `/:id/sse` | SSE stream for order updates | JWT |
| GET | `/admin/reports/export` | Export orders CSV | JWT (admin) |
| GET | `/orders/shift` | Get shift summary | JWT (kasir) |
| GET | `/admin/shifts` | Get all shifts for kasir | JWT (admin) |
| POST | `/pos/shift/start` | Start shift | JWT (kasir) |
| GET | `/pos/shift/status` | Get shift status | JWT (kasir) |
| POST | `/admin/transactions/:id/void` | Void order | JWT (admin) |
| PATCH | `/admin/transactions/:id/flag` | Flag order for review | JWT (admin) |
| POST | `/webhooks/midtrans` | Midtrans webhook | Public |

#### Inventory (`/api/v1/admin/inventory`)

| Method | Endpoint | Deskripsi | Auth |
|--------|----------|-----------|------|
| GET | `/` | List raw materials | JWT (admin) |
| GET | `/low-stock` | Get low stock items | JWT (admin) |
| POST | `/adjust` | Adjust stock | JWT (admin) |
| POST | `/opname` | Submit stock opname | JWT (admin) |
| POST | `/materials` | Create raw material | JWT (admin) |
| PATCH | `/materials/:id` | Update raw material | JWT (admin) |
| POST | `/bom` | Create BOM recipe | JWT (admin) |
| PATCH | `/bom/:id` | Update BOM recipe | JWT (admin) |
| DELETE | `/bom/:id` | Delete BOM recipe | JWT (admin) |
| GET | `/bom/:productId` | Get BOM by product | JWT (admin) |
| GET | `/bom-coverage` | Get BOM coverage report | JWT (admin) |
| POST | `/waste` | Record waste entry | JWT (admin) |
| GET | `/waste` | Get waste history | JWT (admin) |

> **Total: 13 endpoints** (PRD koreksi dari 14)

#### Members (Public - `/api/v1/member`)

| Method | Endpoint | Deskripsi | Auth |
|--------|----------|-----------|------|
| POST | `/register` | Register new member | Public |
| GET | `/lookup` | Lookup member (phone/code) | Public |

#### POS Member (`/api/v1/pos/member`)

| Method | Endpoint | Deskripsi | Auth |
|--------|----------|-----------|------|
| GET | `/lookup` | Lookup member for POS | JWT (kasir) |
| POST | `/process` | Process points (earn/redeem) | JWT (kasir) |

#### Admin Members (`/api/v1/admin/members`)

| Method | Endpoint | Deskripsi | Auth |
|--------|----------|-----------|------|
| GET | `/` | List all members (paginated) | JWT (admin) |
| GET | `/stats` | Member statistics | JWT (admin) |
| GET | `/:id` | Get member detail | JWT (admin) |

#### Finance (`/api/v1/finance`)

| Method | Endpoint | Deskripsi | Auth |
|--------|----------|-----------|------|
| GET | `/dashboard` | Dashboard KPIs | JWT |
| GET | `/shifts` | List shifts | JWT |
| GET | `/shifts/:id` | Shift detail | JWT |
| GET | `/cash` | Cash register report | JWT |
| GET | `/cash/export` | Export cash report | JWT |
| GET | `/profit-share` | Profit share report | JWT |
| POST | `/profit-share/calculate` | Calculate profit share | JWT (admin) |
| GET | `/profit-share/logs` | Profit share logs | JWT |
| PATCH | `/profit-share/:id/pay` | Mark as paid | JWT (admin) |
| GET | `/opex` | List operational expenses | JWT |
| POST | `/opex` | Create expense | JWT |
| DELETE | `/opex/:id` | Delete expense | JWT |

#### Products (`/api/v1/products`)

| Method | Endpoint | Deskripsi | Auth |
|--------|----------|-----------|------|
| GET | `/` | List products | Public |
| GET | `/:id` | Get product detail | Public |
| POST | `/` | Create product | JWT (admin) |
| PATCH | `/:id` | Update product | JWT (admin) |
| DELETE | `/:id` | Delete product | JWT (admin) |
| GET | `/categories` | List categories | Public |
| POST | `/categories` | Create category | JWT (admin) |
| PATCH | `/categories/:id` | Update category | JWT (admin) |

> **Total: 9 endpoints** (PRD koreksi dari 10 - tidak ada PATCH /modifier-groups/:id单独的 separate endpoint)

#### Outlets (`/api/v1/outlets`)

| Method | Endpoint | Deskripsi | Auth |
|--------|----------|-----------|------|
| GET | `/` | Get assigned outlets | JWT |

---

## 8. Fitur Lengkap

### 8.1 Core POS Features

| Fitur | Status | Catatan |
|-------|--------|--------|
| Product Catalog | ✅ | Dengan modifier groups & options |
| Shopping Cart | ✅ | Svelte 5 Runes state |
| Discount Calculation | ✅ | DRY via discount.utils.ts |
| Cash Payment | ✅ | Dengan kembalian |
| QRIS Payment | ✅ | Via Midtrans |
| Split Payment | ✅ | Cash + QRIS |
| Receipt Generation | ✅ | HTML to thermal printer |
| Offline Mode | ✅ | Dexie.js + sync queue |
| Void Order | ✅ | Dengan alasan + fraud detection |
| Price Verification | ✅ | Delta threshold check |

### 8.2 Member & Loyalty Features

| Fitur | Status | Catatan |
|-------|--------|--------|
| Member Registration | ✅ | Via QR code |
| Member Lookup | ✅ | By phone/code |
| Points Earning | ✅ | On transaction completion |
| Points Redemption | ✅ | At POS |
| Loyalty Tier | ✅ | Bronze/Silver/Gold/Platinum |
| Tier Discount | ✅ | Per tier discount rate |
| Member Analytics | ✅ | Transaction history |

### 8.3 Inventory & BOM Features

| Fitur | Status | Catatan |
|-------|--------|--------|
| Raw Material Management | ✅ | CRUD |
| Stock Tracking | ✅ | Real-time |
| Stock Opname | ✅ | Bulk adjustment |
| BOM Recipes | ✅ | Per product/modifier |
| HPP Calculation | ✅ | Auto from BOM |
| BOM Coverage Report | ✅ | HPP coverage stats |
| Waste Tracking | ✅ | With reason |
| Low Stock Alert | ✅ | Via feature flag |

### 8.4 Finance & Reporting Features

| Fitur | Status | Catatan |
|-------|--------|--------|
| Shift Management | ✅ | Open/close dengan balance |
| Cash Reconciliation | ✅ | Discrepancy tracking |
| Operational Expenses | ✅ | CRUD + categorization |
| Asset Depreciation | ✅ | Straight-line method |
| Profit Share | ✅ | 60% Owner / 40% Kasir Pool |
| Daily Revenue Report | ✅ | Filter by shift |
| CSV Export | ✅ | Transactions & reports |

### 8.5 Admin & Security Features

| Fitur | Status | Catatan |
|-------|--------|--------|
| JWT Authentication | ✅ | 12-hour token |
| PIN Authentication | ✅ | For kasir |
| OTP Authentication | ✅ | For admin |
| Rate Limiting | ✅ | Per IP & user |
| Audit Logging | ✅ | Immutable records |
| Feature Flags | ✅ | Toggle features |
| System Health Monitor | ✅ | DB, Redis, Midtrans |

### 8.6 Multi-Outlet Features

| Fitur | Status | Catatan |
|-------|--------|--------|
| Outlet Model | ✅ | Name, address, phone |
| User-Outlet Assignment | ✅ | Many-to-many |
| Outlet Selection | ✅ | At POS login |
| Outlet Filter | ✅ | In reports |

---

## 9. Fitur yang Belum/Tidak Diimplementasi

### 9.1 Critical Fixes Required (Red Team Findings)

> **Dari Red Team Analysis (2026-06-24)** - 20 Kegagalan Fatal ditemukan. Yang ini WAJIB diimplementasi sebelum go-live.
> **Detail lengkap:** Lihat [Section 18 - Red Team Analysis Findings](#18-red-team-analysis-findings)

| # | Fitur | Prioritas | Status | Opsi Pilihan | Catatan |
|---|-------|-----------|--------|--------------|---------|
| 1 | QRIS Expiry Enforcement | **CRITICAL** | ✅ | OPSI B | Cron job untuk void expired QRIS orders |
| 2 | JWT Token Reduction | **HIGH** | ❌ | OPSI B | 365d → 8h atau silent refresh |
| 3 | Void Refund Audit | **HIGH** | ❌ | OPSI A | 4-eyes approval untuk fraud prevention |
| 4 | Offline Receipt | **HIGH** | ❌ | OPSI A | Generate receipt saat offline |
| 5 | Idempotency Keys | **HIGH** | ❌ | OPSI A | Prevent double-charge |
| 6 | Member Rate Limiting | **HIGH** | ❌ | OPSI A | Prevent scraping |
| 7 | Redis Fallback | **MEDIUM** | ❌ | OPSI B | Fallback saat Redis down |
| 8 | BOM Cost Input | **CRITICAL** | ❌ | OPSI A | Manual input cost per bahan baku |
| 9 | Profit Share Shift Boundary | **MEDIUM** | ❌ | OPSI A | Filter by shift_start/shift_end |
| 10 | Backup System | **CRITICAL** | ❌ | OPSI B | Cron backup setiap jam 2 pagi |
| 11 | Docker Mount Fix | **HIGH** | ❌ | OPSI C | Named volume (data safety) |
| 12 | Stock Double-Deduction Race | **MEDIUM** | ❌ | OPSI A | Advisory lock untuk race condition |
| 13 | Shift Auto-Close Race | **MEDIUM** | ❌ | OPSI A | Lock check sebelum auto-close |
| 14 | Shift Modal Escape Hatch | **LOW** | ❌ | OPSI A | UX improvement |
| 15 | CSRF Protection Fix | **HIGH** | ❌ | OPSI A | Double-submit cookie |
| 16 | Offline Admin Guard | **MEDIUM** | ❌ | OPSI A | Guard check saat offline |
| 17 | Tier Downgrade Enable | **LOW** | ❌ | OPSI A | Enable existing code |
| 18 | Redis Password Guard | **HIGH** | ❌ | OPSI B | Env check untuk password |
| 19 | OOM Recovery | **MEDIUM** | ❌ | OPSI B | Graceful restart |
| 20 | Webhook DLQ | **MEDIUM** | ❌ | OPSI A | Dead letter queue untuk errors |

**Total Effort: ~2-3 minggu** (12 OPSI A + 7 OPSI B + 1 OPSI C)

### 9.2 Fitur Plan Masa Depan

| Fitur | Prioritas | Status | Catatan |
|-------|-----------|--------|---------|
| Check-in System | MEDIUM | ❌ | Untuk attendance kasir |
| Online Order Integration | LOW | ❌ | Integrasi GoFood/GrabFood |
| WhatsApp Notification | MEDIUM | ❌ | Order confirmation |
| SMS Notification | LOW | ❌ | Member alerts |
| Advanced Analytics | MEDIUM | ❌ | Complex dashboards |
| Table Management | LOW | ❌ | Dine-in support |
| Kitchen Display System | LOW | ❌ | KDS untuk kitchen |

---

## 10. Model Bisnis

### 10.1 Franchise Model

```
┌─────────────────────────────────────────────────────────────────┐
│                    FRANCHISE MODEL KHUSUS                        │
│                                                                  │
│    NGEMILOH HQ                                                   │
│        │                                                          │
│        │ Supplier Raw Materials                                    │
│        ▼                                                          │
│    ┌────┴────┐    ┌────┴────┐    ┌────┴────┐                     │
│    │ Outlet A │    │ Outlet B │    │ Outlet C │                    │
│    │ Kasir 1  │    │ Kasir 2  │    │ Kasir 3  │                  │
│    │(Freelance)│   │(Freelance)│   │(Freelance)│                │
│    └─────────┘    └─────────┘    └─────────┘                     │
│                                                                  │
│    Kasir dapat shift di multiple outlets                          │
│    Profit share dihitung berdasarkan total penjualan               │
└─────────────────────────────────────────────────────────────────┘
```

### 10.2 User Roles

| Role | Akses | Auth Method |
|------|-------|-------------|
| **Superadmin** | Full dashboard | Email + Password + OTP |
| **Kasir** | POS only | Username + PIN |
| **Member** | Registration | QR Code + Phone |

### 10.3 Profit Share Formula

```
Gross Revenue = Total Penjualan (termasuk PPN)
PPN = Gross Revenue × 11%
Net Revenue = Gross Revenue - PPN
HPP = Total Biaya Pokok (dari BOM)
Opex = Biaya Operasional
Depreciation = Total Depresiasi Aset

Net Profit = Net Revenue - HPP - Opex - Depreciation

Owner Share = Net Profit × 60%
Kasir Pool = Net Profit × 40%
Per Kasir = Kasir Pool × (Kasir Sales / Total Sales)
```

### 10.4 Loyalty Tier Rules

| Tier | Min Points | Discount | Points Rate | Grace Period |
|------|------------|----------|-------------|--------------|
| Bronze | 0 | 0% | 5 per Rp 1,000 | - |
| Silver | 500 | 5% | 5 per Rp 1,000 | 1 bulan |
| Gold | 1,500 | 10% | 5 per Rp 1,000 | 1 bulan |
| Platinum | 5,000 | 15% | 5 per Rp 1,000 | 1 bulan |

---

## 11. Deployment

### 11.1 Docker Services

```yaml
services:
  postgres:     # PostgreSQL 16 database
  redis:        # Redis 7 cache
  nestjs-api:   # NestJS backend
  caddy:        # Reverse proxy + HTTPS
```

### 11.2 Environment Variables

#### Backend (NestJS)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| DATABASE_URL | Yes | - | PostgreSQL connection string |
| REDIS_URL | Yes | - | Redis connection string |
| JWT_ACCESS_SECRET | Yes | - | JWT signing secret |
| PIN_PEPPER_SECRET | Yes | - | PIN hashing pepper |
| MIDTRANS_SERVER_KEY_SANDBOX | No | - | Midtrans sandbox key |
| MIDTRANS_CLIENT_KEY_SANDBOX | No | - | Midtrans client key |
| JWT_ACCESS_EXPIRES | No | 8h | Token expiry |
| DISCREPANCY_THRESHOLD | No | 5000 | Cash tolerance |

#### Frontend (Build Args)

| Variable | Required | Description |
|----------|----------|-------------|
| VITE_API_URL | Yes | Backend API URL |

### 11.3 Health Check Endpoints

| Endpoint | Service | Check |
|----------|---------|-------|
| `/_health` | NestJS | Basic health |
| `/api/v1/products` | NestJS | DB connectivity |
| PostgreSQL | Docker | `pg_isready` |
| Redis | Docker | `redis-cli ping` |

---

## 12. Testing

### 12.1 Backend Tests

| File | Type | Lokasi |
|------|------|--------|
| `auth.service.spec.ts` | Unit | `auth/application/services/` |
| `orders.service.spec.ts` | Unit | `orders/application/services/` |
| `inventory.service.spec.ts` | Unit | `inventory/application/services/` |
| `finance.service.spec.ts` | Unit | `finance/application/services/` |
| `users.service.spec.ts` | Unit | `users/application/services/` |
| `midtrans-gateway.service.spec.ts` | Unit | `payment/` |
| `cookie.spec.ts` | Unit | `common/utils/` |

### 12.2 Frontend Tests

| File | Type | Lokasi |
|------|------|--------|
| `pos.store.test.ts` | Unit | `lib/test/stores/` |
| `api.client.test.ts` | Unit | `lib/services/` |

### 12.3 Running Tests

```bash
# Backend
cd backend
npm run test

# Frontend
cd frontend
npm run test
```

---

## 13. Keamanan

### 13.1 Authentication

| Mechanism | Current State | Target State | Notes |
|-----------|--------------|--------------|-------|
| JWT Access Token | 12 jam (admin) / 365 hari (kasir) | 12 jam (admin) / 8 jam (kasir) | **TO BE FIXED** - See #18.1 Issue #2 |
| JWT Revocation | Redis blocklist support | - | ✅ Already implemented |
| PIN + Pepper | bcrypt 12 rounds + secret | - | ✅ Already implemented |
| OTP 6-digit | SHA-256 hash dengan timing-safe comparison | - | ✅ Already implemented |
| CSRF Token | Timing-safe comparison via crypto.timingSafeEqual | - | ✅ Already implemented |
| IP Lockout | IP + User-Agent SHA-256 hash | - | ✅ Already implemented |

### 13.2 Rate Limiting

| Endpoint | Limit |
|----------|-------|
| `/auth/login` | 5 req/30 min per IP+UA hash |
| `/auth/verify-otp` | 5 req/30 min per IP+UA hash |
| `/orders` | 20 req/min per user |
| Admin endpoints | 60 req/min |

### 13.3 Security Headers

- Helmet.js enabled (CSP disabled - manual per-request nonce)
- CORS configured untuk frontend origin
- CSP dengan per-request nonce untuk inline scripts
- XSS protection
- SQL injection prevention (via Prisma ORM)
- CSV injection prevention (formula injection escape)
- Webhook IP validation via proper CIDR (ip-address library)
- Midtrans webhook signature verification

### 13.4 Security Fixes Applied (2026-06-24)

| # | Issue | Fix |
|---|-------|-----|
| 1 | CSRF timing attack | crypto.timingSafeEqual |
| 2 | Race condition points | prisma.$transaction atomic |
| 3 | CSRF in localStorage | Removed - cookie only |
| 4 | as any casting | Proper ip-address library |
| 5 | Advisory lock deadlock | pg_try_advisory_lock + retry |
| 6 | Math.random codes | crypto.randomInt |
| 7 | User data localStorage | Cookie-based storage |
| 8 | IP lockout bypass | IP + UA hash key |
| 9 | Broken CIDR validation | ip-address library |
| 10 | No token revocation | Redis blocklist |
| 11 | CSP tanpa nonce | Per-request nonce |

---

## 14. Performa

### 14.1 Targets

| Metric | Target |
|--------|--------|
| POS load time | < 2 detik |
| Payment processing | < 3 detik |
| Receipt print | < 5 detik |
| API response (p95) | < 200ms |
| Offline sync | < 60 detik untuk 100 orders |

### 14.2 Database Indexes

- Composite indexes for common queries
- Partial unique indexes
- Index for date range queries
- Index for payment status webhooks

---

## 15. Issues & Warnings

### 15.1 ESLint Warnings (Non-Critical)

| Area | Warning Type | Count | Severity |
|------|-------------|-------|----------|
| Backend | `@typescript-eslint/require-await` | ~17 | LOW |
| Backend | `@typescript-eslint/unsafe-argument` | ~5 | MEDIUM |
| Backend | `no-floating-promises` | ~1 | LOW |

**Catatan:** Warnings ini tidak mempengaruhi functionality. Bisa difix dengan menambahkan `await` atau type assertion yang lebih strict.

### 15.2 Frontend Formatting

| File | Issue | Severity |
|------|-------|----------|
| `member.service.ts` | Prettier formatting | LOW |
| `pos.service.ts` | Prettier formatting | LOW |

**Catatan:** Jalankan `npx prettier --write` untuk fix.

### 15.3 Model Status (Updated 2026-06-24)

| Model | Status | Catatan |
|-------|--------|---------|
| `Customer` | ✅ Active | Pelanggan non-member (tanpa loyalty) |
| `Member` | ✅ Active | Pelanggan dengan loyalty system |

> **Clarification:** Customer dan Member adalah dua entitas berbeda yang aktif bersamaan. Customer adalah pelanggan yang membeli tanpa loyalty, Member adalah yang terdaftar dalam sistem poin.

---

## 16. Caddy Configuration

### 16.1 Routes

| Path Pattern | Target | Description |
|--------------|--------|-------------|
| `/health`, `/_health` | Internal | Health check endpoints |
| `/api/*` | NestJS API | All API routes |
| `/member/*` | NestJS API | Public member registration |
| `/webhooks/*` | NestJS API | Midtrans webhooks |
| `/*` | Frontend SPA | Static files + fallback |

### 16.2 Security Settings

```caddy
{
  admin off
  persist_config off
  auto_https off
}
```

---

## 17. Roadmap

### 17.1 Completed (v8.0)

- ✅ Core POS functionality
- ✅ Offline mode
- ✅ Member & Loyalty system
- ✅ Multi-outlet architecture
- ✅ BOM & HPP calculation
- ✅ Waste tracking
- ✅ Profit share reporting

### 17.2 Future Enhancements

| Feature | Priority | ETA |
|---------|----------|-----|
| Check-in System | Medium | v8.1 |
| WhatsApp Notifications | Medium | v8.2 |
| Advanced Analytics | Medium | v9.0 |
| Online Order Integration | Low | v9.x |

---

## 18. Red Team Analysis Findings

> **Source:** RED_TEAM_ANALYSIS_100_QUESTIONS.md (2026-06-24)
> **Analis:** Claude Opus 4.8 (Ultrathink Mode)
> **Perspektif:** 5 Adversarial Lenses (Attacker, Competitor, Skeptic, Auditor, End User)
> **Total Findings:** 100+ Questions, 20 Kegagalan Fatal

### 18.1 Ringkasan 20 Kegagalan Fatal

Berikut adalah 20 critical issues yang harus diperbaiki sebelum go-live:

| # | Kegagalan | Severity | Dampak | Recommended Solution | Status |
|---|-----------|----------|--------|---------------------|--------|
| 1 | QRIS Expiry Never Enforced | **CRITICAL** | Ghost orders, cash reconciliation failure | **OPSI B** (Cron job) | ✅ Done |
| 2 | JWT 365 Days for Kasir | **HIGH** | Compromised PIN = 1 tahun akses | **OPSI B** (Silent refresh) | ✅ IMPLEMENTED |
| 3 | Void Refund Hardcoded | **HIGH** | Cash fraud tidak terdeteksi | **OPSI A** (Audit enhancement) |
| 4 | No Offline Order Receipt | **MEDIUM** | Customer dispute risk | **OPSI A** (Quick fix) |
| 5 | Double-Charge Possible | **HIGH** | Revenue loss | **OPSI A** (Idempotency key) |
| 6 | Member Registration Unrate-Limited | **HIGH** | Data scraping risk | **OPSI A** (Rate limit) |
| 7 | Redis SPOF | **MEDIUM** | System unavailable saat Redis down | **OPSI B** (Fallback) |
| 8 | BOM Cost Per Unit = 0 | **CRITICAL** | Financial reporting broken | **OPSI A** (Manual input) |
| 9 | Profit Share Uses Created_At | **MEDIUM** | Wrong calculation | **OPSI A** (Filter by shift) |
| 10 | No Backup Configured | **CRITICAL** | Data loss risk | **OPSI B** (Cron backup) |
| 11 | Docker Desktop Bind Mount Trap | **HIGH** | Data corruption on Windows | **OPSI C** (Named volume) |
| 12 | Stock Double-Deduction Race | **MEDIUM** | Inventory inconsistency | **OPSI A** (Advisory lock) |
| 13 | Multi-Instance Shift Auto-Close Race | **MEDIUM** | Kasir tidak bisa close shift | **OPSI A** (Lock check) |
| 14 | Shift Modal Cannot Be Dismissed | **LOW** | UX frustration | **OPSI A** (Escape hatch) |
| 15 | CSRF Protection Broken | **HIGH** | XSRF attack risk | **OPSI A** (Double-submit cookie) |
| 16 | Admin Layout Grants Access When Offline | **MEDIUM** | Security bypass | **OPSI A** (Guard check) |
| 17 | Tier Downgrade Dead Code | **LOW** | Loyalty points issues | **OPSI A** (Enable code) |
| 18 | Redis Starts Without Password | **HIGH** | Unauthorized access | **OPSI B** (Env check) |
| 19 | 512MB NestJS Limit + OOM Crash Loop | **MEDIUM** | System instability | **OPSI B** (Graceful restart) |
| 20 | Webhook Errors Swallowed Silently | **MEDIUM** | Payment reconciliation issues | **OPSI A** (DLQ) |

### 18.2 Owner's Decisions (from RED_TEAM_ANALYSIS_100_QUESTIONS.md)

> **Clarification Q-A (Downtime Tolerance):** Zero-downtime migration adalah pilihan terbaik untuk production. Feature flags memungkinkan enable/disable tanpa redeploy. Effort 2 hari worth it untuk reliability.

> **Clarification Q-B (Decision Maker):** Owner dan admin adalah orang yang sama (saya sendiri). Untuk fraud > Rp 500.000, saya yang investigate dan decide.

> **Clarification Q-C (BOM Input):** Saya (owner) yang input manual cost per bahan baku. Sistem auto-calculate BOM cost per produk. Target: input sebelum go-live. Estimate: ~50+ produk, butuh waktu 1-2 hari untuk input semua.

> **Clarification Q-D (Volume Details):** Peak hour: perkiraan jam 16:00-20:00 (setelah sekolah/kerja). Average transaction: ~Rp 30.000-50.000 per transaksi. Weekend vs weekday: weekend ~30% lebih tinggi. Kasir kerja shift pagi (07:00-15:00) dan shift malam (15:00-23:00).

> **Clarification Q-G (Backup Timing):** Default: Setiap hari jam 2 pagi (otomatis via cron). Tidak bergantung pada kasir online status. Cron job jalan otomatis, bukan manual. Opsional: manual trigger jika perlu.

### 18.3 Solution Matrix: Effort vs Impact

| Kategori | Count | Total Effort | Description |
|----------|-------|-------------|-------------|
| **OPSI A (Quick Fix)** | 12 | ~1-2 hari | Low effort, high impact |
| **OPSI B (Structural)** | 7 | ~2-3 minggu | Medium effort, structural change |
| **OPSI C (Full Redesign)** | 1 | ~4 jam | Critical data safety |

**TOTAL ESTIMATED EFFORT: ~2-3 minggu (dengan 1 engineer)**

### 18.4 Security Findings Summary

> **Catatan:** Numbers di bawah adalah estimasi berdasarkan Red Team Analysis. Verification detail diperlukan untuk akurasi.

| Category | Issues | Critical | Notes |
|----------|--------|----------|-------|
| Authentication | ~5 | ~2 | JWT 365d, PIN strength, OTP brute force |
| Payment | ~5 | ~3 | QRIS expiry, void fraud, double-charge |
| Data Protection | ~4 | ~2 | Backup, rate limiting, PII |
| Infrastructure | ~6 | ~2 | Redis SPOF, Docker mounts, OOM |
| Input Validation | ~2 | ~0 | XSS, CSV injection |

### 18.5 Business Model Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Kasir underreporting sales | HIGH | Periodic audit, random spot-check |
| QRIS fee impact on profit | MEDIUM | Include in profit share calc |
| Waste tracking fraud | MEDIUM | Supplier verification |
| Opening balance manipulation | MEDIUM | Supervisor verification |
| Loyalty points fraud | MEDIUM | Void reason validation, periodic audit |

### 18.6 Implementation Status

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| 2 | JWT 365 Days for Kasir | ✅ IMPLEMENTED | Backend: 8h token + /refresh endpoint. Frontend: auth.store.svelte.ts with silent refresh. |

---

## 19. Priority Action Plan

> **Based on:** RED_TEAM_ANALYSIS_100_QUESTIONS.md Section 11
> **Owner Decision:** Zero-downtime migration dengan feature flags
> **Total Timeline:** ~6 minggu

### PHASE 1: STOP THE BLEEDING (Week 1)

```
DAY 1-2: MUST-DO (Critical Business Impact)
├── #10 Backup System           → OPSI B (4 jam)
├── #1 QRIS Expiry Fix         → OPSI B (2-3 hari)
├── #6 Member Rate Limit       → OPSI A (1 jam)
└── #8 BOM Cost Input          → OPSI A (Manual input)

DAY 3-4: QUICK WINS (High Impact, Low Effort)
├── #4 Offline Receipt         → OPSI A (2 jam)
├── #5 Idempotency            → OPSI A (1 jam)
├── #12 Stock Race Fix         → OPSI A (1 jam)
└── #13 Shift Race Fix         → OPSI A (1 jam)

DAY 5-7: TESTING & VALIDATION
├── Full regression test
├── Backup restore test (MANDATORY)
└── Load test dengan simulated traffic
```

### PHASE 2: STRUCTURAL FIXES (Week 2-3)

```
DAY 8-10: SECURITY HARDENING
├── #2 JWT Reduction           → OPSI B (2 hari)
├── #15 CSRF Fix              → OPSI A (1 jam)
├── #18 Redis Password Guard   → OPSI B (1 jam)
├── #7 Redis Fallback          → OPSI B (4 jam)
└── #16 Offline Admin Guard    → OPSI A (1 jam)

DAY 11-13: FRAUD PREVENTION
├── #3 Void 4-Eyes Approval   → OPSI B (1 hari)
├── #17 Tier Downgrade Enable → OPSI A (1 jam)
├── #9 Profit Share Shift     → OPSI A (2 jam)
└── #20 Webhook DLQ           → OPSI A (1 jam)

DAY 14: REVIEW & REFINE
├── User acceptance testing
├── Documentation updates
└── Runbook for incident response
```

### PHASE 3: OPERATIONAL EXCELLENCE (Week 4-6)

```
DAY 15-20: MONITORING & OBSERVABILITY
├── #19 OOM Recovery          → OPSI B (2 jam)
├── #11 Docker Mount Fix      → OPSI C (4 jam)
├── Real-time fraud dashboard
└── System health alerts

DAY 21-25: UX IMPROVEMENTS
├── #14 Shift Modal Escape Hatch → OPSI A (30 menit)
├── Offline experience polish
└── Admin efficiency tools

DAY 26-30: VALIDATION & OPTIMIZATION
├── Performance tuning
├── Security penetration test
└── Go/No-Go decision for production
```

### 19.1 Feature Flags Required

Untuk zero-downtime deployment, berikut feature flags yang perlu diimplementasi:

| Flag | Purpose | Default |
|------|---------|---------|
| `FEATURE_QRIS_EXPIRY_ENFORCEMENT` | Enable QRIS void cron | `false` |
| `FEATURE_JWT_REFRESH` | Enable silent token refresh | `false` |
| `FEATURE_VOID_APPROVAL` | Require approval for void | `false` |
| `FEATURE_OFFLINE_RECEIPT` | Generate receipt offline | `true` |

### 19.2 Rollback Procedures

| Fix | Rollback Procedure |
|-----|-------------------|
| QRIS Expiry | Disable cron job, manual void |
| JWT Reduction | Revert to 365d (emergency) |
| Void Approval | Disable feature flag |
| Backup System | Point-in-time restore |

### 19.3 Go-Live Checklist

```
PRE-LAUNCH:
□ All Phase 1 & 2 fixes implemented
□ Backup restore test passed
□ Feature flags tested
□ Rollback procedures documented

LAUNCH:
□ Enable features incrementally
□ Monitor error rates
□ Watch dashboard for anomalies

POST-LAUNCH (Day 1-7):
□ Daily error log review
□ Cash reconciliation verified
□ Kasir feedback collected
```

---

## Lampiran

### A. Konfigurasi Database (Prisma)

File: `backend/prisma/schema.prisma`

### B. Konstanta Aplikasi

File: `backend/src/common/utils/constants.ts`

16 konstanta utama:
- `TAX_RATE` = 0.11 (PPN 11%)
- `LOCKOUT_DURATION_MS` = 1800000 (30 menit)
- `LOCKOUT_THRESHOLD` = 5
- `MIN_QRIS_AMOUNT` = 1000
- `DEFAULT_OPENING_BALANCE` = 500000
- `CASH_DISCREPANCY_THRESHOLD` = 5000
- `DAILY_REVENUE_TARGET` = 5000000
- `AUTO_CLOSE_GRACE_MS` = 1800000 (30 menit)
- `AUTO_CLOSE_WARNING_MS` = 5400000 (90 menit)
- `VOID_FRAUD_WINDOW_MS` = 600000 (10 menit)
- `VOID_FRAUD_COUNT` = 3
- `DEFAULT_PRICE_DELTA_THRESHOLD_PCT` = 10
- `MEMBER_CODE_MAX_ATTEMPTS` = 10
- `VOID_REASON_MIN_LENGTH` = 10
- `MAX_EXPORT_ROWS` = 50000
- `SLOW_QUERY_THRESHOLD_MS` = 1000

### C. User Credentials (Development)

| Role | Username | Password/PIN |
|------|----------|-------------|
| Superadmin | admin@ngemiloh.com | SuperAdminP@ssw0rd123! |
| Kasir | kasir1 | 1234 |

### D. Default Outlet

| Field | Value |
|-------|-------|
| ID | 00000000-0000-0000-0000-000000000001 |
| Name | Outlet Utama |
| Address | Jl. Raya Ngemiloh No. 1 |
| Phone | 021-12345678 |

---

*Dokumen ini adalah acuan utama untuk pengembangan NGEMILOH POS v8.1*
*Generated: 2026-06-24*
*Last Updated: 2026-06-24 (Red Team Analysis Findings)*
