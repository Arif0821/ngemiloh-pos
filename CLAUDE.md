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
│    └─────────┘    └─────────┘    └─────────┘                   │
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

## Workflow (Agent-Skills)

```
SPEC-DRIVEN-DEVELOPMENT → PLANNING-AND-TASK-BREAKDOWN → INCREMENTAL-IMPLEMENTATION
                                                                          ↓
                                                              TEST-DRIVEN-DEVELOPMENT
                                                                          ↓
                                                              CODE-REVIEW-AND-QUALITY
                                                                          ↓
                                                              SHIP (git-workflow)
```

### When to Use Skills

| Task | Skill to Use |
|------|-------------|
| New feature/project | `spec-driven-development` → `planning-and-task-breakdown` |
| Multi-file implementation | `incremental-implementation` |
| UI work | `frontend-ui-engineering` |
| API work | `api-and-interface-design` |
| Unfamiliar code/high stakes | `doubt-driven-development` |
| Writing tests / fixing bugs | `test-driven-development` |
| Browser debugging | `browser-testing-with-devtools` |
| Test failures / errors | `debugging-and-error-recovery` |
| Before merge | `code-review-and-quality` |
| Code too complex | `code-simplification` |
| Security concerns | `security-and-hardening` |
| Performance issues | `performance-optimization` |
| Deploying | `shipping-and-launch` |

---

## Available Skills (Agent-Skills)

Invoke via `Skill` tool. See `agent-skills/` folder for full documentation.

### Define Phase
| Skill | When to Use |
|-------|-------------|
| `spec-driven-development` | New project/feature with requirements |
| `interview-me` | User request is underspecified |
| `idea-refine` | Rough concept needing exploration |

### Plan Phase
| Skill | When to Use |
|-------|-------------|
| `planning-and-task-breakdown` | Spec ready, need implementable tasks |

### Build Phase
| Skill | When to Use |
|-------|-------------|
| `incremental-implementation` | Any multi-file change |
| `test-driven-development` | Implementing logic, fixing bugs |
| `frontend-ui-engineering` | Building UI components |
| `api-and-interface-design` | Designing APIs |
| `source-driven-development` | Need doc-verified implementation |
| `doubt-driven-development` | High-stakes decisions |
| `context-engineering` | Need better context loading |

### Verify Phase
| Skill | When to Use |
|-------|-------------|
| `browser-testing-with-devtools` | Browser-based debugging |
| `debugging-and-error-recovery` | Tests fail, bugs, errors |

### Review Phase
| Skill | When to Use |
|-------|-------------|
| `code-review-and-quality` | Before merge |
| `code-simplification` | Code works but too complex |
| `security-and-hardening` | Input handling, auth, data |
| `performance-optimization` | Performance requirements |

### Ship Phase
| Skill | When to Use |
|-------|-------------|
| `git-workflow-and-versioning` | Every commit |
| `ci-cd-and-automation` | CI/CD setup |
| `shipping-and-launch` | Production deployment |
| `deprecation-and-migration` | Removing old features |
| `documentation-and-adrs` | Architectural decisions |

### Specialist Agents (via `Agent` tool)
| Agent | When to Use |
|-------|-------------|
| `code-reviewer` | Thorough code review |
| `security-auditor` | Security vulnerability scan |
| `test-engineer` | Test strategy and coverage |
| `web-performance-auditor` | Core Web Vitals audit |

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

## Unique Selling Points (USPs)

| # | USP | Description |
|---|-----|-------------|
| 1 | Freelance Kasir Model | Flexible, cost-effective staffing |
| 2 | Multi-Shift dengan Carry-Over | Cocok untuk 24/7 operations |
| 3 | Rolling Loyalty Tier | Fair untuk frequent customers (Bronze/Silver/Gold) |
| 4 | Pro-Rata Profit Sharing | Transparent, motivates kasir |
| 5 | Waste Tracking | Accurate HPP untuk food business |
| 6 | Centralized Dashboard | Owner visibility across outlets |

---

## Missing Features (Needs Implementation)

| Feature | Priority | Status |
|---------|----------|--------|
| Member Registration | HIGH | ✅ Built |
| Loyalty Tier System | HIGH | ✅ Built |
| Waste Tracking | MEDIUM | ❌ Not Built |
| BOM Recipes | MEDIUM | ⚠️ Partial (1 product seeded) |
| Outlet Management | HIGH | ⚠️ Partial |
| Check-in System | MEDIUM | ⚠️ Partial |
| Online Order Integration | LOW | Future (GoFood, GrabFood, ShopeeFood) |

---

## Risk Analysis

### Technical Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Printer tidak compatible | MEDIUM | MEDIUM | Browser print fallback ready |
| Redis connection fails | LOW | HIGH | Error handling ready |
| Database corruption | LOW | CRITICAL | Backup system needed |

### Business Risks
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Kasir resign mid-month | MEDIUM | MEDIUM | Pro-rata calculation ready |
| Stockout sebelum reorder | MEDIUM | HIGH | 10-day alert system |
| Internet offline | MEDIUM | LOW | Offline mode ready |

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
│   ├── types/          # Type definitions
│   ├── test/           # Test utilities
│   ├── app.controller.ts
│   ├── app.module.ts
│   ├── app.service.ts
│   └── main.ts         # Entry point with Sentry
├── prisma/
│   ├── schema.prisma   # Database schema
│   ├── seed.ts         # Database seeder
│   └── migrations/     # Migration files
├── test/
│   ├── app.e2e-spec.ts
│   └── orders.e2e-spec.ts
├── Dockerfile
├── docker-entrypoint.sh
├── package.json
├── tsconfig.json
├── nest-cli.json
└── eslint.config.mjs
```

### Frontend (`frontend/`)
```
frontend/
├── src/
│   ├── routes/
│   │   ├── admin/          # Admin panel (13 sub-pages)
│   │   │   ├── dashboard/
│   │   │   ├── products/
│   │   │   ├── categories/
│   │   │   ├── inventory/
│   │   │   ├── cash/
│   │   │   ├── shifts/
│   │   │   ├── cashiers/
│   │   │   ├── transactions/
│   │   │   ├── reports/
│   │   │   ├── analytics/
│   │   │   ├── discounts/
│   │   │   ├── profit-share/
│   │   │   ├── opex/
│   │   │   ├── members/
│   │   │   ├── settings/
│   │   │   ├── system-health/
│   │   │   ├── system-logs/
│   │   │   ├── audit-logs/
│   │   │   └── assets/
│   │   ├── pos/            # POS interface
│   │   │   └── print/      # Receipt printing
│   │   ├── member/         # Public member registration
│   │   │   └── register/
│   │   ├── login/          # Kasir PIN login
│   │   ├── login-admin/    # Admin email+OTP login
│   │   │   └── verify-otp/
│   │   ├── shift/          # Shift open/close
│   │   ├── change-pin/     # Change PIN page
│   │   ├── +layout.svelte
│   │   ├── +page.svelte
│   │   └── +error.svelte
│   ├── lib/
│   │   ├── components/pos/   # POS UI components
│   │   │   ├── CartSidebar.svelte
│   │   │   ├── ProductList.svelte
│   │   │   ├── ModalManager.svelte
│   │   │   ├── MemberLookupModal.svelte
│   │   │   └── modals/      # PaymentModal, QrisWaitModal, etc.
│   │   ├── services/         # api.client.ts, pos.service.ts, printer.service.ts, member.service.ts
│   │   ├── stores/           # Svelte 5 Runes ($state, $derived, $effect)
│   │   │   ├── member.store.svelte.ts
│   │   │   └── ...
│   │   ├── db.ts            # Dexie (IndexedDB for offline)
│   │   ├── domain/          # Domain types and logic
│   │   └── utils/           # Utility functions
│   ├── app.css
│   ├── app.html
│   ├── app.d.ts
│   ├── hooks.server.ts
│   └── test/
│       └── setup.ts
├── static/
│   └── robots.txt
├── build/              # Production build output
├── package.json
├── svelte.config.js
├── vite.config.ts
├── tsconfig.json
├── eslint.config.js
└── vitest.config.ts
```

### Infrastructure (Root)
```
├── docker-compose.yml    # 4 services: postgres, redis, nestjs-api, caddy
├── Caddyfile            # Reverse proxy config
├── Caddy.Dockerfile
├── postgres.Dockerfile
├── .env                 # Environment config
├── .env.example         # Environment template
├── data/                # Docker volumes (postgres, redis, caddy, storage)
├── redis-entrypoint.sh  # Custom Redis entrypoint (no password dev mode)
├── caddy/              # Caddy static files
├── .trivyignore        # Trivy security scanner ignore rules
└── secrets/            # Docker secrets files
    ├── db_password.txt
    ├── jwt_access_secret.txt
    ├── pin_pepper_secret.txt
    ├── csrf_secret.txt
    ├── redis_password.txt
    ├── email_app_password.txt
    ├── midtrans_server_key_sandbox.txt
    └── midtrans_server_key_production.txt
```

### Documentation (`docs/`)
```
docs/
├── NGEMILOH_POS_REQUIREMENTS_DOCUMENTATION.md   # Complete requirements
├── NGEMILOH_POS_BRAINSTORMING_ANALYSIS.md      # Brainstorming analysis
├── index.md
├── guides/
│   ├── BACKUP.md
│   ├── SECRETS_MANAGEMENT.md
│   ├── RUNBOOK.md
│   ├── PAYMENT_TESTING.md
│   ├── Technical_Debt_Register.md
│   ├── deployment/
│   │   ├── DEPLOYMENT_CHECKLIST.md
│   │   └── SENTRY_SETUP.md
│   └── troubleshooting/
│       └── DR_log.md
├── api/
│   ├── auth.md
│   └── orders.md
├── decisions/
│   ├── 0001-use-nestjs.md
│   ├── 0002-use-prisma-orm.md
│   ├── 0003-authentication-strategy.md
│   ├── 0004-offline-first-architecture.md
│   └── 0005-use-sveltekit.md
├── audits/
│   ├── audit-findings-2026-06-18.md
│   └── audit-report-2026-06-18.md
└── specs/                    # Design specs (from spec-driven-development)
    └── 2026-06-18-comprehensive-audit-design.md
```

### PRD Documentation (`PRD v2/`)
```
PRD v2/
├── PRD_MASTER_FINAL_NGEMILOH_POS.md           # Master PRD
├── PRD_NGEMILOH_POS_v7.0_MASTER.md           # Version 7 PRD
├── PRD_Ngemiloh_POS_v5.md                    # Version 5 PRD
├── PRD_Ngemiloh_POS_v6.0_CODE_AUDITED.md    # Version 6 with audit
├── API_CONTRACT_FINAL.md                     # API contracts
├── FRONTEND_ARCH_FINAL.md                    # Frontend architecture
├── DEPLOYMENT_COOLIFY.md                    # Coolify deployment
├── ANALYSIS_REPORT.md                       # Analysis report
├── deployment_guide_ngemiloh.md             # Deployment guide
└── files2/                                  # Structured PRD sections
    ├── 00-overview.md
    ├── 01-stakeholders-rbac.md
    ├── 02-business-rules.md
    ├── 03-journeys-flows.md
    ├── 04-functional-reqs.md
    ├── 05-nonfunctional-reqs.md
    ├── 06-architecture.md
    ├── 07-database.md
    ├── 08-api-contract.md
    ├── 09-security.md
    ├── 10-testing.md
    ├── 11-deployment.md
    ├── 12-monitoring.md
    ├── 13-roadmap.md
    ├── 14-risk-register.md
    ├── 15-appendix.md
    ├── ADR-all.md
    └── README.md
```

### Scripts (`scripts/`)
```
scripts/
├── backup.sh              # Database backup script
├── backup-config.sh      # Config backup script
├── health-monitor.sh     # Health monitoring script
├── monitor.sh            # Service monitoring script
├── run-migration.sh      # Run Prisma migrations
├── run-sql.ts           # Run SQL scripts
├── run-sql-split.ts     # Split and run SQL
└── replace.js            # String replacement utility
```

### CI/CD (`.github/`)
```
.github/
└── workflows/
    └── ci.yml            # GitHub Actions CI pipeline
```

### Testing (`tests/`)
```
tests/
├── e2e_test.js           # End-to-end tests
├── sast_scan.js         # Static Application Security Testing
├── dast_scan.js         # Dynamic Application Security Testing
└── k6/
    └── load_test.js     # k6 load testing
```

### Agent-Skills Plugin
```
agent-skills/              # Production-grade engineering skills
├── skills/                # 24 skill workflows (source of truth)
├── agents/               # Specialist agent personas
├── docs/                 # Setup guides
├── references/           # Supplementary checklists
├── hooks/                # Session lifecycle hooks
├── README.md
├── AGENTS.md
└── plugin.json
```

---

## Commands

### Backend (`./backend`)
```bash
npm run build           # Build NestJS app
npm run start:dev       # Development with hot reload
npm run start:prod      # Production
npm run lint            # ESLint with auto-fix
npm run test            # Jest unit tests
npm run test:e2e        # End-to-end tests
npm run test:cov        # With coverage
npx prisma generate     # Generate Prisma client
npx prisma migrate dev  # Run migrations (dev)
npx prisma migrate deploy # Run migrations (prod)
npx prisma db seed     # Seed database
```

### Frontend (`./frontend`)
```bash
npm run dev             # Development server
npm run build           # Production build
npm run preview         # Preview production build
npm run check           # TypeScript + Svelte check
npm run lint            # Prettier + ESLint
npm run format          # Auto-format code
npm run test            # Vitest unit tests
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage
```

### Docker
```bash
docker compose up -d              # Start all services
docker compose down                # Stop all services
docker compose logs -f           # View logs
docker compose exec nestjs-api sh # Shell into API container
docker compose exec postgres psql -U ngemiloh # PostgreSQL shell
docker compose exec redis redis-cli # Redis shell
```

### Database
```bash
# Run migrations
docker compose exec nestjs-api npx prisma migrate deploy

# Seed database
docker compose exec nestjs-api npx prisma db seed

# Reset database
docker compose exec nestjs-api npx prisma migrate reset
```

---

## Key Documentation Files

| File | Description |
|------|-------------|
| `CLAUDE.md` | This file - project documentation |
| `agent-skills/README.md` | Full skill catalog |
| `agent-skills/skills/*/SKILL.md` | Individual skill documentation |
| `SKILLS_SUMMARY.md` | Quick skill reference |
| `POST_FIX_COMPREHENSIVE_AUDIT_REPORT.md` | Post-fix audit results |
| `COMPREHENSIVE_FINAL_AUDIT_REPORT.md` | Comprehensive audit |
| `FINAL_AUDIT_REPORT.md` | Final audit report |
| `ANALYSIS_REPORT.md` | Analysis report |
| `DEPLOYMENT_COOLIFY.md` | Coolify deployment guide |

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

1. Baca `CLAUDE.md` dan `agent-skills/` untuk konteks project
2. **ANALYZE FIRST** - Deep analysis sebelum menulis code
3. **INVOKE SKILLS** - Gunakan `Skill` tool untuk skills yang relevan
4. **IMPLEMENT** - Build piece by piece dengan verification
5. **VERIFY EVERY STEP** - Build → Test → Type Check sebelum next task
6. **REVIEW BEFORE COMMIT** - Gunakan `code-review-and-quality`
7. **COMMIT WITH EVIDENCE** - Sertakan verification output

---

## Skill Discovery

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
    ├── Before merge? ────────────────────→ code-review-and-quality
    ├── Code too complex? ────────────────→ code-simplification
    ├── Security concerns? ───────────────→ security-and-hardening
    ├── Performance issues? ───────────────→ performance-optimization
    └── Deploying? ──────────────────────→ shipping-and-launch
```

---

## Core Operating Behaviors (from Agent-Skills)

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
