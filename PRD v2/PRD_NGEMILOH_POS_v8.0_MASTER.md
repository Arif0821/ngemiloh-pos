# PRD NGEMILOH POS v8.0 MASTER
**Version:** 8.0 (Master)
**Date:** 2026-06-20
**Author:** Senior Engineering Team
**Status:** DRAFT - For Review

---

## Table of Contents

1. [Overview](#1-overview)
2. [Business Context](#2-business-context)
3. [Technical Stack](#3-technical-stack)
4. [All Features - EXISTING & COMPLETED](#all-features--existing--completed)
   - [4.1 Backend Modules Status](#41-backend-modules-status)
   - [4.2 Frontend Pages Status](#42-frontend-pages-status)
   - [4.3 Database Models Status](#43-database-models-status)
   - [4.4 Auth Module - Complete Features](#44-auth-module---complete-features)
   - [4.5 Orders Module - Complete Features](#45-orders-module---complete-features)
   - [4.6 Products Module - Complete Features](#46-products-module---complete-features)
   - [4.7 Finance Module - Complete Features](#47-finance-module---complete-features)
   - [4.8 Inventory Module - Complete Features](#48-inventory-module---complete-features)
   - [4.9 Discounts Module - Complete Features](#49-discounts-module---complete-features)
   - [4.10 Payment Module - Complete Features](#410-payment-module---complete-features)
   - [4.11 Receipts Module - Complete Features](#411-receipts-module---complete-features)
   - [4.12 Audit Module - Complete Features](#412-audit-module---complete-features)
   - [4.13 Email Module - Complete Features](#413-email-module---complete-features)
   - [4.14 Users Module - Complete Features](#414-users-module---complete-features)
   - [4.15 Flags Module - Complete Features](#415-flags-module---complete-features)
   - [4.16 Frontend - POS Complete Features](#416-frontend---pos-complete-features)
   - [4.17 Frontend - Admin Complete Features](#417-frontend---admin-complete-features)
5. [Phase 1: Critical Audit Fixes](#phase-1-critical-audit-fixes)
   - [KRITIS-01: CI/CD Path Fix](#kritIS-01-cicd-path-fix)
   - [KRITIS-02: VITE_API_URL Environment](#kritIS-02-vite_api_url-environment)
   - [KRITIS-03: Auto-Close Shift Time Boundary](#kritIS-03-auto-close-shift-time-boundary)
   - [KRITIS-04: Logout Clear Token](#kritIS-04-logout-clear-token)
   - [TINGGI-01: Admin Auth Guard Bypass](#tinggI-01-admin-auth-guard-bypass)
   - [TINGGI-02: Sidebar Link Fix](#tinggI-02-sidebar-link-fix)
   - [TINGGI-03: Swagger Documentation](#tinggI-03-swagger-documentation)
   - [TINGGI-04: Frontend Store Tests](#tinggI-04-frontend-store-tests)
   - [TINGGI-05: Email Warning Auto-Close](#tinggI-05-email-warning-auto-close)
   - [TINGGI-06: Dashboard KPI Shift Filter](#tinggI-06-dashboard-kpi-shift-filter)
5. [Phase 2: Enhance Existing Features](#phase-2-enhance-existing-features)
   - [2.1 Waste Tracking UI](#21-waste-tracking-ui)
   - [2.2 BOM Recipes UI](#22-bom-recipes-ui)
   - [2.3 Dexie Discount Cache](#23-dexie-discount-cache)
   - [2.4 Profit Share HPP Display](#24-profit-share-hpp-display)
6. [Phase 3: Build New Features](#phase-3-build-new-features)
   - [3.1 Members Module Backend](#31-members-module-backend)
   - [3.2 Members Registration UI](#32-members-registration-ui)
   - [3.3 Loyalty Tier System](#33-loyalty-tier-system)
   - [3.4 Multi-Outlet Architecture](#34-multi-outlet-architecture)
7. [Non-Functional Requirements](#non-functional-requirements)
8. [Database Schema Changes](#database-schema-changes)
9. [API Contracts](#api-contracts)
10. [Testing Requirements](#testing-requirements)
11. [Deployment Checklist](#deployment-checklist)

---

## 1. Overview

### 1.1 Project Name
**NGEMILOH POS** - Point of Sale System for Ngemiloh Snack Business

### 1.2 Project Description
Sistem POS lengkap untuk bisnis makanan ringan (snack) Ngemiloh dengan fitur:
- Kasir freelance model dengan shift fleksibel
- Multi-shift dengan carry-over saldo
- Loyalty tier system (Bronze/Silver/Gold)
- Pro-rata profit sharing (60% Owner / 40% Kasir Pool)
- Waste tracking untuk HPP akurat
- Offline-first architecture

### 1.3 Document Purpose
PRD ini merupakan acuan utama untuk menyelesaikan pengembangan sistem POS Ngemiloh berdasarkan:
- Analisis audit dari 12 file dokumentasi
- 114 keputusan arsitektur dari interview questions
- Status implementasi saat ini (27/28 fitur frontend complete)

### 1.4 Development Phases

| Phase | Name | Priority | Features |
|-------|------|----------|----------|
| 1 | Critical Audit Fixes | 🔴 | 4 KRITIS + 6 TINGGI |
| 2 | Enhance Existing | 🟡 | Waste, BOM UI, Discount Cache |
| 3 | Build New | 🟢 | Members, Loyalty, Multi-Outlet |

---

## 2. Business Context

### 2.1 Business Model

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
│    │ Kasir 1 │    │ Kasir 2 │    │ Kasir 3 │                    │
│    │(Freelance)│   │(Freelance)│   │(Freelance)│               │
│    └─────────┘    └─────────┘    └─────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Key Decisions (From Interview Questions)

| # | Decision | Answer |
|---|----------|--------|
| Q39 | Auto-Close Shift Trigger | Idle timeout 4 jam + crossing midnight |
| Q79 | Midtrans Anomaly Handling | Kasir layani + foto bukti + kirim owner |
| Q53 | Ghost Order Detection | Dashboard Admin + notifikasi |
| Q110 | PPN + Rounding | 11% dulu → bulatkan Rp 500 → profit vs tax dipisah |
| Q8 | Opex Input | Kasir via POS + upload foto nota |
| Q72 | Grace Period Auto-Close | 30 menit |

### 2.3 User Roles

| Role | Access | Auth Method |
|------|--------|------------|
| Owner/Superadmin | Full dashboard | Email + OTP |
| Kasir | POS only | PIN 6 digit |
| Customer | Member registration | QR Code + HP |

---

## 3. Technical Stack

### 3.1 Backend
| Component | Technology |
|-----------|------------|
| Framework | NestJS 11 |
| Language | TypeScript (strict mode) |
| ORM | Prisma 5.22+ |
| Database | PostgreSQL 16+ |
| Cache | Redis 7+ |
| Job Queue | BullMQ |
| Auth | JWT + PIN-based |

### 3.2 Frontend
| Component | Technology |
|-----------|------------|
| Framework | SvelteKit 2 + Svelte 5 (Runes) |
| Language | TypeScript |
| Styling | Tailwind CSS 4 |
| Offline Storage | Dexie.js (IndexedDB) |
| State | Svelte 5 Runes ($state, $derived) |

### 3.3 Infrastructure
| Component | Technology |
|-----------|------------|
| Container | Docker + Docker Compose |
| Reverse Proxy | Caddy 2 |
| CI/CD | GitHub Actions |

---

# All Features - EXISTING & COMPLETED

## 4.1 Backend Modules Status

| Module | Location | Completion | Notes |
|--------|----------|------------|-------|
| **auth** | `backend/src/auth/` | ~90% | Login, JWT, OTP, PIN |
| **orders** | `backend/src/orders/` | ~80% | CRUD, sync, payment |
| **products** | `backend/src/products/` | ~75% | CRUD, modifiers |
| **finance** | `backend/src/finance/` | ~70% | Shifts, profit share |
| **inventory** | `backend/src/inventory/` | ~75% | Stock, BOM |
| **discounts** | `backend/src/discounts/` | ~65% | Scheduled discounts |
| **payment** | `backend/src/payment/` | ~60% | Midtrans, QRIS |
| **receipts** | `backend/src/receipts/` | ~80% | Receipt generation |
| **audit** | `backend/src/audit/` | ~70% | Logging |
| **email** | `backend/src/email/` | ~60% | Alerts, OTP |
| **users** | `backend/src/users/` | ~60% | CRUD |
| **flags** | `backend/src/flags/` | ~70% | Feature flags |
| **jobs** | `backend/src/jobs/` | ~40% | BullMQ |
| **members** | - | **MISSING** | **0% - Phase 3** |
| **common** | `backend/src/common/` | ✅ | Utilities, filters |
| **dto** | `backend/src/dto/` | ✅ | Validation |
| **types** | `backend/src/types/` | ✅ | Type definitions |
| **test** | `backend/src/test/` | ✅ | Test utilities |
| **prisma** | `backend/src/prisma/` | ✅ | Database service |

---

## 4.2 Frontend Pages Status

### Login & Authentication (4/4 Complete)
| Route | Feature | Status |
|-------|---------|--------|
| `/login` | Kasir login (username + PIN) | ✅ Complete |
| `/login-admin` | Admin login (email + password) | ✅ Complete |
| `/login-admin/verify-otp` | OTP verification for admin | ✅ Complete |
| `/change-pin` | Change PIN for kasir | ✅ Complete |

### POS (Point of Sale) (3/3 Complete)
| Route | Feature | Status |
|-------|---------|--------|
| `/pos` | Main POS with product list, cart, payment processing, QRIS, offline mode | ✅ Complete |
| `/pos/print` | Receipt printing functionality | ✅ Complete |
| `/shift` | Cashier daily shift summary | ✅ Complete |

### Admin Dashboard & Management (20/20 Complete)
| Route | Feature | Status |
|-------|---------|--------|
| `/admin/dashboard` | KPI cards, revenue trend chart, top products, payment distribution | ✅ Complete |
| `/admin/transactions` | Transaction history with filters, void, detail modal, flagging | ✅ Complete |
| `/admin/products` | Product CRUD + modifier groups (toppings/sauces) | ✅ Complete |
| `/admin/categories` | Category management with sort order | ✅ Complete |
| `/admin/inventory` | Raw materials with stock opname functionality | ✅ Complete |
| `/admin/discounts` | Discount/promo management (percentage & fixed) | ✅ Complete |
| `/admin/shifts` | Shift history with discrepancy tracking | ✅ Complete |
| `/admin/cashiers` | Cashier CRUD, PIN reset, status toggle | ✅ Complete |
| `/admin/analytics` | Revenue trends, peak hours, payment distribution charts | ✅ Complete |
| `/admin/reports` | CSV export for transactions | ✅ Complete |
| `/admin/cash` | Cash register report with export | ✅ Complete |
| `/admin/opex` | Operational expenses input & history | ✅ Complete |
| `/admin/assets` | Asset management with depreciation calculation | ✅ Complete |
| `/admin/profit-share` | Net profit calculation with 60/40 split | ✅ Complete |
| `/admin/settings` | Store profile (name, halal cert, address, receipt footer) | ✅ Complete |
| `/admin/settings/flags` | Feature flags toggle | ✅ Complete |
| `/admin/system-health` | PostgreSQL, Redis, Midtrans status monitoring | ✅ Complete |
| `/admin/audit-logs` | Immutable audit log viewer with filters | ✅ Complete |
| `/admin/system-logs` | System logs viewer | ✅ Complete |
| `/admin/system-logs` | System logs viewer | ✅ Complete |

### Missing Pages (Phase 3)
| Route | Feature | Status |
|-------|---------|--------|
| `/register` | Member registration page | ❌ MISSING |
| `/admin/members` | Member management | ❌ MISSING |
| `/admin/bom` | BOM Recipes management | ❌ MISSING |

### Frontend Completion: 27/30 pages (~90%)

---

## 4.3 Database Models Status

### Existing Models (24 Total)
| Model | Fields | Relationships |
|-------|--------|---------------|
| **User** | id, name, username, email, pin_hash, password_hash, role, is_active, cashier_letter | Products, Orders, CashRegister, AuditLog |
| **Category** | id, name, sort_order, is_active | Products |
| **Product** | id, name, category_id, base_price, image_url, is_active, is_out_of_stock, sort_order | Category, Modifiers, BOM, OrderItems |
| **ProductModifierGroup** | id, product_id, name, is_required, max_selections, sort_order | Product, ModifierOptions |
| **ProductModifierOption** | id, group_id, name, additional_price, sort_order | Group, BOM, OrderItemModifiers |
| **Discount** | id, name, type, value, scope, target_id, valid_from, valid_until, applicable_days, is_active | User, OrderItems |
| **Order** | id, cashier_id, client_uuid, total_amount, discount_total, cogs_total, payment_method, cash_amount, qris_amount, payment_gateway, payment_status, status, voided_by, void_reason, customer_name, order_number | User (cashier), User (voider), OrderItems, OrderRefund, StockMovement |
| **OrderItem** | id, order_id, product_id, product_name_snapshot, base_price, discount_amount, discounted_base, modifier_total, final_price, quantity, subtotal | Order, Product, Discount, OrderItemModifiers |
| **OrderItemModifier** | id, order_item_id, option_id, group_name_snapshot, option_name_snapshot, additional_price_at_time | OrderItem, ModifierOption |
| **OrderRefund** | id, order_id, amount, refund_method, refunded_by, refunded_at, notes | Order, User |
| **CashRegister** | id, cashier_id, shift_date, shift_start, shift_end, opening_balance, closing_balance, system_cash_total, discrepancy, status, notes, shift_number, carry_over_from_shift_id | User, self-reference |
| **OperationalExpense** | id, category, description, amount, expense_date | User |
| **Asset** | id, name, purchase_price, useful_life_months, monthly_depreciation, purchase_date, is_active | - |
| **ProfitShareLog** | id, period_month, total_revenue, total_hpp, total_opex, total_depreciation, net_profit, owner_share, cashier_share, cashier_paid_amount, is_paid | User, ProfitShareDetail |
| **ProfitShareDetail** | id, profit_share_log_id, cashier_id, cashier_name, total_sales, total_orders, shift_count, share_amount, is_paid | ProfitShareLog, User |
| **FeatureFlag** | id, name, is_enabled, description, updated_by | User |
| **Setting** | id, key, value, updated_by | User |
| **AuditLog** | id (BigInt), actor_id, action, entity_type, entity_id, old_value, new_value, ip_address | User |
| **Customer** | id, phone, name, loyalty_points, registered_via, created_at | - |
| **RawMaterial** | id, name, purchase_unit, purchase_qty, usage_unit, conversion_factor, current_stock, min_stock, cost_per_unit, supplier | PriceHistory, BOM, StockMovement |
| **RawMaterialPriceHistory** | id, raw_material_id, cost_per_unit, valid_from | RawMaterial, User |
| **BomRecipe** | id, product_id, modifier_option_id, raw_material_id, quantity_per_serving | Product, ModifierOption, RawMaterial |
| **StockMovement** | id, raw_material_id, type, quantity, reference_order_id, notes, created_by | RawMaterial, User, Order |
| **IpLockout** | id, ip_address, failed_count, locked_until | - |
| **SystemLog** | id (BigInt), level, source, message, metadata | - |

### Missing Models (Phase 3)
| Model | Purpose | Priority |
|-------|---------|----------|
| **LoyaltyTier** | Tier levels for loyalty program | HIGH |
| **MemberTransaction** | Point earning/redeeming history | HIGH |
| **Outlet** | Multi-outlet support | MEDIUM |
| **UserOutlet** | Kasir-outlet assignment | MEDIUM |

---

## 4.4 Auth Module - Complete Features

### 4.4.1 Kasir Login (PIN)
```
Endpoint: POST /api/v1/auth/kasir/login
Flow:
1. Kasir input username + PIN
2. Backend hash PIN dengan pepper (bcrypt 12 rounds)
3. Verifikasi dengan database
4. Generate JWT token (12 jam expiry)
5. Set httpOnly cookie access_token
6. Return user info
```

**Security Features:**
- ✅ PIN hashing dengan bcrypt 12 rounds + pepper
- ✅ Rate limiting (20 req/min per IP)
- ✅ IP lockout setelah 5 failed attempts
- ✅ JWT token (12h expiry)
- ✅ CSRF protection

### 4.4.2 Admin Login (Email + Password)
```
Endpoint: POST /api/v1/auth/admin/login
Flow:
1. Admin input email + password
2. Backend verifikasi dengan bcrypt
3. Generate JWT token (12 jam expiry)
4. Send OTP email untuk 2FA
5. Set httpOnly cookie access_token
```

### 4.4.3 OTP Verification
```
Endpoint: POST /api/v1/auth/verify-otp
Flow:
1. Admin input 6-digit OTP
2. Backend verifikasi OTP dari Redis
3. Jika valid → aktifkan session
4. OTP expire setelah 5 menit
5. Max 3 failed attempts → lockout
```

### 4.4.4 PIN Management
```
Endpoint: POST /api/v1/auth/change-pin
- Kasir bisa ganti PIN sendiri
- Wajib verifikasi PIN lama terlebih dahulu
- PIN baru harus 6 digit
```

### 4.4.5 Get Current User
```
Endpoint: GET /api/v1/auth/me
- Return user info dari JWT token
- Digunakan untuk verifikasi session
```

---

## 4.5 Orders Module - Complete Features

### 4.5.1 Create Order
```
Endpoint: POST /api/v1/orders
Flow:
1. Kasir submit cart items + payment method
2. Validasi stok (jika INVENTORY_CHECK flag enabled)
3. Generate order number dengan advisory lock
4. Simpan order dengan status "pending"
5. Proses payment (cash/QRIS/split)
6. Update status → "completed"
7. Kurangi stok jika success
8. Generate receipt
```

**Order Number Format:**
```
Format: TRX-YYYYMMDD-{letter}-{sequence}
Example: TRX-20260620-C-001
- YYMMDD = tanggal
- letter = cashier letter (A, B, C...)
- sequence = 001, 002, ...
```

### 4.5.2 Order Payment Methods
```
1. CASH
   - Kasir terima uangcash
   - Hitung kembalian
   - Simpan cash_amount

2. QRIS (Midtrans)
   - Generate QR code
   - Wait for payment notification
   - Timeout: 10 menit (configurable)

3. SPLIT
   - Cash + QRIS kombinasi
   - Wajib ada cash_amount > 0
   - Generate 2 payment records
```

### 4.5.3 Offline Sync
```
Endpoint: POST /api/v1/orders/sync-batch
Flow:
1. POS offline → simpan order ke Dexie (IndexedDB)
2. Setiap order punya client_uuid (UUID v4)
3. Saat online → sync-batch kirim semua order
4. Server proses per order
5. Return success/failed per order
```

**Idempotency:**
- Server check client_uuid sebelum insert
- Jika sudah ada → skip (prevents duplicate)

### 4.5.4 Order Status
```
Status Flow:
pending → completed
pending → failed → pending (retry)
completed → voided
```

### 4.5.5 Void Order
```
Endpoint: POST /api/v1/admin/transactions/:id/void
Requirements:
- Wajib isi reason
- Void setelah > 3x dalam 10 menit → trigger fraud alert
- Void refund stock ke warehouse
- Void записывается в audit log
```

### 4.5.6 Order History
```
Endpoint: GET /api/v1/orders
Query Parameters:
- ?cashier_id=xxx (filter by kasir)
- ?date_from=xxx (filter by date)
- ?date_to=xxx
- ?status=completed
- ?page=1
- ?limit=20
```

### 4.5.7 Shift Summary
```
Endpoint: GET /api/v1/orders/shift
- Return semua order dalam shift aktif
- Total revenue, count, payment distribution
```

### 4.5.8 SSE Order Status
```
Endpoint: GET /api/v1/orders/:id/sse
Use Case:
- Real-time update saat QRIS payment status berubah
- Browser listen ke SSE stream
- Server push update saat payment success/failed
```

### 4.5.9 Fraud Detection
```
Trigger: 3x void dalam 10 menit
Action:
1. Log warning ke SystemLog
2. Send email alert ke owner
3. Flag kasir di dashboard
```

---

## 4.6 Products Module - Complete Features

### 4.6.1 Product CRUD
```
GET /api/v1/products
- List semua produk aktif
- Include category, modifiers
- Filter by category_id

POST /api/v1/admin/products
- Create produk baru
- Upload image (resize to 800px, WebP)
- Set base_price, category

PATCH /api/v1/admin/products/:id
- Update produk
- Replace image
- Log perubahan harga

DELETE /api/v1/admin/products/:id
- Soft delete jika punya order history
- Hard delete jika belum ada order
```

### 4.6.2 Categories
```
GET /api/v1/categories
- List semua category
- Sort by sort_order

POST /api/v1/admin/categories
- Create category baru

PATCH /api/v1/admin/categories/:id
- Update category

DELETE /api/v1/admin/categories/:id
- Soft delete
```

### 4.6.3 Product Modifiers (Toppings/Sauces)
```
Modifier Group:
- Nama: "Tingkat Pedas", "Saus Extra"
- is_required: true/false
- max_selections: 1, 2, 3...

Modifier Option:
- Nama: "Level 1", "Level 2"
- additional_price: 0, 1000, 2000...

Endpoint: /api/v1/admin/products/:id/modifiers
- Attach modifier group ke produk
- Set sort order
```

### 4.6.4 Product Image
```
Upload Flow:
1. Kasir upload image
2. Backend resize to 800px width
3. Convert to WebP, quality 80
4. Save to storage
5. Return URL
```

---

## 4.7 Finance Module - Complete Features

### 4.7.1 Cash Register (Shift)
```
Open Shift:
Endpoint: POST /api/v1/pos/shift/start
- Input opening_balance
- Generate shift number (per kasir per hari)
- Set status = "open"
- Carry-over dari shift sebelumnya

Close Shift:
Endpoint: POST /api/v1/admin/finance/cash/close
- Input closing_balance (blind closing)
- Hitung discrepancy
- Set status = "closed"

Auto-Close (Cron):
- Cron setiap 15 menit
- Close shift idle > 4 jam + grace period 30 menit
```

### 4.7.2 Discrepancy Handling
```
Threshold: Rp 10.000
If |discrepancy| > threshold:
- Log warning
- Send email alert ke owner
- Kasir wajib report explanation
```

### 4.7.3 Dashboard KPI
```
Endpoint: GET /api/v1/admin/finance/kpi
Return:
{
  revenue,           // Total penjualan
  gross_revenue,     // Revenue - tax
  total_tax,         // PPN 11%
  cogs,              // HPP
  net_profit,        // gross_revenue - cogs - opex
  order_count,
  average_order,
  payment_distribution: { cash: 45, qris: 30, split: 25 }
}
```

### 4.7.4 Analytics
```
Endpoint: GET /api/v1/admin/finance/analytics
Charts:
- Revenue trend (daily/weekly/monthly)
- Top products
- Payment distribution
- Peak hours (heatmap)
```

### 4.7.5 Profit Sharing
```
Formula:
Net Profit = Revenue - Tax - COGS - Opex - Depreciation
Owner Share = Net Profit × 60%
Kasir Pool = Net Profit × 40%

Per Kasir:
Kasir Share = (Kasir Orders / Total Orders) × Kasir Pool

Endpoint: GET /api/v1/admin/finance/profit-share
- List semua period
- Detail per kasir
```

### 4.7.6 Operational Expenses (Opex)
```
Endpoint: GET /api/v1/admin/finance/opex
Categories:
- Sewa Tempat
- Listrik
- Kemasan
- Lainnya

POST /api/v1/admin/finance/opex
- Input expense baru
- auto-tanggal hari ini
```

### 4.7.7 Assets
```
Endpoint: GET /api/v1/admin/finance/assets
- List semua aset
- Monthly depreciation calculation
- Useful life tracking

POST /api/v1/admin/finance/assets
- Add aset baru
- Set purchase_price, useful_life_months
```

---

## 4.8 Inventory Module - Complete Features

### 4.8.1 Raw Materials
```
Endpoint: GET /api/v1/admin/inventory
Fields:
- id, name
- current_stock
- min_stock (for alerts)
- cost_per_unit
- supplier
- unit conversion

POST /api/v1/admin/inventory/materials
- Create bahan baku baru

PATCH /api/v1/admin/inventory/materials/:id
- Update stock, price
- Log price history
```

### 4.8.2 Stock Movement (FEFO)
```
Types:
- IN (pembelian)
- OUT (pemakaian produksi)
- ADJUSTMENT (opname)
- WASTE (rusak/expired)
- RETURN (retur)

FEFO Logic:
- Ambil dari batch dengan expiry paling dekat
- Kurangi stock per batch
- Track qty_remaining per batch
```

### 4.8.3 Stock Opname
```
Endpoint: POST /api/v1/admin/inventory/opname
Flow:
1. Hitung fisik barang
2. Input ke sistem
3. Sistem hitung selisih
4. Create adjustment movement
5. Update stock
```

### 4.8.4 Low Stock Alert
```
Endpoint: GET /api/v1/admin/inventory/low-stock
Trigger: current_stock <= min_stock
Return: List bahan baku yang perlu restock
```

### 4.8.5 BOM (Bill of Materials)
```
Endpoint: GET /api/v1/admin/inventory/bom/:productId
Structure:
- product_id
- raw_material_id
- quantity_per_serving

Use Case:
- Hitung HPP per produk
- Kurangi stock saat order
```

### 4.8.6 Auto Stock Reduction
```
Trigger: Order completed
Flow:
1. Get order items
2. Get BOM for each product
3. Calculate required materials
4. Deduct from stock (FEFO)
5. Create StockMovement records
```

### 4.8.7 Stock Restoration (Void)
```
Trigger: Order voided
Flow:
1. Get original StockMovement for order
2. Reverse each movement
3. Restore stock to original levels
```

---

## 4.9 Discounts Module - Complete Features

### 4.9.1 Discount Types
```
1. PERCENTAGE
   - Discount % dari base_price
   - Example: 10% off

2. FIXED_AMOUNT
   - Discount amount tetap
   - Example: Rp 5.000 off
```

### 4.9.2 Discount Scope
```
1. ALL_PRODUCTS
   - Discount untuk semua produk

2. CATEGORY
   - Discount untuk category tertentu

3. SPECIFIC_PRODUCT
   - Discount untuk produk tertentu
```

### 4.9.3 Discount Scheduling
```
valid_from: DateTime
valid_until: DateTime
applicable_days: [0,1,2,3,4,5,6] // 0=Minggu

Example:
- Weekend Promo: valid Fri 18:00 - Sun 23:59
- Happy Hour: Mon-Fri 14:00-16:00
```

### 4.9.4 Auto Expire (Cron)
```
Cron: Setiap 5 menit
Check:
1. Discount valid_until passed → is_active = false
2. Discount valid_from reached → is_active = true
3. Manual disabled → skip (don't auto-enable)
```

### 4.9.5 Discount Calculation
```
Priority:
1. SPECIFIC_PRODUCT (highest)
2. CATEGORY
3. ALL_PRODUCTS (lowest)

Rules:
- Diskon hanya pada base_price, bukan modifier
- Diskon tidak stack (highest wins)
- Diskon dihitung per item
```

---

## 4.10 Payment Module - Complete Features

### 4.10.1 Midtrans Integration
```
Environment:
- Sandbox: SB-Mid-server-xxx
- Production: Mid-server-xxx

Endpoints:
POST /api/v1/payment/qris
- Generate QRIS payment
- Return QR code image URL

POST /api/v1/payment/webhook
- Midtrans callback
- Update order status
- Verify signature SHA512
```

### 4.10.2 Payment Status
```
Status Flow:
pending → processing → settlement (success)
pending → expire (timeout 10 min)
pending → decline (failed)
```

### 4.10.3 Fake Gateway (Development)
```
Environment Variable: FAKE_MIDTRANS=true
Flow:
1. Generate fake QR URL
2. Return immediately as "settlement"
3. No actual Midtrans call
```

### 4.10.4 Split Payment
```
Structure:
{
  payment_method: "split",
  cash_amount: 50000,      // Tunai
  qris_amount: 35000,      // QRIS
  total_amount: 85000       // Total
}

Rules:
- cash_amount wajib > 0
- Total must match sum
```

---

## 4.11 Receipts Module - Complete Features

### 4.11.1 Receipt Data
```
Endpoint: GET /api/v1/receipts/:orderId
Return:
{
  order_number,
  cashier_name,
  items: [{ name, qty, price }],
  subtotal,
  discount,
  total,
  payment_method,
  cash_received,
  change,
  timestamp
}
```

### 4.11.2 Receipt Formats
```
1. Plain Text (58mm printer)
   - Fixed width font
   - Line characters: ─, │, ┌, ┐, └, ┘

2. Plain Text (80mm printer)
   - Wider format
   - More detail

3. HTML (browser print)
   - Styled receipt
   - Auto print dialog
```

### 4.11.3 Receipt Content
```
Header:
- Company name
- Address
- Phone

Body:
- Date & Time
- Order number
- Cashier name
- Items (name, qty, price, modifiers)
- Subtotal
- Discount (if any)
- TOTAL (bold)

Payment:
- Method: CASH / QRIS / SPLIT
- Tunai: Rp xxx
- Kembalian: Rp xxx

Footer:
- "Terima Kasih"
- QR link for member registration
```

### 4.11.4 Print
```
Endpoint: GET /api/v1/receipts/:orderId/print
Flow:
1. Return HTML receipt
2. Browser auto open print dialog
3. Select printer (Bluetooth/USB)
```

---

## 4.12 Audit Module - Complete Features

### 4.12.1 Audit Log
```
Captured Events:
- LOGIN (kasir, admin)
- LOGOUT
- OTP_REQUEST
- OTP_VERIFY
- SHIFT_OPEN
- SHIFT_CLOSE
- SHIFT_AUTO_CLOSE
- ORDER_CREATE
- ORDER_VOID
- ORDER_FLAG
- PROFIT_SHARE_PAYMENT
- PRICE_CHANGE
- INVENTORY_ADJUST
```

### 4.12.2 Audit Data
```
{
  id,
  actor_id,        // User who performed
  action,          // Action type
  entity_type,     // Order, Product, etc.
  entity_id,       // ID of affected entity
  old_value,       // Before (JSON)
  new_value,       // After (JSON)
  ip_address,
  timestamp
}
```

### 4.12.3 Query Audit
```
Endpoint: GET /api/v1/admin/audit-logs
Filters:
- ?actor_id=xxx
- ?action=ORDER_VOID
- ?entity_type=Order
- ?date_from=xxx
- ?date_to=xxx
```

### 4.12.4 Immutability
```
- No UPDATE or DELETE on audit_log table
- Trigger prevents mutations
- Only INSERT allowed
```

---

## 4.13 Email Module - Complete Features

### 4.13.1 Email Types
```
1. OTP Email
   - 6-digit code
   - Expire 5 minutes
   - HTML template

2. Fraud Alert
   - Triggered by void pattern
   - Contains kasir info, order details

3. Discrepancy Alert
   - Shift closing with large discrepancy
   - Threshold: Rp 10.000

4. Loss Alert
   - Monthly when profit is negative
   - Summary of expenses

5. Shift Reminder
   - Sent to owner when shift not closed
```

### 4.13.2 Email Queue (BullMQ)
```
Flow:
1. Email request → Add to queue
2. Worker process queue
3. Send via SMTP (Resend/SendGrid)
4. Retry on failure (max 3)
```

### 4.13.3 Configuration
```
Environment Variables:
- SMTP_HOST
- SMTP_PORT
- SMTP_USER
- SMTP_PASS
- EMAIL_FROM
```

---

## 4.14 Users Module - Complete Features

### 4.14.1 User Types
```
1. SUPERADMIN (Owner)
   - Full access
   - Email login + OTP

2. CASHIER
   - POS only
   - PIN login
   - Assigned to outlet(s)
```

### 4.14.2 User Management
```
GET /api/v1/admin/users
- List all users
- Filter by role

POST /api/v1/admin/users
- Create user (cashier only by admin)

PATCH /api/v1/admin/users/:id
- Update name, role
- Toggle is_active

POST /api/v1/admin/users/:id/reset-pin
- Reset PIN to default
- Send new PIN via email
```

### 4.14.3 Cashier Letter
```
Format: A, B, C, D...
Used in:
- Order number: TRX-20260620-A-001
- Receipt header
```

---

## 4.15 Flags Module - Complete Features

### 4.15.1 Feature Flags
```
Purpose:
- Toggle features without deploy
- A/B testing
- Gradual rollout

Default Flags:
- QRIS_PAYMENT (enable/disable QRIS)
- SPLIT_PAYMENT (enable/disable split)
- DISCOUNT_SYSTEM
- MODIFIER_SYSTEM
- INVENTORY_CHECK (validate stock)
- PRINT_RECEIPT
- EMAIL_RECEIPT
- PROFIT_SHARE
```

### 4.15.2 Flag Usage
```
Backend:
const flags = await flagsService.getFlags();
if (flags.QRIS_PAYMENT) { ... }

Frontend:
const res = await api.get('/flags');
if (res.data.QRIS_PAYMENT) { showQRIS(); }
```

---

## 4.16 Frontend - POS Complete Features

### 4.16.1 POS Layout
```
┌─────────────────────────────────────────────────┐
│ Header: Store Name │ Cashier │ Time │ Logout     │
├───────────────────┼─────────────────────────────┤
│                   │                             │
│   Product Grid    │      Cart Sidebar          │
│                   │                             │
│   [Category]      │   - Item 1     Rp 15.000  │
│   ┌───┐┌───┐┌───┐│   - Item 2     Rp 10.000  │
│   │   ││   ││   ││   - Modifier   Rp  2.000  │
│   └───┘└───┘└───┘│                            │
│   ┌───┐┌───┐┌───┐│   ─────────────────────  │
│   │   ││   ││   ││   Subtotal     Rp 27.000  │
│   └───┘└───┘└───┘│   Diskon        Rp  0     │
│                   │   TOTAL         Rp 27.000  │
│                   │                            │
│                   │   [  BAYAR LUNAS  ]       │
├───────────────────┴─────────────────────────────┤
│ Status Bar: Connection │ Sync Status │ Version │
└─────────────────────────────────────────────┘
```

### 4.16.2 Cart Operations
```
Add Item:
- Tap product → Add to cart
- If has modifiers → Show modifier modal

Update Quantity:
- Tap cart item → +/- buttons
- Swipe to delete

Modifier Selection:
- Required modifiers must be selected
- Show additional price
- Max selections enforced
```

### 4.16.3 Payment Flow
```
1. Tap "BAYAR LUNAS"
2. Select payment method:
   - CASH → Input amount → Show change
   - QRIS → Generate QR → Wait for payment
   - SPLIT → CASH + QRIS combination
3. On success → Print receipt
4. Clear cart
```

### 4.16.4 Offline Mode
```
Indicator:
- Online: Green dot
- Offline: Red dot + "OFFLINE MODE"

When Offline:
- All operations work (cash only)
- Orders saved to Dexie
- QRIS disabled (require online)

Sync on Reconnect:
- Auto-trigger sync
- Show progress
- Toast on complete
```

### 4.16.5 Print Receipt
```
Trigger: After payment success
Flow:
1. Generate receipt HTML
2. Open print dialog
3. User selects printer
4. Print

Printer Options:
- Bluetooth (PUTIAN802)
- USB
- Browser Print (fallback)
```

---

## 4.17 Frontend - Admin Complete Features

### 4.17.1 Dashboard
```
KPI Cards:
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Revenue  │ │ Orders   │ │ Avg Order│ │ Profit   │
│ Rp 2.5jt│ │    125   │ │ Rp 20rb  │ │ Rp 800rb │
└──────────┘ └──────────┘ └──────────┘ └──────────┘

Charts:
- Revenue Trend (7 days)
- Top Products (bar chart)
- Payment Distribution (pie chart)
```

### 4.17.2 Transactions Page
```
Table Columns:
- Order #, Date, Cashier, Items, Total, Payment, Status

Actions:
- View Detail (modal)
- Void (with reason)
- Flag (mark suspicious)

Filters:
- Date range
- Cashier
- Payment method
- Status
```

### 4.17.3 Products Page
```
Table with:
- Image, Name, Category, Price, Stock, Status

Actions:
- Add Product
- Edit Product
- Manage Modifiers
- Toggle Active

Product Form:
- Name (required)
- Category (select)
- Base Price (number)
- Image (upload)
- Modifiers (multi-select)
```

### 4.17.4 Inventory Page
```
Tabs:
1. Stock - List bahan baku
2. Opname - Physical count

Stock Tab:
- Name, Current, Min, Cost, Supplier
- Color coded: Normal (green), Low (yellow), Critical (red)

Opname Tab:
- Select material
- Input physical count
- Calculate variance
- Submit adjustment
```

### 4.17.5 Cashiers Page
```
Table:
- Letter, Name, Username, Status, Created

Actions:
- Add Cashier
- Edit Cashier
- Reset PIN
- Toggle Active

Cashier Form:
- Name (required)
- Username (unique)
- Initial PIN (auto or manual)
```

### 4.17.6 Shifts Page
```
Table:
- Cashier, Date, Open, Close, Opening, Closing, Discrepancy

Status Badges:
- Open (blue)
- Closed (green)
- Auto-Closed (orange)

Detail Modal:
- List all orders in shift
- Payment summary
- Discrepancy explanation
```

### 4.17.7 Reports Page
```
Export Options:
- Transaction CSV
- Cash Report CSV
- Profit Share CSV

Filters:
- Date range (max 30 days)
- Cashier (optional)
```

### 4.17.8 Profit Share Page
```
Current Period Summary:
┌─────────────────────────────────────────────┐
│ Total Revenue     : Rp 15.000.000          │
│ Total HPP         : Rp  6.000.000          │
│ Total Opex        : Rp  2.000.000          │
│ ──────────────────────────────────────      │
│ Net Profit        : Rp  7.000.000          │
│ Owner (60%)       : Rp  4.200.000          │
│ Kasir Pool (40%)  : Rp  2.800.000          │
└─────────────────────────────────────────────┘

Per Cashier Breakdown:
- Name, Orders, Revenue, Share Amount, Paid?
```

### 4.17.9 System Health Page
```
Status Indicators:
┌─────────────────────────────────────────────┐
│ PostgreSQL    ● Connected  (15ms)           │
│ Redis        ● Connected  (2ms)            │
│ Midtrans     ● OK         (sandbox)        │
│ SMTP         ● OK                          │
└─────────────────────────────────────────────┘
```

---

## Complete Features Summary

| Category | Total | Completed | Missing |
|----------|-------|-----------|---------|
| Backend Modules | 17 | 16 | 1 (members) |
| Frontend Pages | 30 | 27 | 3 |
| Database Models | 28 | 24 | 4 |
| API Endpoints | 100+ | 90+ | ~10 |
| Features | 200+ | 180+ | ~20 |

**Overall Completion: ~90%**

---

# Phase 1: Critical Audit Fixes

## KRITIS-01: CI/CD Path Fix

### Description
Docker image build akan selalu gagal karena path Dockerfile salah di CI/CD.

### Current Issue
```yaml
# SALAH - file tidak ada:
file: ./Caddy.Dockerfile

# SEBENARNYA ADA DI:
docker/caddy.Dockerfile
```

### Required Fix

**File:** `.github/workflows/ci.yml`

| Change | From | To |
|--------|------|-----|
| Caddy Dockerfile path | `./Caddy.Dockerfile` | `./docker/caddy.Dockerfile` |

### Implementation
```yaml
# Build and push Caddy (frontend)
- name: Build and push Caddy (frontend)
  uses: docker/build-push-action@v5
  with:
    context: .
    file: ./docker/caddy.Dockerfile  # ← FIXED
    push: true
    tags: ${{ secrets.DOCKER_USERNAME }}/ngemiloh-caddy:${{ github.sha }}
    build-args: |
      VITE_API_URL=${{ secrets.VITE_API_URL }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

### Acceptance Criteria
- [ ] CI/CD pipeline build Caddy image successfully
- [ ] VITE_API_URL passed as build argument
- [ ] Image pushed to registry

---

## KRITIS-02: VITE_API_URL Environment

### Description
Frontend production tidak bisa hit API karena BASE_URL kosong.

### Root Cause
- Tidak ada `.env` di folder `frontend/`
- `docker/caddy.Dockerfile` tidak inject `VITE_API_URL` saat build

### Required Fixes

**Step 1:** Buat `frontend/.env.example`
```bash
# frontend/.env.example
VITE_API_URL=http://localhost:3000
```

**Step 2:** Buat `frontend/.env` untuk development
```bash
# frontend/.env
VITE_API_URL=http://localhost:3000
```

**Step 3:** Update `docker/caddy.Dockerfile`
```dockerfile
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./

# Terima URL API dari build argument
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build
```

**Step 4:** Update `docker-compose.yml`
```yaml
caddy:
  build:
    context: .
    dockerfile: docker/caddy.Dockerfile
    args:
      VITE_API_URL: ${VITE_API_URL:-http://localhost:3000}
```

**Step 5:** Tambahkan GitHub Secret
```
Repository → Settings → Secrets → Actions → New repository secret
Name: VITE_API_URL
Value: https://api.namadomain-anda.com
```

### Acceptance Criteria
- [ ] Frontend production build dengan VITE_API_URL
- [ ] API calls berfungsi di production
- [ ] Fallback ke localhost di development

---

## KRITIS-03: Auto-Close Shift Time Boundary

### Description
Auto-close shift ambil order tanpa batas waktu. Kasir buka shift baru akan ikut terhitung di shift lama.

### Business Rule
**"Shift = Business Date — filter by `shift_start..shift_end`"**

### Current Issue
```typescript
// SALAH: tidak ada batas akhir waktu
const orders = await this.prisma.order.findMany({
  where: {
    cashier_id: shift.cashier_id,
    status: 'completed',
    created_at: { gte: shift.shift_start },  // ← tidak ada lte/lt!
  },
});
```

### Decision (From Q39 & Q79)
- Auto-close trigger: Idle timeout 4 jam + crossing midnight
- Grace period: 30 menit
- Anomali handling: Kasir layani + foto bukti + kirim owner

### Required Fix

**File:** `backend/src/finance/finance.cron.ts`

```typescript
private async autoCloseShift(shift: {
  id: string;
  cashier_id: string;
  opening_balance: unknown;
  shift_start: Date;
  cashier: { name: string; email: string | null };
}) {
  this.logger.warn(
    `Auto-closing shift ${shift.id} for cashier ${shift.cashier.name}`,
  );

  try {
    // Waktu auto-close adalah sekarang (saat cron berjalan)
    const auto_close_time = new Date();

    // FIXED: Gunakan shift_start sampai auto_close_time sebagai boundary
    const orders = await this.prisma.order.findMany({
      where: {
        cashier_id: shift.cashier_id,
        status: 'completed',
        created_at: {
          gte: shift.shift_start,   // mulai shift dibuka
          lt: auto_close_time,      // ← TAMBAH: sampai saat auto-close
        },
      },
    });

    const totalCashSales = orders.reduce((sum, o) => {
      if (o.payment_method === 'cash') return sum + Number(o.total_amount);
      if (o.payment_method === 'split') return sum + Number(o.cash_amount || 0);
      return sum;
    }, 0);

    const expectedBalance = Number(shift.opening_balance) + totalCashSales;

    await this.prisma.cashRegister.update({
      where: { id: shift.id },
      data: {
        status: 'closed',
        actual_close_at: auto_close_time,
        closing_balance: expectedBalance,
        system_cash_total: expectedBalance,
        discrepancy: 0,
        is_auto_closed: true,
      },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        actor_id: shift.cashier_id,
        action: 'CASH_REGISTER_AUTO_CLOSE',
        entity_type: 'CashRegister',
        entity_id: shift.id,
        new_value: {
          reason: 'Auto-closed: idle timeout exceeded grace period',
          system_cash_total: expectedBalance,
          order_count: orders.length,
        },
      },
    });

    this.logger.log(`Shift ${shift.id} auto-closed. Orders: ${orders.length}`);
  } catch (err) {
    this.logger.error(
      `Failed to auto-close shift ${shift.id}: ${(err as Error).message}`,
    );
  }
}
```

### Acceptance Criteria
- [ ] Auto-close menggunakan boundary `shift_start` to `auto_close_time`
- [ ] Order setelah auto-close tidak masuk shift lama
- [ ] Audit log记录auto-close event
- [ ] Grace period 30 menit sebelum auto-close

---

## KRITIS-04: Logout Clear Token

### Description
Tombol logout POS tidak clear token. Cookie `access_token` masih ada.

### Current Issue
```html
<!-- SALAH: hanya navigasi, tidak clear apapun -->
<a href="/login" title="Keluar">Logout</a>
```

### Required Fix

**File:** `frontend/src/routes/pos/+page.svelte`

```typescript
// Tambahkan di bagian script
import { api } from '$lib/services/api.client';

async function handle_logout() {
  try {
    // Hapus cookie via backend
    await api.post('/auth/logout', {});
  } catch {
    // Lanjutkan logout walau request gagal
  } finally {
    // Bersihkan data lokal
    localStorage.removeItem('user');
    // Arahkan ke halaman login
    window.location.href = '/login';
  }
}
```

**Template:**
```svelte
<!-- Ganti <a> dengan <button> -->
<button
  onclick={handle_logout}
  class="flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-100"
  title="Keluar"
>
  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
    />
  </svg>
  <span class="hidden sm:inline">Logout</span>
</button>
```

**Backend Endpoint:** `backend/src/auth/presentation/auth.controller.ts`

```typescript
@Post('logout')
@HttpCode(200)
logout(@Res({ passthrough: true }) res: Response) {
  res.clearCookie('access_token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
  });
  res.clearCookie('csrf_token', { path: '/' });
  return { success: true, message: 'Logged out' };
}
```

### Acceptance Criteria
- [ ] Logout button clear localStorage
- [ ] Backend endpoint clear cookies
- [ ] Kasir tidak bisa akses POS setelah logout tanpa login ulang

---

## TINGGI-01: Admin Auth Guard Bypass

### Description
Halaman admin terbuka jika manipulasi localStorage via browser console.

### Current Issue
```typescript
// Siapapun bisa jalankan di console:
// localStorage.setItem('user', JSON.stringify({ role: 'superadmin', name: 'Test' }))
// → Langsung masuk admin panel!
```

### Required Fix

**File:** `frontend/src/routes/admin/+layout.svelte`

```typescript
onMount(async () => {
  const user_str = localStorage.getItem('user');
  if (!user_str) {
    goto('/login-admin');
    return;
  }

  let user: { role: string; name: string };
  try {
    user = JSON.parse(user_str);
    if (user.role !== 'superadmin') {
      goto('/login-admin');
      return;
    }
  } catch {
    goto('/login-admin');
    return;
  }

  // VERIFIKASI TOKEN KE BACKEND
  try {
    const res = await api.get('/auth/me');
    if (!res.ok) {
      localStorage.removeItem('user');
      goto('/login-admin');
      return;
    }
  } catch {
    // Jika offline, percayakan localStorage sementara
    console.warn('Cannot verify session — network offline');
  }

  is_superadmin = true;
  admin_name = user.name || 'Admin';
});
```

### Acceptance Criteria
- [ ] Admin layout verifikasi token ke backend
- [ ] Redirect ke login jika token invalid/expired
- [ ] Fallback untuk mode offline

---

## TINGGI-02: Sidebar Link Fix

### Description
Link sidebar `/admin/users` arah ke route 404.

### Current Issue
```javascript
// SALAH: /admin/users tidak ada
{ href: '/admin/users', label: 'Manajemen Kasir', icon: '...' }

// BENAR:
{ href: '/admin/cashiers', label: 'Manajemen Kasir', icon: '...' }
```

### Required Fix

**File:** `frontend/src/routes/admin/+layout.svelte`

Replace all occurrences of `/admin/users` with `/admin/cashiers`.

### Acceptance Criteria
- [ ] Semua link Manajemen Kasir pointing ke `/admin/cashiers`
- [ ] Tidak ada 404 route dari sidebar

---

## TINGGI-03: Swagger Documentation

### Description
Swagger API documentation kosong karena tidak ada decorator `@ApiTags`, `@ApiOperation`.

### Required Fixes

**Auth Controller Example:**
```typescript
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Auth')
@ApiBearerAuth()
@Controller('auth')
export class AuthController {

  @Post('kasir/login')
  @ApiOperation({
    summary: 'Login kasir dengan PIN',
    description: 'Autentikasi kasir dengan username dan PIN 6 digit',
  })
  @ApiResponse({ status: 201, description: 'Login berhasil' })
  @ApiResponse({ status: 401, description: 'PIN salah' })
  @ApiResponse({ status: 429, description: 'Terlalu banyak percobaan' })
  async kasirLogin(@Body() dto: KasirLoginDto) {
    return this.authService.kasirLogin(dto);
  }
}
```

**Priority Controllers:**
1. `auth.controller.ts` - login, logout, OTP
2. `orders.controller.ts` - core business flow
3. `finance.controller.ts` - shift management
4. `products.controller.ts` - product catalog

### Acceptance Criteria
- [ ] Semua endpoint utama punya Swagger decorator
- [ ] API docs menampilkan request/response schemas
- [ ] DTOs punya `@ApiProperty` decorator

---

## TINGGI-04: Frontend Store Tests

### Description
Frontend store tests directory kosong.

### Required Fix

**File:** `frontend/src/test/stores/pos.store.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { PosStore } from '$lib/stores/pos.store.svelte';

describe('PosStore', () => {
  let store: PosStore;

  beforeEach(() => {
    store = new PosStore();
  });

  // Test: Tambah produk ke keranjang
  it('menambahkan produk baru ke cart', () => {
    const product = {
      id: 'prod-1',
      name: 'Macaroni Pedas',
      base_price: 10000,
      category_id: 'cat-1',
      modifier_groups: [],
    };

    store.add_to_cart(product as any, []);

    expect(store.cart).toHaveLength(1);
    expect(store.cart[0].id).toBe('prod-1');
    expect(store.cart[0].quantity).toBe(1);
  });

  // Test: Tambah produk yang sama → qty bertambah
  it('menambahkan quantity jika produk + modifier sama', () => {
    const product = {
      id: 'prod-1',
      name: 'Macaroni Pedas',
      base_price: 10000,
      category_id: 'cat-1',
      modifier_groups: [],
    };

    store.add_to_cart(product as any, []);
    store.add_to_cart(product as any, []);

    expect(store.cart).toHaveLength(1);
    expect(store.cart[0].quantity).toBe(2);
  });

  // Test: Kalkulasi total cart
  it('menghitung cart_total dengan benar', () => {
    const product = {
      id: 'prod-1',
      name: 'Macaroni Pedas',
      base_price: 10000,
      category_id: 'cat-1',
      modifier_groups: [],
    };

    store.add_to_cart(product as any, []);
    store.add_to_cart(product as any, []);

    // 2 item × 10000 = 20000
    expect(store.cart_total).toBe(20000);
  });

  // Test: Diskon hanya berlaku pada base_price, bukan modifier
  it('menerapkan diskon hanya pada base_price', () => {
    store.active_discounts = [
      {
        id: 'disc-1',
        type: 'percentage',
        value: 10,
        scope: 'all_products',
        is_active: true,
        applicable_days: null,
        target_id: null,
      } as any,
    ];

    const modifier = { id: 'mod-1', additional_price: 5000 };
    const product = {
      id: 'prod-1',
      name: 'Macaroni',
      base_price: 10000,
      category_id: 'cat-1',
      modifier_groups: [],
    };

    store.add_to_cart(product as any, [modifier as any]);

    // Diskon 10% dari base_price 10000 = 1000
    expect(store.discount_total).toBe(1000);
    expect(store.cart_total).toBe(14000);
  });

  // Test: Reset cart
  it('mereset cart dan payment state', () => {
    const product = {
      id: 'prod-1',
      name: 'Test',
      base_price: 5000,
      category_id: 'cat-1',
      modifier_groups: [],
    };
    store.add_to_cart(product as any, []);
    store.cash_amount = 50000;

    store.reset_cart();

    expect(store.cart).toHaveLength(0);
    expect(store.cash_amount).toBe(0);
  });
});
```

### Acceptance Criteria
- [ ] Test file dibuat di `frontend/src/test/stores/pos.store.test.ts`
- [ ] Minimal 5 test cases untuk PosStore
- [ ] Tests passing di CI/CD

---

## TINGGI-05: Email Warning Auto-Close

### Description
Email warning shift tidak terkirim. Cron jalan tapi tidak ada email.

### Decision (From Q53)
Alert ghost order + shift warning ke Dashboard Admin + notifikasi.

### Required Fix

**File:** `backend/src/finance/finance.cron.ts`

```typescript
async sendAutoCloseWarnings() {
  const now = new Date();
  const warningThreshold = new Date(now.getTime() + 30 * 60 * 1000); // 30 menit

  const shiftsNearClose = await this.prisma.cashRegister.findMany({
    where: {
      status: 'open',
      planned_close_at: {
        lte: warningThreshold,
        gt: now,
      },
    },
    include: {
      cashier: { select: { name: true, email: true } },
    },
  });

  for (const shift of shiftsNearClose) {
    const minutesLeft = Math.round(
      (shift.planned_close_at!.getTime() - now.getTime()) / 60000
    );

    this.logger.log(
      `Shift warning: ${shift.id} closes in ${minutesLeft} minutes`,
    );

    // Kirim email peringatan ke kasir
    if (shift.cashier.email) {
      await this.emailService
        .sendAlert(
          `Peringatan: Shift Anda akan otomatis ditutup dalam ${minutesLeft} menit`,
          `
            <p>Halo <strong>${shift.cashier.name}</strong>,</p>
            <p>Shift Anda akan <strong>otomatis ditutup</strong> dalam 
               <strong>${minutesLeft} menit</strong>.</p>
            <p>Mohon segera tutup shift secara manual melalui aplikasi POS 
               dan hitung uang tunai Anda.</p>
            <p>Jika Anda sudah tutup shift, abaikan pesan ini.</p>
          `,
        )
        .catch((err) =>
          this.logger.error(
            `Gagal kirim warning email ke ${shift.cashier.email}: ${err.message}`,
          ),
        );
    }

    // CATAT KE DATABASE UNTUK DASHBOARD NOTIFIKASI
    await this.prisma.systemLog.create({
      data: {
        level: 'warn',
        source: 'finance.cron',
        message: `Shift warning: ${shift.id} closes in ${minutesLeft} minutes`,
        metadata: {
          shift_id: shift.id,
          cashier_id: shift.cashier_id,
          cashier_name: shift.cashier.name,
          minutes_left: minutesLeft,
        },
      },
    });
  }
}
```

### Acceptance Criteria
- [ ] Email terkirim ke kasir 30 menit sebelum auto-close
- [ ] Log tersimpan untuk dashboard notifikasi
- [ ] Admin bisa lihat list shift warning di dashboard

---

## TINGGI-06: Dashboard KPI Shift Filter

### Description
Dashboard KPI filter by `created_at` bukan Shift Range.

### Business Rule
**"All reports filter by `shift_start..shift_end`, NOT `created_at::date`"**

### Decision (From Q110)
PPN 11% dihitung dulu → bulatkan Rp 500 → profit vs tax dipisah per transaksi.

### Required Fix

**File:** `backend/src/finance/application/services/finance.service.ts`

```typescript
async getDashboardKpi(date: string) {
  const query_date = new Date(date);
  query_date.setHours(0, 0, 0, 0);
  const query_date_end = new Date(date);
  query_date_end.setHours(23, 59, 59, 999);

  // Cari semua shift yang DIMULAI pada tanggal tersebut
  const shifts = await this.prisma.cashRegister.findMany({
    where: {
      shift_start: { gte: query_date, lte: query_date_end },
    },
    select: { id: true, shift_start: true, actual_close_at: true },
  });

  if (shifts.length === 0) {
    return {
      revenue: 0,
      order_count: 0,
      total_tax: 0,
      net_profit: 0,
      payment_distribution: {},
    };
  }

  const shift_ids = shifts.map((s) => s.id);

  // Query order berdasarkan cash_register_id (shift-based)
  const [aggregateResult, paymentCounts] = await Promise.all([
    this.prisma.order.aggregate({
      where: {
        cash_register_id: { in: shift_ids },
        status: { not: 'voided' },
      },
      _sum: {
        total_amount: true,
        cogs_total: true,
      },
      _count: true,
    }),
    this.prisma.$queryRaw<{ payment_method: string; count: bigint }[]>`
      SELECT payment_method, COUNT(*)::bigint as count
      FROM orders
      WHERE cash_register_id = ANY(${shift_ids}::text[])
        AND status != 'voided'
      GROUP BY payment_method
    `,
  ]);

  const revenue = Number(aggregateResult._sum.total_amount || 0);
  const cogs = Number(aggregateResult._sum.cogs_total || 0);

  // PPN 11% dari revenue (Tax Inclusive → Ekstrak)
  const tax_rate = 0.11;
  const gross_revenue = revenue / (1 + tax_rate);
  const total_tax = revenue - gross_revenue;

  // Profit = Revenue - Tax - COGS
  const net_profit = gross_revenue - cogs;

  // Payment distribution
  const payment_distribution: Record<string, number> = {};
  for (const row of paymentCounts) {
    payment_distribution[row.payment_method] = Number(row.count);
  }

  return {
    revenue,
    order_count: aggregateResult._count,
    gross_revenue: Math.round(gross_revenue),
    total_tax: Math.round(total_tax),
    cogs,
    net_profit: Math.round(net_profit),
    payment_distribution,
  };
}
```

### Acceptance Criteria
- [ ] KPI filter by shift range, bukan created_at
- [ ] Tax (PPN) dipisah dari revenue
- [ ] Net profit = Gross Revenue - Tax - COGS
- [ ] Rounding ke Rp 500 terdekat untuk tax

---

# Phase 2: Enhance Existing Features

## 2.1 Waste Tracking UI

### Description
Tambahkan UI Waste Tracking di inventory page.

### Database Status
- `StockMovement` model sudah ada dengan type `waste`
- Tapi tidak ada dedicated WasteLog UI

### Required Implementation

**Frontend:** `frontend/src/routes/admin/inventory/+page.svelte`

```svelte
<!-- Tambahkan tab Waste -->
<div class="mb-6 flex gap-2 border-b border-slate-200">
  <button
    onclick={() => (activeTab = 'stock')}
    class={`px-4 py-2 text-sm font-medium ${
      activeTab === 'stock'
        ? 'border-b-2 border-blue-600 text-blue-600'
        : 'text-slate-600 hover:text-slate-800'
    }`}
  >
    Stok
  </button>
  <button
    onclick={() => (activeTab = 'waste')}
    class={`px-4 py-2 text-sm font-medium ${
      activeTab === 'waste'
        ? 'border-b-2 border-red-600 text-red-600'
        : 'text-slate-600 hover:text-slate-800'
    }`}
  >
    Waste
  </button>
</div>

{#if activeTab === 'waste'}
<div class="rounded-xl bg-white p-6 shadow-sm">
  <h2 class="text-lg font-bold mb-4">Input Waste / Kerusakan</h2>
  
  <div class="grid gap-4 md:grid-cols-2">
    <div>
      <label class="block text-sm font-medium text-slate-700 mb-1">
        Bahan Baku
      </label>
      <select
        bind:value={waste_material_id}
        class="w-full rounded-lg border border-slate-300 px-3 py-2"
      >
        <option value="">Pilih bahan...</option>
        {#each materials as m}
          <option value={m.id}>
            {m.name} (Stok: {m.stock} {m.unit})
          </option>
        {/each}
      </select>
    </div>
    
    <div>
      <label class="block text-sm font-medium text-slate-700 mb-1">
        Jumlah Waste
      </label>
      <input
        type="number"
        bind:value={waste_quantity}
        placeholder="Jumlah"
        class="w-full rounded-lg border border-slate-300 px-3 py-2"
      />
    </div>
    
    <div>
      <label class="block text-sm font-medium text-slate-700 mb-1">
        Alasan
      </label>
      <select
        bind:value={waste_reason}
        class="w-full rounded-lg border border-slate-300 px-3 py-2"
      >
        <option value="expired">Bahan Expired</option>
        <option value="processing_error">Salah Olah</option>
        <option value="damaged">Rusak</option>
        <option value="sample">Sample/Coba-coba</option>
      </select>
    </div>
    
    <div>
      <label class="block text-sm font-medium text-slate-700 mb-1">
        Keterangan
      </label>
      <input
        type="text"
        bind:value={waste_note}
        placeholder="Contoh: bahan expired karena penyimpanan kurang baik"
        class="w-full rounded-lg border border-slate-300 px-3 py-2"
      />
    </div>
  </div>
  
  <button
    onclick={submitWaste}
    class="mt-4 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
  >
    Catat Waste
  </button>
  
  <!-- Waste History -->
  <div class="mt-6">
    <h3 class="text-md font-semibold mb-3">Riwayat Waste</h3>
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b text-left">
          <th class="pb-2">Tanggal</th>
          <th class="pb-2">Bahan</th>
          <th class="pb-2">Jumlah</th>
          <th class="pb-2">Alasan</th>
        </tr>
      </thead>
      <tbody>
        {#each wasteHistory as w}
          <tr class="border-b">
            <td class="py-2">{formatDate(w.created_at)}</td>
            <td class="py-2">{w.material_name}</td>
            <td class="py-2">{w.quantity} {w.unit}</td>
            <td class="py-2">
              <span class="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                {w.reason}
              </span>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
{/if}
```

### API Endpoint

**File:** `backend/src/inventory/infrastructure/repositories/prisma-inventory.repository.ts`

```typescript
async recordWaste(data: {
  raw_material_id: string;
  quantity: number;
  reason: 'expired' | 'processing_error' | 'damaged' | 'sample';
  notes?: string;
  recorded_by: string;
}): Promise<StockMovement> {
  const material = await this.prisma.rawMaterial.findUnique({
    where: { id: data.raw_material_id },
  });

  if (!material) {
    throw new NotFoundException('Raw material not found');
  }

  // Validasi stok cukup
  if (material.current_stock < data.quantity) {
    throw new BadRequestException('Insufficient stock for waste');
  }

  // Kurangi stok
  await this.prisma.rawMaterial.update({
    where: { id: data.raw_material_id },
    data: {
      current_stock: { decrement: data.quantity },
    },
  });

  // Catat movement
  return this.prisma.stockMovement.create({
    data: {
      raw_material_id: data.raw_material_id,
      type: 'waste',
      quantity: data.quantity,
      notes: `${data.reason}${data.notes ? ': ' + data.notes : ''}`,
      created_by: data.recorded_by,
    },
  });
}
```

### Acceptance Criteria
- [ ] Tab Waste di inventory page
- [ ] Form input waste dengan alasan
- [ ] Riwayat waste table
- [ ] Stok otomatis berkurang saat waste dicatat

---

## 2.2 BOM Recipes UI

### Description
BOM (Bill of Materials) recipes UI untuk setup HPP per produk.

### Database Status
- `BomRecipe` model sudah ada
- API endpoints sudah ada
- UI belum ada

### Required Implementation

**Frontend:** `frontend/src/routes/admin/inventory/+page.svelte`

```svelte
<!-- Tab BOM Recipes -->
<button onclick={() => (activeTab = 'bom')}>
  Resep / BOM
</button>

{#if activeTab === 'bom'}
<div class="rounded-xl bg-white p-6 shadow-sm">
  <h2 class="text-lg font-bold mb-4">Bill of Materials (BOM)</h2>
  <p class="text-sm text-slate-600 mb-4">
    Setup resep untuk menghitung HPP (Harga Pokok Penjualan) per produk.
  </p>

  <!-- Product Selector -->
  <div class="mb-4">
    <label class="block text-sm font-medium text-slate-700 mb-1">
      Pilih Produk
    </label>
    <select
      bind:value={selectedProductForBom}
      onchange={loadBomForProduct}
      class="w-full rounded-lg border border-slate-300 px-3 py-2"
    >
      <option value="">Pilih produk...</option>
      {#each products as p}
        <option value={p.id}>{p.name}</option>
      {/each}
    </select>
  </div>

  {#if selectedProductForBom}
  <!-- BOM Table -->
  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b text-left bg-slate-50">
          <th class="px-3 py-2">Bahan Baku</th>
          <th class="px-3 py-2">Jumlah per Porsi</th>
          <th class="px-3 py-2">Unit</th>
          <th class="px-3 py-2">Harga/Unit</th>
          <th class="px-3 py-2">Subtotal HPP</th>
          <th class="px-3 py-2">Aksi</th>
        </tr>
      </thead>
      <tbody>
        {#each bomItems as item}
          <tr class="border-b">
            <td class="px-3 py-2">{item.material_name}</td>
            <td class="px-3 py-2">
              <input
                type="number"
                step="0.01"
                bind:value={item.quantity}
                class="w-20 rounded border px-2 py-1"
              />
            </td>
            <td class="px-3 py-2">{item.unit}</td>
            <td class="px-3 py-2">Rp {formatNumber(item.cost_per_unit)}</td>
            <td class="px-3 py-2 font-medium">
              Rp {formatNumber(item.quantity * item.cost_per_unit)}
            </td>
            <td class="px-3 py-2">
              <button
                onclick={() => removeBomItem(item.id)}
                class="text-red-600 hover:text-red-800"
              >
                Hapus
              </button>
            </td>
          </tr>
        {/each}
        <tr class="bg-blue-50 font-bold">
          <td colspan="4" class="px-3 py-2 text-right">Total HPP per Porsi:</td>
          <td class="px-3 py-2 text-blue-700">
            Rp {formatNumber(totalBomCost)}
          </td>
          <td></td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Add Material -->
  <div class="mt-4 flex gap-2">
    <select
      bind:value={newBomMaterial}
      class="flex-1 rounded-lg border border-slate-300 px-3 py-2"
    >
      <option value="">Tambah bahan...</option>
      {#each availableMaterials as m}
        <option value={m.id}>{m.name} (Stok: {m.stock})</option>
      {/each}
    </select>
    <input
      type="number"
      step="0.01"
      bind:value={newBomQuantity}
      placeholder="Qty"
      class="w-24 rounded-lg border border-slate-300 px-3 py-2"
    />
    <button
      onclick={addBomItem}
      class="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
    >
      Tambah
    </button>
  </div>

  <!-- Save Button -->
  <button
    onclick={saveBom}
    class="mt-4 rounded-lg bg-green-600 px-6 py-2 text-sm font-medium text-white hover:bg-green-700"
  >
    Simpan Resep
  </button>
  {/if}
</div>
{/if}
```

### Acceptance Criteria
- [ ] BOM tab di inventory page
- [ ] Setup resep per produk
- [ ] Kalkulasi HPP otomatis per porsi
- [ ] Modifier option BOM support

---

## 2.3 Dexie Discount Cache

### Description
Tambahkan tabel discounts di Dexie untuk offline mode.

### Required Fix

**File:** `frontend/src/lib/db.ts`

```typescript
export class PosDatabase extends Dexie {
  products!: Table<LocalProduct, string>;
  orders!: Table<LocalOrder, string>;
  cart!: Table<LocalCartItem, string>;
  discounts!: Table<Discount, string>;  // ← TAMBAH

  constructor() {
    super('NgemilohPOSDB');
    this.version(4).stores({
      products: 'id, category_id',
      orders: 'client_uuid, sync_status, created_at',
      cart: 'id',
      discounts: 'id, is_active',  // ← TAMBAH
    });
  }
}
```

**Update service:** `frontend/src/lib/services/pos.service.ts`

```typescript
async fetch_discounts() {
  try {
    const res = await api.get(`/admin/discounts`);
    if (res.ok) {
      const json: ApiResponse<Discount[]> = await res.json();
      if (json.success) {
        pos_store.active_discounts = json.data.filter((d) => d.is_active);

        // Simpan ke Dexie untuk mode offline
        await db.discounts.clear();
        await db.discounts.bulkAdd(json.data);
      }
    } else {
      console.warn('Failed to fetch discounts:', res.status);
      // Fallback: load dari Dexie jika offline
      const cached = await db.discounts.where('is_active').equals(1).toArray();
      pos_store.active_discounts = cached;
    }
  } catch {
    console.warn('Offline: loading discounts from local cache');
    const cached = await db.discounts.toArray();
    pos_store.active_discounts = cached.filter((d) => d.is_active);
  }
}
```

### Acceptance Criteria
- [ ] Dexie version upgraded to 4
- [ ] Discounts cached untuk offline
- [ ] Discounts loaded dari cache saat offline

---

## 2.4 Profit Share HPP Display

### Description
Tampilkan warning HPP=0 dan info BOM status.

### Required Implementation

**File:** `frontend/src/routes/admin/profit-share/+page.svelte`

```svelte
<!-- Warning Banner -->
{#if hppIsZero}
  <div class="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
    <div class="flex items-start gap-3">
      <svg class="h-5 w-5 text-amber-500 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
        <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"/>
      </svg>
      <div>
        <p class="font-medium text-amber-800">HPP Belum Dikonfigurasi</p>
        <p class="text-sm text-amber-700 mt-1">
          Nilai HPP (Harga Pokok Penjualan) masih Rp 0 karena resep BOM belum diisi.
          Pergi ke menu <a href="/admin/inventory" class="underline font-medium">Bahan Baku</a>
          dan lengkapi resep BOM untuk setiap produk agar kalkulasi profit akurat.
        </p>
      </div>
    </div>
  </div>
{/if}

<!-- BOM Coverage Stats -->
<div class="mb-4 rounded-lg bg-slate-50 p-4">
  <h3 class="text-sm font-semibold text-slate-700 mb-2">Status BOM Recipes</h3>
  <div class="grid grid-cols-3 gap-4 text-center">
    <div>
      <p class="text-2xl font-bold text-green-600">{bomConfiguredCount}</p>
      <p class="text-xs text-slate-500">Produk dengan BOM</p>
    </div>
    <div>
      <p class="text-2xl font-bold text-red-600">{bomMissingCount}</p>
      <p class="text-xs text-slate-500">Produk tanpa BOM</p>
    </div>
    <div>
      <p class="text-2xl font-bold text-blue-600">{bomCoveragePercent}%</p>
      <p class="text-xs text-slate-500">Coverage</p>
    </div>
  </div>
</div>
```

### Acceptance Criteria
- [ ] Warning banner jika HPP = 0
- [ ] BOM coverage statistics
- [ ] Link ke inventory untuk setup BOM

---

# Phase 3: Build New Features

## 3.1 Members Module Backend

### Description
Build entire members module for customer registration and loyalty.

### Database Schema

```prisma
// NEW MODELS

model Customer {
  id               String   @id @default(uuid())
  phone            String   @unique @db.VarChar(20)
  name             String   @db.VarChar(100)
  current_tier_id  String?  @map("current_tier_id")
  transaction_count Int     @default(0) @map("transaction_count")
  tier_period_start DateTime? @map("tier_period_start") @db.Timestamptz
  tier_period_end   DateTime? @map("tier_period_end") @db.Timestamptz
  registered_via   String?  @db.VarChar(50)
  created_at      DateTime @default(now()) @db.Timestamptz
  updated_at      DateTime @updatedAt @db.Timestamptz

  tier            LoyaltyTier? @relation(fields: [current_tier_id], references: [id])
  transactions    MemberTransaction[]

  @@map("customers")
}

model LoyaltyTier {
  id            String   @id @default(uuid())
  name          String   @db.VarChar(50) // bronze, silver, gold
  min_transactions Int   @map("min_transactions")
  max_transactions Int?  @map("max_transactions")
  discount_percent Int   @map("discount_percent")
  is_active     Boolean  @default(true) @map("is_active")
  created_at    DateTime @default(now()) @db.Timestamptz

  customers     Customer[]

  @@map("loyalty_tiers")
}

model MemberTransaction {
  id            String   @id @default(uuid())
  customer_id   String   @map("customer_id")
  order_id      String?  @map("order_id")
  points_earned Int      @default(0) @map("points_earned")
  points_redeemed Int   @default(0) @map("points_redeemed")
  tier_at_time  String?  @map("tier_at_time")
  created_at    DateTime @default(now()) @db.Timestamptz

  customer      Customer @relation(fields: [customer_id], references: [id])
  order        Order?   @relation(fields: [order_id], references: [id])

  @@map("member_transactions")
}
```

### Module Structure

```
backend/src/members/
├── members.module.ts
├── members.controller.ts
├── members.service.ts
├── domain/
│   ├── entities/
│   │   └── customer.entity.ts
│   └── interfaces/
│       └── customer-repository.interface.ts
├── application/
│   ├── services/
│   │   └── members.service.ts
│   └── dtos/
│       ├── register-customer.dto.ts
│       ├── lookup-customer.dto.ts
│       └── update-points.dto.ts
└── infrastructure/
    └── repositories/
        └── prisma-customer.repository.ts
```

### API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/members/register` | Register new member |
| GET | `/api/v1/members/lookup` | Lookup by phone |
| GET | `/api/v1/members/:id` | Get member details |
| PATCH | `/api/v1/members/:id/points` | Add/use points |
| GET | `/api/v1/members/:id/history` | Transaction history |
| GET | `/api/v1/members/:id/tier` | Get current tier |
| POST | `/api/v1/members/qr-register` | Register from QR scan |

### Service Logic

```typescript
// Tier calculation
function calculateTier(transactionCount: number): LoyaltyTier {
  if (transactionCount >= 76) return 'gold';      // 15% discount
  if (transactionCount >= 26) return 'silver';   // 10% discount
  return 'bronze';                                 // 5% discount
}

// Points calculation (1 point per Rp 1000)
function calculatePoints(totalAmount: number): number {
  return Math.floor(totalAmount / 1000);
}
```

### Acceptance Criteria
- [ ] Members module created
- [ ] Customer registration with phone
- [ ] Loyalty tier calculation
- [ ] Points earning on transaction
- [ ] Points redemption
- [ ] QR code registration

---

## 3.2 Members Registration UI

### Description
Member registration page accessible via QR code on receipt.

### Flow

```
Struk Pelanggan
    ↓
QR Code "Daftar Member" → opens /register?ref=XXX
    ↓
Form: No. HP + Nama
    ↓
Submit → Backend creates customer
    ↓
Show Member ID + QR Code for next visit
```

### Required Pages

**Frontend:** `frontend/src/routes/register/+page.svelte`

```svelte
<script lang="ts">
  import { api } from '$lib/services/api.client';
  import { goto } from '$app/navigation';

  let phone = $state('');
  let name = $state('');
  let loading = $state(false);
  let error = $state('');
  let success = $state(false);
  let memberId = $state('');

  async function handleRegister() {
    if (!phone || !name) {
      error = 'Mohon isi semua field';
      return;
    }

    loading = true;
    error = '';

    try {
      const res = await api.post('/members/register', {
        phone,
        name,
        registered_via: 'qr_link',
      });

      if (res.ok) {
        const data = await res.json();
        success = true;
        memberId = data.data.id;
      } else {
        const data = await res.json();
        error = data.message || 'Gagal mendaftar';
      }
    } catch (e) {
      error = 'Terjadi kesalahan. Silakan coba lagi.';
    } finally {
      loading = false;
    }
  }
</script>

<div class="min-h-screen bg-gradient-to-b from-blue-50 to-white py-12 px-4">
  <div class="mx-auto max-w-md">
    <!-- Header -->
    <div class="mb-8 text-center">
      <h1 class="text-2xl font-bold text-slate-800">Daftar Member Ngemiloh</h1>
      <p class="mt-2 text-slate-600">
        Scan QR Code di struk atau datang ke kasir untuk mendaftar
      </p>
    </div>

    {#if success}
    <!-- Success State -->
    <div class="rounded-2xl bg-white p-8 shadow-lg">
      <div class="text-center">
        <div class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg class="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 class="text-xl font-bold text-slate-800">Pendaftaran Berhasil!</h2>
        <p class="mt-2 text-slate-600">Selamat datang, {name}!</p>
      </div>

      <div class="mt-6 rounded-lg bg-slate-50 p-4">
        <p class="text-sm text-slate-500">ID Member Anda:</p>
        <p class="font-mono text-lg font-bold text-blue-600">{memberId}</p>
      </div>

      <p class="mt-4 text-center text-sm text-slate-500">
        Tunjukkan ID member ini saat下次 belanja untuk mendapat poin!
      </p>

      <a
        href="/pos"
        class="mt-6 block w-full rounded-lg bg-blue-600 py-3 text-center font-medium text-white hover:bg-blue-700"
      >
        Mulai Belanja
      </a>
    </div>

    {:else}
    <!-- Registration Form -->
    <div class="rounded-2xl bg-white p-8 shadow-lg">
      <form onsubmit={(e) => { e.preventDefault(); handleRegister(); }}>
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-slate-700">
              Nomor HP
            </label>
            <input
              type="tel"
              bind:value={phone}
              placeholder="08xxxxxxxxxx"
              class="mt-1 w-full rounded-lg border border-slate-300 px-4 py-3"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-slate-700">
              Nama
            </label>
            <input
              type="text"
              bind:value={name}
              placeholder="Nama lengkap"
              class="mt-1 w-full rounded-lg border border-slate-300 px-4 py-3"
            />
          </div>
        </div>

        {#if error}
        <p class="mt-4 text-sm text-red-600">{error}</p>
        {/if}

        <button
          type="submit"
          disabled={loading}
          class="mt-6 w-full rounded-lg bg-blue-600 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Mendaftar...' : 'Daftar Sekarang'}
        </button>
      </form>
    </div>
    {/if}
  </div>
</div>
```

### POS Integration

**File:** `frontend/src/routes/pos/+page.svelte`

```svelte
<!-- Tambahkan field untuk scan member -->
<div class="flex items-center gap-2">
  <input
    type="text"
    bind:value={memberPhone}
    placeholder="Scan/Input No. HP Member"
    class="flex-1 rounded-lg border px-3 py-2"
  />
  <button
    onclick={lookupMember}
    class="rounded-lg bg-blue-100 px-4 py-2 text-sm text-blue-700"
  >
    Cek
  </button>
</div>

{#if activeMember}
<div class="mt-2 rounded-lg bg-green-50 p-2 text-sm">
  <p class="font-medium text-green-800">
    {activeMember.name}
  </p>
  <p class="text-green-600">
    Tier: {activeMember.tier} | Points: {activeMember.points}
  </p>
</div>
{/if}
```

### Acceptance Criteria
- [ ] `/register` page untuk QR scan registration
- [ ] Form validation (phone format, name required)
- [ ] Success state dengan member ID
- [ ] POS integration untuk lookup member
- [ ] Display tier dan points di POS

---

## 3.3 Loyalty Tier System

### Description
Implement rolling loyalty tier system based on transaction frequency.

### Business Rules (From Interview Q56-Q67)

| Tier | Transactions | Discount | Grace Period |
|------|--------------|----------|--------------|
| Bronze | 1-25 | 5% | - |
| Silver | 26-75 | 10% | 1 bulan sebelum demotion |
| Gold | 76+ | 15% | 1 bulan sebelum demotion |

### Tier Period
- **Rolling 2 months** from join date
- After 2 months, counter resets and tier recalculated
- **Grace period 1 month** before tier downgrade

### Implementation

```typescript
// backend/src/members/application/services/loyalty.service.ts

interface TierInfo {
  tier_name: 'bronze' | 'silver' | 'gold';
  discount_percent: number;
  points_earned: number;
  next_tier?: {
    name: string;
    transactions_needed: number;
  };
}

async function calculateTier(customerId: string): Promise<TierInfo> {
  const customer = await this.prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      transactions: {
        where: {
          created_at: {
            gte: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000), // 2 months
          },
        },
      },
    },
  });

  const transactionCount = customer.transactions.length;

  let tier: TierInfo;

  if (transactionCount >= 76) {
    tier = {
      tier_name: 'gold',
      discount_percent: 15,
      points_earned: Math.floor(transactionCount / 1000),
      next_tier: undefined, // Max tier
    };
  } else if (transactionCount >= 26) {
    tier = {
      tier_name: 'silver',
      discount_percent: 10,
      points_earned: Math.floor(transactionCount / 1000),
      next_tier: {
        name: 'gold',
        transactions_needed: 76 - transactionCount,
      },
    };
  } else {
    tier = {
      tier_name: 'bronze',
      discount_percent: 5,
      points_earned: Math.floor(transactionCount / 1000),
      next_tier: {
        name: 'silver',
        transactions_needed: 26 - transactionCount,
      },
    };
  }

  return tier;
}

// Apply discount on order
async function applyMemberDiscount(orderId: string, customerId: string) {
  const tierInfo = await calculateTier(customerId);

  const order = await this.prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  // Discount hanya pada base_price, bukan modifier
  let discountTotal = 0;

  for (const item of order.items) {
    const discount = Math.floor(item.base_price * tierInfo.discount_percent / 100);
    discountTotal += discount * item.quantity;
  }

  // Update order dengan discount
  await this.prisma.order.update({
    where: { id: orderId },
    data: {
      discount_total: { increment: discountTotal },
    },
  });

  return { discount_total: discountTotal, tier: tierInfo.tier_name };
}
```

### Acceptance Criteria
- [ ] Tier calculation based on rolling 2-month period
- [ ] Discount applied automatically on POS
- [ ] Grace period before tier downgrade
- [ ] Points calculation (1 point per Rp 1000)

---

## 3.4 Multi-Outlet Architecture

### Description
Prepare architecture for multi-outlet expansion.

### Database Schema

```prisma
// NEW MODELS

model Outlet {
  id          String   @id @default(uuid())
  name        String   @db.VarChar(100)
  address     String?  @db.Text
  phone       String?  @db.VarChar(20)
  is_active   Boolean  @default(true) @map("is_active")
  created_at  DateTime @default(now()) @db.Timestamptz
  updated_at  DateTime @updatedAt @db.Timestamptz

  users       UserOutlet[]
  cashRegisters CashRegister[]

  @@map("outlets")
}

model UserOutlet {
  id        String   @id @default(uuid())
  user_id   String   @map("user_id")
  outlet_id String   @map("outlet_id")
  assigned_at DateTime @default(now()) @map("assigned_at")
  is_primary Boolean  @default(false) @map("is_primary")

  user      User    @relation(fields: [user_id], references: [id])
  outlet    Outlet  @relation(fields: [outlet_id], references: [id])

  @@unique([user_id, outlet_id])
  @@map("user_outlets")
}
```

### Backend Changes

```typescript
// Kasir check-in saat mulai shift
async startShift(dto: StartShiftDto) {
  // Validasi kasir assigned ke outlet
  const assignment = await this.prisma.userOutlet.findFirst({
    where: {
      user_id: dto.cashier_id,
      outlet_id: dto.outlet_id,
    },
    include: { outlet: true },
  });

  if (!assignment) {
    throw new BadRequestException(
      'Kasir tidak ditugaskan di outlet ini'
    );
  }

  // Buat shift dengan outlet_id
  return this.prisma.cashRegister.create({
    data: {
      cashier_id: dto.cashier_id,
      outlet_id: dto.outlet_id,
      opening_balance: dto.opening_balance,
      shift_start: new Date(),
      status: 'open',
    },
  });
}
```

### Frontend Changes

**POS Login Flow:**
```svelte
//Setelah login, pilih outlet
{#if !selectedOutlet}
  <div class="p-4">
    <h2 class="text-lg font-bold mb-4">Pilih Outlet</h2>
    {#each assignedOutlets as outlet}
      <button
        onclick={() => selectOutlet(outlet)}
        class="w-full rounded-lg border p-4 mb-2 text-left"
      >
        <p class="font-medium">{outlet.name}</p>
        <p class="text-sm text-slate-500">{outlet.address}</p>
      </button>
    {/each}
  </div>
{:else}
  <!-- POS Interface -->
{/if}
```

### Acceptance Criteria
- [ ] Outlet model created
- [ ] UserOutlet assignment model
- [ ] Kasir check-in ke outlet
- [ ] Outlet filter di dashboard
- [ ] Laporan per outlet

---

# Non-Functional Requirements

## Performance

| Metric | Target |
|--------|--------|
| POS load time | < 2 seconds |
| Payment processing | < 3 seconds |
| Receipt print | < 5 seconds |
| API response (p95) | < 200ms |
| Offline sync | < 60 seconds for 100 orders |

## Security

| Requirement | Implementation |
|-------------|----------------|
| JWT Access Token | 12h for kasir, 12h for admin | Generated automatically on login, not manually provided |
| PIN Hashing | bcrypt 12 rounds + pepper |
| Rate Limiting | 20 req/min per user |
| CSRF Protection | Enabled |
| Input Validation | class-validator DTOs |
| SQL Injection | Prisma ORM parameterized queries |
| XSS Prevention | Helmet.js + sanitization |

## Reliability

| Requirement | Implementation |
|-------------|----------------|
| Offline Mode | Dexie.js IndexedDB |
| Sync Strategy | Chunking 10 orders per batch |
| Max Offline Queue | 100 transactions |
| Health Check | /_health endpoint |
| Graceful Degradation | Partial functionality offline |

## Scalability

| Component | Current | Target |
|-----------|---------|--------|
| Database | Single instance | Ready for replication |
| API | Single instance | Ready for horizontal scaling |
| Cache | Redis single | Ready for cluster |
| Sessions | JWT stateless | Redis for admin |

---

# Database Schema Changes

## Phase 1 - No schema changes (audit fixes only)

## Phase 2 - No new tables

## Phase 3 - New Models

### Migration Script

```sql
-- Create loyalty_tiers table
CREATE TABLE loyalty_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(50) NOT NULL,
  min_transactions INT NOT NULL,
  max_transactions INT,
  discount_percent INT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create customers table (rename from Customer)
ALTER TABLE customer RENAME TO customers;

-- Add tier relationship
ALTER TABLE customers
  ADD COLUMN current_tier_id UUID REFERENCES loyalty_tiers(id),
  ADD COLUMN transaction_count INT DEFAULT 0,
  ADD COLUMN tier_period_start TIMESTAMPTZ,
  ADD COLUMN tier_period_end TIMESTAMPTZ,
  ADD COLUMN updated_at TIMESTAMPTZ DEFAULT now();

-- Create member_transactions table
CREATE TABLE member_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES customers(id),
  order_id UUID REFERENCES orders(id),
  points_earned INT DEFAULT 0,
  points_redeemed INT DEFAULT 0,
  tier_at_time VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create outlets table
CREATE TABLE outlets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  address TEXT,
  phone VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create user_outlets junction table
CREATE TABLE user_outlets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  outlet_id UUID NOT NULL REFERENCES outlets(id),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  is_primary BOOLEAN DEFAULT false,
  UNIQUE(user_id, outlet_id)
);

-- Add outlet_id to cash_register
ALTER TABLE cash_register
  ADD COLUMN outlet_id UUID REFERENCES outlets(id);

-- Seed default tiers
INSERT INTO loyalty_tiers (name, min_transactions, max_transactions, discount_percent) VALUES
  ('bronze', 1, 25, 5),
  ('silver', 26, 75, 10),
  ('gold', 76, NULL, 15);
```

---

# API Contracts

## Phase 1 - No new endpoints

## Phase 2 - No new endpoints

## Phase 3 - New Endpoints

### POST /api/v1/members/register

**Request:**
```json
{
  "phone": "081234567890",
  "name": "Budi Santoso",
  "registered_via": "qr_link"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "phone": "081234567890",
    "name": "Budi Santoso",
    "tier": "bronze",
    "discount_percent": 5,
    "created_at": "2026-06-20T00:00:00Z"
  }
}
```

### GET /api/v1/members/lookup

**Query:** `?phone=081234567890`

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "phone": "081234567890",
    "name": "Budi Santoso",
    "tier": {
      "name": "silver",
      "discount_percent": 10
    },
    "transaction_count": 45,
    "points": 125000,
    "tier_period_end": "2026-08-20T00:00:00Z",
    "next_tier": {
      "name": "gold",
      "transactions_needed": 31
    }
  }
}
```

### PATCH /api/v1/members/:id/points

**Request:**
```json
{
  "action": "earn", // or "redeem"
  "points": 5000,
  "order_id": "uuid" // optional
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "customer_id": "uuid",
    "action": "earn",
    "points": 5000,
    "new_balance": 130000
  }
}
```

---

# Testing Requirements

## Unit Tests

| Module | Coverage Target | Priority |
|--------|----------------|----------|
| Auth Service | 90% | HIGH |
| Orders Service | 85% | HIGH |
| Finance Service | 80% | HIGH |
| Members Service | 85% | HIGH |
| Loyalty Service | 85% | HIGH |

## Integration Tests

| Scenario | Description |
|----------|-------------|
| E2E Order Flow | Kasir login → Add to cart → Pay → Receipt |
| Member Registration | QR scan → Register → Apply discount |
| Shift Flow | Open → Transactions → Close |
| Offline Sync | Offline order → Online sync → Verify |

## Performance Tests

| Test | Target |
|------|--------|
| Load Test | 50 concurrent users |
| Stress Test | 100 concurrent users |
| Endurance Test | 4 hours continuous |

---

# Deployment Checklist

## Pre-Deployment

- [ ] All Phase 1 fixes implemented
- [ ] All Phase 1 tests passing
- [ ] Code review approved
- [ ] Security scan clean
- [ ] Database migration ready

## Post-Deployment

- [ ] Health check passing
- [ ] Smoke tests passing
- [ ] Performance baseline verified
- [ ] Monitoring active
- [ ] Backup verified

---

# Timeline & Milestones

## Phase 1: Critical Audit Fixes
**Duration:** 1-2 days
**Target:** 2026-06-22

| Task | Status |
|------|--------|
| KRITIS-01: CI/CD path | Pending |
| KRITIS-02: VITE_API_URL | Pending |
| KRITIS-03: Auto-Close boundary | Pending |
| KRITIS-04: Logout clear token | Pending |
| TINGGI-01: Admin auth guard | Pending |
| TINGGI-02: Sidebar link fix | Pending |
| TINGGI-03: Swagger docs | Pending |
| TINGGI-04: Store tests | Pending |
| TINGGI-05: Email warning | Pending |
| TINGGI-06: KPI shift filter | Pending |

## Phase 2: Enhance Existing
**Duration:** 2-3 days
**Target:** 2026-06-25

| Task | Status |
|------|--------|
| Waste Tracking UI | Pending |
| BOM Recipes UI | Pending |
| Dexie Discount Cache | Pending |
| Profit Share HPP Display | Pending |

## Phase 3: Build New Features
**Duration:** 5-7 days
**Target:** 2026-07-02

| Task | Status |
|------|--------|
| Members Module Backend | Pending |
| Members Registration UI | Pending |
| Loyalty Tier System | Pending |
| Multi-Outlet Architecture | Pending |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 8.0 | 2026-06-20 | Senior Engineering | Initial draft |

---

*Document ini adalah acuan utama untuk pengembangan NGEMILOH POS*
