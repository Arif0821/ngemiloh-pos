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
| Waste Tracking | MEDIUM | ❌ Not Built |
| BOM Recipes | MEDIUM | ⚠️ Partial (1 product seeded) |
| Outlet Management | HIGH | ⚠️ Partial |
| Check-in System | MEDIUM | ⚠️ Partial |
| Online Order Integration | LOW | Future |

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

### Agent-Skills Plugin
```
agent-skills/            # Production-grade engineering skills
├── skills/               # 24 skill workflows (source of truth)
├── agents/              # Specialist agent personas
├── docs/                # Setup guides
├── references/          # Supplementary checklists
├── hooks/                # Session lifecycle hooks
└── plugin.json
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
    ├── Browser issues? ─────────────────→ browser-testing-with-devtools
    ├── Before merge? ───────────────────→ code-review-and-quality
    ├── Code too complex? ───────────────→ code-simplification
    ├── Security concerns? ───────────────→ security-and-hardening
    ├── Performance issues? ───────────────→ performance-optimization
    └── Deploying? ──────────────────────→ shipping-and-launch
```

---

## Core Operating Behaviors (from Agent-Skills)

These behaviors apply at all times:

1. **Surface Assumptions** - State assumptions before implementing
2. **Manage Confusion Actively** - STOP when inconsistent, ask not guess
3. **Push Back When Warranted** - You are not a yes-machine
4. **Enforce Simplicity** - Resist overcomplication
5. **Scope Discipline** - Touch only what you're asked to touch
6. **Verify, Don't Assume** - Evidence before assertions
