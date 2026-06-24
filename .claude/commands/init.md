# /init Command

When Claude Code starts, this command provides project-specific initialization.

## Project Overview

**POS Nabil** - Point of Sale system for Ngemiloh (snack business).
- **Backend:** NestJS 11 + PostgreSQL 16 + Prisma 6 + Redis 7
- **Frontend:** SvelteKit 2 + Svelte 5 (Runes) + Tailwind CSS 4
- **Infrastructure:** Docker + Caddy reverse proxy

### Key Capabilities
Offline-first POS, QRIS payment (Midtrans), shift management, audit logging, multi-kasir support, member loyalty system.

### Business Model
```
┌─────────────────────────────────────────────────────────────────┐
│                    FRANCHISE MODEL KHUSUS                        │
│    NGEMILOH HQ                                                   │
│        │                                                          │
│        │ Supplier Raw Materials                                    │
│        ▼                                                          │
│    ┌────┴────┐    ┌────┴────┐    ┌────┴────┐                 │
│    │ Outlet A │    │ Outlet B │    │ Outlet C │                 │
│    │ Kasir 1  │    │ Kasir 2  │    │ Kasir 3  │               │
│    │(Freelance)│   │(Freelance)│   │(Freelance)│             │
│    └─────────┘    └─────────┘    └─────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## User Preferences (CRITICAL)

1. **snake_case naming** - All code MUST use snake_case for variables, functions, methods, properties, and file names
2. **Simple Code** - Sederhana, readable, tanpa complexity & duplikasi tidak perlu, mudah debug & fix
3. **Deep analysis** - Analyze thoroughly before implementing
4. **Best practice solutions** - Options with pros/cons
5. **Strict Verification (MANDATORY)** - Setiap perubahan WAJIB disertai Build + Test + Type Check + Code Review

---

## Agent-Skills Overview

Agent-skills adalah 24 structured workflows untuk production-grade engineering. Skills orchestrate development lifecycle secara otomatis.

### 7 Slash Commands (Entry Points)

| Command | Phase | Description |
|---------|-------|-------------|
| `/spec` | DEFINE | Buat spec PRD sebelum coding |
| `/plan` | PLAN | Breakdown jadi small, atomic tasks |
| `/build` | BUILD | Implementasi incremental (thin slices) |
| `/test` | VERIFY | Prove it works dengan tests |
| `/review` | REVIEW | Quality gate sebelum merge |
| `/code-simplify` | REVIEW | Simplify code, clarity over cleverness |
| `/ship` | SHIP | Deploy to production |

**Example:** `/build` internally calls: `incremental-implementation`, `test-driven-development`, `frontend-ui-engineering`, `api-and-interface-design`, dll sesuai konteks task.

### 24 Skills (Auto-Activated)

Skills activate otomatis berdasarkan konteks task. Gunakan `Skill` tool untuk invoke manual.

#### Define → Plan → Build
| Skill | When |
|-------|-------|
| `interview-me` | Request underspecified |
| `idea-refine` | Rough concept |
| `spec-driven-development` | New feature |
| `planning-and-task-breakdown` | Need task breakdown |
| `incremental-implementation` | Multi-file change |
| `test-driven-development` | Implementing logic, bugs |
| `frontend-ui-engineering` | UI work |
| `api-and-interface-design` | API design |
| `source-driven-development` | Need official docs |
| `doubt-driven-development` | High-stakes, unfamiliar |
| `context-engineering` | Session/task switch |

#### Verify → Review → Ship
| Skill | When |
|-------|-------|
| `browser-testing-with-devtools` | Browser debugging |
| `debugging-and-error-recovery` | Tests fail, errors |
| `code-review-and-quality` | Before merge |
| `code-simplification` | Complex code |
| `security-and-hardening` | Security concerns |
| `performance-optimization` | Performance issues |
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

### Reference Checklists (MANDATORY)

References adalah **cheat sheet** yang WAJIB di-load saat relevant. Mereka companion ke skills.

| Reference | Skill Companion | Kapan Load |
|-----------|---------------|------------|
| `agent-skills/references/testing-patterns.md` | `test-driven-development` | Writing tests, mocking |
| `agent-skills/references/security-checklist.md` | `security-and-hardening` | Auth, input, OWASP |
| `agent-skills/references/performance-checklist.md` | `performance-optimization` | Core Web Vitals, bundle |
| `agent-skills/references/accessibility-checklist.md` | `frontend-ui-engineering` | WCAG 2.1 AA, ARIA |
| `agent-skills/references/orchestration-patterns.md` | `git-workflow-and-versioning` | Multi-agent work |

### Reference-by-Skill Mapping (COMPLETE)

Pemetaan menyeluruh skills + references ke seluruh struktur project.

#### Skill → Reference Quick Reference

| Skill | Reference File | Primary Use Case |
|-------|---------------|------------------|
| `test-driven-development` | `agent-skills/references/testing-patterns.md` | Unit tests, mocking, assertions |
| `frontend-ui-engineering` | `agent-skills/references/accessibility-checklist.md` | Svelte components, WCAG 2.1 AA |
| `security-and-hardening` | `agent-skills/references/security-checklist.md` | Auth, payment, OWASP Top 10 |
| `performance-optimization` | `agent-skills/references/performance-checklist.md` | Queries, bundle, Core Web Vitals |
| `git-workflow-and-versioning` | `agent-skills/references/orchestration-patterns.md` | Multi-agent, parallel work |

#### Backend File Mapping (Key Files)

| File Pattern | Primary Skill | Secondary Skills |
|--------------|--------------|------------------|
| `auth/**/*.ts` | `security-and-hardening` | `test-driven-development` |
| `orders/**/*.ts` | `test-driven-development` | `security-and-hardening` |
| `payment/**/*.ts` | `security-and-hardening` | `test-driven-development` |
| `finance/**/*.ts` | `test-driven-development` | `security-and-hardening` |
| `inventory/**/*.ts` | `test-driven-development` | `performance-optimization` |
| `products/**/*.ts` | `test-driven-development` | `performance-optimization` |
| `discounts/**/*.ts` | `test-driven-development` | `security-and-hardening` |
| `members/**/*.ts` | `security-and-hardening` | `test-driven-development` |
| `email/**/*.ts` | `security-and-hardening` | `test-driven-development` |
| `audit/**/*.ts` | `security-and-hardening` | - |
| `jobs/**/*.ts` | `performance-optimization` | `test-driven-development` |
| `common/**/*.ts` | `security-and-hardening` | `performance-optimization` |
| `**/repository.ts` | `performance-optimization` | `test-driven-development` |
| `**/*controller.ts` | `security-and-hardening` | `performance-optimization` |

#### Frontend File Mapping (Key Files)

| File Pattern | Primary Skill | Secondary Skills |
|--------------|--------------|------------------|
| `routes/**/+.svelte` | `frontend-ui-engineering` | `security-and-hardening` |
| `lib/components/**/*.svelte` | `frontend-ui-engineering` | `test-driven-development` |
| `pos/**` | `frontend-ui-engineering` | `performance-optimization` |
| `login/**` | `frontend-ui-engineering` | `security-and-hardening` |
| `admin/**` | `frontend-ui-engineering` | `security-and-hardening` |

#### Complete Reference Loading Workflow

```
Task arrives
    │
    ├── Identify primary skill based on task type
    │
    ├── Load associated reference(s):
    │   ├── Writing tests → agent-skills/references/testing-patterns.md
    │   ├── UI components → agent-skills/references/accessibility-checklist.md
    │   ├── Auth/payment → agent-skills/references/security-checklist.md
    │   ├── DB/API → agent-skills/references/performance-checklist.md
    │   └── Multi-agent → agent-skills/references/orchestration-patterns.md
    │
    ├── Apply checklist items from reference
    │
    └── Continue with skill workflow
```

#### Decision Matrix

| Task Type | Primary Skill | Reference to Load |
|-----------|--------------|-------------------|
| Writing unit tests | `test-driven-development` | `agent-skills/references/testing-patterns.md` |
| Building Svelte components | `frontend-ui-engineering` | `agent-skills/references/accessibility-checklist.md` |
| Auth endpoint changes | `security-and-hardening` | `agent-skills/references/security-checklist.md` |
| Payment integration | `security-and-hardening` | `agent-skills/references/security-checklist.md` |
| Database queries | `performance-optimization` | `agent-skills/references/performance-checklist.md` |
| API design | `api-and-interface-design` | - |
| Browser debugging | `browser-testing-with-devtools` | - |
| Bug fixing | `debugging-and-error-recovery` | - |
| Pre-merge review | `code-review-and-quality` | `agent-skills/references/security-checklist.md` |
| Code complexity | `code-simplification` | - |
| Multi-agent work | `git-workflow-and-versioning` | `agent-skills/references/orchestration-patterns.md` |
| Production deploy | `shipping-and-launch` | `agent-skills/references/security-checklist.md` + `agent-skills/references/performance-checklist.md` |

#### Verification Checklist

- [ ] Skill identified based on task type
- [ ] Relevant reference(s) loaded
- [ ] Checklist items applied
- [ ] Tests written with testing patterns
- [ ] Accessibility features implemented
- [ ] Security controls in place
- [ ] Performance optimized

### Development Lifecycle

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
All reports filter by `shift_start..shift_end`, NOT `created_at::date`. Shift crosses midnight = still same business day.

### JWT Auth (No Refresh Tokens)
- **Kasir:** 365-day access token (unlimited - admin controls via PIN reset/delete)
- **Admin:** 12-hour access token, email + 6-digit OTP
- No logout/revoke mechanism - tokens expire automatically

### Database Safety
Use `SELECT ... FOR UPDATE` pattern for idempotent state transitions (payment, void, shift close).

---

## Missing Features (Priority)

| Feature | Priority | Status |
|---------|----------|--------|
| Waste Tracking | MEDIUM | ❌ Not Built |
| BOM Recipes | MEDIUM | ⚠️ Partial |
| Outlet Management | HIGH | ⚠️ Partial |
| Check-in System | MEDIUM | ⚠️ Partial |
| Online Order Integration | LOW | Future |

---

## Project Structure

### Backend (`backend/`)
```
backend/
├── src/
│   ├── auth/           # JWT auth, PIN login, OTP for admin
│   ├── orders/         # Order processing with state machine
│   ├── products/       # Product catalog with modifiers
│   ├── inventory/      # Stock management, BOM recipes
│   ├── finance/        # Cash register, shift, profit share
│   ├── discounts/      # Scheduled discount campaigns
│   ├── members/        # Member & loyalty system
│   ├── payment/        # Midtrans QRIS + Fake gateway
│   ├── receipts/       # Receipt generation
│   ├── email/          # OTP and alert notifications
│   ├── audit/          # Audit logging interceptor
│   ├── jobs/           # BullMQ background jobs
│   ├── flags/          # Feature flags
│   ├── users/          # User management
│   ├── prisma/         # Database service
│   ├── common/         # Shared utilities, redis, filters
│   ├── dto/            # Data transfer objects
│   └── types/          # Type definitions
├── prisma/
│   ├── schema.prisma   # Database schema
│   ├── seed.ts         # Database seeder
│   └── migrations/     # Migration files
└── test/               # e2e tests
```

### Frontend (`frontend/`)
```
frontend/
├── src/
│   ├── routes/
│   │   ├── admin/          # Admin panel (13+ sub-pages)
│   │   ├── pos/            # POS interface
│   │   ├── member/         # Public member registration
│   │   ├── login/          # Kasir PIN login
│   │   ├── login-admin/     # Admin email+OTP login
│   │   └── shift/          # Shift open/close
│   └── lib/
│       ├── components/pos/   # POS UI components
│       ├── services/         # api, pos, printer, member services
│       ├── stores/           # Svelte 5 Runes stores
│       └── domain/          # Domain types and logic
└── package.json
```

### Infrastructure (Root)
```
├── docker-compose.yml    # 4 services: postgres, redis, nestjs-api, caddy
├── Caddyfile           # Reverse proxy config
├── .env                # Environment config
└── secrets/            # Docker secrets files
```

---

## Commands

### Backend (`./backend`)
```bash
npm run build           # Build NestJS app
npm run start:dev       # Development with hot reload
npm run lint            # ESLint with auto-fix
npm run test            # Jest unit tests
npx prisma migrate dev  # Run migrations (dev)
npx prisma db seed     # Seed database
```

### Frontend (`./frontend`)
```bash
npm run dev             # Development server
npm run build           # Production build
npm run check           # TypeScript + Svelte check
npm run lint            # Prettier + ESLint
npm run test            # Vitest unit tests
```

### Docker
```bash
docker compose up -d              # Start all services
docker compose down                # Stop all services
docker compose logs -f           # View logs
docker compose exec nestjs-api sh # Shell into API container
```

---

## Verification (MANDATORY)

### Evidence Before Assertions
**"Seems right" is NEVER sufficient** - Always show evidence:
- Test output proving tests pass
- Build output proving compilation succeeds
- Type check output proving no errors

### Verification Order
```
Backend: npm run lint → npm run build → npm run test
Frontend: npm run lint → npm run check → npm run test → npm run build
```

### Critical Rules
- **Test failures = incomplete** - Fitur TIDAK dianggap selesai jika tests gagal
- **Build failed = incomplete** - Jangan lanjutkan jika build gagal
- **Lint warnings = fix** - Jangan abaikan lint warnings
- **Commit without verification = violate rules** - Verification WAJIB sebelum commit

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
    │   ├── API work? ───────────────────→ api-and-interface-design
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

These behaviors apply at all times:

1. **Surface Assumptions** - State assumptions before implementing
2. **Manage Confusion Actively** - STOP when inconsistent, ask not guess
3. **Push Back When Warranted** - You are not a yes-machine
4. **Enforce Simplicity** - resist overcomplication
5. **Scope Discipline** - Touch only what you're asked to touch
6. **Verify, Don't Assume** - Evidence before assertions
