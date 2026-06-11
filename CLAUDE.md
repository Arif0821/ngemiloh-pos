# POS Nabil - AI Coding Agent Guide

## Project Overview

POS Nabil is a Point of Sale system built with modern web technologies. This guide helps AI coding agents understand project conventions, apply best practices, and use the embedded agent-skills workflow.

## Tech Stack

- **Frontend:** SvelteKit 2 (Svelte 5 with runes), TypeScript, Tailwind CSS, Dexie (IndexedDB)
- **Backend:** NestJS, TypeScript, Prisma ORM
- **Database:** PostgreSQL 16
- **Cache/Queue:** Redis 7 with BullMQ
- **Container:** Docker, Docker Compose, Caddy (reverse proxy)
- **Payments:** Midtrans (QRIS, Cash, Split)
- **Monitoring:** Sentry (error tracking)
- **Analytics:** Umami (privacy-focused, optional)

## Project Structure

```
POS_Nabil/
├── backend/              → NestJS API (Clean Architecture)
│   └── src/
│       ├── auth/         → Authentication (JWT, PIN, Password)
│       ├── orders/       → Order processing & QRIS payments
│       ├── products/     → Product & modifier management
│       ├── inventory/   → Stock & raw materials (FEFO)
│       ├── finance/      → KPIs, OPEX, profit share
│       ├── discounts/    → Discount rules & scheduling
│       ├── users/        → User management
│       ├── flags/        → Feature flags
│       ├── audit/        → Audit logging
│       └── common/       → Shared utilities, filters, interceptors
├── frontend/             → SvelteKit 2 SPA
│   └── src/
│       ├── lib/
│       │   ├── services/ → API client, POS service, printer
│       │   ├── stores/   → Svelte 5 runes stores
│       │   ├── components/ → UI components
│       │   └── db.ts     → Dexie IndexedDB schema
│       └── routes/       → SvelteKit pages
├── docs/                 → Documentation
│   ├── api/              → API endpoint documentation
│   └── decisions/         → Architecture Decision Records (ADRs)
├── agent-skills/         → AI agent skills (23 skill workflows)
├── tests/                → Shared test utilities
├── scripts/              → Build & deployment scripts
├── Caddyfile             → Reverse proxy configuration
├── docker-compose.yml     → Container orchestration
└── SKILLS_SUMMARY.md      → Skills reference guide
```

## Commands

```bash
# Backend Development
cd backend
npm run start:dev          → Start NestJS dev server (port 3000)
npm run build → Build for production
npm run lint → Run ESLint
npx tsc --noEmit           → Type check
npm test → Run unit tests
npm run test:e2e           → Run E2E tests
npx prisma migrate dev → Run migrations (dev)
npx prisma migrate deploy   → Run migrations (prod)
npx prisma studio → Open Prisma Studio

# Frontend Development
cd frontend
npm run dev                → Start SvelteKit dev server (port 5173)
npm run build              → Build for production
npm run check              → Run Svelte type check
npm run lint                → Run ESLint
npm run format              → Format with Prettier
npm test                    → Run Vitest tests

# Docker
docker-compose up -d        → Start all services
docker-compose down → Stop all services
docker-compose logs -f      → View logs
docker-compose exec nestjs-api sh → Shell into backend container

# Full Stack (from root)
npm run dev:backend         → Start backend only
npm run dev:frontend → Start frontend only
```

## Code Conventions

### TypeScript Style
- Use named exports (no default exports)
- Prefer `const` over `let`
- Use explicit types for function parameters and return values
- Use `interface` for object shapes, `type` for unions/intersections

### Svelte Components (Frontend)
- Use Svelte 5 runes (`$state`, `$derived`, `$effect`) for reactivity
- Colocate tests next to source: `Component.svelte` → `Component.test.ts`
- Use `class` directive for conditional classes
- Error boundaries at route level (`+error.svelte`)

### Backend Services (NestJS)
- Follow Clean Architecture: `domain/application/infrastructure/presentation` layers
- Use dependency injection with `@Inject()` and tokens
- Repository pattern with interfaces in domain layer
- Service methods should be focused and small (ideally < 100 lines)

### API Design
- RESTful endpoints with `/api/v1` prefix
- Error responses follow format: `{ success: false, error: { code: string, message: string, details?: unknown } }`
- Success responses: `{ success: true, data: T, meta?: PaginationMeta }`
- Validate input at route handlers using class-validator DTOs
- Return appropriate HTTP status codes (201 for create, 200 for success, 4xx for errors)

### Git Workflow
- Atomic commits (one logical change per commit)
- Descriptive messages: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- Branch naming: `feature/`, `fix/`, `chore/`, `refactor/`

## AI Agent Skills

This project uses the [agent-skills](https://github.com/addyosmani/agent-skills) library. All 23 skills are available in `.claude/commands/`.

### Quick Reference

| Skill | Fungsi | Kapan Digunakan |
|-------|--------|-----------------|
| **META** | | |
| `using-agent-skills` | Peta skills | Awal sesi, bingung pakai skill apa |
| **DEFINE** | | |
| `interview-me` | Tanya satu-satu | Requirement belum jelas |
| `idea-refine` | Jernihkan ide | Konsep masih abstrak/nabrak |
| `spec-driven-development` | Tulis PRD | Mulai fitur baru |
| **PLAN** | | |
| `planning-and-task-breakdown` | Pecah jadi task | Udah ada spec, mau implement |
| **BUILD** | | |
| `incremental-implementation` | Build tipis-tipis | Implementasi umum |
| `test-driven-development` | Test duluan | Tambah logic / fix bug |
| `context-engineering` | Atur konteks | Konteks hilang / output jelek |
| `source-driven-development` | Cek docs | Pakai library baru |
| `doubt-driven-development` | Review adversarial | High stakes (prod, security) |
| `frontend-ui-engineering` | UI component | Bikin/modify UI |
| `api-and-interface-design` | Design API | Bikin API baru |
| **VERIFY** | | |
| `browser-testing-with-devtools` | Chrome DevTools | Debug browser/frontend |
| `debugging-and-error-recovery` | 5-step triage | Bug/error muncul |
| **REVIEW** | | |
| `code-review-and-quality` | Review 5-axis | Sebelum merge |
| `code-simplification` | Sederhanakan | Kode berantakan |
| `security-and-hardening` | OWASP audit | Input user, auth, payment |
| `performance-optimization` | Core Web Vitals | Performa lambat |
| **SHIP** | | |
| `git-workflow-and-versioning` | Atomic commit | Setiap perubahan kode |
| `ci-cd-and-automation` | Pipeline CI/CD | Setup/modify build pipeline |
| `deprecation-and-migration` | Cleanup kode | Hapus fitur lama |
| `documentation-and-adrs` | Dokumentasi ADR | Decision arsitektur |
| `shipping-and-launch` | Launch checklist | Mau deploy |

### Skill Discovery Flow

```
Task arrives
    │
    ├── Unclear what user wants? ──────→ interview-me
    ├── Vague idea, need variants? ────→ idea-refine
    ├── New project/feature? ───────────→ spec-driven-development
    ├── Have spec, need tasks? ─────────→ planning-and-task-breakdown
    ├── Implementing code? ─────────────→ incremental-implementation
    │   ├── UI work? ─────────────────→ frontend-ui-engineering
    │   ├── API work? ────────────────→ api-and-interface-design
    │   └── High stakes? ──────────────→ doubt-driven-development
    ├── Writing tests? ────────────────→ test-driven-development
    ├── Something broke? ──────────────→ debugging-and-error-recovery
    ├── Reviewing code? ────────────────→ code-review-and-quality
    ├── CI/CD work? ──────────────────→ ci-cd-and-automation
    └── Deploying? ────────────────────→ shipping-and-launch
```

## Boundaries

### Always Do
- Run tests before commits
- Follow naming conventions
- Validate inputs at API boundaries
- Use parameterized queries (no SQL concatenation)
- Keep functions small and focused

### Ask First
- Database schema changes
- Adding new dependencies
- Modifying authentication logic
- Changing API contracts
- Modifying CI configuration

### Never Do
- Commit secrets or API keys
- Push directly to main branch
- Skip tests to make commits faster
- Remove failing tests without approval
- Commit `node_modules/`, `.env`, or build artifacts

## Security Guidelines

- All user input is untrusted — validate at boundaries
- Use parameterized queries for database operations
- Hash passwords with bcrypt (never store plaintext)
- Keep secrets in environment variables
- Set security headers (CSP, HSTS, X-Frame-Options)
- Rate limit authentication endpoints

## Performance Guidelines

- Profile before optimizing (don't guess)
- Paginate list endpoints
- Avoid N+1 queries (use joins/includes)
- Optimize images (compression, lazy loading, responsive sizes)
- Cache expensive operations where appropriate

## Common Patterns

### Creating a New Feature

1. Start with `spec-driven-development` skill
2. Create task list with `planning-and-task-breakdown`
3. Implement incrementally with `incremental-implementation`
4. Write tests with `test-driven-development`
5. Review with `code-review-and-quality`
6. Ship with `shipping-and-launch`

### Bug Fix Process

1. Reproduce the bug
2. Write a test that fails (Prove-It Pattern)
3. Fix the root cause
4. Verify test passes
5. Run full test suite
6. Commit with descriptive message

### API Endpoint Pattern

```typescript
// 1. Define schema
const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
});

// 2. Validate at boundary
app.post('/api/tasks', async (req, res) => {
  const result = CreateTaskSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid input',
        details: result.error.flatten(),
      },
    });
  }
  // result.data is typed and validated
  const task = await taskService.create(result.data);
  return res.status(201).json(task);
});
```

## Verification Checklist

Before every commit:

- [ ] All tests pass: `npm test`
- [ ] Build succeeds: `npm run build`
- [ ] Type check passes: `npx tsc --noEmit`
- [ ] Lint passes: `npm run lint`
- [ ] No secrets in code
- [ ] Changes are scoped to the task

## Getting Help

- Full skill documentation: `agent-skills/skills/<skill-name>/SKILL.md`
- Skills summary: `SKILLS_SUMMARY.md`
- Project structure: See above

## Notes

- This project follows trunk-based development
- Feature flags are used for incomplete features
- Code review is required before merge
- Documentation should explain WHY, not just WHAT
