# POS Nabil - Claude Code Initialization

## Project Context

**POS Nabil** is a Point of Sale system for Ngemiloh (snack business).
- **Backend:** NestJS 11 + PostgreSQL 16 + Prisma 6 + Redis 7
- **Frontend:** SvelteKit 2 + Svelte 5 (Runes) + Tailwind CSS 4
- **Infrastructure:** Docker + Caddy reverse proxy

## User Preferences (CRITICAL)

1. **snake_case naming** - All code MUST use snake_case
2. **Simple Code** - Sederhana, readable, mudah debug & fix
3. **Deep analysis** - Analyze thoroughly before implementing
4. **Best practice solutions** - Options with pros/cons
5. **Strict Verification** - Setiap perubahan WAJIB Build + Test + Type Check + Review

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

## Agent-Skills (24 skills)

### Define Phase
| Skill | Purpose |
|-------|---------|
| `spec-driven-development` | Spec-first development |
| `interview-me` | Clarify requirements |
| `idea-refine` | Refine ideas into specs |

### Plan Phase
| Skill | Purpose |
|-------|---------|
| `planning-and-task-breakdown` | Create task plans |

### Build Phase
| Skill | Purpose |
|-------|---------|
| `incremental-implementation` | Thin slices implementation |
| `test-driven-development` | RED-GREEN-REFACTOR cycle |
| `source-driven-development` | Doc-verified code |
| `doubt-driven-development` | Adversarial review |
| `context-engineering` | Context management |
| `frontend-ui-engineering` | UI building |
| `api-and-interface-design` | API design |

### Verify Phase
| Skill | Purpose |
|-------|---------|
| `debugging-and-error-recovery` | 5-step triage |
| `browser-testing-with-devtools` | E2E testing |

### Review Phase
| Skill | Purpose |
|-------|---------|
| `code-review-and-quality` | Five-axis review |
| `code-simplification` | Simplify complexity |
| `security-and-hardening` | OWASP prevention |
| `performance-optimization` | CWV optimization |

### Ship Phase
| Skill | Purpose |
|-------|---------|
| `git-workflow-and-versioning` | Atomic commits |
| `ci-cd-and-automation` | CI/CD pipelines |
| `shipping-and-launch` | Deployment |
| `deprecation-and-migration` | Safe removal |
| `documentation-and-adrs` | Document decisions |

### Support
| Skill | Purpose |
|-------|---------|
| `observability-and-instrumentation` | Logs/metrics |
| `using-agent-skills` | Skill guide |

---

## Specialist Agents (via `Agent` tool)

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
All reports filter by `shift_start..shift_end`, NOT `created_at::date`.

### JWT Auth
- Kasir: 365-day token, PIN only
- Admin: 12-hour token, email + 6-digit OTP
- No refresh tokens

### Database Safety
Use `SELECT ... FOR UPDATE` for idempotent state transitions.

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
