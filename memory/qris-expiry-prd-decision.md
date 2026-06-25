---
name: qris-expiry-implementation
description: PRD Section 18 Issue #1 - QRIS Expiry Enforcement IMPLEMENTED
metadata:
  type: project
---

# QRIS Expiry Enforcement - IMPLEMENTATION COMPLETE

## Issue Summary
| Item | Value |
|------|-------|
| Issue # | 1 (Red Team Analysis) |
| Name | QRIS Expiry Never Enforced |
| Severity | **CRITICAL** |
| Impact | Ghost orders, cash reconciliation failure |
| Opsi Terpilih | **OPSI B** |
| Deskripsi Opsi | Cron job untuk void expired QRIS orders |
| **Status** | **✅ IMPLEMENTED** |

## Implementation Details

### Files Modified
| File | Action | Commit |
|------|--------|--------|
| `backend/src/finance/finance.module.ts` | + InventoryModule import | 7c41b95 |
| `backend/src/finance/finance.cron.ts` | + cron methods | 7c41b95, 19da21c |
| `backend/src/finance/finance.cron.spec.ts` | + unit tests | 13c3a41, 3ddbdb8 |

### Feature Flag
- Name: `FEATURE_QRIS_EXPIRY_ENFORCEMENT`
- Default: `false`
- Enable via: `/admin/settings/flags`

### Cron Details
- Interval: Every 5 minutes
- Logic:
  1. Check feature flag (skip if disabled)
  2. Find orders: qris/split, pending_sync, unpaid, qris_expiry_at < now
  3. For each: restore inventory, void order, create audit log
  4. Send email alert + system log

### Rollback Procedure
1. Disable cron job (via feature flag)
2. Manual void jika diperlukan

## Commit History
```
96564bf chore(qris-expiry): final verification complete
3ddbdb8 test(finance): add findMany query parameter verification
13c3a41 test(finance): add unit tests for QRIS expiry cron job
19da21c fix(finance): correct void reason format per spec
7c41b95 feat(finance): implement QRIS expiry cron job (Tasks 1-3)
9c40f1d docs(PRD): update Section 9.1 and 18.1 - mark as done
```

## Related Decisions

### Priority Action Plan (Section 19)
- ~~PHASE 1 DAY 1-2: QRIS Expiry Fix~~ → **DONE**
- Remaining: 19 issues

### Feature Flags Required
| Flag | Purpose | Default | Status |
|------|---------|---------|--------|
| `FEATURE_QRIS_EXPIRY_ENFORCEMENT` | Enable QRIS void cron | `false` | ✅ Done |
| `FEATURE_JWT_REFRESH` | Enable silent token refresh | `false` | ✅ Done (2026-06-25) |
| `FEATURE_VOID_APPROVAL` | Require approval for void | `false` | ❌ |
| `FEATURE_OFFLINE_RECEIPT` | Generate receipt offline | `true` | ❌ |

**Progress: 5/20 issues IMPLEMENTED**

## Source
- PRD: `PRD v2/PRD_NGEMILOH_POS_v8.0_MASTER_INDONESIAN.md`
- Section: 9.1, 18.1, 19.1, 19.2
