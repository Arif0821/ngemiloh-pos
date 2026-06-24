# QRIS Expiry Enforcement - Design Document

**Date:** 2026-06-25
**PRD Reference:** Section 18.1 Issue #1
**Opsi:** OPSI B (Cron Job)

---

## 1. Problem Statement

QRIS payment memiliki expiry time (default 15 menit), tapi sistem tidak pernah void orders yang tidak dibayar setelah expiry. Ini menyebabkan:
- Ghost orders (order forever pending)
- Cash reconciliation failure
- Inventory tetap terdeduct padahal tidak ada pembayaran

---

## 2. Solution Overview

Cron job check expired QRIS orders setiap 5 menit, void orders yang tidak dibayar dalam expiry time, restore inventory, dan kirim alert.

---

## 3. Technical Design

### 3.1 Cron Job Location
- **File:** `backend/src/finance/finance.cron.ts`
- **Pattern:** Sama dengan existing `checkAutoCloseShifts()` dan `sendAutoCloseWarnings()`

### 3.2 Logic Flow
```
@Cron('*/5 * * * *')
async checkExpiredQrisOrders() {
  1. Check feature flag FEATURE_QRIS_EXPIRY_ENFORCEMENT
     → Skip if disabled
  
  2. Find orders WHERE:
     - payment_method = 'qris' OR 'split'
     - status = 'pending_sync'
     - payment_status = 'unpaid'
     - qris_expiry_at < NOW()
  
  3. For each expired order:
     a. Restore inventory (call restoreStockForOrder)
     b. Void order (status → 'voided', payment_status → 'expired')
     c. Create audit log (QRIS_EXPIRY_VOID)
     d. Send email alert to admin
     e. Create system log entry
}
```

### 3.3 Feature Flag Check
```typescript
const flag = await this.prisma.featureFlag.findUnique({
  where: { name: 'FEATURE_QRIS_EXPIRY_ENFORCEMENT' }
});
if (!flag?.is_enabled) {
  this.logger.log('QRIS Expiry Enforcement is disabled, skipping...');
  return;
}
```

---

## 4. Decisions Made

| Decision | Value | Rationale |
|----------|-------|-----------|
| Cron Interval | 5 menit | Balanced responsiveness vs performance |
| Alert Destination | Email + System Log | Immediate awareness + audit trail |
| Void Reason Format | Dynamic text | "QRIS expired: no payment received within X minutes" |
| Inventory Restore | Ya | Customer tidak jadi bayar = stock dikembalikan |

---

## 5. Void Reason Format
```
QRIS expired: no payment received within {expiry_minutes} minutes
```

Example: `QRIS expired: no payment received within 15 minutes`

---

## 6. Alert Content

### 6.1 Email
**Subject:** `[NGEMILOH] QRIS Expired - {count} order(s) auto-voided`

**Body:** HTML email dengan:
- Jumlah order yang di-void
- Total amount affected
- List order IDs
- Timestamp

### 6.2 System Log
```typescript
await this.prisma.systemLog.create({
  data: {
    level: 'warn',
    source: 'finance.cron',
    message: `QRIS expiry void: ${count} order(s) auto-voided`,
    metadata: JSON.stringify({
      order_ids: orderIds,
      total_amount: totalAmount,
      expired_at: new Date().toISOString(),
    }),
  },
});
```

---

## 7. Audit Log Action
```typescript
await this.prisma.auditLog.create({
  data: {
    actor_id: null, // System action
    action: 'QRIS_EXPIRY_VOID',
    entity_type: 'Order',
    entity_id: orderId,
    new_value: {
      void_reason: `QRIS expired: no payment received within ${expiryMinutes} minutes`,
      expired_at: new Date().toISOString(),
    },
  },
});
```

---

## 8. Files to Modify

| File | Action | Notes |
|------|--------|-------|
| `backend/src/finance/finance.cron.ts` | Add cron method | ~100 lines |
| `backend/src/finance/finance.module.ts` | Verify imports | Should already have PrismaModule |

---

## 9. Feature Flag

| Flag Name | Default | Description |
|-----------|---------|-------------|
| `FEATURE_QRIS_EXPIRY_ENFORCEMENT` | `false` | Enable QRIS void cron |

---

## 10. Rollback Procedure

1. Disable cron via feature flag (set `FEATURE_QRIS_EXPIRY_ENFORCEMENT` to `false`)
2. Manual void jika diperlukan untuk stuck orders

---

## 11. Related PRD Sections

- Section 9.1: Issue #1 (Critical Fixes)
- Section 18.1: Red Team Analysis Finding #1
- Section 19.1: Feature Flags
- Section 19.2: Rollback Procedures

---

## 12. Timeline

- **Effort:** 2-3 hari
- **Phase:** PHASE 1: STOP THE BLEEDING (DAY 1-2)
