---
name: qris-expiry-implementation
description: PRD Section 18 Issue #1 - QRIS Expiry Enforcement implementation details
metadata:
  type: project
---

# QRIS Expiry Enforcement - PRD Decision

## Issue Summary
| Item | Value |
|------|-------|
| Issue # | 1 (Red Team Analysis) |
| Name | QRIS Expiry Never Enforced |
| Severity | **CRITICAL** |
| Impact | Ghost orders, cash reconciliation failure |
| Opsi Terpilih | **OPSI B** |
| Deskripsi Opsi | Cron job untuk void expired QRIS orders |

## Implementation Details

### Feature Flag
- Name: `FEATURE_QRIS_EXPIRY_ENFORCEMENT`
- Default: `false`
- Enable via: `/admin/settings/flags`

### Rollback Procedure
1. Disable cron job (via feature flag)
2. Manual void jika diperlukan

### Timeline
- Effort: 2-3 hari

### Technical Notes
- Field `qris_expiry_at` sudah ada di schema.prisma (line 198)
- Pattern cron job ada di `FinanceCronService`
- Default QRIS expiry: 900 detik (15 menit) via `QRIS_EXPIRY_SECONDS` env

## Related Decisions

### Priority Action Plan (Section 19)
- PHASE 1 DAY 1-2: QRIS Expiry Fix
- Total Timeline: ~2-3 minggu untuk semua fixes

### Feature Flags Required
| Flag | Purpose | Default |
|------|---------|---------|
| `FEATURE_QRIS_EXPIRY_ENFORCEMENT` | Enable QRIS void cron | `false` |
| `FEATURE_JWT_REFRESH` | Enable silent token refresh | `false` |
| `FEATURE_VOID_APPROVAL` | Require approval for void | `false` |
| `FEATURE_OFFLINE_RECEIPT` | Generate receipt offline | `true` |

## Source
- PRD: `PRD v2/PRD_NGEMILOH_POS_v8.0_MASTER_INDONESIAN.md`
- Section: 9.1, 18.1, 19.1, 19.2
