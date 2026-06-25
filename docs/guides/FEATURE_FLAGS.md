# Feature Flags Registry

> **NGEMILOH POS - Feature Flags Management Guide**
> Last Updated: 2026-06-26

Feature flags allow safe, incremental deployment of functionality. This document describes all feature flags, their rollout strategy, testing procedures, and rollback procedures.

---

## 1. Feature Flags Overview

### 1.1 All Available Flags

| Flag Name | Default | Category | Related Issue |
|-----------|---------|----------|---------------|
| `QRIS_PAYMENT` | `false` | Payment | - |
| `SPLIT_PAYMENT` | `false` | Payment | - |
| `DISCOUNT_SYSTEM` | `false` | Loyalty | - |
| `MODIFIER_SYSTEM` | `false` | Products | - |
| `INVENTORY_CHECK` | `false` | Inventory | - |
| `PRINT_RECEIPT` | `false` | Operations | - |
| `EMAIL_RECEIPT` | `false` | Operations | - |
| `PROFIT_SHARE` | `false` | Finance | - |
| `FEATURE_QRIS_EXPIRY_ENFORCEMENT` | `false` | Security | #1 |
| `FEATURE_VOID_APPROVAL` | `false` | Fraud Prevention | #3 |
| `FEATURE_JWT_REFRESH` | `false` | Security | #2 |
| `FEATURE_OFFLINE_RECEIPT` | `true` | Offline-First | #4 |

### 1.2 Critical Security Flags (PRIMARY)

These 4 flags are the focus of this registry and represent security-critical functionality:

| Flag | Default | Risk if Enabled Early | Risk if Disabled Late |
|------|--------|---------------------|----------------------|
| `FEATURE_QRIS_EXPIRY_ENFORCEMENT` | `false` | Valid orders may be incorrectly voided | Ghost orders, cash reconciliation failure |
| `FEATURE_JWT_REFRESH` | `false` | Token refresh race conditions | Compromised PIN = 1 year access |
| `FEATURE_VOID_APPROVAL` | `false` | Legitimate voids blocked by approval queue | Cash fraud not detected |
| `FEATURE_OFFLINE_RECEIPT` | `true` | Minimal - minor performance overhead | Customer disputes, no proof of purchase |

---

## 2. Detailed Flag Specifications

### 2.1 FEATURE_QRIS_EXPIRY_ENFORCEMENT

**Purpose:** Void expired unpaid QRIS orders automatically via cron job.

**Default:** `false`  
**Category:** Security / Cash Reconciliation  
**Related Issue:** #1 - QRIS Expiry Never Enforced

#### When to ENABLE:

| Condition | Reason |
|-----------|--------|
| After backup restore tested | Ensure cron doesn't void valid orders |
| After QRIS payment flow validated | Verify order lifecycle end-to-end |
| During low-traffic period | First run should be monitored closely |
| Finance team available for review | Manual verification recommended for first 7 days |

#### When to DISABLE:

| Condition | Reason |
|-----------|--------|
| Order lifecycle testing in progress | Cron may interfere with test scenarios |
| Midtrans webhook issues detected | May compound reconciliation problems |
| During migration or data fix | Avoid race conditions |
| Cash reconciliation discrepancy found | Disable until root cause identified |

#### Cron Schedule:
```
Every 5 minutes: Check for expired unpaid QRIS orders
Expire window: 30 minutes from QRIS generation
```

#### Impact When Enabled:
- Orders unpaid for >30 minutes are automatically voided
- Void reason: "EXPIRED: QRIS payment timeout"
- Kasir can manually void (even if flag is disabled)
- Admin dashboard shows void count

#### Testing Checklist:
```
□ Test expired order void (mock 30+ minute timeout)
□ Verify void reason logged correctly
□ Check kasir can still manual void
□ Verify admin sees void in dashboard
□ Test concurrent void scenarios
□ Verify void notification sent
□ Check Redis idempotency prevents double-void
```

#### Rollback Procedure:
```bash
# Immediate rollback - disable flag
1. Admin Dashboard > Flags > FEATURE_QRIS_EXPIRY_ENFORCEMENT > Toggle OFF

# Manual recovery if orders were incorrectly voided:
2. Check void_audit_log for affected orders
3. Restore order status via admin panel
4. Contact affected customers if needed
5. Reconcile Midtrans dashboard

Time to rollback: < 1 minute (flag toggle)
```

---

### 2.2 FEATURE_JWT_REFRESH

**Purpose:** Enable silent refresh of 8-hour access tokens before expiry.

**Default:** `false`  
**Category:** Security  
**Related Issue:** #2 - JWT 365 Days for Kasir

#### When to ENABLE:

| Condition | Reason |
|-----------|--------|
| After all kasir logged out once | Old 365-day tokens must be invalidated |
| Frontend silent refresh tested | Verify token rotation works |
| Admin can monitor token refresh | Track refresh success/failure rates |
| Support staff trained on refresh issues | Handle edge cases |

#### When to DISABLE:

| Condition | Reason |
|-----------|--------|
| Token refresh showing high failure rate | Investigate before re-enabling |
| Frontend deployment not yet complete | Frontend must handle refresh properly |
| During token migration period | Old tokens + new refresh = conflicts |
| Redis connectivity issues | Refresh tokens stored in Redis |

#### Technical Details:
```
Token Expiry: 8 hours (from 365 days)
Refresh Window: 30 minutes before expiry
Refresh Endpoint: POST /api/v1/auth/refresh
Rotation: Refresh token rotated on each use
```

#### Impact When Enabled:
- Kasir sessions persist across shifts automatically
- No forced logout at token expiry
- Reduced login friction
- Requires: Redis available, Frontend supports refresh

#### Testing Checklist:
```
□ Test token refresh at T-30 minutes
□ Test token refresh at T-5 minutes (edge case)
□ Verify refresh token rotation (old invalid after use)
□ Test offline token refresh fails gracefully
□ Test multiple tabs (separate tokens)
□ Verify CSRF token refresh after token refresh
□ Test refresh with clock skew (±5 minutes)
□ Verify audit log shows refresh events
□ Test expired refresh token rejection
```

#### Rollback Procedure:
```bash
# Disable flag (Kasir must re-login)
1. Admin Dashboard > Flags > FEATURE_JWT_REFRESH > Toggle OFF

# Emergency: Force all tokens to expire immediately
2. Backend: Set JWT_SECRET to new value (invalidate all tokens)
3. Notify all kasir to re-login
4. Monitor login success rate

# Redis cleanup (if needed)
5. redis-cli KEYS "refresh:*" | xargs redis-cli DEL

Time to rollback: < 5 minutes
```

---

### 2.3 FEATURE_VOID_APPROVAL

**Purpose:** Require admin approval for all void requests (4-eyes principle).

**Default:** `false`  
**Category:** Fraud Prevention  
**Related Issue:** #3 - Void Refund Hardcoded

#### When to ENABLE:

| Condition | Reason |
|-----------|--------|
| Admin staff available during all shifts | Approval queue requires timely response |
| Clear void approval SLA defined | e.g., "voids reviewed within 2 hours" |
| Training completed for both kasir and admin | New workflow requires education |
| Audit log dashboard ready | Admin needs visibility into pending voids |

#### When to DISABLE:

| Condition | Reason |
|-----------|--------|
| Admin not available (holiday/emergency) | Voids queue up, business blocked |
| High void volume period | Approval becomes bottleneck |
| System issues causing void failures | Don't compound problems |
| Integration testing in progress | Approval flow adds test complexity |

#### Workflow:

```
Kasir requests void
        ↓
[Flag OFF] → Void executes immediately (legacy)
[Flag ON]  → Creates VoidApprovalRequest
                   ↓
            Admin reviews request
                   ↓
         Approve → Void executes
         Reject → Request denied, kasir notified
```

#### Impact When Enabled:
- Kasir void requests pending until approved
- Maximum queue time: 2 hours (recommended SLA)
- All voids have audit trail with approver identity
- Rejected voids can be re-requested with reason

#### Testing Checklist:
```
□ Test void request creates approval entry
□ Test void executes after approval
□ Test void rejected (kasir notified)
□ Test re-request after rejection
□ Test admin sees pending void count
□ Test admin approve/reject with notes
□ Test auto-expiry of stale requests (24h)
□ Test concurrent void requests
□ Test void approval with admin offline
□ Verify audit log completeness
□ Test SMS/notification on approval/rejection
```

#### Rollback Procedure:
```bash
# Disable flag - immediate revert to direct void
1. Admin Dashboard > Flags > FEATURE_VOID_APPROVAL > Toggle OFF

# Handle pending approvals:
2. Review pending_approval_queue
3. Admin can batch-approve or cancel
4. Notify affected kasir of rollback

Time to rollback: < 1 minute (flag toggle)
Note: Pending approvals remain in queue (can be cleared separately)
```

---

### 2.4 FEATURE_OFFLINE_RECEIPT

**Purpose:** Generate and auto-print receipts when POS is offline.

**Default:** `true`  
**Category:** Offline-First  
**Related Issue:** #4 - No Offline Order Receipt

#### When to ENABLE:

| Condition | Reason |
|-----------|--------|
| Always enabled for POS terminals | Core offline-first requirement |
| After offline mode thoroughly tested | Ensure receipt data integrity |
| Printer service verified | Receipts print on reconnect |

#### When to DISABLE:

| Condition | Reason |
|-----------|--------|
| Debugging receipt issues | Reduces logging/noise |
| Testing without printer | Avoids pending queue buildup |
| Performance profiling | Slight overhead from IndexedDB |

#### Technical Details:
```
Storage: IndexedDB (localStorage for receipts)
Sync: Automatic on reconnect
Print: Via printer.service.ts when online
Queue Limit: 100 receipts (warn after 50)
```

#### Impact When Enabled:
- Receipts saved to IndexedDB when offline
- Auto-printed when connection restored
- Badge shows pending receipt count
- Manual print option available

#### Testing Checklist:
```
□ Test receipt saved to IndexedDB offline
□ Test auto-print on reconnect
□ Test manual print button
□ Test badge shows correct count
□ Test 100+ receipts (queue overflow handling)
□ Test receipt data integrity (all fields present)
□ Test concurrent offline transactions
□ Test browser close/reopen (receipts persist)
□ Test printer failure handling
□ Test receipt re-print from history
```

#### Rollback Procedure:
```bash
# Disable flag - receipts still saved but no auto-print
1. Admin Dashboard > Flags > FEATURE_OFFLINE_RECEIPT > Toggle OFF

# Pending receipts remain in IndexedDB
2. Frontend: Manual print all pending receipts
3. Clear pending queue after printing

Time to rollback: < 1 minute (flag toggle)
Note: Receipts already saved are NOT lost
```

---

## 3. Go-Live Rollout Sequence

### 3.1 Recommended Sequence

```
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 0: PRE-LAUNCH (Day -7 to Day -1)                             │
├─────────────────────────────────────────────────────────────────────┤
│ 1. All flags at DEFAULT (except OFFLINE_RECEIPT = true)            │
│ 2. Test each flag toggle in staging                                │
│ 3. Verify admin dashboard flag management works                    │
│ 4. Train admin staff on flag operations                            │
│ 5. Document escalation contacts for each flag issue                │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 1: DAY 1 - STABLE CORE                                       │
├─────────────────────────────────────────────────────────────────────┤
│ 1. FEATURE_OFFLINE_RECEIPT = true (keep default)                   │
│ 2. All other flags = false                                         │
│ 3. Monitor: Receipt generation, offline mode                       │
│ 4. Focus: Basic POS operations stable                              │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 2: DAY 3-7 - SECURITY LITE                                   │
├─────────────────────────────────────────────────────────────────────┤
│ 1. FEATURE_VOID_APPROVAL = true                                    │
│    - Admin available during business hours                          │
│    - Monitor void request queue                                     │
│ 2. FEATURE_QRIS_EXPIRY_ENFORCEMENT = true                          │
│    - After 3 days of stable QRIS payments                          │
│    - Monitor void counts closely                                    │
│ 3. Focus: Fraud prevention light mode                              │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 3: DAY 14-21 - FULL SECURITY                                 │
├─────────────────────────────────────────────────────────────────────┤
│ 1. All kasir re-login (invalidate old tokens)                      │
│ 2. FEATURE_JWT_REFRESH = true                                      │
│    - Only after all old tokens expired                              │
│    - Monitor refresh success rate                                   │
│ 3. Focus: Token security fully enabled                             │
└─────────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────────┐
│ PHASE 4: DAY 30+ - OPTIONAL ENHANCEMENTS                           │
├─────────────────────────────────────────────────────────────────────┤
│ Based on business needs:                                            │
│ - QRIS_PAYMENT = true (if QRIS is primary payment)                │
│ - PROFIT_SHARE = true (if profit sharing enabled)                   │
│ - Other operational flags as needed                                 │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Rollout Decision Matrix

| Flag | Prerequisites | Gate Criteria |
|------|--------------|---------------|
| `FEATURE_OFFLINE_RECEIPT` | None | Always ON |
| `FEATURE_VOID_APPROVAL` | Admin trained, SLA defined | 24h stable operation |
| `FEATURE_QRIS_EXPIRY_ENFORCEMENT` | QRIS flow validated, backup tested | 72h stable QRIS |
| `FEATURE_JWT_REFRESH` | All users re-login, frontend ready | Old tokens expired |

---

## 4. Testing Checklists

### 4.1 Pre-Enable Testing (All Flags)

```
□ Backend build passes (npm run build)
□ Backend tests pass (npm run test)
□ Frontend build passes (npm run build)
□ Admin dashboard flag toggle works
□ Redis connectivity verified
□ PostgreSQL connectivity verified
□ Logs flowing correctly
□ Monitoring dashboards accessible
```

### 4.2 Per-Flag Testing Matrix

| Flag | Smoke Test | Integration Test | Chaos Test |
|------|------------|------------------|------------|
| `FEATURE_QRIS_EXPIRY_ENFORCEMENT` | Void expired order | Concurrent voids, webhook race | Redis down during cron |
| `FEATURE_JWT_REFRESH` | Token refreshes | Multiple tabs, clock skew | Redis down during refresh |
| `FEATURE_VOID_APPROVAL` | Request → Approve | Queue overflow, admin offline | Database down during approval |
| `FEATURE_OFFLINE_RECEIPT` | Save offline, print online | 100+ receipts, browser crash | Printer disconnected |

### 4.3 Post-Enable Monitoring Checklist

```
For each enabled flag, monitor for 72 hours:
□ Error rate unchanged (or lower)
□ Response time unchanged (or lower)
□ No increase in support tickets
□ Cash reconciliation passes
□ Audit log entries appearing
□ No unexpected side effects
```

---

## 5. Rollback Strategy

### 5.1 Quick Rollback Decision Tree

```
Issue Detected with Flag
         ↓
    ┌────┴────┐
    │ Can you │
    │ identify │
    │  root?   │
    └────┬────┘
      Yes│    No
    ┌────┴────┐
    ↓         ↓
┌───────┐  ┌───────────────┐
│ Fix & │  │ Immediate     │
│ Deploy│  │ Rollback Flag │
└───────┘  └───────────────┘
```

### 5.2 Rollback Time Estimates

| Flag | Disable Time | Full Recovery Time | Notes |
|------|--------------|-------------------|-------|
| `FEATURE_QRIS_EXPIRY_ENFORCEMENT` | 1 min | 15 min | Manual void restore if needed |
| `FEATURE_JWT_REFRESH` | 5 min | 30 min | Users must re-login |
| `FEATURE_VOID_APPROVAL` | 1 min | 5 min | Pending queue preserved |
| `FEATURE_OFFLINE_RECEIPT` | 1 min | 2 min | Receipts already saved |

### 5.3 Rollback Runbook Template

```markdown
## ROLLBACK: {FLAG_NAME}

### Symptoms
- What users are experiencing
- Error messages observed

### Impact Assessment
- Users affected: N
- Duration: X minutes
- Revenue impact: None/Low/Medium/High

### Rollback Steps
1. [ ] Disable flag via Admin Dashboard
2. [ ] Verify behavior reverted
3. [ ] Monitor error rate
4. [ ] Notify stakeholders
5. [ ] Document in incident log

### Post-Mortem
- Root cause: 
- Corrective action:
- Prevention:
```

---

## 6. Reserved Flags for Future

These flags are reserved for planned features. Do NOT use these names for other purposes.

### 6.1 Reserved Security Flags

| Reserved Flag | Purpose | ETA |
|---------------|---------|-----|
| `FEATURE_2FA_ENFORCEMENT` | Require 2FA for admin accounts | Phase 2 |
| `FEATURE_IP_WHITELIST` | Restrict admin access by IP | Phase 2 |
| `FEATURE_AUDIT_EXPORT` | Export all audit logs | Phase 3 |
| `FEATURE_SESSION_LIMIT` | Max concurrent sessions per user | Phase 3 |

### 6.2 Reserved Payment Flags

| Reserved Flag | Purpose | ETA |
|---------------|---------|-----|
| `FEATURE_EDC_PAYMENT` | Electronic card payment integration | Phase 2 |
| `FEATURE_CASHLESS_ONLY` | Disable cash payments | Phase 2 |
| `FEATURE_TIP_ENTRY` | Capture tips on card payments | Phase 3 |
| `FEATURE_REFUND_WINDOW` | Limit refund window to 24h | Phase 3 |

### 6.3 Reserved Operational Flags

| Reserved Flag | Purpose | ETA |
|---------------|---------|-----|
| `FEATURE_MULTI_STORE` | Support multiple store locations | Phase 4 |
| `FEATURE_KITCHEN_DISPLAY` | Kitchen order display system | Phase 4 |
| `FEATURE_LOYALTY_REDEMPTION` | Points redemption at POS | Phase 3 |
| `FEATURE_PREORDER` | Pre-order functionality | Phase 4 |

### 6.4 Naming Convention

```
FEATURE_{FEATURE_NAME}
  └── All uppercase
  └── Underscore separator
  └── No abbreviations unless well-known (QRIS, JWT)
  └── Max 50 characters
```

---

## 7. Administration

### 7.1 Access Control

| Role | Can View | Can Toggle |
|------|----------|------------|
| Owner | All flags | All flags |
| Admin | All flags | Operational flags only |
| Kasir | No | No |
| DevOps | All flags | Read-only |

### 7.2 Change Management

| Change Type | Approval Required | Notification |
|-------------|------------------|--------------|
| Security flags | Owner or 2 admins | Immediate slack alert |
| Operational flags | 1 admin | EOD summary |
| Test/experiment | DevOps | None |

### 7.3 Monitoring Alerts

Configure alerts for:

```
⚠️  Alert: Flag toggled
    Channel: #ops-alerts
    Message: {USER} toggled {FLAG} to {VALUE}
    
⚠️  Alert: Flag causing errors
    Channel: #ops-critical
    Message: Error rate spike detected for {FLAG}
    
⚠️  Alert: Pending queue growing
    Channel: #ops-warnings
    Message: {FLAG} pending queue > 50 items
```

---

## 8. Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│                    FEATURE FLAGS QUICK REF                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TOGGLE:  Admin > Dashboard > Flags > [Flag Name] > Toggle     │
│                                                                 │
│  CHECK:    GET /api/v1/admin/flags                             │
│                                                                 │
│  LOGS:     grep "FEATURE_" backend/logs/app.log                │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  FLAG                    DEFAULT  ENABLE WHEN          RISK   │
│  ─────────────────────────────────────────────────────────────  │
│  FEATURE_QRIS_EXPIRY_   false    After 3d stable      High    │
│  ENFORCEMENT                     QRIS + backup tested          │
│                                                                 │
│  FEATURE_JWT_REFRESH    false    All users re-login   High     │
│                                  + frontend ready              │
│                                                                 │
│  FEATURE_VOID_APPROVAL  false    Admin trained +       Medium   │
│                                  SLA defined                  │
│                                                                 │
│  FEATURE_OFFLINE_       true     Always ON             Low     │
│  RECEIPT                                                (keep)  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  EMERGENCY: redis-cli GET flag:{name} → SET flag:{name} {val} │
└─────────────────────────────────────────────────────────────────┘
```

---

## 9. Appendix

### A. Related Documentation

| Document | Location |
|----------|----------|
| PRD Security Findings | `PRD v2/PRD_RED_TEAM.md` |
| PRD Status Tracker | `PRD v2/PRD_STATUS.md` |
| Backend Flags Service | `backend/src/flags/application/services/flags.service.ts` |
| Go-Live Checklist | `PRD v2/PRD_STATUS.md#section-6` |
| Backup Runbook | `docs/guides/BACKUP.md` |

### B. Contact Escalation

| Issue | First Response | Escalation |
|-------|----------------|------------|
| Flag toggle not working | DevOps | Backend Lead |
| Flag causing 500 errors | Backend Lead | Owner |
| Pending queue stuck | Admin | Owner |
| Token refresh failures | DevOps | Backend Lead |

### C. Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-06-26 | 1.0.0 | Initial feature flags registry | Engineering |

---

*This document is part of NGEMILOH POS operational documentation*
*Update after any feature flag change*
