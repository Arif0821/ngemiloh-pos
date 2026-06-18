# Docker CVEs & Prisma Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development

**Goal:** Fix all remaining Docker vulnerabilities and Prisma database migration error

---

## Issues Summary

### 1. nestjs-api Docker CVEs (6 vulnerabilities)
| CVE | Severity | Fixable | Package |
|-----|----------|---------|---------|
| CVE-2026-33671 | 7.5 HIGH | ✓ | npm / picomatch / 4.0.3 |
| CVE-2026-53655 | 6.9 MED | ✓ | npm / tar / 7.5.11 |
| CVE-2025-60876 | 6.5 MED | ✓ | apk / alpine/busybox / 1.37.0-r31 |
| CVE-2026-33750 | 6.5 MED | ✓ | npm / brace-expansion / 2.0.2 |
| CVE-2026-33672 | 5.3 MED | ✓ | npm / picomatch / 4.0.3 |
| CVE-2026-42338 | 5.3 MED | ✓ | npm / ip-address / 10.1.0 |

### 2. caddy Docker CVEs (27 vulnerabilities)
- 1 CRITICAL (openssl)
- 11 HIGH (openssl)
- 13 MEDIUM
- 2 LOW

### 3. Prisma Error
```
The column 'Discount.manually_disabled' does not exist in the current database.
```

---

## Tasks

### Task 1: Fix nestjs-api Docker CVEs

**Files:**
- Modify: `backend/Dockerfile`
- Modify: `backend/package.json`

**Steps:**
1. Update `node:22-alpine` to latest version (check for newer LTS)
2. Update npm overrides for picomatch, tar, brace-expansion, ip-address
3. Update any direct dependencies that have fixed versions
4. Rebuild and verify CVEs are resolved

**Note:** busybox CVE is in Alpine base - no fix available until Alpine releases update

### Task 2: Fix caddy Docker CVEs (OPENSSL)

**Files:**
- Modify: `Caddy.Dockerfile`

**Steps:**
1. Use `caddy:2-alpine` with latest tag instead of pinned version
2. Or use `caddy:3` (Bookworm) which has newer OpenSSL
3. Test healthcheck works without curl
4. Verify CVEs are resolved

**Note:** OpenSSL CVEs are in Caddy base image - we need newer Caddy version

### Task 3: Fix Prisma Discount.manually_disabled Error

**Files:**
- Check: `backend/prisma/schema.prisma`
- Check: `backend/src/discounts/` (cron, service files)
- Database: Need to add missing column or remove reference from code

**Steps:**
1. Check if `manually_disabled` field exists in schema.prisma
2. If field exists in schema but not in DB: Run migration
3. If field doesn't exist in schema: Remove from code that references it
4. Fix the cron job that queries this column
5. Test the fix

---

## Verification

After each task:
1. Run `docker scout cves <image>` to verify fixes
2. For Prisma: Run the cron job or test the query

## Success Criteria

- nestjs-api: CVEs reduced from 6 to ≤2 (busybox unavoidable)
- caddy: CVEs reduced from 27 to ≤5 (base image limited)
- Prisma: No more "manually_disabled column does not exist" errors
