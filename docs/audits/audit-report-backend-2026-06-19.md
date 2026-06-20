# Comprehensive Backend Audit Report
**Tanggal:** 2026-06-19  
**Scope:** Backend Source Code (`backend/src`)  
**Auditor:** Claude Code (Multi-Agent Audit)

---

## Executive Summary

| Kategori | CRITICAL | HIGH | MEDIUM | LOW | INFO | Total |
|----------|----------|------|--------|-----|------|-------|
| Security | 1 | 5 | 8 | 5 | 4 | **23** |
| Code Quality | 0 | 5 | 8 | 7 | 2 | **22** |
| Performance | 0 | 4 | 7 | 4 | 1 | **16** |
| Test Coverage | 0 | 6 | 5 | 2 | 1 | **14** |
| **TOTAL** | **1** | **20** | **28** | **18** | **8** | **75** |

---

## 🔴 CRITICAL Issues

### 1. OTP Verification Bypass in Development Mode
**File:** `auth/presentation/auth.controller.ts:64`  
**Severity:** CRITICAL  
**Description:** Admin OTP verification completely bypassed when `NODE_ENV=development`, allowing direct login without 2FA.

**Impact:** If production accidentally runs with NODE_ENV=development, admin accounts have no 2FA protection.

**Recommendation:**
```typescript
// REMOVE the entire development bypass block
// Testing should use TESTING_OTP_BYPASS=true flag that is NEVER allowed in production
```

---

## 🟠 HIGH Priority Issues

### Security (5 issues)

| # | Issue | File | Line |
|---|-------|------|------|
| S1 | PIN Only 4-6 Digits - Weak Brute-Force | `auth.service.ts` | 51 |
| S2 | Missing UUID Validation on Void Order | `orders.controller.ts` | 169 |
| S3 | OTP Hashing with bcrypt(10) Inconsistent | `auth.service.ts` | 346 |
| S4 | CSRF Cookie Not Protected with httpOnly | `csrf.middleware.ts` | 28 |
| S5 | OTP Request Logs Email Address | `auth.service.ts` | 343 |

### Code Quality (5 issues)

| # | Issue | File | Line |
|---|-------|------|------|
| Q1 | Unsafe `as any` Cast | `prisma-finance.repository.ts` | 107 |
| Q2 | Unused Function validatePasswordRequirements | `auth.service.ts` | 58 |
| Q3 | Duplicate Password Validation Logic | `auth.service.ts` | 117, 243 |
| Q4 | Function Name Not snake_case (escapeCsvField) | `orders.service.ts` | 37 |
| Q5 | Cookie Functions Naming Inconsistency | `cookie.ts` | 17 |

### Performance (4 issues)

| # | Issue | File | Line |
|---|-------|------|------|
| P1 | getShiftSummary In-Memory Aggregation | `orders.service.ts` | 921 |
| P2 | getDashboardKpi Fetches All Orders | `finance.service.ts` | 35 |
| P3 | getAnalytics Loads 10,000 Orders | `finance.service.ts` | 483 |
| P4 | findActiveDiscounts Called Every Order | `orders.service.ts` | 170 |

### Test Coverage (6 issues)

| # | Service | File |
|---|---------|------|
| T1 | FakePaymentGatewayService | `fake-gateway.service.ts` |
| T2 | SyncProcessor | `jobs/processors/sync.processor.ts` |
| T3 | ReceiptsService (IDOR Security) | `receipts/receipts.service.ts` |
| T4 | AuditService | `audit/audit.service.ts` |
| T5 | EmailProcessor | `jobs/processors/email.processor.ts` |
| T6 | FinanceCronService | `finance/finance.cron.ts` |

---

## 🟡 MEDIUM Priority Issues

### Security (8 issues)
1. Floating Point Price Validation Precision Issues (`create-order.dto.ts:47`)
2. Shift Summary Kasir ID Filter UUID Validation (`orders.controller.ts:118`)
3. Error Response Includes Request Path (`http-exception.filter.ts:81`)
4. Midtrans Webhook IP Allowlist Bypass (`orders.controller.ts:242`)
5. OTP Sent in Plaintext Email (`email.service.ts:124`)
6. Customer Name Has No MinLength (`users.dto.ts:42`)
7. RolesGuard Silently Allows Access (`roles.guard.ts:18`)
8. JWT Signing Uses Empty String Fallback (`auth.service.ts:186`)

### Code Quality (8 issues)
1. Nested Loops in Discount Calculation (`orders.service.ts:177`)
2. Large createOrderWithCache Method (`orders.service.ts:556`)
3. Swallowed Error in Inventory Reduction (`orders.service.ts:378`)
4. Implicit Any Type in whereClause (`orders.service.ts:906`)
5. Midtrans Client in Constructor (`orders.service.ts:26`)
6. Complex Analytics Computation (`finance.service.ts:67`)
7. Error Handling Swallows Failures (`email.service.ts:24`)
8. Unused RxJS Imports (`orders.controller.ts:28`)

### Performance (7 issues)
1. findAvailableBatches In-Memory Calculation (`prisma-inventory.repository.ts:126`)
2. Products Endpoint Lacks Caching (`products.service.ts:15`)
3. getLowStockMaterials Filters In-Memory (`inventory.service.ts:46`)
4. openShift Counts All Closed Shifts (`finance.service.ts:581`)
5. Auto-Close Cron Processes Sequentially (`finance.cron.ts:42`)
6. autoCloseShift Fetches All Orders (`finance.cron.ts:93`)
7. Prisma Connection Pool Default Settings (`prisma.service.ts:18`)

### Test Coverage (5 issues)
1. ProductsService Missing Tests (`products.service.ts`)
2. DiscountsService Missing Tests (`discounts.service.ts`)
3. FlagsService Missing Tests (`flags.service.ts`)
4. EmailService Missing Tests (`email.service.ts`)
5. App E2E Tests Minimal (`app.e2e-spec.ts`)

---

## 🟢 LOW Priority Issues

### Security (5 issues)
1. Stack Traces in Non-Production
2. Lockout Alert Email Contains Username
3. Redis Connection Without Password in Dev Mode

### Code Quality (7 issues)
1. Non-Descriptive Variable `vStatus`
2. Single Letter Variable 'o'
3. Unused Method `addLoyaltyPoints`
4. Unsafe Type Casting for Order

### Performance (4 issues)
1. Peak Hours Array Pre-Allocated
2. findOrderByClientUuid Missing Includes
3. SSE Heartbeat Interval 30 Seconds

### Test Coverage (2 issues)
1. FinanceService Coverage Could Expand
2. DiscountCronService Missing Tests

---

## ✅ Best Practices Found

### Security Positives
- ✅ Secrets validation at startup (`validateSecrets()`)
- ✅ Password hashing with bcrypt (cost 12)
- ✅ CSRF middleware implemented
- ✅ Rate limiting with `@nestjs/throttler`
- ✅ JWT with `timingSafeEqual` verification
- ✅ IP lockout mechanism
- ✅ OTP lockout after failed attempts
- ✅ Input validation with class-validator
- ✅ Helmet.js security headers
- ✅ CORS properly restricted
- ✅ Audit logging for critical operations
- ✅ Prisma ORM prevents SQL injection
- ✅ XSS prevention in email alerts
- ✅ Advisory locks for concurrent order numbers

### Code Quality Positives
- ✅ Webhook signature verification excellent
- ✅ Repository pattern clean separation
- ✅ Transaction safety with `$transaction`
- ✅ CSV injection prevention
- ✅ Comprehensive audit trail
- ✅ OrdersService has excellent test coverage

---

## 📋 Recommended Action Plan

### Immediate (Fix Before Next Deploy)

1. **Remove OTP bypass in development mode** (CRITICAL)
2. **Add ParseUUIDPipe to voidOrder endpoint** (HIGH)
3. **Fix escapeCsvField → escape_csv_field** (HIGH)
4. **Remove unused validatePasswordRequirements** (HIGH)
5. **Extract duplicate password validation to helper** (HIGH)
6. **Replace unsafe `as any` cast** (HIGH)
7. **Fix S3-S5 security issues**

### This Sprint

1. **Performance: Database Aggregation**
   - Replace in-memory aggregation with SQL in `getShiftSummary`
   - Replace in-memory aggregation with SQL in `getDashboardKpi`
   - Implement DB-level aggregation for `getAnalytics`

2. **Performance: Caching**
   - Cache `findActiveDiscounts` in Redis (60s TTL)
   - Cache product catalog in Redis (5-minute TTL)

3. **Test Coverage: Critical Services**
   - Add tests for FakePaymentGatewayService
   - Add tests for ReceiptsService (IDOR checks)
   - Add tests for SyncProcessor
   - Add tests for AuditService

### Next Sprint

1. **Code Quality: Refactoring**
   - Break down large methods into smaller units
   - Add proper error handling for swallowed errors
   - Fix type annotations

2. **Performance: Database Optimization**
   - Add proper indexes for aggregation queries
   - Configure Prisma connection pool
   - Implement true FEFO with expiry_date

3. **Test Coverage: Business Services**
   - Add tests for ProductsService
   - Add tests for DiscountsService
   - Expand E2E test coverage

---

## 📊 Coverage Statistics

| Category | Current | Target |
|----------|---------|--------|
| Overall Test Coverage | ~41% | 70% |
| Critical Services Covered | 7 | 13 |
| Services Needing Tests | 10 | 0 |

---

## Generated By
Claude Code Multi-Agent Audit
- Security Auditor
- Code Reviewer
- Performance Auditor
- Test Engineer

**Date:** 2026-06-19
