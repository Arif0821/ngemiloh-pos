# POS Nabil - Claude Code Initialization

## Project Context

**POS Nabil** is a Point of Sale system for Ngemiloh (snack business).
- **Backend:** NestJS 11 + PostgreSQL 16 + Prisma 6 + Redis 7
- **Frontend:** SvelteKit 2 + Svelte 5 (Runes) + Tailwind CSS 4
- **Infrastructure:** Docker + Caddy reverse proxy

## User Preferences

1. **No Phase Development** - Complete all features in one go, no splitting into phases
2. **Always Use Skills** - Every task must use `superpowers` + `agent-skills` combined
3. **snake_case naming** for all code
4. **Simple, readable code** - No unnecessary complexity

---

## The Basic Workflow

```
brainstorming → using-git-worktrees → writing-plans → 
subagent-driven-development/executing-plans → test-driven-development → 
requesting-code-review → finishing-a-development-branch
```

---

## Superpowers Skills (via `Skill` tool)

### Testing (1 skill)
| Skill | Purpose |
|-------|---------|
| `test-driven-development` | RED-GREEN-REFACTOR cycle |

### Debugging (2 skills)
| Skill | Purpose |
|-------|---------|
| `systematic-debugging` | 4-phase root cause analysis |
| `verification-before-completion` | Verify fixes before commit |

### Collaboration (11 skills)
| Skill | Purpose |
|-------|---------|
| `brainstorming` | Socratic design approach |
| `writing-plans` | Create implementation plans |
| `executing-plans` | Batch execution with checkpoints |
| `subagent-driven-development` | Parallel subagent + 2-stage review |
| `dispatching-parallel-agents` | Fan-out agent dispatching |
| `requesting-code-review` | Code review template |
| `receiving-code-review` | Review response handling |
| `using-git-worktrees` | Isolated workspace |
| `finishing-a-development-branch` | Complete development |

### Meta Skills
| Skill | Purpose |
|-------|---------|
| `using-superpowers` | Load skill instructions |
| `writing-skills` | Create new skills |

---

## Agent-Skills (27 skills via `Agent` tool)

### Define Phase
| Skill | Purpose |
|-------|---------|
| `interview-me` | Clarify requirements |
| `idea-refine` | Refine ideas into specs |
| `spec-driven-development` | Spec-first development |

### Plan Phase
| Skill | Purpose |
|-------|---------|
| `planning-and-task-breakdown` | Create task plans |

### Build Phase
| Skill | Purpose |
|-------|---------|
| `incremental-implementation` | Step-by-step coding |
| `source-driven-development` | Code-first iteration |
| `frontend-ui-engineering` | UI component building |

### Verify Phase
| Skill | Purpose |
|-------|---------|
| `browser-testing-with-devtools` | E2E testing |

### Review Phase
| Skill | Purpose |
|-------|---------|
| `code-review-and-quality` | Quality review |
| `security-and-hardening` | Security audit |

### Ship Phase
| Skill | Purpose |
|-------|---------|
| `git-workflow-and-versioning` | Git practices |
| `ci-cd-and-automation` | CI/CD pipelines |
| `shipping-and-launch` | Deployment |

### Support Skills
| Skill | Purpose |
|-------|---------|
| `code-simplification` | Simplify code |
| `debugging-and-error-recovery` | Fix bugs |
| `performance-optimization` | Optimize performance |
| `api-and-interface-design` | API design |
| `documentation-and-adrs` | Write docs |
| `deprecation-and-migration` | Migrate code |
| `observability-and-instrumentation` | Logging/monitoring |
| `context-engineering` | Manage context |
| `doubt-driven-development` | Resolve doubts |
| `using-agent-skills` | Agent skill guide |

---

## Agent Types (subagent_type)

| Agent | Use Case |
|-------|----------|
| `Explore` | Broad file/code search |
| `Plan` | Architecture design |
| `code-reviewer` | Senior reviewer (5 dimensions) |
| `security-auditor` | Vulnerability detection |
| `test-engineer` | QA/test strategy |
| `web-performance-auditor` | Performance analysis |
| `general-purpose` | Catch-all tasks |

---

## Key Commands

### Backend
```bash
npm run build       # Build NestJS
npm run start:dev   # Hot reload dev
npm run lint        # ESLint
npm run test        # Jest tests
```

### Frontend
```bash
npm run dev         # SvelteKit dev
npm run build       # Production build
npm run check       # TypeScript check
npm run test        # Vitest tests
```

### Docker
```bash
docker compose up -d       # Start services
docker compose logs -f     # View logs
```

---

## Important Patterns

### Shift = Business Date
All reports filter by `shift_start`..`shift_end`, NOT `created_at::date`.

### JWT Auth
- Kasir: 20-hour token, PIN only
- Admin: 12-hour token, email + 6-digit OTP
- No refresh tokens

### Database Safety
Use `SELECT ... FOR UPDATE` for idempotent state transitions.

---

## Context Memory

| File | Purpose |
|------|---------|
| `memory/no-phase-development.md` | No phased work |
| `memory/always-use-skills.md` | Use skills always |
| `memory/backend-debugging-findings.md` | Past fixes |

---

## Key Files

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Full project documentation |
| `docs/superpowers/plans/` | Implementation plans |
| `docs/superpowers/specs/` | Design specifications |
| `docs/audit-report-*.md` | Audit reports |

---

## Last Session (2026-06-18)

### Completed: Hybrid Token Migration ✅
- Moved JWT tokens from localStorage to httpOnly cookies
- Access token in httpOnly;Secure;SameSite=Strict cookie
- CSRF token stored separately in localStorage
- Backend tests: 85 passed
- Frontend tests: 32 passed
- Committed: `6aec072`

### Completed: Comprehensive Audit ✅
- 356 issues resolved (P1-P4)
- 12 P1-Critical fixed
- 40 P2-High fixed
- All lint/tests/build passing

### Pending Priorities
1. Database Migration (indexes from audit)
2. Naming Convention (180 violations)
3. Test Coverage (62 missing tests)
