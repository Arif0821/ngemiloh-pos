# PRD STATUS v8.1 - NGEMILOH POS
**Implementation Tracker & Issue Management**

| Metadata | Value |
|----------|-------|
| Version | 8.1 |
| Date | 2026-06-25 |
| Last Updated | 2026-06-25 |
| Overall Progress | 7/20 Issues (35%) |

---

## 1. Quick Summary

### 1.1 Critical Issues Status

| Severity | Total | Done | In Progress | Pending |
|----------|-------|------|-------------|---------|
| **CRITICAL** | 5 | 2 | 0 | 3 |
| **HIGH** | 8 | 2 | 0 | 6 |
| **MEDIUM** | 5 | 3 | 0 | 2 |
| **LOW** | 2 | 0 | 0 | 2 |
| **TOTAL** | **20** | **7** | **0** | **13** |

### 1.2 Implementation Progress

```
[████████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░] 35%
7/20 Issues Implemented

Legend: █ = Done   ░ = Pending   ● = In Progress
```

### 1.3 Issue Distribution by Category

| Category | Issues | Critical | Implemented |
|----------|--------|----------|-------------|
| Authentication | 4 | 1 | 1 |
| Payment | 4 | 2 | 1 |
| Data Protection | 3 | 2 | 1 |
| Infrastructure | 4 | 1 | 1 |
| Race Conditions | 3 | 0 | 1 |
| UX | 2 | 0 | 0 |

---

## 2. Issue Tracker

### 2.1 CRITICAL Issues

| # | Issue | Risk | Solution | Status | Effort | Owner |
|---|-------|------|----------|--------|--------|-------|
| **1** | QRIS Expiry Never Enforced | Ghost orders, cash reconciliation failure | OPSI B (Cron job void expired) | ✅ DONE | 2-3 days | - |
| **8** | BOM Cost Per Unit = 0 | Financial reporting broken | OPSI A (Manual cost input) | ⬜ PENDING | 1 day | Owner |
| **10** | No Backup Configured | Data loss risk | OPSI B (Cron backup) | ✅ DONE | 4 hours | - |
| **11** | Docker Desktop Bind Mount | Data corruption on Windows | OPSI C (Named volume) | ⬜ PENDING | 4 hours | DevOps |
| **18** | Redis Starts Without Password | Unauthorized access | OPSI B (Env check) | ⬜ PENDING | 1 hour | DevOps |

---

### 2.2 HIGH Issues

| # | Issue | Risk | Solution | Status | Effort | Owner |
|---|-------|------|----------|--------|--------|-------|
| **2** | JWT 365 Days for Kasir | Compromised PIN = 1 tahun akses | OPSI B (Silent refresh) | ✅ DONE | 2 days | - |
| **3** | Void Refund Hardcoded | Cash fraud tidak terdeteksi | OPSI A (4-eyes approval) | ⬜ PENDING | 1 day | Backend |
| **5** | Double-Charge Possible | Revenue loss | OPSI A (Idempotency key) | ⬜ PENDING | 1 hour | Backend |
| **6** | Member Registration Unrate-Limited | Data scraping risk | OPSI A (Rate limit) | ✅ DONE | 1 hour | - |
| **9** | Profit Share Uses Created_At | Wrong calculation | OPSI A (Filter by shift) | ⬜ PENDING | 2 hours | Backend |
| **12** | Stock Double-Deduction Race | Inventory inconsistency | OPSI A (Advisory lock) | ⬜ PENDING | 1 hour | Backend |
| **15** | CSRF Protection Broken | XSRF attack risk | OPSI A (Double-submit cookie) | ⬜ PENDING | 1 hour | Backend |
| **16** | Admin Layout Grants Access When Offline | Security bypass | OPSI A (Guard check) | ⬜ PENDING | 1 hour | Frontend |

---

### 2.3 MEDIUM Issues

| # | Issue | Risk | Solution | Status | Effort | Owner |
|---|-------|------|----------|--------|--------|-------|
| **4** | No Offline Order Receipt | Customer dispute risk | OPSI A (Quick fix) | ✅ DONE | 2 hours | Frontend |
| **7** | Redis SPOF | System unavailable when Redis down | OPSI B (Fallback) | ⬜ PENDING | 4 hours | Backend |
| **13** | Multi-Instance Shift Auto-Close Race | Kasir cannot close shift | OPSI A (Lock check) | ⬜ PENDING | 1 hour | Backend |
| **19** | 512MB NestJS Limit + OOM Crash Loop | System instability | OPSI B (Graceful restart) | ⬜ PENDING | 2 hours | DevOps |
| **20** | Webhook Errors Swallowed Silently | Payment reconciliation issues | OPSI A (DLQ) | ⬜ PENDING | 1 hour | Backend |

---

### 2.4 LOW Issues

| # | Issue | Risk | Solution | Status | Effort | Owner |
|---|-------|------|----------|--------|--------|-------|
| **14** | Shift Modal Cannot Be Dismissed | UX frustration | OPSI A (Escape hatch) | ⬜ PENDING | 30 min | Frontend |
| **17** | Tier Downgrade Dead Code | Loyalty points issues | OPSI A (Enable code) | ⬜ PENDING | 1 hour | Backend |

---

## 3. Implemented Issues Detail

### 3.1 #1 - QRIS Expiry Enforcement ✅

| Field | Value |
|-------|-------|
| **Status** | IMPLEMENTED |
| **Completed** | 2026-06-25 |
| **Solution** | Cron job via `finance.cron.ts` |
| **Feature Flag** | `FEATURE_QRIS_EXPIRY_ENFORCEMENT` |
| **Files** | `backend/src/finance/finance.cron.ts` |

**Verification:**
- [x] Cron job created
- [x] Feature flag added
- [x] Void expired orders logic
- [x] Manual void available

---

### 3.2 #2 - JWT Token Reduction ✅

| Field | Value |
|-------|-------|
| **Status** | IMPLEMENTED |
| **Completed** | 2026-06-25 |
| **Solution** | 8h token + silent refresh |
| **Feature Flag** | `FEATURE_JWT_REFRESH` |

**Components:**
- Backend: 8h token + `/api/v1/auth/refresh` endpoint
- Frontend: `auth.store.svelte.ts` with silent refresh

**Verification:**
- [x] Token expiry reduced from 365d to 8h
- [x] Silent refresh implemented
- [x] Feature flag added
- [x] Old tokens invalidated on go-live

---

### 3.3 #6 - Member Rate Limiting ✅

| Field | Value |
|-------|-------|
| **Status** | IMPLEMENTED |
| **Completed** | 2026-06-25 |
| **Solution** | Rate limit middleware |
| **Files** | `backend/src/members/member-rate-limiter.middleware.ts` |

**Limits:**
- Registration: 5 requests / 30 minutes per IP
- Lookup: 20 requests / minute per IP

**Verification:**
- [x] Middleware implemented
- [x] Rate limits configured
- [x] Blocked IPs logged

---

### 3.4 #10 - Backup System ✅

| Field | Value |
|-------|-------|
| **Status** | IMPLEMENTED |
| **Completed** | 2026-06-25 |
| **Solution** | Cron backup via script |
| **Schedule** | Daily at 02:00 (default) |
| **Files** | `scripts/docker/schedule-backup.sh` |

**Verification:**
- [x] Backup script created
- [x] Cron configured
- [x] Restore tested
- [x] Documentation updated

---

### 3.5 # - Void Reason Format ✅

| Field | Value |
|-------|-------|
| **Status** | IMPLEMENTED |
| **Completed** | 2026-06-25 |
| **Rule** | Minimum 10 characters |
| **Constant** | `VOID_REASON_MIN_LENGTH = 10` |

---

### 3.6 #4 - Offline Receipt ✅

| Field | Value |
|-------|-------|
| **Status** | IMPLEMENTED |
| **Completed** | 2026-06-25 |
| **Solution** | IndexedDB + auto-print on reconnect |
| **Files** | `frontend/src/lib/db.ts`, `frontend/src/lib/services/printer.service.ts`, `frontend/src/routes/pos/+page.svelte` |

**Components:**
- IndexedDB schema: `LocalReceipt` interface
- `save_receipt_for_offline()` - stores receipt when offline
- `print_pending_receipts()` - prints when back online
- Auto-print in online handler
- UI badge indicator for pending receipts
- Manual print button for pending receipts

**Verification:**
- [x] Receipt saved to IndexedDB when offline
- [x] Auto-print when back online
- [x] Badge indicator shows pending count
- [x] Manual print button available

---

### 3.7 #13 - Shift Race Fix ✅

| Field | Value |
|-------|-------|
| **Status** | IMPLEMENTED |
| **Completed** | 2026-06-25 |
| **Solution** | PostgreSQL advisory lock + double-check |
| **Files** | `backend/src/finance/application/services/finance.service.ts`, `backend/src/finance/finance.cron.ts` |

**Mechanism:**
- `closeShift()`: Advisory lock with retry + double-check status
- `autoCloseShift()`: Per-shift lock + double-check before close
- Optimistic locking prevents race between manual and auto-close

**Verification:**
- [x] Advisory lock prevents concurrent close
- [x] Double-check after lock acquisition
- [x] Retry with backoff on lock contention

---

## 4. Pending Issues by Phase

### Phase 1: STOP THE BLEEDING

| # | Issue | Priority | Effort | Owner | Status |
|---|-------|----------|--------|-------|--------|
| 8 | BOM Cost Input | CRITICAL | 1 day | Owner | ⬜ |
| 4 | Offline Receipt | MEDIUM | 2 hours | Frontend | ✅ DONE |
| 5 | Idempotency Keys | HIGH | 1 hour | Backend | ⬜ |
| 12 | Stock Race Fix | MEDIUM | 1 hour | Backend | ⬜ |
| 13 | Shift Race Fix | MEDIUM | 1 hour | Backend | ✅ DONE |

---

### Phase 2: STRUCTURAL FIXES

| # | Issue | Priority | Effort | Owner | Status |
|---|-------|----------|--------|-------|--------|
| 15 | CSRF Fix | HIGH | 1 hour | Backend | ⬜ |
| 18 | Redis Password Guard | HIGH | 1 hour | DevOps | ⬜ |
| 7 | Redis Fallback | MEDIUM | 4 hours | Backend | ⬜ |
| 16 | Offline Admin Guard | MEDIUM | 1 hour | Frontend | ⬜ |
| 3 | Void 4-Eyes Approval | HIGH | 1 day | Backend | ⬜ |
| 17 | Tier Downgrade Enable | LOW | 1 hour | Backend | ⬜ |
| 9 | Profit Share Shift | MEDIUM | 2 hours | Backend | ⬜ |
| 20 | Webhook DLQ | MEDIUM | 1 hour | Backend | ⬜ |

---

### Phase 3: OPERATIONAL EXCELLENCE

| # | Issue | Priority | Effort | Owner | Status |
|---|-------|----------|--------|-------|--------|
| 19 | OOM Recovery | MEDIUM | 2 hours | DevOps | ⬜ |
| 11 | Docker Mount Fix | HIGH | 4 hours | DevOps | ⬜ |
| 14 | Shift Modal Escape | LOW | 30 min | Frontend | ⬜ |

---

## 5. Feature Flags Registry

| Flag | Purpose | Default | Implemented | Phase |
|------|---------|---------|-------------|-------|
| `FEATURE_QRIS_EXPIRY_ENFORCEMENT` | Void expired QRIS | `false` | ✅ | 1 |
| `FEATURE_JWT_REFRESH` | Silent token refresh | `false` | ✅ | 2 |
| `FEATURE_VOID_APPROVAL` | Require approval for void | `false` | ⬜ | 2 |
| `FEATURE_OFFLINE_RECEIPT` | Generate receipt offline | `true` | ✅ | 1 |

---

## 6. Go-Live Checklist

### Pre-Launch Requirements

| # | Requirement | Owner | Status | Notes |
|---|-------------|-------|--------|-------|
| 1 | All Phase 1 & 2 fixes implemented | Team | ⬜ | 14/15 pending |
| 2 | BOM cost input completed | Owner | ⬜ | ~50+ products |
| 3 | Backup restore test passed | DevOps | ⬜ | Mandatory |
| 4 | Feature flags tested | QA | ⬜ | Toggle on/off |
| 5 | Rollback procedures documented | DevOps | ⬜ | See below |

---

### Launch Day

| # | Task | Owner | Status |
|---|------|-------|--------|
| 1 | Enable features incrementally | Team | ⬜ |
| 2 | Monitor error rates | DevOps | ⬜ |
| 3 | Watch dashboard for anomalies | Admin | ⬜ |
| 4 | Cash reconciliation verified | Finance | ⬜ |

---

### Post-Launch (Day 1-7)

| # | Task | Frequency | Status |
|---|------|-----------|--------|
| 1 | Daily error log review | Daily | ⬜ |
| 2 | Cash reconciliation verified | Daily | ⬜ |
| 3 | Kasir feedback collected | Day 3, 7 | ⬜ |
| 4 | Performance metrics check | Daily | ⬜ |

---

## 7. Rollback Procedures

| Fix | Rollback Procedure | Time |
|-----|-------------------|------|
| QRIS Expiry | Disable cron job, manual void | 5 min |
| JWT Reduction | Revert to 365d (emergency) | 10 min |
| Void Approval | Disable feature flag | 1 min |
| Backup System | Point-in-time restore | 30 min |
| Docker Mount | Revert to bind mount | 15 min |

---

## 8. Timeline Estimate

```
Week 1: Phase 1 - STOP THE BLEEDING
├── Day 1-2: MUST-DO (CRITICAL)
│   ├── #10 Backup       ✅ DONE
│   ├── #1 QRIS Expiry  ✅ DONE
│   ├── #6 Rate Limit   ✅ DONE
│   └── #8 BOM Cost     ⬜ (Owner input)
├── Day 3-4: QUICK WINS
│   ├── #4 Offline Receipt
│   ├── #5 Idempotency
│   ├── #12 Stock Race
│   └── #13 Shift Race
└── Day 5-7: TESTING
    ├── Full regression
    ├── Backup restore test
    └── Load test

Week 2-3: Phase 2 - STRUCTURAL FIXES
├── Day 8-10: SECURITY
│   ├── #15 CSRF
│   ├── #18 Redis Password
│   ├── #7 Redis Fallback
│   └── #16 Offline Admin
├── Day 11-13: FRAUD PREVENTION
│   ├── #3 Void Approval
│   ├── #17 Tier Downgrade
│   ├── #9 Profit Share
│   └── #20 Webhook DLQ
└── Day 14: REVIEW

Week 4-6: Phase 3 - OPERATIONAL EXCELLENCE
├── Day 15-20: MONITORING
├── Day 21-25: UX IMPROVEMENTS
└── Day 26-30: VALIDATION

TOTAL: ~6 weeks (1 engineer)
```

---

## 9. Dependencies

### Issue Dependencies

| Issue | Depends On | Blocked By |
|-------|------------|------------|
| #7 Redis Fallback | - | #18 Redis Password |
| #4 Offline Receipt | - | - |
| #5 Idempotency | - | - |
| #3 Void Approval | - | - |

### External Dependencies

| Task | Dependency | Owner |
|------|------------|-------|
| #8 BOM Cost Input | Manual data entry | Owner |
| #10 Backup | Cron configuration | DevOps |
| #11 Docker Mount | Docker Compose update | DevOps |

---

## 10. Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-06-25 | 8.1.0 | Initial split from monolithic PRD | Tim Engineering |
| 2026-06-25 | 8.1.0 | Mark 5 issues as IMPLEMENTED | Tim Engineering |

---

*This document tracks implementation progress and issue status*
*Update after each fix is verified and merged*
