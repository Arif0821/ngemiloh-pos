# POS Nabil - Claude Code Instructions

> NGEMILOH franchise POS: offline-first, QRIS payment, shift management, member loyalty.

---

## ⚡ CRITICAL Rules (Enforced Always)

| Rule | Description |
|------|-------------|
| **snake_case ONLY** | Code identifiers use snake_case (variables, functions). File naming uses kebab-case (`user-service.ts`) |
| **VERIFY Before Claim** | Show evidence: lint → build → test |
| **Shift = Business Date** | Reports filter by `shift_start..shift_end`, NOT `created_at::date` |
| **DB Safety** | Use `SELECT ... FOR UPDATE` for idempotent state transitions |
| **Stop on Confusion** | STOP → Name it → Present tradeoff → Wait |

---

## 🚫 Larangan Keras

- ❌ Hardcode credential/secret/URL production
- ❌ `any` di TypeScript tanpa alasan
- ❌ Breaking change DB tanpa konfirmasi
- ❌ Push ke main tanpa CI passing
- ❌ Empty catch block
- ❌ `db push` di production

---

## 🎯 Claude Code Roles

Claude Code assumes 8 roles based on task context. **BUKAN role aplikasi** (Kasir/Admin), tapi peran AI saat bekerja.

| Role | Kapan Aktif | Fokus Utama |
|------|-------------|-------------|
| **Solution Architect** | Desain sistem, arsitektur, ERD | Clean architecture, dependency injection |
| **Backend Developer** | Kode di `backend/` | NestJS, Prisma, JWT, Redis, BullMQ |
| **Frontend Developer** | Kode di `frontend/` | SvelteKit, Svelte 5 Runes |
| **DBA** | Schema, migrasi, query | Prisma, index, N+1 prevention |
| **DevOps Engineer** | Docker, CI/CD, Coolify | Multi-stage build, secrets |
| **Security Engineer** | Auth, environment, endpoint | JWT hardening, rate limiting |
| **QA Engineer** | Fitur baru, bugfix, deploy | Jest, Supertest, Playwright |
| **Product Owner** | Klarifikasi fitur, prioritas | Kriteria selesai, scope |

---

## 🔄 Task → Skill Workflow

| Task Type | Primary Skill | Secondary Skill |
|-----------|---------------|----------------|
| Task unclear | `interview-me` | - |
| New feature | `spec-driven-development` | `planning-and-task-breakdown` |
| Fixing bugs | `debugging-and-error-recovery` | `test-driven-development` |
| Building UI | `frontend-ui-engineering` | `test-driven-development` |
| API design | `api-and-interface-design` | `source-driven-development` |
| Code review | `code-review-and-quality` | `security-and-hardening` |
| Performance | `performance-optimization` | `debugging-and-error-recovery` |
| Deploy | `shipping-and-launch` | `ci-cd-and-automation` |

> **Note:** Full skill list and auto-activation rules available in Global CLAUDE.md.

---

## 📊 Business Rules

### Profit Share Formula
```
Gross Revenue = Total Penjualan (termasuk PPN)
PPN = Gross Revenue × 11%
Net Revenue = Gross Revenue - PPN

HPP = Total Biaya Pokok (from BOM)
Opex = Biaya Operasional
Depreciation = Total Depresiasi Aset

Net Profit = Net Revenue - HPP - Opex - Depreciation
Owner Share = Net Profit × 60%
Kasir Pool = Net Profit × 40%
Per Kasir = Kasir Pool × (Kasir Sales / Total Sales)
```

### Loyalty Tiers
| Tier | Min Points | Discount | Grace |
|------|------------|----------|-------|
| Bronze | 0 | 0% | - |
| Silver | 500 | 5% | 1 bulan |
| Gold | 1,500 | 10% | 1 bulan |
| Platinum | 5,000 | 15% | 1 bulan |

### Key Constants
| Constant | Value |
|----------|-------|
| `TAX_RATE` | 0.11 |
| `MIN_QRIS_AMOUNT` | 1000 |
| `VOID_REASON_MIN_LENGTH` | 10 |
| `MAX_EXPORT_ROWS` | 50000 |

---

## 🚦 Feature Flags

| Flag | Purpose | Default |
|------|---------|---------|
| `FEATURE_QRIS_EXPIRY_ENFORCEMENT` | Void expired QRIS | `false` |
| `FEATURE_JWT_REFRESH` | Silent token refresh | `false` |
| `FEATURE_VOID_APPROVAL` | 4-eyes void approval | `false` |
| `FEATURE_OFFLINE_RECEIPT` | Generate offline receipt | `true` |

---

## 🔐 Security

| Role | Token | Method |
|------|-------|--------|
| Kasir | 8-hour access token | PIN |
| Admin | 12-hour access token | Email + 6-digit OTP |

**No logout/revoke** - tokens expire automatically.

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | NestJS 11 + PostgreSQL 16 + Prisma **v5.22+** + Redis 7 + BullMQ |
| Frontend | SvelteKit 2 + Svelte 5 (Runes) + Tailwind CSS 4 |
| Infra | Docker + Caddy reverse proxy |

### Project Structure
```
backend/src/       # NestJS modules: auth, orders, products, inventory, finance, members, payment
backend/prisma/    # Schema + migrations
frontend/src/      # SvelteKit: routes/admin, routes/pos, routes/member
```

---

## 📈 Performance Targets

| Metric | Target |
|--------|--------|
| POS load time | < 2 detik |
| Payment processing | < 3 detik |
| Receipt print | < 5 detik |
| API response (p95) | < 200ms |
| Offline sync | < 60 detik / 100 orders |

---

## 📚 Documentation

| Document | Location |
|----------|----------|
| PRD Specs | `PRD v2/PRD_SPEC.md` |
| PRD Status | `PRD v2/PRD_STATUS.md` (20 issues: 5/20 done) |
| API Docs | `PRD v2/PRD_API_CONTRACT.md` |
| Architecture | `SPEC.md` |
| ADRs | `docs/decisions/` |
| Guides | `docs/guides/` |
| Memory | `memory/` |

---

## ✅ Checklist Sebelum Commit

- [ ] Sudah baca file relevan?
- [ ] Sudah identifikasi file yang terpengaruh?
- [ ] Tidak ada duplikasi?
- [ ] Tidak ada typo?
- [ ] Build + lint passing?
- [ ] Test sudah diperbarui?
- [ ] Env variable didokumentasikan di `.env.example`?
- [ ] Prisma migration ada?

---

## 📋 Verification Commands

```bash
# Backend (NestJS)
cd backend && npm run lint && npm run build && npm run test

# Frontend (SvelteKit)
cd frontend && npm run lint && npm run check && npm run test && npm run build
```

---

*Last Updated: 2026-06-25*
*Source: PRD v2 (Modular Documentation)*
