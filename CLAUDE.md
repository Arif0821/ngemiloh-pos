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
│    ┌────┴────┐    ┌────┴────┐    ┌────┴────┐                     │
│    │ Outlet A │    │ Outlet B │    │ Outlet C │                   │
│    │ Kasir 1 │    │ Kasir 2 │    │ Kasir 3 │                    │
│    │(Freelance)│   │(Freelance)│   │(Freelance)│                │
│    └─────────┘    └─────────┘    └─────────┘                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## User Preferences (CRITICAL)

1. **No Phase Development** - Complete all features at once
2. **Always Use Skills** - `superpowers` + `agent-skills` combined
3. **snake_case naming** for all code
4. **Simple, readable code** - No unnecessary complexity
5. **Deep analysis** - Analyze thoroughly before implementing
6. **Best practice solutions** - Options with pros/cons
7. **Strict Verification (MANDATORY)** - Build + Test + Type Check for every code change

---

## Workflow

```
brainstorming → writing-plans → subagent-driven-development →
finishing-a-development-branch
```

---

## Available Skills

### Superpowers (via `Skill` tool)
| Category | Skills |
|----------|--------|
| Testing | `test-driven-development` |
| Debugging | `systematic-debugging`, `verification-before-completion` |
| Collaboration | `brainstorming`, `writing-plans`, `executing-plans`, `subagent-driven-development`, `dispatching-parallel-agents`, `requesting-code-review`, `receiving-code-review`, `using-git-worktrees`, `finishing-a-development-branch` |
| Meta | `using-superpowers`, `writing-skills` |

### Agent-Skills (via `Agent` tool)
| Phase | Skills |
|-------|--------|
| Define | `interview-me`, `idea-refine`, `spec-driven-development` |
| Plan | `planning-and-task-breakdown`, `Plan` |
| Build | `incremental-implementation`, `source-driven-development`, `frontend-ui-engineering`, `doubt-driven-development`, `context-engineering`, `api-and-interface-design` |
| Verify | `test-driven-development`, `browser-testing-with-devtools`, `debugging-and-error-recovery` |
| Review | `code-review-and-quality`, `code-simplification`, `security-and-hardening`, `performance-optimization` |
| Ship | `git-workflow-and-versioning`, `ci-cd-and-automation`, `shipping-and-launch`, `deprecation-and-migration`, `documentation-and-adrs` |
| Support | `observability-and-instrumentation`, `using-agent-skills` |

### Agent Types (subagent_type)
`Explore`, `Plan`, `code-reviewer`, `security-auditor`, `test-engineer`, `web-performance-auditor`, `general-purpose`

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
| Member Registration | HIGH | ❌ Not Built |
| Loyalty Tier System | HIGH | ❌ Not Built |
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
│   ├── payment/       # Midtrans QRIS + Fake gateway
│   ├── receipts/      # Receipt generation
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
│   │   │   ├── settings/
│   │   │   ├── system-health/
│   │   │   ├── system-logs/
│   │   │   ├── audit-logs/
│   │   │   └── assets/
│   │   ├── pos/            # POS interface
│   │   │   └── print/      # Receipt printing
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
│   │   │   └── modals/      # PaymentModal, QrisWaitModal, etc.
│   │   ├── services/         # api.client.ts, pos.service.ts, printer.service.ts
│   │   ├── stores/           # Svelte 5 Runes ($state, $derived, $effect)
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
└── superpowers/
    ├── plans/
    │   ├── 2026-06-18-comprehensive-audit-plan.md
    │   ├── 2026-06-18-hybrid-token-migration.md
    │   ├── 2026-06-18-naming-convention.md
    │   ├── 2026-06-18-test-coverage.md
    │   ├── 2026-06-19-docker-cve-audit-fix.md
    │   ├── 2026-06-19-docker-cves-and-prisma-fix.md
    │   ├── 2026-06-19-audit-fixes.md
    │   └── 2026-06-19-action-plan-implementation.md
    └── specs/
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
agent-skills/
├── skills/               # 23 skill workflows
├── agents/               # Specialist agent personas
├── docs/                 # Setup guides
├── references/           # Checklists
├── hooks/                # Claude hooks
├── scripts/              # Validation scripts
├── README.md
├── AGENTS.md
├── CLAUDE.md
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
| `CLAUDE.md` | Full project documentation |
| `SKILLS_SUMMARY.md` | 23 skill workflows summary |
| `superpowers-guide.md` | Superpowers guide |
| `POST_FIX_COMPREHENSIVE_AUDIT_REPORT.md` | Post-fix audit results |
| `COMPREHENSIVE_FINAL_AUDIT_REPORT.md` | Comprehensive audit |
| `FINAL_AUDIT_REPORT.md` | Final audit report |
| `ANALYSIS_REPORT.md` | Analysis report |
| `DEPLOYMENT_COOLIFY.md` | Coolify deployment guide |
| `.trivyignore` | Trivy security scanner ignore rules |
| `NGEMILOH_POS_BRAINSTORMING_ANALYSIS.md` | Brainstorming + gaps + risks |

---

## Verification (MANDATORY)

### Backend Verification Order
```bash
cd backend
npm run lint          # 1. ESLint check
npm run build         # 2. TypeScript compile
npm run test          # 3. Unit tests
```

### Frontend Verification Order
```bash
cd frontend
npm run lint          # 1. ESLint + Prettier check
npm run check         # 2. TypeScript + Svelte check
npm run test          # 3. Unit tests
npm run build         # 4. Production build
```

### Rules
- **Evidence before assertions** - Show output proving success
- **Test failures = incomplete** - Feature is NOT complete if tests fail
- **Build failed = incomplete** - Don't proceed if build fails
- **Lint warnings = fix** - Don't ignore lint warnings

---

## Quick Start

1. Read `CLAUDE.md` for full project documentation
2. Invoke relevant skills at task start (superpowers + agent-skills)
3. Use agent-skills for parallel work
4. Deep analyze before implementing
5. Strict verification before claiming completion
6. Commit frequently with clear messages
