# POS Nabil - Claude Code Reference

Quick reference untuk project POS Nabil. Untuk detail lengkap, lihat `init.md` atau `CLAUDE.md`.

---

## Project Overview

**POS Nabil** - Point of Sale system untuk Ngemiloh (snack business).

| Component | Technology |
|----------|-----------|
| Backend | NestJS 11 + PostgreSQL 16 + Prisma 6 + Redis 7 |
| Frontend | SvelteKit 2 + Svelte 5 (Runes) + Tailwind CSS 4 |
| Infrastructure | Docker + Caddy reverse proxy |

### Key Capabilities
Offline-first POS, QRIS payment (Midtrans), shift management, audit logging, multi-kasir support, member loyalty system.

---

## User Preferences (CRITICAL)

| # | Rule | Description |
|---|------|-------------|
| 1 | **snake_case naming** | All code MUST use snake_case |
| 2 | **Simple Code** | Readable, tanpa complexity tidak perlu |
| 3 | **Deep analysis** | Analyze thoroughly before implementing |
| 4 | **Best practice** | Options with pros/cons |
| 5 | **Strict Verification** | Build + Test + Type Check + Review WAJIB |

---

## Agent-Skills Integration

Agent-skills adalah 24 structured workflows untuk production-grade engineering.

### 7 Slash Commands (Entry Points)

| Command | Phase | What It Does |
|---------|-------|-------------|
| `/spec` | DEFINE | Buat spec sebelum coding |
| `/plan` | PLAN | Breakdown jadi atomic tasks |
| `/build` | BUILD | Implementasi incremental |
| `/test` | VERIFY | Prove it works |
| `/review` | REVIEW | Quality gate |
| `/code-simplify` | REVIEW | Clarity over cleverness |
| `/ship` | SHIP | Deploy to production |

> **Note:** Slash commands tidak available di VSCode Extension. Gunakan `Skill` tool sebagai alternatif.

### 24 Skills (Auto-Activated)

Skills dipanggil otomatis berdasarkan konteks atau via `Skill` tool.

#### Define Phase
| Skill | When |
|-------|-------|
| `interview-me` | Request underspecified |
| `idea-refine` | Rough concept |
| `spec-driven-development` | New feature |

#### Plan Phase
| Skill | When |
|-------|-------|
| `planning-and-task-breakdown` | Need task breakdown |

#### Build Phase
| Skill | When |
|-------|-------|
| `incremental-implementation` | Multi-file change |
| `test-driven-development` | Logic, bugs |
| `frontend-ui-engineering` | UI work |
| `api-and-interface-design` | API design |
| `source-driven-development` | Need official docs |
| `doubt-driven-development` | High-stakes |
| `context-engineering` | Session/task switch |

#### Verify Phase
| Skill | When |
|-------|-------|
| `browser-testing-with-devtools` | Browser debugging |
| `debugging-and-error-recovery` | Tests fail, errors |

#### Review Phase
| Skill | When |
|-------|-------|
| `code-review-and-quality` | Before merge |
| `code-simplification` | Complex code |
| `security-and-hardening` | Security concerns |
| `performance-optimization` | Performance issues |

#### Ship Phase
| Skill | When |
|-------|-------|
| `git-workflow-and-versioning` | Every commit |
| `ci-cd-and-automation` | CI/CD setup |
| `shipping-and-launch` | Production deploy |
| `deprecation-and-migration` | Remove features |
| `documentation-and-adrs` | Architectural decisions |
| `observability-and-instrumentation` | Add telemetry |

### Specialist Agents (via `Agent` tool)

| Agent | Perspective |
|-------|-------------|
| `code-reviewer` | Staff Engineer code review |
| `security-auditor` | Vulnerability detection |
| `test-engineer` | Test strategy, coverage |
| `web-performance-auditor` | Core Web Vitals audit |

---

## Reference Checklists (MANDATORY)

References adalah **cheat sheet** yang WAJIB di-load saat relevant. Companion ke skills.

| Reference | Skill Companion | Kapan Load |
|-----------|---------------|------------|
| `agent-skills/references/testing-patterns.md` | `test-driven-development` | Writing tests, mocking |
| `agent-skills/references/security-checklist.md` | `security-and-hardening` | Auth, input, OWASP |
| `agent-skills/references/performance-checklist.md` | `performance-optimization` | Core Web Vitals, bundle |
| `agent-skills/references/accessibility-checklist.md` | `frontend-ui-engineering` | WCAG 2.1 AA, ARIA |
| `agent-skills/references/orchestration-patterns.md` | `git-workflow-and-versioning` | Multi-agent work |

### Reference-by-Skill Mapping (WAJIB)

| When Working On | MUST Load |
|-----------------|----------|
| Writing tests | `agent-skills/references/testing-patterns.md` |
| Building UI | `agent-skills/references/accessibility-checklist.md` |
| Security/auth | `agent-skills/references/security-checklist.md` |
| Performance | `agent-skills/references/performance-checklist.md` |
| Pre-launch | `agent-skills/references/security-checklist.md` + `agent-skills/references/performance-checklist.md` |
| Code review | `agent-skills/references/security-checklist.md` |

### Reference Usage Workflow

```
Skill invoked → Check reference needed → Load reference → Apply checklist → Continue
```

---

## Development Lifecycle

```
  DEFINE          PLAN           BUILD          VERIFY         REVIEW          SHIP
┌──────┐      ┌──────┐      ┌──────┐      ┌──────┐      ┌──────┐      ┌──────┐
│ Spec │ ───▶ │ Plan │ ───▶ │ Code │ ───▶ │ Test │ ───▶ │  QA  │ ───▶ │  Go  │
│     │      │     │      │ Impl │      │Debug │      │ Gate │      │ Live │
└──────┘      └──────┘      └──────┘      └──────┘      └──────┘      └──────┘
  /spec          /plan          /build        /test         /review       /ship
```

---

## Key Patterns

### Shift = Business Date
Reports filter by `shift_start..shift_end`, NOT `created_at::date`.

### JWT Auth (No Refresh Tokens)
| User | Token | Auth Method |
|------|-------|------------|
| Kasir | 365-day | PIN only |
| Admin | 12-hour | Email + 6-digit OTP |

### Database Safety
Use `SELECT ... FOR UPDATE` for idempotent state transitions.

---

## Missing Features (Priority)

| Feature | Priority | Status |
|---------|----------|--------|
| Member Registration | HIGH | ✅ Built |
| Loyalty Tier System | HIGH | ✅ Built |
| Waste Tracking | MEDIUM | ❌ Not Built |
| BOM Recipes | MEDIUM | ⚠️ Partial |
| Outlet Management | HIGH | ⚠️ Partial |
| Check-in System | MEDIUM | ⚠️ Partial |
| Online Order Integration | LOW | Future |

---

## Commands

### Backend (`./backend`)
```bash
npm run build           # Build NestJS
npm run start:dev       # Hot reload dev
npm run lint            # ESLint
npm run test            # Jest tests
npx prisma migrate dev  # Run migrations
npx prisma db seed     # Seed database
```

### Frontend (`./frontend`)
```bash
npm run dev             # SvelteKit dev
npm run build           # Production build
npm run check           # TypeScript + Svelte check
npm run lint            # Prettier + ESLint
npm run test            # Vitest tests
```

### Docker
```bash
docker compose up -d              # Start services
docker compose down                # Stop services
docker compose logs -f           # View logs
docker compose exec nestjs-api sh # Shell into container
```

---

## Verification (MANDATORY)

### Evidence Before Assertions
**"Seems right" is NEVER sufficient** - Always show evidence.

### Verification Order
```
Backend:  npm run lint → npm run build → npm run test
Frontend: npm run lint → npm run check → npm run test → npm run build
```

### Critical Rules
- **Test failures = incomplete** - Jangan lanjutkan jika tests gagal
- **Build failed = incomplete** - Jangan lanjutkan jika build gagal
- **Lint warnings = fix** - Jangan abaikan warnings
- **Commit without verification** - WAJIB verification sebelum commit

---

## Skill Discovery Flow

```
Task arrives
    │
    ├── Don't know what you want? ──────→ interview-me
    ├── Rough concept? ───────────────────→ idea-refine
    ├── New feature? ──────────────────────→ spec-driven-development
    ├── Have spec, need tasks? ───────────→ planning-and-task-breakdown
    ├── Implementing code? ────────────────→ incremental-implementation
    │   ├── UI work? ────────────────────→ frontend-ui-engineering
    │   ├── API work? ──────────────────→ api-and-interface-design
    │   ├── High stakes? ────────────────→ doubt-driven-development
    │   └── Tests / bugs? ───────────────→ test-driven-development
    ├── Something broke? ─────────────────→ debugging-and-error-recovery
    ├── Browser issues? ──────────────────→ browser-testing-with-devtools
    ├── Before merge? ───────────────────→ code-review-and-quality
    ├── Code too complex? ───────────────→ code-simplification
    ├── Security concerns? ───────────────→ security-and-hardening
    ├── Performance issues? ───────────────→ performance-optimization
    └── Deploying? ──────────────────────→ shipping-and-launch
```

---

## Core Operating Behaviors

| # | Behavior | Description |
|---|---------|-------------|
| 1 | **Surface Assumptions** | State assumptions before implementing |
| 2 | **Manage Confusion Actively** | STOP when inconsistent, ask not guess |
| 3 | **Push Back When Warranted** | Not a yes-machine |
| 4 | **Enforce Simplicity** | Resist overcomplication |
| 5 | **Scope Discipline** | Touch only what you're asked |
| 6 | **Verify, Don't Assume** | Evidence before assertions |

---

## Quick Start

1. Baca CLAUDE.md dan agent-skills/ untuk konteks
2. **ANALYZE FIRST** - Deep analysis sebelum code
3. **INVOKE SKILLS** - Skills auto atau via `Skill` tool
4. **IMPLEMENT** - Piece by piece dengan verification
5. **VERIFY EVERY STEP** - Build → Test → Type Check
6. **REVIEW BEFORE COMMIT** - Code review
7. **COMMIT WITH EVIDENCE** - Sertakan verification output

---

## Project Structure

```
backend/
├── src/
│   ├── auth/           # JWT auth, PIN login, OTP
│   ├── orders/         # Order processing
│   ├── products/       # Product catalog
│   ├── inventory/      # Stock management
│   ├── finance/        # Cash register, shift
│   ├── discounts/      # Discount campaigns
│   ├── members/        # Member & loyalty
│   ├── payment/        # Midtrans QRIS
│   ├── receipts/       # Receipt generation
│   ├── email/          # OTP notifications
│   ├── audit/          # Audit logging
│   └── common/         # Shared utilities
└── prisma/
    └── schema.prisma   # Database schema

frontend/
├── src/routes/
│   ├── admin/          # Admin panel
│   ├── pos/            # POS interface
│   ├── member/         # Member registration
│   ├── login/          # Kasir PIN login
│   └── shift/          # Shift open/close
└── src/lib/
    ├── components/pos/   # POS components
    ├── services/         # API services
    └── stores/           # Svelte stores
```

---

## Reference Quick Lookup

| Task Type | Reference |
|-----------|-----------|
| Write tests | `agent-skills/references/testing-patterns.md` |
| Build UI | `agent-skills/references/accessibility-checklist.md` |
| Security work | `agent-skills/references/security-checklist.md` |
| Performance | `agent-skills/references/performance-checklist.md` |
| Multi-agent | `agent-skills/references/orchestration-patterns.md` |

**Full quick ref:** `REFERENCES_QUICKREF.md`
