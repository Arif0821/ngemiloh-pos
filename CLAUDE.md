# POS Nabil - Claude Code Instructions

> Ngemiloh franchise POS: offline-first, QRIS payment, shift management, member loyalty.

---

## ⚡ CRITICAL Rules (Enforced Always)

| Rule | Description |
|------|-------------|
| **snake_case ONLY** | All code variables/functions use snake_case. No camelCase. |
| **VERIFY Before Claim** | Show evidence: `npm run lint → build → test` |
| **Evidence > Assertion** | "Seems right" is NEVER sufficient |
| **Stop on Confusion** | Ask, don't guess |
| **Shift = Business Date** | Reports filter by `shift_start..shift_end`, NOT `created_at::date` |
| **DB Safety** | Use `SELECT ... FOR UPDATE` for idempotent state transitions |

---

## 🧠 Prinsip Dasar

1. **Analisa mendalam** — baca file relevan sebelum coding
2. **Minimal 3 opsi** — pro/cons untuk setiap solusi beserta rekomendasi terbaik
3. **Banyak tanya** — jangan asumsikan kebutuhan
4. **Multi-file impact** — identifikasi semua file yang terpengaruh
5. **Kode sederhana** — hindari over-engineering
6. **Sesuaikan versi** — check runtime version sebelum coding

---

## 👤 Claude Code Roles

Claude Code assume 8 roles based on task context. **BUKAN role aplikasi** (Kasir/Admin), tapi peran AI saat bekerja.

| Role | Kapan Aktif | Fokus Utama |
|------|-------------|-------------|
| **Solution Architect** | Desain sistem, arsitektur, ERD, API contract | Clean architecture, dependency injection |
| **Backend Developer** | Kode di `backend/` | NestJS, Prisma, JWT, Redis, BullMQ |
| **Frontend Developer** | Kode di `frontend/` | SvelteKit, Svelte 5 Runes ($state, $derived, $effect) |
| **DBA** | Schema, migrasi, query | Prisma, index, constraint, N+1 prevention |
| **DevOps Engineer** | Docker, CI/CD, Coolify | Multi-stage build, healthcheck, secrets |
| **Security Engineer** | Auth, environment, endpoint | JWT hardening, rate limiting, CORS whitelist |
| **QA Engineer** | Fitur baru, bugfix, deploy | Jest unit test, Supertest, Playwright E2E |
| **Product Owner** | Klarifikasi fitur, prioritas | Kriteria selesai, scope management |

---

## 🚫 Larangan Keras

- ❌ Hardcode credential/secret/URL production
- ❌ `any` di TypeScript tanpa alasan
- ❌ Breaking change DB tanpa konfirmasi
- ❌ Push ke main tanpa CI passing
- ❌ Empty catch block
- ❌ `db push` di production

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

## 🔧 Skills & Commands

### Slash Commands

| Command | Skill Orchestrated | Purpose |
|---------|-------------------|---------|
| `/spec` | `spec-driven-development` | Buat spec PRD sebelum coding |
| `/plan` | `planning-and-task-breakdown` | Breakdown jadi atomic tasks |
| `/build` | `incremental-implementation` + domain skills | Implementasi incremental |
| `/test` | `test-driven-development` | Prove it works dengan tests |
| `/review` | `code-review-and-quality` | Quality gate sebelum merge |
| `/code-simplify` | `code-simplification` | Clarity over cleverness |
| `/ship` | Parallel fan-out: code-reviewer + security-auditor + test-engineer | Pre-launch checklist |

### 24 Skills by Phase

| Phase | Skill | When to Use |
|-------|-------|-------------|
| Define | `interview-me` | Request underspecified |
| Define | `idea-refine` | Rough concept |
| Define | `spec-driven-development` | New feature/project |
| Plan | `planning-and-task-breakdown` | Breakdown tasks |
| Build | `incremental-implementation` | Multi-file change |
| Build | `test-driven-development` | Logic, bugs (Prove-It) |
| Build | `frontend-ui-engineering` | UI components, WCAG 2.1 AA |
| Build | `api-and-interface-design` | APIs, module boundaries |
| Build | `source-driven-development` | Need official docs |
| Build | `doubt-driven-development` | High-stakes decisions |
| Build | `context-engineering` | Session/task switch |
| Verify | `browser-testing-with-devtools` | Browser debugging |
| Verify | `debugging-and-error-recovery` | Tests fail, errors |
| Review | `code-review-and-quality` | Five-axis review |
| Review | `code-simplification` | Complex code |
| Review | `security-and-hardening` | Auth, OWASP Top 10 |
| Review | `performance-optimization` | Core Web Vitals |
| Ship | `git-workflow-and-versioning` | Every commit |
| Ship | `ci-cd-and-automation` | CI/CD setup |
| Ship | `shipping-and-launch` | Production deploy |
| Ship | `deprecation-and-migration` | Removing features |
| Ship | `documentation-and-adrs` | Architectural decisions |
| Ship | `observability-and-instrumentation` | Telemetry, logging |

### Decision Matrix

| Task | Primary Skill | Secondary |
|------|--------------|-----------|
| Writing tests | `test-driven-development` | - |
| Building UI | `frontend-ui-engineering` | `test-driven-development` |
| Auth changes | `security-and-hardening` | `test-driven-development` |
| API changes | `api-and-interface-design` | `security-and-hardening` |
| Database queries | `performance-optimization` | `test-driven-development` |
| Multi-agent work | `git-workflow-and-versioning` | - |
| Refactoring | `code-simplification` | `test-driven-development` |
| New feature | `spec-driven-development` | `planning-and-task-breakdown` |
| Bug fix | `debugging-and-error-recovery` | `test-driven-development` |

### Skills Auto-Activation

| Task Pattern | Skills |
|--------------|--------|
| "fix bug", "error" | `debugging-and-error-recovery` |
| "UI", "component" | `frontend-ui-engineering` |
| "API", "endpoint" | `api-and-interface-design` |
| "review", "quality" | `code-review-and-quality` |

### How to Invoke

```
Task arrives
    │
    ├── Automatic: Skills activate based on context
    │
    └── Manual: Skill{skill: "skill-name"}
```

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | NestJS 11 + PostgreSQL 16 + Prisma 6 + Redis 7 + BullMQ |
| Frontend | SvelteKit 2 + Svelte 5 (Runes) + Tailwind CSS 4 |
| Infra | Docker + Caddy reverse proxy |

### Project Structure
```
backend/src/       # NestJS modules: auth, orders, products, inventory, finance, members, payment
backend/prisma/    # Schema + migrations
frontend/src/      # SvelteKit: routes/admin, routes/pos, routes/member
```

---

## 📋 Commands

```bash
# Backend
npm run build     # Build
npm run start:dev # Dev server
npm run lint      # Lint
npm run test      # Test

# Frontend
npm run dev       # Dev server
npm run build     # Build
npm run check     # Type check
npm run lint      # Lint
npm run test      # Test

# Docker
docker compose up -d    # Start
docker compose logs -f  # Logs
```

---

## 📊 Business Rules (PRD v8.1)

### Profit Share Formula
```
Gross Revenue = Total Penjualan (termasuk PPN)
PPN = Gross Revenue × 11%
Net Profit = Net Revenue - HPP - Opex - Depreciation

Owner Share = Net Profit × 60%
Kasir Pool = Net Profit × 40%
Per Kasir = Kasir Pool × (Kasir Sales / Total Sales)
```

### Loyalty Tiers
| Tier | Min Points | Discount |
|------|------------|----------|
| Bronze | 0 | 0% |
| Silver | 500 | 5% |
| Gold | 1,500 | 10% |
| Platinum | 5,000 | 15% |

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

## 🔐 Security (JWT Auth)

| Role | Token | Method |
|------|-------|--------|
| Kasir | 365-day access token | PIN |
| Admin | 12-hour access token | Email + 6-digit OTP |

**No logout/revoke** - tokens expire automatically.

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
| Architecture | `SPEC.md` |
| Red Team Findings | `docs/red-team-findings.md` |
| API Docs | `docs/api/` |
| ADRs | `docs/decisions/` |
| Guides | `docs/guides/` |
| Memory | `memory/` |

---

## 📋 Quick Reference Card

### Reference by Task Type (MANDATORY LOAD)

| Task Type | Load This Reference |
|-----------|---------------------|
| Writing tests | `agent-skills/references/testing-patterns.md` |
| Building UI components | `agent-skills/references/accessibility-checklist.md` |
| Security/auth changes | `agent-skills/references/security-checklist.md` |
| Performance work | `agent-skills/references/performance-checklist.md` |
| Pre-launch/deploy | `agent-skills/references/security-checklist.md` + `agent-skills/references/performance-checklist.md` |
| Code review | `agent-skills/references/security-checklist.md` |
| Multi-agent work | `agent-skills/references/orchestration-patterns.md` |

### 5 References & Key Items

| # | File | Skill | Key Items |
|---|------|-------|-----------|
| 1 | `agent-skills/references/testing-patterns.md` | `test-driven-development` | AAA, naming, mocking |
| 2 | `agent-skills/references/security-checklist.md` | `security-and-hardening` | OWASP Top 10, auth |
| 3 | `agent-skills/references/performance-checklist.md` | `performance-optimization` | CWV, TTFB, bundle |
| 4 | `agent-skills/references/accessibility-checklist.md` | `frontend-ui-engineering` | WCAG 2.1 AA, ARIA |
| 5 | `agent-skills/references/orchestration-patterns.md` | `git-workflow-and-versioning` | Multi-agent patterns |

### Orchestration Patterns (Multi-Agent)

**Endorsed:**
- Direct invocation (single persona)
- Single-persona slash command
- Parallel fan-out with merge (`/ship`)
- Sequential as user-driven

**Anti-Patterns (AVOID):**
- Router persona
- Persona calling persona
- Deep persona trees

### Checklist Before Complete
Before any task is complete:

- [ ] Skill identified correctly based on task type
- [ ] Reference loaded and applied (testing/security/performance/accessibility)
- [ ] Checklist items from reference verified in code
- [ ] Tests written using testing patterns (AAA, DAMP naming)
- [ ] Accessibility features implemented (WCAG 2.1 AA)
- [ ] Security controls in place (OWASP Top 10)
- [ ] Performance optimized where applicable (Core Web Vitals)

---

## 🎯 Missing Features

| Feature | Priority | Status |
|---------|----------|--------|
| Waste Tracking | MEDIUM | ❌ Not Built |
| BOM Recipes | MEDIUM | ⚠️ Partial |
| Outlet Management | HIGH | ⚠️ Partial |
| Check-in System | MEDIUM | ⚠️ Partial |
