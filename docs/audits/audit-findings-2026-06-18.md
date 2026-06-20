# Consolidated Audit Findings - POS Nabil

**Generated:** 2026-06-18
**Total Findings:** 356

---

## P1-CRITICAL Issues (Immediate Action Required)

### 🔒 Security - 10 Issues

| # | File | Line | Issue | OWASP | Fix |
|---|------|------|-------|-------|-----|
| 1 | `receipts.controller.ts` | 16,29,48,62 | **IDOR** - Any user can access any order's receipt | A01 | Add ownership check |
| 2 | `orders.controller.ts` | 194 | **IDOR** - Users can check status of any order | A01 | Add role/cashier_id check |
| 3 | `orders.controller.ts` | 114 | **IDOR** - Kasir can bypass and view other kasir's shift data | A01 | Remove kasir_id param for kasir |
| 4 | `api.client.ts` | 93 | **Token in localStorage** - admin_token vulnerable to XSS | DATA | Use httpOnly cookies |
| 5 | `api.client.ts` | 95 | **Token in localStorage** - access_token vulnerable to XSS | DATA | Use httpOnly cookies |
| 6 | `login/+page.svelte` | 65 | **User data in localStorage** - potential token exposure | DATA | Use httpOnly cookies |
| 7 | `login-admin/+page.svelte` | 46 | **Admin data in localStorage** | DATA | Use httpOnly cookies |
| 8 | `change-pin/+page.svelte` | 15,82 | **Pending PIN data in localStorage** | DATA | Use session only |
| 9 | `verify-otp/+page.svelte` | 56 | **Admin data in localStorage** after OTP | DATA | Use httpOnly cookies |
| 10 | `cashiers/+page.svelte` | 117 | **PIN displayed in plain text** in toast | DATA | Mask PIN, show only last 2 digits |

### ⚡ Performance - 2 Issues (OOM Risk)

| # | File | Line | Issue | Impact | Fix |
|---|------|------|-------|--------|-----|
| 1 | `orders.service.ts` | 1075 | **exportOrdersCsv** - Loads ALL orders without pagination | OOM for large ranges | Add pagination/chunking |
| 2 | `finance.service.ts` | 469 | **getAnalytics** - Loads 10,000+ orders without pagination | OOM for 30-365 days | Use DB aggregations |

---

## P2-HIGH Issues

### 🐛 Bugs - 7 Issues

| # | File | Line | Issue | Type | Fix |
|---|------|------|-------|------|-----|
| 1 | `finance.service.ts` | 337 | Division by zero - lifespanMonths could be 0 | EDGE_CASE | Add zero check |
| 2 | `finance.service.ts` | 367 | Division by zero - parsedLifespan could be 0 | EDGE_CASE | Add zero check |
| 3 | `finance.service.ts` | 54 | Division by zero - dailyRevenueTarget could be 0 | EDGE_CASE | Add zero check |
| 4 | `orders.service.ts` | 381 | Error.message access without type check | ERROR_LOGIC | Safe error handling |
| 5 | `orders.service.ts` | 872 | Error.message access without type check | ERROR_LOGIC | Safe error handling |
| 6 | `orders.service.ts` | 1030 | Error.message access without type check | ERROR_LOGIC | Safe error handling |
| 7 | `printer.service.ts` | 128 | Null check - item.subtotal could be undefined | NULL_CHECK | Add null check |
| 8 | `printer.service.ts` | 121 | Null check - order.client_uuid could be null | NULL_CHECK | Add null check |

### ⚡ Performance - 4 Issues

| # | File | Line | Issue | Impact | Fix |
|---|------|------|-------|--------|-----|
| 1 | `orders.service.ts` | 918 | getShiftSummary loads ALL orders for aggregation | High memory | Use DB aggregation |
| 2 | `finance.service.ts` | 35 | getDashboardKpi loads ALL orders | High memory | Use Prisma _sum |
| 3 | `finance.service.ts` | 109 | getProfitShare loads ALL month orders | High memory | Use DB aggregation |
| 4 | `orders.service.ts` | 489 | syncBatchOrders processes sequentially | Slow | Use Promise.all |

### 🔒 Security - 9 Issues

| # | File | Line | Issue | OWASP | Fix |
|---|------|------|-------|-------|-----|
| 1 | `orders.controller.ts` | 160,176,194,204 | Missing ParseUUIDPipe | A03 | Add validation |
| 2 | `products.controller.ts` | 134,153,162,174,189,200 | Missing ParseUUIDPipe | A03 | Add validation |
| 3 | `inventory.controller.ts` | 91,109 | Missing ParseUUIDPipe | A03 | Add validation |
| 4 | `discounts.controller.ts` | 46,54,68 | Missing ParseUUIDPipe | A03 | Add validation |
| 5 | `finance.controller.ts` | 117 | Missing ParseUUIDPipe | A03 | Add validation |
| 6 | `verify-otp.dto.ts` | 6-9 | OTP DTO expects 8 digits, generates 6 digits | A07 | Fix DTO to 6 |
| 7 | `users.dto.ts` | 20-22 | Weak PIN (4 digits minimum) | A07 | Require 6+ digits |
| 8 | `audit.controller.ts` | 25-29 | Missing UUID validation on query | A03 | Add ParseUUIDPipe |
| 9 | `QrisWaitModal.svelte` | 77 | External QR API without SRI | A05 | Use local library |

### 🧪 Tests - 20 Missing Test Cases

Priority services without tests:
- `InventoryService` - reduceStockForOrder, restoreStockForOrder
- `UsersService` - createCashier, resetCashierPin
- `MidtransGatewayService` - createQris, verifyWebhookSignature
- `AuthService` - OTP rate limiting, lockout, admin login

---

## P3-MEDIUM Issues

### 🐛 Bugs - 12 Issues
- TODO comments in inventory (expiry_date, COGS tracking)
- Missing null checks in orders.service.ts (lines 223, 248)
- Type suppression `as any` in pos.service.ts line 332
- Reactivity issue in ModifierModal (delete on reactive state)
- Async issue in setInterval (unhandled promises)
- Chart.js initialization race condition

### ⚡ Performance - 13 Issues
- 10 missing indexes in Prisma schema
- N+1 query in inventory (findAvailableBatches)
- Unoptimized query in finance (findAssets without select)
- Memory issue in getLowStockMaterials (filter in memory)
- findActiveDiscounts loads ALL discounts without limit

### 🔒 Security - 12 Issues
- Login attempts not logged to audit
- Verbose error messages in non-production
- Public flags endpoint rate limiting
- Broad CIDR ranges for Midtrans webhook
- Error logging exposing sensitive data
- HTTP localhost fallback in dev mode

### 🧪 Tests - 30 Missing Test Cases
- ProductsService, DiscountsService CRUD tests
- FlagsService cache invalidation tests
- ReceiptsService generation tests
- EmailService configuration checks
- AuditService archival tests
- RedisService operations

### 🔄 Refactor - 18 Issues
- Password validation duplicated 3x (auth.service.ts)
- Date utils not used (inline setHours instead)
- Revenue calculation repeated multiple times
- Frontend format_rp not used (inline Intl.NumberFormat)
- Cashier letter lookup duplicated

### 📏 Complexity - 15 Long Functions
- `orders.service.ts:createOrder` - 328 lines
- `orders.service.ts:buildOrderItems` - 105 lines
- `orders.service.ts:handleMidtransWebhook` - 118 lines
- `finance.service.ts:closePeriod` - 160 lines
- `finance.service.ts:getAnalytics` - 93 lines
- `receipts.service.ts:generateReceiptText` - 162 lines
- `auth.service.ts:login` - 128 lines

---

## P4-LOW Issues

### 🔄 Naming - 180 camelCase Violations

Files with most violations:
- `finance.service.ts` - 50+ variables
- `frontend/routes/admin/*.svelte` - 100+ state variables
- `app.controller.ts` - method names
- `audit.interceptor.ts` - variable names

### 🔄 Duplication - 9 Small Duplications
- Date formatting inline (6 lines)
- Revenue calculation pattern (1 line x3)
- Currency formatting inline (4 lines x5)
- Cashier letter lookup (4 lines x2)

### 📏 Complexity - 7 Files
- `orders.service.ts` - 1141 lines total
- `finance.service.ts` - 688 lines total
- `receipts.service.ts` - 395 lines (God Object)
- `auth.service.ts` - 487 lines

---

## Missing Database Indexes

Add to `backend/prisma/schema.prisma`:

```prisma
model OrderRefund {
  // Add indexes:
  @@index([order_id])
  @@index([refunded_by])
}

model OperationalExpense {
  // Add indexes:
  @@index([created_by])
  @@index([category])
  @@index([expense_date])
  @@index([expense_date, category])
}

model ProfitShareLog {
  // Add index:
  @@index([cashier_paid_by])
}

model RawMaterialPriceHistory {
  // Add indexes:
  @@index([raw_material_id])
  @@index([recorded_by])
}
```

---

## Priority Implementation Order

### Phase 1: P1-Critical (Immediate)
1. Fix IDOR vulnerabilities (3 issues)
2. Fix localStorage token exposure (7 issues)
3. Fix PIN displayed in plain text (1 issue)
4. Add pagination to CSV export
5. Add pagination to analytics

### Phase 2: P2-High
1. Fix division by zero (3 issues)
2. Fix error.message access (3 issues)
3. Fix null checks (4 issues)
4. Add ParseUUIDPipe validation (9 endpoints)
5. Fix OTP DTO length mismatch
6. Strengthen PIN requirements
7. Add missing indexes to Prisma schema

### Phase 3: P3-Medium
1. Add comprehensive tests for untested services
2. Use DB aggregations instead of loading all data
3. Fix type suppressions
4. Extract duplicated code
5. Break up long functions

### Phase 4: P4-Low
1. Rename camelCase to snake_case (180 violations)
2. Extract small duplications
3. Split God Object files
