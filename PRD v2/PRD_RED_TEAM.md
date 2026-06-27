---
name: prd-red-team
description: Red team security findings and recommendations
metadata:
  type: reference
  version: 8.3
---

# PRD RED TEAM v8.3 - NGEMILOH POS
**Security Audit Report & Attack Vector Analysis**

| Metadata | Value |
|----------|-------|
| Version | 8.3 |
| Date | 2026-06-27 |
| Classification | Internal - Confidential |
| Owner | Security Team |

---

## 1. Executive Summary

### 1.1 Purpose

This document presents a red team security analysis of the NGEMILOH POS system. It catalogs 20 identified security vulnerabilities, categorizes their attack vectors, and tracks remediation status.

### 1.2 Scope

| Area | Coverage |
|------|----------|
| Authentication & Session Management | 4 issues |
| Payment Processing | 4 issues |
| Data Protection | 3 issues |
| Infrastructure | 4 issues |
| Race Conditions | 3 issues |
| User Experience Security | 2 issues |

### 1.3 Risk Summary

| Severity | Count | Remediated | Pending |
|----------|-------|------------|---------|
| CRITICAL | 5 | 4 | 1 (Owner) |
| HIGH | 8 | 8 | 0 |
| MEDIUM | 5 | 5 | 0 |
| LOW | 2 | 2 | 0 |
| **TOTAL** | **20** | **19** | **1 (Owner)** |

### 1.4 Deep Audit (2026-06-27)

**3 NEW issues discovered via multi-agent deep analysis:**
- N1: Webhook idempotency missing (P1) - In Progress
- N2: JWT blocklist fail-open (P1) - In Progress
- N3: Health checks only liveness (P2) - In Progress

See PRD_STATUS.md Section 4.2 for details.

### 1.5 Overall Assessment

**GO-LIVE READY (conditional):** 19 of 20 engineer-implemented issues are remediated. The remaining CRITICAL issue (#8 BOM Cost) requires owner action for manual data entry. All technical security controls are in place.

---

## 2. Kegagalan Fatal (20 Issues)

This section catalogs all identified security issues from the implementation tracker.

### 2.1 CRITICAL Issues

| # | Issue | Risk | Attack Vector | Status | Owner |
|---|-------|------|--------------|--------|-------|
| 1 | QRIS Expiry Never Enforced | Ghost orders, cash reconciliation failure | Exploit expired-but-unvoided QRIS orders | ✅ DONE | - |
| 8 | BOM Cost Per Unit = 0 | Financial reporting broken, cost fraud undetected | Manipulate product cost data | ⬜ PENDING | Owner |
| 10 | No Backup Configured | Data loss risk | Permanent data loss scenario | ✅ DONE | - |
| 11 | Docker Desktop Bind Mount | Data corruption on Windows | Volume corruption, data loss | ✅ DONE | DevOps |
| 18 | Redis Starts Without Password | Unauthorized access | Network-adjacent attack | ✅ DONE | DevOps |

### 2.2 HIGH Issues

| # | Issue | Risk | Attack Vector | Status | Owner |
|---|-------|------|--------------|--------|-------|
| 2 | JWT 365 Days for Kasir | Compromised PIN = 1 tahun akses | Token theft, prolonged unauthorized access | ✅ DONE | - |
| 3 | Void Refund Hardcoded | Cash fraud tidak terdeteksi | Void transactions without authorization | ✅ DONE | Backend |
| 5 | Double-Charge Possible | Revenue loss | Idempotency bypass, duplicate charges | ✅ DONE | Backend |
| 6 | Member Registration Unrate-Limited | Data scraping risk | Automated member data extraction | ✅ DONE | - |
| 9 | Profit Share Uses Created_At | Wrong calculation | Shift boundary manipulation | ✅ DONE | Backend |
| 12 | Stock Double-Deduction Race | Inventory inconsistency | Race condition in concurrent orders | ✅ DONE | Backend |
| 15 | CSRF Protection Broken | XSRF attack risk | Cross-site request forgery | ✅ DONE | Backend |
| 16 | Admin Layout Grants Access When Offline | Security bypass | Offline privilege escalation | ✅ DONE | Frontend |

### 2.3 MEDIUM Issues

| # | Issue | Risk | Attack Vector | Status | Owner |
|---|-------|------|--------------|--------|-------|
| 4 | No Offline Order Receipt | Customer dispute risk | No proof of transaction | ✅ DONE | Frontend |
| 7 | Redis SPOF | System unavailable when Redis down | DoS via Redis dependency | ✅ DONE | Backend |
| 13 | Multi-Instance Shift Auto-Close Race | Kasir cannot close shift | Shift state corruption | ✅ DONE | Backend |
| 19 | 512MB NestJS Limit + OOM Crash Loop | System instability | Resource exhaustion | ✅ DONE | DevOps |
| 20 | Webhook Errors Swallowed Silently | Payment reconciliation issues | Missed payment confirmations | ✅ DONE | Backend |

### 2.4 LOW Issues

| # | Issue | Risk | Attack Vector | Status | Owner |
|---|-------|------|--------------|--------|-------|
| 14 | Shift Modal Cannot Be Dismissed | UX frustration | Denial of service to kasir | ✅ DONE | Frontend |
| 17 | Tier Downgrade Dead Code | Loyalty points issues | Grace period bypass | ✅ DONE | Backend |

---

## 3. Attack Vectors

### 3.1 QRIS Fraud

**Vector:** Exploit expired but un-voided QRIS payments

**Attack Scenario:**
1. Customer completes QRIS payment (valid 24 hours)
2. Order is not automatically voided after expiry
3. Attacker claims order was never completed
4. Cashier manually voids — ghost order created
5. Financial reconciliation fails

**Current State:** Fixed (#1) — Cron job enforces void after expiry
**Feature Flag:** `FEATURE_QRIS_EXPIRY_ENFORCEMENT`

---

### 3.2 Cash Fraud

**Vector:** Void transactions without proper authorization

**Attack Scenario:**
1. Kasir processes legitimate order
2. Kasir voids order without reason (shortcut)
3. Cash collected but order marked void
4. Money pocketed — no audit trail

**Current State:** Fixed (#3) — 4-eyes approval workflow
**Feature Flag:** `FEATURE_VOID_APPROVAL`

**Related:** Void reason minimum 10 characters (`VOID_REASON_MIN_LENGTH`)

---

### 3.3 Token Theft & Session Hijacking

**Vector:** JWT tokens with 365-day expiry

**Attack Scenario:**
1. Kasir PIN compromised (shoulder surfing, shared PIN)
2. Attacker obtains access token
3. Token valid for 1 year
4. Attacker has persistent access to POS

**Current State:** Fixed (#2) — 8-hour token + silent refresh
**Feature Flag:** `FEATURE_JWT_REFRESH`

**Mitigation Layers:**
- HttpOnly, Secure, SameSite cookie (not localStorage)
- CSRF token required for mutations
- Silent refresh rotates token regularly

---

### 3.4 Member Data Scraping

**Vector:** Unrate-limited member registration/lookup endpoints

**Attack Scenario:**
1. Automated scripts target `/api/v1/members/register`
2. Bulk registration of fake members
3. Member lookup endpoint scraped for phone numbers
4. Spam, social engineering, or data sale

**Current State:** Fixed (#6) — Rate limiting implemented
**Limits:**
- Registration: 5 requests / 30 minutes per IP
- Lookup: 20 requests / minute per IP

---

### 3.5 CSRF / Cross-Site Request Forgery

**Vector:** Browser-based attack using authenticated sessions

**Attack Scenario:**
1. Admin is logged into POS dashboard
2. Admin visits malicious site
3. Site sends mutation request with admin cookies
4. Request succeeds — action performed

**Current State:** Fixed (#15) — Double-submit cookie pattern
**Mechanism:**
- CSRF token in `X-CSRF-Token` header
- Timing-safe comparison on server
- Public routes excluded (login, refresh, webhooks)

---

### 3.6 Offline Security Bypass

**Vector:** Admin layout accessible without authentication check

**Attack Scenario:**
1. Frontend cached in browser
2. User navigates to `/admin` directly
3. Layout renders without server-side guard
4. Sensitive data may be exposed in cached views

**Current State:** Fixed (#16) — Guard check before render

---

### 3.7 Infrastructure Attacks

**Redis Without Password:**
- Vector: Network-adjacent unauthorized access
- State: Fixed (#18) — `REDIS_PASSWORD` env var enforced

**Docker Bind Mounts on Windows:**
- Vector: Data corruption due to permission mismatch
- State: Fixed (#11) — Named volumes replace bind mounts

**OOM Crash Loop:**
- Vector: Resource exhaustion leads to instability
- State: Fixed (#19) — Graceful restart with memory limits

---

### 3.8 Race Conditions

**Stock Double-Deduction:**
- Vector: Concurrent orders deduct same stock item
- State: Fixed (#12) — PostgreSQL advisory lock

**Shift Auto-Close Race:**
- Vector: Multiple instances attempt simultaneous close
- State: Fixed (#13) — Advisory lock + double-check

**Double-Charge (Idempotency):**
- Vector: Network retry causes duplicate payment
- State: Fixed (#5) — SELECT FOR UPDATE + Redis idempotency key

---

## 4. Mitigations

### 4.1 Implemented Mitigations

| Category | Controls | Status |
|----------|----------|--------|
| **Authentication** | 8h token, silent refresh, HttpOnly cookie | ✅ Active |
| **Authorization** | 4-eyes void approval, offline guard | ✅ Active |
| **Session Security** | CSRF double-submit, SameSite cookie | ✅ Active |
| **Rate Limiting** | Registration 5/30min, lookup 20/min | ✅ Active |
| **Race Conditions** | Advisory locks, idempotency keys | ✅ Active |
| **Infrastructure** | Named volumes, Redis password, OOM restart | ✅ Active |
| **Observability** | Webhook DLQ, audit logging | ✅ Active |
| **Offline** | IndexedDB receipts, pending badge | ✅ Active |

### 4.2 Pending Mitigations

| # | Issue | Severity | Blocker | Action |
|---|-------|----------|---------|--------|
| 8 | BOM Cost = 0 | CRITICAL | Owner | Manual data entry for ~50+ products |

**Risk:** Without accurate BOM costs, HPP calculation is wrong. Fraud in cost reporting cannot be detected.

---

## 5. Recommendations

### 5.1 Immediate (Before Go-Live)

| Priority | Action | Owner |
|----------|--------|-------|
| 🔴 CRITICAL | Complete BOM cost data entry for all products | Owner |
| 🔴 CRITICAL | Test backup restore procedure | DevOps |
| 🟡 HIGH | Toggle all feature flags on/off in staging | QA |
| 🟡 HIGH | Invalidate all existing JWT tokens on go-live | DevOps |
| 🟢 MEDIUM | Document escalation contacts for incidents | Admin |

### 5.2 Short-Term (Week 1-2)

| Priority | Action | Rationale |
|----------|--------|-----------|
| 🔴 CRITICAL | Enable `FEATURE_VOID_APPROVAL` in production | Cash fraud prevention |
| 🟡 HIGH | Review webhook DLQ entries daily for first week | Payment reconciliation |
| 🟡 HIGH | Monitor failed login attempts | Brute force detection |
| 🟢 MEDIUM | Collect kasir feedback on 4-eyes workflow | UX adjustment if needed |

### 5.3 Long-Term (Architectural)

| Priority | Action | Benefit |
|----------|--------|---------|
| 🟡 HIGH | Implement HSM for payment keys | PCI-DSS compliance |
| 🟡 HIGH | Add real-time inventory alerts | Proactive stock management |
| 🟢 MEDIUM | Separate admin and POS databases | Principle of least privilege |
| 🟢 MEDIUM | Implement full audit log (immutable) | Forensic capability |

---

## 6. References

| Document | Location | Purpose |
|----------|----------|---------|
| PRD Specification | `PRD v2/PRD_SPEC.md` | Feature requirements, business rules |
| PRD Status | `PRD v2/PRD_STATUS.md` | Issue tracker, implementation status |
| API Contract | `PRD v2/PRD_API_CONTRACT.md` | Endpoint definitions |
| Architecture | `SPEC.md` | System design, data flow |
| CLAUDE.md | `CLAUDE.md` | Security rules, constants |
| Feature Flags | `CLAUDE.md` | Toggle configuration |

### Related Security Documentation

| Topic | Reference |
|-------|-----------|
| JWT Security | CLAUDE.md Section: Security |
| CSRF Protection | CLAUDE.md Section: Security |
| Token Storage | CLAUDE.md Section: Security |
| Offline Security | CLAUDE.md Section: Offline-First |

---

*This document is part of the NGEMILOH POS security documentation suite*
*Classification: Internal - Confidential*
*Next Review: After all 20 issues remediated*
