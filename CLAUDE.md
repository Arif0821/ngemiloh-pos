# CLAUDE.md

Project-specific instructions for Claude Code.

---

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

## Agent-Skills Integration

Agent-skills adalah production-grade engineering skills yang automate workflow development. Skills diaktivasi **otomatis** berdasarkan konteks task atau bisa dipanggil manual via slash commands.

### 7 Slash Commands (Entry Points)

| Command | Lifecycle Phase | What It Does |
|---------|----------------|--------------|
| `/spec` | DEFINE | Buat spec sebelum coding |
| `/plan` | PLAN | Breakdown task menjadi small, atomic pieces |
| `/build` | BUILD | Implementasi incremental (1 slice at a time) |
| `/test` | VERIFY | Prove it works dengan tests |
| `/review` | REVIEW | Quality gate sebelum merge |
| `/code-simplify` | REVIEW | Clarity over cleverness |
| `/ship` | SHIP | Deploy to production dengan confidence |

**Tip:** Slash commands orchestrate skills secara otomatis. Kamu cukup ketik `/build`, agent akan memanggil skills yang diperlukan.

### 24 Skills (Granular Workflows)

Skills dipanggil otomatis berdasarkan konteks atau bisa dipanggil manual via `Skill` tool.

#### Define Phase
| Skill | When to Use |
|-------|-------------|
| `interview-me` | Request underspecified, perlu clarify apa user sebenarnya mau |
| `idea-refine` | Rough concept yang perlu exploration |
| `spec-driven-development` | New feature/project, requirements unclear |

#### Plan Phase
| Skill | When to Use |
|-------|-------------|
| `planning-and-task-breakdown` | Spec ready, perlu breakdown jadi implementable tasks |

#### Build Phase
| Skill | When to Use |
|-------|-------------|
| `incremental-implementation` | Multi-file change, implement thin vertical slices |
| `test-driven-development` | Implementing logic, fixing bugs (Prove-It pattern) |
| `frontend-ui-engineering` | Building UI components, WCAG 2.1 AA |
| `api-and-interface-design` | Designing APIs, module boundaries |
| `source-driven-development` | Perlu cite official documentation |
| `doubt-driven-development` | High-stakes decisions, unfamiliar code |
| `context-engineering` | Session start, task switch, output quality drop |

#### Verify Phase
| Skill | When to Use |
|-------|-------------|
| `browser-testing-with-devtools` | Browser debugging, DOM inspection, network traces |
| `debugging-and-error-recovery` | Tests fail, builds break, unexpected behavior |

#### Review Phase
| Skill | When to Use |
|-------|-------------|
| `code-review-and-quality` | Before merge, five-axis review |
| `code-simplification` | Code works but too complex |
| `security-and-hardening` | Input handling, auth, OWASP Top 10 |
| `performance-optimization` | Core Web Vitals, profiling |

#### Ship Phase
| Skill | When to Use |
|-------|-------------|
| `git-workflow-and-versioning` | Every commit, atomic commits |
| `ci-cd-and-automation` | CI/CD setup, quality gates |
| `shipping-and-launch` | Production deployment, rollback |
| `deprecation-and-migration` | Removing features, zombie code |
| `documentation-and-adrs` | Architectural decisions, API docs |
| `observability-and-instrumentation` | Adding telemetry, logging, metrics |

### Specialist Agents (via `Agent` tool)
| Agent | When to Use |
|-------|-------------|
| `code-reviewer` | Thorough code review (staff engineer standard) |
| `security-auditor` | Security vulnerability scan, OWASP assessment |
| `test-engineer` | Test strategy, coverage analysis |
| `web-performance-auditor` | Core Web Vitals audit |

### Reference Checklists (MANDATORY)

Quick references yang **WAJIB** di-load saat relevant. References adalah **cheat sheet** yang membuat skills lebih complete.

| Reference | Skill Companion | Kapan Load |
|-----------|---------------|------------|
| `agent-skills/references/testing-patterns.md` | `test-driven-development` | Writing tests, mocking, assertions |
| `agent-skills/references/security-checklist.md` | `security-and-hardening` | Auth, input validation, OWASP |
| `agent-skills/references/performance-checklist.md` | `performance-optimization` | Core Web Vitals, TTFB, bundle |
| `agent-skills/references/accessibility-checklist.md` | `frontend-ui-engineering` | WCAG 2.1 AA, keyboard, ARIA |
| `agent-skills/references/orchestration-patterns.md` | `git-workflow-and-versioning` | Multi-agent, parallel work |

### Reference Usage Rules (WAJIB)

```
REFERENCES LOADING WORKFLOW:
┌─────────────────────────────────────────────────────────────────┐
│ 1. Skill invoked                                                │
│ 2. Check skill steps for "reference needed"                   │
│ 3. IF reference needed → Read agent-skills/references/<file>.md │
│ 4. Apply checklist items from reference                        │
│ 5. Continue with skill workflow                               │
└─────────────────────────────────────────────────────────────────┘
```

**Reference-by-Skill Mapping:**

| When Working On | MUST Load This Reference |
|-----------------|------------------------|
| Writing tests | `agent-skills/references/testing-patterns.md` |
| Building UI components | `agent-skills/references/accessibility-checklist.md` |
| Security/auth changes | `agent-skills/references/security-checklist.md` |
| Performance work | `agent-skills/references/performance-checklist.md` |
| Multi-agent orchestration | `agent-skills/references/orchestration-patterns.md` |
| Pre-launch/deploy | `agent-skills/references/security-checklist.md` + `agent-skills/references/performance-checklist.md` |
| Code review | `agent-skills/references/security-checklist.md` (for security axis) |

**Verification:** Reference checklist items akan diverifikasi SEBELUM task dianggap complete.

### Skill Activation Flow

```
Task arrives
    │
    ├── Skills activate automatically based on context
    │   (agent checks "Use When" conditions)
    │
    └── OR: Manual invocation via:
            ├── Slash commands: /spec, /plan, /build, /test, /review, /ship
            └── Skill tool: Skill{skill: "skill-name"}
```

**Example automatic triggers:**
- "fix payment bug" → `debugging-and-error-recovery` + `test-driven-development`
- "add new button" → `frontend-ui-engineering` + `test-driven-development`
- "review this code" → `code-review-and-quality` + `security-and-hardening`

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
| Member Registration | HIGH | ✅ Built |
| Loyalty Tier System | HIGH | ✅ Built |
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
Backend:
1. npm run lint    → ESLint check
2. npm run build   → TypeScript compile
3. npm run test    → Unit tests
4. [Review]       → Code review

Frontend:
1. npm run lint    → ESLint + Prettier
2. npm run check   → TypeScript + Svelte check
3. npm run test    → Unit tests
4. npm run build   → Production build
5. [Review]       → Code review
```

### Critical Rules
- **Test failures = incomplete** - Fitur TIDAK dianggap selesai jika tests gagal
- **Build failed = incomplete** - Jangan lanjutkan jika build gagal
- **Lint warnings = fix** - Jangan abaikan lint warnings
- **Commit without verification = violate rules** - Verification WAJIB sebelum commit

---

## Quick Start

1. Baca CLAUDE.md dan agent-skills/ untuk konteks project
2. **ANALYZE FIRST** - Deep analysis sebelum menulis code
3. **INVOKE SKILLS** - Skills diaktifkan otomatis, atau gunakan `Skill` tool
4. **IMPLEMENT** - Build piece by piece dengan verification
5. **VERIFY EVERY STEP** - Build → Test → Type Check sebelum next task
6. **REVIEW BEFORE COMMIT** - Gunakan `/review` atau `code-review-and-quality`
7. **COMMIT WITH EVIDENCE** - Sertakan verification output

---

## Core Operating Behaviors

These behaviors apply at all times:

### 1. Surface Assumptions
Before implementing anything non-trivial, explicitly state assumptions and ask for correction.

### 2. Manage Confusion Actively
When encountering inconsistencies: **STOP** → Name the confusion → Present tradeoff → Wait for resolution.

### 3. Push Back When Warranted
You are not a yes-machine. Point out problems directly with concrete downsides.

### 4. Enforce Simplicity
Before finishing: Can this be done in fewer lines? Are abstractions earning their complexity?

### 5. Scope Discipline
Touch only what you're asked to touch. Do NOT refactor adjacent systems as a side effect.

### 6. Verify, Don't Assume
Every task requires verification evidence. "Seems right" is never sufficient.
