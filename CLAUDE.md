# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**POS Nabil** is a Point of Sale system for Ngemiloh (snack business), built with:
- **Backend:** NestJS 11 + PostgreSQL 16 + Prisma 6 + Redis 7
- **Frontend:** SvelteKit 2 + Svelte 5 (Runes) + Tailwind CSS 4
- **Infrastructure:** Docker + Caddy reverse proxy

Key capabilities: offline-first POS, QRIS payment (Midtrans), shift management, audit logging, multi-kasir support.

## User Preferences

1. **No Phase Development** - Complete all features in one go, no splitting into phases
2. **Always Use Skills** - Every task must use `superpowers` + `agent-skills` combined
3. **snake_case naming** for all code
4. **Simple, readable code** - No unnecessary complexity
5. **Deep analysis** - Analyze thoroughly before implementing
6. **Best practice solutions** - Provide options with pros/cons
7. **Strict Verification** - **MANDATORY** for every code change (see below)

## Commands

### Backend (./backend)
```bash
npm run build           # Build NestJS app
npm run start:dev       # Development with hot reload
npm run start:prod      # Production
npm run lint            # ESLint with auto-fix
npm run test            # Jest unit tests
npm run test:cov        # With coverage
npx prisma generate     # Generate Prisma client
npx prisma migrate dev # Run migrations (dev)
npx prisma migrate deploy # Run migrations (prod)
npx prisma db seed      # Seed database
```

### Frontend (./frontend)
```bash
npm run dev             # Development server
npm run build           # Production build
npm run check           # TypeScript + Svelte check
npm run lint            # Prettier + ESLint
npm run format          # Auto-format code
npm run test            # Vitest unit tests
npm run test:watch      # Watch mode
```

### Docker
```bash
docker compose up -d              # Start all services
docker compose logs -f           # View logs
docker compose exec nestjs-api sh # Shell into API container
```

## Architecture

### Backend: Clean Architecture Layers
```
src/
├── auth/           # JWT auth, PIN login, OTP for admin
├── orders/         # Order processing with state machine
├── products/      # Product catalog with modifiers
├── inventory/     # Stock management, BOM recipes
├── finance/       # Cash register, shift, profit share
├── discounts/     # Scheduled discount campaigns
├── email/         # OTP and alert notifications
├── audit/         # Audit logging interceptor
└── prisma/        # Database service
```

Each module follows: `presentation/ → application/ → domain/infrastructure/`

### Frontend: SvelteKit SPA
```
src/
├── lib/
│   ├── components/pos/  # POS UI (CartSidebar, ProductList, Modals)
│   ├── services/        # api.client.ts, pos.service.ts, printer.service.ts
│   ├── stores/          # Svelte 5 Runes ($state, $derived, $effect)
│   └── db.ts           # Dexie (IndexedDB for offline)
└── routes/
    ├── pos/            # POS interface
    ├── admin/          # Admin panel (dashboard, products, reports, etc.)
    ├── login/          # Kasir PIN login
    ├── login-admin/    # Admin email+OTP login
    └── shift/         # Shift open/close
```

### Key Integration Points
- **Offline sync:** Dexie stores products/orders/cart; sync on reconnect
- **Printer:** HTML print dialog (window.print()) with 80mm/58mm CSS
- **Payments:** Midtrans QRIS integration
- **Auth flow:** Kasir = PIN only; Admin = email + OTP

## Important Patterns

### Database State Changes
Use `SELECT ... FOR UPDATE` pattern for idempotent state transitions (payment, void, shift close). Never assume sequential processing.

### Shift = Business Date
All reports filter by `shift_start`..`shift_end`, NOT `created_at::date`. Shift crosses midnight = still same business day.

### JWT Auth (no refresh tokens)
- Kasir: 365-day access token (unlimited - admin controls via PIN reset/delete)
- Admin: 12-hour access token, email + 6-digit OTP
- No logout/revoke mechanism - tokens expire automatically

## Security
- JWT + bcrypt password hashing
- CSRF protection (cookie token + header)
- Rate limiting (100/min general, 5/10min for login)
- IP lockout after 5 failed attempts
- Helmet security headers
- Audit logging on all mutating requests

## Testing
- Backend: Jest with `@nestjs/testing`, Prisma test setup
- Frontend: Vitest with `@testing-library/svelte`
- CI: `.github/workflows/ci.yml` runs lint → typecheck → test → build

## Strict Verification (MANDATORY)

**Every code change MUST be verified before claiming completion:**

### Backend Verification Order
```bash
cd backend
npm run lint          # 1. ESLint check
npm run build         # 2. TypeScript compile
npm run test          # 3. Unit tests
npm run test:cov      # 4. Coverage (optional)
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
- **Evidence before assertions** - Show output proving success, don't just claim
- **Test failures = incomplete** - If tests fail, the feature is NOT complete
- **Build failed = incomplete** - Don't proceed if build fails
- **Lint warnings = fix** - Don't ignore lint warnings

### Exception
- Plan Mode: Verification is POSTPONED until user approves plan and I exit plan mode

## Agent Skills
23 workflow skills available in `agent-skills/skills/`:
- Define: `interview-me`, `idea-refine`, `spec-driven-development`
- Plan: `planning-and-task-breakdown`
- Build: `incremental-implementation`, `source-driven-development`, `frontend-ui-engineering`
- Verify: `test-driven-development`, `browser-testing-with-devtools`
- Review: `code-review-and-quality`, `security-and-hardening`
- Ship: `git-workflow-and-versioning`, `ci-cd-and-automation`, `shipping-and-launch`

Quick reference: `SKILLS_SUMMARY.md`

## Memory Files

User preferences stored in: `%USERPROFILE%\.claude\projects\C--POS-Nabil\memory\`
- `no-phase-development.md` - No phased work
- `always-use-skills.md` - Use skills always
- `backend-debugging-findings.md` - Past fixes
- `naming-convention-snake-case.md` - Code naming rules
- `code-simplicity-rule.md` - Code simplicity guidelines
- `strict-verification.md` - Mandatory build + test + type check for all code changes
