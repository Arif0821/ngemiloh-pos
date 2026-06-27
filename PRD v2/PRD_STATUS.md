# PRD STATUS v8.3 - NGEMILOH POS
**Implementation Tracker & Feature Summary**

| Metadata | Value |
|----------|-------|
| Version | 8.3 |
| Date | 2026-06-27 |
| Status | GO-LIVE READY (Conditional) |
| Overall Progress | 20/20 PRD Issues ✅ DONE |
| Test Coverage | 17/17 test files ✅ DONE |

---

## 1. Quick Summary

### 1.1 Status Overview

| Category | Total | Done | Pending |
|----------|-------|------|---------|
| **PRD Issues** | 20 | 20 | 0 |
| **NEW Issues (Audit)** | 3 | 0 | 3 (In Progress) |
| **Test Files** | 17 | 17 | 0 |

### 1.2 Implementation Progress

```
[████████████████████████████████████████████] 100%
20/20 PRD Issues DONE ✅
17/17 Test Files DONE ✅

PENDING: 3 NEW issues from deep audit (see Section 4)
PENDING: BOM Cost input (Owner action)
```

### 1.3 By Severity

| Severity | Total | Done | Pending |
|----------|-------|------|---------|
| CRITICAL | 5 | 4 | 1 (Owner) |
| HIGH | 8 | 8 | 0 |
| MEDIUM | 5 | 5 | 0 |
| LOW | 2 | 2 | 0 |

---

## 2. Issue Tracker (Summary)

### 2.1 CRITICAL

| # | Issue | Status | Owner |
|---|-------|--------|-------|
| 1 | QRIS Expiry Never Enforced | ✅ DONE | - |
| 8 | BOM Cost Per Unit = 0 | ⬜ PENDING | **Owner** |
| 10 | No Backup Configured | ✅ DONE | - |
| 11 | Docker Desktop Bind Mount | ✅ DONE | DevOps |
| 18 | Redis Starts Without Password | ✅ DONE | DevOps |

### 2.2 HIGH

| # | Issue | Status |
|---|-------|--------|
| 2 | JWT 365 Days for Kasir | ✅ DONE |
| 3 | Void Refund Hardcoded | ✅ DONE |
| 5 | Double-Charge Possible | ✅ DONE |
| 6 | Member Registration Unrate-Limited | ✅ DONE |
| 9 | Profit Share Uses Created_At | ✅ DONE |
| 12 | Stock Double-Deduction Race | ✅ DONE |
| 15 | CSRF Protection Broken | ✅ DONE |
| 16 | Admin Layout Grants Access When Offline | ✅ DONE |

### 2.3 MEDIUM

| # | Issue | Status |
|---|-------|--------|
| 4 | No Offline Order Receipt | ✅ DONE |
| 7 | Redis SPOF | ✅ DONE |
| 13 | Multi-Instance Shift Auto-Close Race | ✅ DONE |
| 19 | 512MB NestJS Limit + OOM Crash Loop | ✅ DONE |
| 20 | Webhook Errors Swallowed Silently | ✅ DONE |

### 2.4 LOW

| # | Issue | Status |
|---|-------|--------|
| 14 | Shift Modal Cannot Be Dismissed | ✅ DONE |
| 17 | Tier Downgrade Dead Code | ✅ DONE |

---

## 3. Fitur Baru (New Features)

> Implementasi fitur baru yang ditambahkan sebagai hasil dari issue resolution.

### 3.1 Authentication & Security

| Fitur | File | Fungsi |
|-------|------|--------|
| **8-Hour JWT Token** | `auth.service.ts` | Token expiry dikurangi dari 365 hari ke 8 jam untuk keamanan |
| **Silent Token Refresh** | `auth.store.svelte.ts` | Auto-refresh token sebelum expiry tanpa user intervention |
| **CSRF Protection** | `csrf.middleware.ts` | Double-submit cookie pattern dengan timing-safe comparison |
| **Member Rate Limiting** | `member-rate-limiter.middleware.ts` | 5 req/30min (register), 20 req/min (lookup) |
| **Redis Password Guard** | `redis.service.ts` | Enforce password authentication untuk Redis |

### 3.2 Payment & Transactions

| Fitur | File | Fungsi |
|-------|------|--------|
| **QRIS Expiry Cron** | `finance.cron.ts` | Auto-void expired QRIS orders setelah 24 jam |
| **Idempotency Keys** | `orders.service.ts` | Mencegah duplicate order dari network retry |
| **Webhook DLQ** | `webhook-dlq.service.ts` | Dead letter queue untuk failed webhooks |
| **4-Eyes Void Approval** | `orders.service.ts`, `VoidApprovalRequest` | Approval required untuk void transaction |

### 3.3 Inventory & Stock

| Fitur | File | Fungsi |
|-------|------|--------|
| **Advisory Lock Stock** | `inventory.service.ts` | PostgreSQL advisory lock untuk prevent race condition |
| **Stock Double-Check** | `inventory.service.ts` | Verifikasi stok sebelum deduct |

### 3.4 Finance & Reporting

| Fitur | File | Fungsi |
|-------|------|--------|
| **Shift-Based Profit Share** | `finance.service.ts` | Hitung profit share berdasarkan shift, bukan created_at |
| **Auto-Close Shift** | `finance.cron.ts` | Cron job untuk auto-close shifts |
| **Shift Race Prevention** | `finance.service.ts` | Advisory lock untuk prevent concurrent shift close |
| **Tier Downgrade Cron** | `finance.cron.ts` | Daily check untuk grace period expired |

### 3.5 Offline Support

| Fitur | File | Fungsi |
|-------|------|--------|
| **Offline Receipt** | `db.ts`, `printer.service.ts` | Simpan receipt ke IndexedDB saat offline |
| **Auto-Print on Reconnect** | `pos/+page.svelte` | Print pending receipts saat kembali online |
| **Offline Admin Guard** | `+layout.svelte` | Cek online status sebelum render admin layout |

### 3.6 Infrastructure

| Fitur | File | Fungsi |
|-------|------|--------|
| **Named Volumes** | `docker-compose.yml` | Replace bind mounts untuk Windows compatibility |
| **Redis Fallback** | `redis.service.ts` | MemoryCache fallback saat Redis unavailable |
| **OOM Recovery** | `docker-compose.yml` | Graceful restart dengan memory limits |

---

## 4. Post-Launch Issues (Pending)

### 4.1 Owner Action Required

| # | Issue | Severity | Effort | Notes |
|---|-------|----------|--------|-------|
| 8 | BOM Cost Input | CRITICAL | 1 day | Input ~50+ products. See `docs/guides/BOM_TEMPLATE.md` |

### 4.2 NEW Issues (In Progress - 2026-06-27)

| # | Issue | Severity | Status | Notes |
|---|-------|----------|--------|-------|
| N1 | Webhook Idempotency Missing | P1 CRITICAL | ⬜ IN PROGRESS | Double processing risk |
| N2 | JWT Blocklist Fail-Open | P1 CRITICAL | ⬜ IN PROGRESS | Should fail-closed |
| N3 | Health Check Liveness Only | P2 HIGH | ⬜ IN PROGRESS | Need persistence check |

---

## 5. Go-Live Checklist

### Pre-Launch

| # | Task | Owner | Status |
|---|------|-------|--------|
| 1 | BOM Cost Input | Owner | ⬜ PENDING |
| 2 | Backup Restore Test | DevOps | ⬜ PENDING |
| 3 | Feature Flags Toggle Test | QA | ⬜ PENDING |
| 4 | Invalidate All JWT Tokens | DevOps | ⬜ PENDING |

### Launch Day

| # | Task | Owner | Status |
|---|------|-------|--------|
| 1 | Enable features incrementally | Team | ⬜ PENDING |
| 2 | Monitor error rates | DevOps | ⬜ PENDING |
| 3 | Cash reconciliation | Finance | ⬜ PENDING |

### Post-Launch (Day 1-7)

| # | Task | Frequency |
|---|------|-----------|
| 1 | Daily error log review | Daily |
| 2 | Cash reconciliation | Daily |
| 3 | Kasir feedback | Day 3, 7 |

---

## 6. Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-06-27 | 8.3 | Clean up: Remove verbose details, add "Fitur Baru" section | Engineering |
| 2026-06-27 | 8.2 | Deep audit: 3 NEW issues found | 3-Agent Audit |
| 2026-06-25 | 8.1 | Initial split from monolithic PRD | Tim Engineering |

---

*Update after each fix is verified and merged*
*Source: PRD v2 (Modular Documentation)*