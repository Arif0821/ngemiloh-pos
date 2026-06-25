# PRD SPEC v8.1 - NGEMILOH POS
**Product Requirements & Specification Document**

| Metadata | Value |
|----------|-------|
| Version | 8.1 |
| Date | 2026-06-25 |
| Status | ACTIVE - Development |
| Owner | Tim Engineering |

---

## 1. Executive Summary

### 1.1 Overview

**NGEMILOH POS** adalah sistem Point of Sale lengkap untuk franchise snack/makanan ringan. Sistem ini dirancang untuk mendukung operasi multi-outlet dengan model kasir freelance dan sistem loyalty member.

### 1.2 Target Users

| User Type | Description | Access Level |
|-----------|-------------|--------------|
| **Kasir (Cashier)** | Staff freelance yang beroperasi di outlet | POS only, shift management |
| **Admin** | Pemilik/pengelola franchise | Full dashboard, reports, user management |
| **Member** | Pelanggan tetap dengan loyalty points | Registration, point tracking |

### 1.3 Key Value Propositions

| # | Value Proposition | Impact |
|---|-----------------|--------|
| 1 | Offline-first operation | Operasi tetap jalan saat internet down |
| 2 | QRIS payment integration | Pembayaran cashless via Midtrans |
| 3 | Member loyalty system | Retensi pelanggan via points & tiers |
| 4 | Multi-outlet support | 1 sistem, banyak cabang |
| 5 | Profit share automation | Perhitungan bagi hasil otomatis |

### 1.4 Success Metrics

| Metric | Target |
|--------|--------|
| POS load time | < 2 detik |
| Payment processing | < 3 detik |
| Receipt print | < 5 detik |
| API response (p95) | < 200ms |
| Offline sync | < 60 detik / 100 orders |

---

## 2. Business Model

### 2.1 Franchise Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    NGEMILOH FRANCHISE                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│    NGEMILOH HQ (Owner)                                       │
│        │                                                      │
│        │ Supply Raw Materials                                 │
│        ▼                                                      │
│    ┌────┴────┐    ┌────┴────┐    ┌────┴────┐                │
│    │ Outlet A│    │ Outlet B│    │ Outlet C│                │
│    │ Kasir 1 │    │ Kasir 2 │    │ Kasir 3 │                │
│    └─────────┘    └─────────┘    └─────────┘                │
│                                                              │
│    • Kasir dapat shift di multiple outlets                   │
│    • Profit share dihitung berdasarkan total penjualan        │
│    • HPP dihitung dari BOM (Bill of Materials)               │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 User Roles

| Role | Authentication | Access Scope |
|------|----------------|--------------|
| **Superadmin** | Email + Password + 6-digit OTP | Full dashboard, all outlets |
| **Kasir** | Username (dari admin) + 4-6 digit PIN | POS only, assigned outlets |

### 2.3 Profit Share Formula

```
┌─────────────────────────────────────────────────────────────────┐
│                     PROFIT CALCULATION                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Gross Revenue  = Total Penjualan (gross, including PPN)       │
│  PPN            = Gross Revenue × 11%                          │
│  Net Revenue    = Gross Revenue - PPN                          │
│                                                                  │
│  HPP            = Total Biaya Pokok (from BOM)                 │
│  Opex           = Biaya Operasional                            │
│  Depreciation   = Total Depresiasi Aset                        │
│                                                                  │
│  Net Profit     = Net Revenue - HPP - Opex - Depreciation      │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                     PROFIT DISTRIBUTION                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Owner Share    = Net Profit × 60%                             │
│  Kasir Pool     = Net Profit × 40%                             │
│                                                                  │
│  Per Kasir      = Kasir Pool × (Kasir Sales / Total Sales)    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4 Business Constants

| Constant | Value | Description |
|----------|-------|-------------|
| `TAX_RATE` | 11% | PPN (Pajak Pertambahan Nilai) |
| `OWNER_SHARE` | 60% | Owner's portion of net profit |
| `KASIR_POOL` | 40% | Kasir pool portion |
| `MIN_QRIS_AMOUNT` | Rp 1,000 | Minimum QRIS transaction |
| `DEFAULT_OPENING_BALANCE` | Rp 500,000 | Default cash drawer |
| `CASH_DISCREPANCY_THRESHOLD` | Rp 5,000 | Max allowed cash variance |
| `DAILY_REVENUE_TARGET` | Rp 5,000,000 | Target per outlet per day |

---

## 3. Loyalty Program

### 3.1 Tier Structure

| Tier | Min Points | Discount | Grace Period | Points Rate |
|------|------------|----------|-------------|-------------|
| **Bronze** | 0 | 0% | - | 5 per Rp 1,000 |
| **Silver** | 500 | 5% | 1 bulan | 5 per Rp 1,000 |
| **Gold** | 1,500 | 10% | 1 bulan | 5 per Rp 1,000 |
| **Platinum** | 5,000 | 15% | 1 bulan | 5 per Rp 1,000 |

### 3.2 Tier Rules

1. **Points Earning**: Points dihitung dari subtotal (setelah diskon, sebelum PPN)
2. **Tier Upgrade**: Otomatis naik tier saat points mencapai threshold
3. **Tier Downgrade**: Turun tier jika points di bawah threshold + grace period expired
4. **Discount Application**: Tier discount叠加 dengan product discounts

### 3.3 Points Calculation

```
Points Earned = floor(Subtotal / 1000) × Points Rate

Example:
- Transaction: Rp 45,000 (after product discount)
- Points Earned = floor(45000 / 1000) × 5 = 45 × 5 = 225 points
```

---

## 4. Feature Requirements

### 4.1 Core POS Features

| Feature | Priority | Description |
|---------|----------|-------------|
| Product Catalog | MUST | Display products with categories and modifiers |
| Shopping Cart | MUST | Add/remove items, adjust quantities |
| Discount Calculation | MUST | Apply product/category/global discounts |
| Cash Payment | MUST | Accept cash with change calculation |
| QRIS Payment | MUST | Midtrans integration for cashless |
| Split Payment | MUST | Combine cash + QRIS in one transaction |
| Receipt Generation | MUST | HTML thermal printer format |
| Void Order | MUST | Cancel order with mandatory reason |
| Price Verification | SHOULD | Delta threshold check for price changes |
| Offline Mode | MUST | Continue operations when internet is down |

### 4.2 Member & Loyalty Features

| Feature | Priority | Description |
|---------|----------|-------------|
| Member Registration | MUST | QR code + phone number registration |
| Member Lookup | MUST | Find member by phone or member code |
| Points Earning | MUST | Add points on transaction completion |
| Points Redemption | MUST | Use points as payment at POS |
| Tier Display | MUST | Show current tier and progress |
| Tier Discount | MUST | Apply automatic tier discount |

### 4.3 Inventory & BOM Features

| Feature | Priority | Description |
|---------|----------|-------------|
| Raw Material CRUD | MUST | Manage ingredient inventory |
| Stock Tracking | MUST | Real-time stock updates on sale |
| Stock Opname | SHOULD | Periodic physical count adjustment |
| BOM Recipes | MUST | Link raw materials to products |
| HPP Calculation | MUST | Auto-calculate cost per product |
| Waste Tracking | SHOULD | Record spoiled/damaged inventory |
| Low Stock Alert | SHOULD | Notify when stock below threshold |

### 4.4 Finance & Reporting Features

| Feature | Priority | Description |
|---------|----------|-------------|
| Shift Management | MUST | Open/close shift with balance |
| Cash Reconciliation | MUST | Compare expected vs actual cash |
| Operational Expenses | MUST | Track opex per outlet/period |
| Asset Depreciation | SHOULD | Straight-line depreciation |
| Profit Share Report | MUST | Calculate owner/kasir split |
| CSV Export | MUST | Export transactions and reports |
| Daily Revenue | MUST | Filter by shift date |

### 4.5 Admin & Security Features

| Feature | Priority | Description |
|---------|----------|-------------|
| JWT Authentication | MUST | Secure token-based auth |
| PIN Authentication | MUST | 4-6 digit PIN for kasir |
| OTP Authentication | MUST | 6-digit OTP for admin |
| Rate Limiting | MUST | Prevent brute force attacks |
| Audit Logging | MUST | Immutable action logs |
| Feature Flags | SHOULD | Toggle features without redeploy |
| System Health | SHOULD | Monitor DB, Redis, payment gateway |

### 4.6 Multi-Outlet Features

| Feature | Priority | Description |
|---------|----------|-------------|
| Outlet Management | MUST | Create/edit outlet data |
| User-Outlet Assignment | MUST | Assign kasir to outlets |
| Outlet Selection | MUST | Choose outlet at POS login |
| Report Filtering | MUST | Filter by outlet |

---

## 5. Data Model

### 5.1 Entity Relationship Diagram (High-Level)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CORE ENTITIES                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│    ┌─────────┐         ┌─────────────┐                                  │
│    │  User   │────────<│  UserOutlet  │>────────┐                       │
│    │ (Kasir) │         └─────────────┘          │                       │
│    └────┬────┘                                 ▼                       │
│         │                               ┌──────────┐                     │
│         │         ┌─────────────┐       │  Outlet  │                     │
│         │         │CashRegister │──────┤(Cabang)  │                     │
│         │         └─────────────┘       └──────────┘                     │
│         │                                                                 │
│         │ creates                                                      │
│         ▼                                                              │
│    ┌─────────────┐         ┌─────────────┐                            │
│    │   Order     │────────<│  OrderItem   │                            │
│    │ (Transaksi) │         └─────────────┘                            │
│    └──────┬──────┘                                                     │
│           │                                                             │
│           ├─────── OrderItemModifier                                    │
│           ├─────── OrderRefund                                          │
│           ├─────── StockMovement                                        │
│           └─────── MemberTransaction                                    │
│                        ▲                                               │
│                        │                                               │
│    ┌─────────┐         │                                               │
│    │ Member  │─────────┘                                               │
│    │(Pelanggan)│                                                       │
│    └────┬────┘                                                         │
│         │                                                               │
│         └───────── LoyaltyTier                                          │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                        FINANCE ENTITIES                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│    ┌─────────────────┐    ┌──────────────────┐                         │
│    │OperationalExpense│   │      Asset       │                         │
│    └─────────────────┘    └──────────────────┘                         │
│                                                                          │
│    ┌─────────────────┐    ┌──────────────────┐                         │
│    │ ProfitShareLog  │───>│ProfitShareDetail │                         │
│    └─────────────────┘    └──────────────────┘                         │
│                                                                          │
├─────────────────────────────────────────────────────────────────────────┤
│                      INVENTORY ENTITIES                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│    ┌───────────────┐    ┌─────────────┐    ┌─────────────┐            │
│    │ RawMaterial   │───>│BomRecipe    │<───│  Product    │            │
│    └───────────────┘    └─────────────┘    └─────────────┘            │
│          │                                            │                   │
│          │               ┌─────────────┐              │                   │
│          └──────────────>│StockMovement│<─────────────┘                   │
│                          └─────────────┘                                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Core Entities

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| **User** | Kasir dan admin | username, pin_hash, role, outlet_assignments |
| **Outlet** | Branch/cabang | name, address, phone, is_active |
| **UserOutlet** | Assignment kasir-outlet | user_id, outlet_id |
| **CashRegister** | Shift kasir | user_id, outlet_id, opening_balance, status |
| **Order** | Header transaksi | order_number, total, status, payment_method |
| **OrderItem** | Item dalam transaksi | product_id, quantity, unit_price |
| **OrderItemModifier** | Modifier per item | modifier_option_id, price |
| **OrderRefund** | Data refund/void | original_order_id, reason, method |
| **Customer** | Non-member checkout | name (optional), is_anonymous |
| **Member** | Loyalty member | phone, code, points, tier_id |
| **LoyaltyTier** | Tier definitions | name, min_points, discount_rate |

### 5.3 Inventory Entities

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| **Product** | Produk dengan harga | name, price, category_id, image_url |
| **Category** | Kategori produk | name, sort_order |
| **ProductModifierGroup** | Grup modifier | name, is_required |
| **ProductModifierOption** | Opsi modifier | name, price_adjustment |
| **RawMaterial** | Bahan baku | name, unit, current_stock |
| **BomRecipe** | Resep HPP | product_id, materials[], quantities[] |
| **StockMovement** | Gerakan stok | type, quantity, reference |

### 5.4 Finance Entities

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| **OperationalExpense** | Biaya operasional | category, amount, date |
| **Asset** | Aset dengan depresiasi | name, purchase_price, useful_life |
| **ProfitShareLog** | Log bagi hasil | period, total_profit, owner_share |
| **ProfitShareDetail** | Detail bagi hasil | kasir_id, sales_amount, share_amount |

### 5.5 System Entities

| Entity | Description | Key Attributes |
|--------|-------------|----------------|
| **Discount** | Diskon/promo | type, scope, value, conditions |
| **FeatureFlag** | Feature toggles | key, is_enabled |
| **Setting** | Pengaturan toko | key, value |
| **AuditLog** | Log audit immutable | action, actor, details |
| **IpLockout** | Login lockout | ip_address, ua_hash, expires_at |

### 5.6 Enum Types

```typescript
// User Roles
enum Role {
  kasir       // Kasir freelance
  superadmin  // Administrator
}

// Discount Types
enum DiscountType {
  percentage   // Diskon %
  fixed_amount // Diskon nominal
}

enum DiscountScope {
  all_products     // Semua produk
  category         // Per kategori
  specific_product // Produk tertentu
}

// Payment
enum PaymentMethod {
  cash   // Tunai
  qris   // QRIS Midtrans
  split  // Gabungan cash + QRIS
}

// Order State
enum OrderStatus {
  completed    // Selesai
  voided      // Dibatalkan
  pending_sync // Menunggu sync (offline)
}

enum RegisterStatus {
  open   // Shift terbuka
  closed // Shift ditutup
}

// Inventory
enum StockMovementType {
  in          // Masuk
  out         // Keluar (sale)
  adjustment  // Penyesuaian
  waste       // Sisa/rusak
}

// Refund
enum RefundMethod {
  cash
  transfer
  original_payment
  manual_cash
  store_credit
}
```

---

## 6. Non-Functional Requirements

### 6.1 Performance

| Metric | Target | Measurement |
|--------|--------|-------------|
| POS page load | < 2 detik | First contentful paint |
| Payment processing | < 3 detik | End-to-end QRIS |
| Receipt print | < 5 detik | Thermal printer output |
| API response (p95) | < 200ms | Backend endpoints |
| Offline sync | < 60 detik / 100 orders | Batch sync completion |

### 6.2 Security

| Requirement | Implementation |
|-------------|----------------|
| Authentication | JWT (12h admin / 8h kasir) + PIN + OTP |
| Rate Limiting | 5 req/30min for auth, 20 req/min for orders |
| CSRF Protection | Double-submit cookie pattern |
| SQL Injection | Prevented via Prisma ORM |
| XSS Prevention | CSP headers + input sanitization |
| Payment Security | Midtrans signature verification |

### 6.3 Availability

| Scenario | Behavior |
|----------|----------|
| Internet down | Continue POS operations via IndexedDB |
| Redis down | Fallback to database session |
| Payment gateway timeout | Auto-retry 3x, then queue |
| Database connection lost | Graceful error, retry logic |

### 6.4 Scalability

| Aspect | Limit |
|--------|-------|
| Concurrent users | 50+ per instance |
| Orders per day | 1000+ per outlet |
| Products | 500+ per outlet |
| Members | 10,000+ per system |

---

## 7. Constraints & Assumptions

### 7.1 Technical Constraints

| Constraint | Description |
|------------|-------------|
| Browser Support | Chrome, Firefox, Safari (modern versions) |
| Printer | ESC/POS compatible thermal printers |
| Mobile | Responsive, but optimized for tablet (768px+) |
| OS | Windows 11 + Docker Desktop (development) |

### 7.2 Business Assumptions

| Assumption | Validation |
|------------|------------|
| Peak hours: 16:00-20:00 | Average transaction: Rp 30,000-50,000 |
| Weekend traffic | ~30% higher than weekday |
| Shift schedule | Morning (07:00-15:00), Evening (15:00-23:00) |
| Kasir count | 2-3 per outlet |

---

## 8. Out of Scope

The following features are explicitly NOT in scope for v8.x:

| Feature | Reason |
|---------|--------|
| Online food delivery (GoFood/GrabFood) | Integration complexity, separate ordering system needed |
| Table management | No dine-in model |
| Kitchen Display System (KDS) | Not in current business model |
| SMS notifications | WhatsApp preferred by target market |
| Multi-language support | Indonesian only for v8.x |
| Mobile app | Web-based POS only |
| Inventory transfer between outlets | Not in current franchise model |

---

## 9. Glossary

| Term | Definition |
|------|------------|
| **BOM** | Bill of Materials - Recipe linking products to raw materials |
| **HPP** | Harga Pokok Penjualan - Cost of goods sold |
| **QRIS** | QR Indonesian Standard - National QR payment standard |
| **Kasir** | Cashier - Staff operating the POS |
| **Outlet** | Branch - Physical store location |
| **Profit Share** | Revenue split between owner and kasir pool |
| **Shift** | Work period - Opening to closing of cash register |
| **Void** | Order cancellation - With mandatory reason |
| **PPN** | Pajak Pertambahan Nilai - 11% Value Added Tax |

---

## 10. References

| Document | Location | Purpose |
|----------|---------|---------|
| Architecture | `SPEC.md` | System architecture details |
| API Documentation | `PRD_API_CONTRACT.md` | Endpoint specifications |
| Implementation Status | `PRD_STATUS.md` | Issue tracker & progress |
| ADRs | `docs/decisions/` | Architectural decisions |
| Red Team Findings | `PRD_RED_TEAM.md` | Security & risk analysis |
| Deployment Guide | `docs/guides/RUNBOOK.md` | Operations manual |
| Backup Guide | `docs/guides/BACKUP.md` | Backup procedures |

---

## 11. Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 8.1 | 2026-06-25 | Split from monolithic PRD into modular docs | Tim Engineering |
| 8.0 | 2026-06-19 | Initial comprehensive PRD | Tim Engineering |

---

*This document is the specification source of truth for NGEMILOH POS v8.1*
*For implementation details, see linked documents in Section 10*
