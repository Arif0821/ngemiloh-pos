# Red Team Findings

> **Source:** PRD Section 18-20 Kegagalan Fatal sebelum go-live
> **Total Effort:** ~2-3 minggu
> **All decisions finalized by owner.**

---

## Summary

| # | Issue | Severity | Solution |
|---|-------|----------|---------|
| 1 | QRIS Expiry Never Enforced | **CRITICAL** | Cron job void expired QRIS |
| 2 | JWT 365 Days for Kasir | HIGH | 365d → 8h atau silent refresh |
| 3 | Void Refund Hardcoded | HIGH | 4-eyes approval |
| 4 | No Offline Order Receipt | MEDIUM | Generate receipt saat offline |
| 5 | Double-Charge Possible | HIGH | Idempotency key |
| 6 | Member Registration Unrate-Limited | HIGH | Rate limit per IP |
| 7 | Redis SPOF | MEDIUM | Redis fallback |
| 8 | BOM Cost Per Unit = 0 | **CRITICAL** | Manual input per bahan baku |
| 9 | Profit Share Uses Created_At | MEDIUM | Filter by shift_start/shift_end |
| 10 | No Backup Configured | **CRITICAL** | Cron backup setiap jam 2 pagi |
| 11 | Docker Desktop Bind Mount Trap | HIGH | Named volume |
| 12 | Stock Double-Deduction Race | MEDIUM | Advisory lock |
| 13 | Multi-Instance Shift Auto-Close Race | MEDIUM | Lock check |
| 14 | Shift Modal Cannot Be Dismissed | LOW | Escape hatch |
| 15 | CSRF Protection Broken | HIGH | Double-submit cookie |
| 16 | Admin Layout Grants Access When Offline | MEDIUM | Guard check |
| 17 | Tier Downgrade Dead Code | LOW | Enable existing code |
| 18 | Redis Starts Without Password | HIGH | Env check untuk password |
| 19 | 512MB NestJS Limit + OOM Crash Loop | MEDIUM | Graceful restart |
| 20 | Webhook Errors Swallowed Silently | MEDIUM | Dead letter queue |

---

## Detailed Issues

### CRITICAL Priority (Must Fix)

#### #1: QRIS Expiry Never Enforced
- **Dampak:** Ghost orders, reconciliation failure
- **Solution:** Cron job untuk void expired QRIS orders
- **Status:** ⚠️ In Progress (docs/superpowers/specs/2026-06-25-qris-expiry-design.md)

#### #8: BOM Cost Per Unit = 0
- **Dampak:** Financial reporting broken
- **Solution:** Manual input cost per bahan baku
- **Owner Action:** Input ~50+ produk sebelum go-live (est. 1-2 hari)

#### #10: No Backup Configured
- **Dampak:** Data loss risk
- **Solution:** Cron backup setiap jam 2 pagi (otomatis)
- **Owner Decision:** Tidak bergantung pada kasir online, cron job otomatis

### HIGH Priority

| # | Issue | Dampak | Solution |
|---|-------|--------|---------|
| 2 | JWT 365 Days for Kasir | 1 tahun akses jika PIN compromised | Silent refresh (8 jam) |
| 3 | Void Refund Hardcoded | Cash fraud tidak terdeteksi | 4-eyes approval |
| 5 | Double-Charge Possible | Revenue loss | Idempotency key |
| 6 | Member Registration Unrate-Limited | Data scraping | Rate limit per IP |
| 11 | Docker Desktop Bind Mount Trap | Data corruption on Windows | Named volume |
| 15 | CSRF Protection Broken | XSRF attack risk | Double-submit cookie |
| 18 | Redis Starts Without Password | Unauthorized access | Env check untuk password |

### MEDIUM Priority

| # | Issue | Dampak | Solution |
|---|-------|--------|---------|
| 4 | No Offline Order Receipt | Customer dispute risk | Generate receipt offline |
| 7 | Redis SPOF | System unavailable | Redis fallback |
| 9 | Profit Share Uses Created_At | Wrong calculation | Filter by shift_start/shift_end |
| 12 | Stock Double-Deduction Race | Inventory inconsistency | Advisory lock |
| 13 | Multi-Instance Shift Auto-Close Race | Kasir tidak bisa close shift | Lock check |
| 16 | Admin Layout Grants Access When Offline | Security bypass | Guard check |
| 19 | 512MB NestJS Limit + OOM Crash Loop | System instability | Graceful restart |
| 20 | Webhook Errors Swallowed Silently | Reconciliation issues | Dead letter queue |

### LOW Priority

| # | Issue | Dampak | Solution |
|---|-------|--------|---------|
| 14 | Shift Modal Cannot Be Dismissed | UX frustration | Escape hatch |
| 17 | Tier Downgrade Dead Code | Loyalty issues | Enable existing code |

---

## Implementation Plan

### PHASE 1: STOP THE BLEEDING (Week 1)

```
DAY 1-2: MUST-DO
├── #10 Backup System           → 4 jam
├── #1 QRIS Expiry Fix         → 2-3 hari
├── #6 Member Rate Limit       → 1 jam
└── #8 BOM Cost Input          → Owner manual input

DAY 3-4: QUICK WINS
├── #4 Offline Receipt         → 2 jam
├── #5 Idempotency            → 1 jam
├── #12 Stock Race Fix         → 1 jam
└── #13 Shift Race Fix         → 1 jam

DAY 5-7: TESTING & VALIDATION
├── Full regression test
├── Backup restore test (MANDATORY)
└── Load test dengan simulated traffic
```

### PHASE 2: STRUCTURAL FIXES (Week 2-3)

```
DAY 8-10: SECURITY HARDENING
├── #2 JWT Reduction           → 2 hari
├── #15 CSRF Fix              → 1 jam
├── #18 Redis Password Guard   → 1 jam
├── #7 Redis Fallback          → 4 jam
└── #16 Offline Admin Guard    → 1 jam

DAY 11-13: FRAUD PREVENTION
├── #3 Void 4-Eyes Approval   → 1 hari
├── #17 Tier Downgrade Enable → 1 jam
├── #9 Profit Share Shift     → 2 jam
└── #20 Webhook DLQ           → 1 jam

DAY 14: REVIEW & REFINE
├── User acceptance testing
├── Documentation updates
└── Runbook for incident response
```

### PHASE 3: OPERATIONAL EXCELLENCE (Week 4-6)

```
DAY 15-20: MONITORING & OBSERVABILITY
├── #19 OOM Recovery          → 2 jam
├── #11 Docker Mount Fix      → 4 jam
├── Real-time fraud dashboard
└── System health alerts

DAY 21-25: UX IMPROVEMENTS
├── #14 Shift Modal Escape Hatch → 30 menit
├── Offline experience polish
└── Admin efficiency tools

DAY 26-30: VALIDATION & OPTIMIZATION
├── Performance tuning
├── Security penetration test
└── Go/No-Go decision for production
```

---

## Owner Decisions (Final)

| Question | Decision |
|----------|----------|
| Q-A: Downtime Tolerance | Zero-downtime dengan feature flags |
| Q-B: Decision Maker | Owner untuk fraud > Rp 500.000 |
| Q-C: BOM Input | Owner input manual cost per bahan baku |
| Q-D: Volume Details | Peak 16:00-20:00, avg Rp 30-50k, shift 07-15 & 15-23 |
| Q-G: Backup Timing | Default jam 2 pagi, cron otomatis |

---

## Effort Estimate

| Category | Items | Time |
|----------|-------|------|
| OPSI A (Quick fixes) | 12 items | ~1-2 hari masing-masing |
| OPSI B (Structural) | 7 items | ~2-3 minggu total |
| OPSI C (Docker fix) | 1 item | ~4 jam |
| **TOTAL** | **20 items** | **~2-3 minggu** |
