# POS Nabil - AI Coding Agent Guide

## Project Overview

POS Nabil is a Point of Sale system built with modern web technologies. This guide helps AI coding agents understand project conventions, apply best practices, and use the embedded agent-skills workflow.

## Tech Stack

- **Frontend:** React19, TypeScript, Vite, Tailwind CSS
- **Backend:** Node.js, Express, TypeScript
- **Database:** PostgreSQL with Prisma ORM
- **Container:** Docker, Docker Compose
- **Analytics:** Umami (privacy-focused web analytics)

## Project Structure

```
POS_Nabil/
├── backend/           → Express API, Prisma ORM
├── frontend/ → React SPA
├── docs/              → Documentation
├── agent-skills/     → AI agent skills (agent-skills library)
│   ├── skills/        → 23 skill workflows
│   ├── agents/        → Specialist personas
│   └── references/    → Checklists
├── SKILLS_SUMMARY.md  → Skills reference guide
└── docker-compose.yml  → Container orchestration
```

## Commands

```bash
# Development
npm run dev              → Start development server
npm run dev:backend → Start backend only
npm run dev:frontend     → Start frontend only

# Build & Test
npm run build            → Production build
npm test                 → Run tests
npm run lint             → Lint code
npx tsc --noEmit         → Type check

# Database
npx prisma migrate       → Run migrations
npx prisma studio        → Open Prisma Studio

# Docker
docker-compose up        → Start all services
docker-compose down     → Stop all services
```

## Code Conventions

### TypeScript Style
- Use named exports (no default exports)
- Prefer `const` over `let`
- Use explicit types for function parameters and return values
- Use `interface` for object shapes, `type` for unions/intersections

### React Components
- Functional components with hooks (no class components)
- Colocate tests next to source: `Component.tsx` → `Component.test.tsx`
- Use `cn()` utility for conditional classNames
- Error boundaries at route level

### API Design
- RESTful endpoints with consistent naming
- Error responses follow format: `{ error: { code: string, message: string, details?: unknown } }`
- Validate input at route handlers using Zod schemas
- Return appropriate HTTP status codes

### Git Workflow
- Atomic commits (one logical change per commit)
- Descriptive messages: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- Branch naming: `feature/`, `fix/`, `chore/`, `refactor/`

## AI Agent Skills

This project uses the [agent-skills](https://github.com/addyosmani/agent-skills) library for engineering workflow best practices. See `SKILLS_SUMMARY.md` for the complete reference.

### Quick Skill Reference

| Task | Skill |
|------|-------|
| Unclear requirements | `interview-me` |
| Vague idea | `idea-refine` |
| New feature | `spec-driven-development` |
| Planning tasks | `planning-and-task-breakdown` |
| Building code | `incremental-implementation` |
| Writing tests | `test-driven-development` |
| UI work | `frontend-ui-engineering` |
| API design | `api-and-interface-design` |
| Debugging | `debugging-and-error-recovery` |
| Code review | `code-review-and-quality` |
| Simplifying code | `code-simplification` |
| Security | `security-and-hardening` |
| Performance | `performance-optimization` |
| Git commits | `git-workflow-and-versioning` |
| CI/CD | `ci-cd-and-automation` |
| Documentation | `documentation-and-adrs` |
| Deployment | `shipping-and-launch` |

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
