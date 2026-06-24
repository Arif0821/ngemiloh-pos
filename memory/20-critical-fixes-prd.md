---
name: 20-critical-fixes-prd
description: Summary 20 Critical Fixes dari Red Team Analysis - semua sudah decided by owner
metadata:
  type: project
---

# 20 Critical Fixes - Red Team Analysis

## Source
- PRD Section 18.1 & 9.1
- Source: `RED_TEAM_ANALYSIS_100_QUESTIONS.md` (2026-06-24)
- **Semua decision sudah final dari owner**

## Summary Table

| # | Issue | Severity | Opsi | Deskripsi Opsi |
|---|-------|----------|------|----------------|
| 1 | QRIS Expiry Never Enforced | **CRITICAL** | OPSI B | Cron job untuk void expired QRIS orders |
| 2 | JWT 365 Days for Kasir | HIGH | OPSI B | 365d → 8h atau silent refresh |
| 3 | Void Refund Hardcoded | HIGH | OPSI A | 4-eyes approval untuk fraud prevention |
| 4 | No Offline Order Receipt | MEDIUM | OPSI A | Generate receipt saat offline |
| 5 | Double-Charge Possible | HIGH | OPSI A | Prevent double-charge |
| 6 | Member Registration Unrate-Limited | HIGH | OPSI A | Prevent scraping |
| 7 | Redis SPOF | MEDIUM | OPSI B | Fallback saat Redis down |
| 8 | BOM Cost Per Unit = 0 | **CRITICAL** | OPSI A | Manual input cost per bahan baku |
| 9 | Profit Share Uses Created_At | MEDIUM | OPSI A | Filter by shift_start/shift_end |
| 10 | No Backup Configured | **CRITICAL** | OPSI B | Cron backup setiap jam 2 pagi |
| 11 | Docker Desktop Bind Mount Trap | HIGH | OPSI C | Named volume (data safety) |
| 12 | Stock Double-Deduction Race | MEDIUM | OPSI A | Advisory lock untuk race condition |
| 13 | Multi-Instance Shift Auto-Close Race | MEDIUM | OPSI A | Lock check sebelum auto-close |
| 14 | Shift Modal Cannot Be Dismissed | LOW | OPSI A | Escape hatch |
| 15 | CSRF Protection Broken | HIGH | OPSI A | Double-submit cookie |
| 16 | Admin Layout Grants Access When Offline | MEDIUM | OPSI A | Guard check saat offline |
| 17 | Tier Downgrade Dead Code | LOW | OPSI A | Enable existing code |
| 18 | Redis Starts Without Password | HIGH | OPSI B | Env check untuk password |
| 19 | 512MB NestJS Limit + OOM Crash Loop | MEDIUM | OPSI B | Graceful restart |
| 20 | Webhook Errors Swallowed Silently | MEDIUM | OPSI A | Dead letter queue |

## Total Effort
- OPSI A: 12 items (~1-2 hari masing-masing)
- OPSI B: 7 items (~2-3 minggu total)
- OPSI C: 1 item (~4 jam)
- **TOTAL: ~2-3 minggu**

## Priority Action Plan (Section 19)

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

## Key Owner Decisions

### Q-A: Downtime Tolerance
- Zero-downtime migration dengan feature flags
- Feature flags memungkinkan enable/disable tanpa redeploy

### Q-B: Decision Maker
- Owner dan admin adalah orang yang sama
- Untuk fraud > Rp 500.000, owner yang investigate dan decide

### Q-C: BOM Input
- Owner yang input manual cost per bahan baku
- Target: input sebelum go-live
- Estimate: ~50+ produk, butuh waktu 1-2 hari

### Q-D: Volume Details
- Peak hour: 16:00-20:00
- Average transaction: ~Rp 30.000-50.000
- Weekend vs weekday: weekend ~30% lebih tinggi
- Kasir shift pagi (07:00-15:00) dan shift malam (15:00-23:00)

### Q-G: Backup Timing
- Default: Setiap hari jam 2 pagi (otomatis via cron)
- Tidak bergantung pada kasir online status
- Cron job jalan otomatis, bukan manual
- Opsional: manual trigger jika perlu
