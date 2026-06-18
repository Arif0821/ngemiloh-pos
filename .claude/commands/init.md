# /init Command

When Claude Code starts, this command provides project-specific initialization.

## Project Context

**POS Nabil** - Point of Sale system for Ngemiloh (snack business).
- Backend: NestJS 11 + PostgreSQL 16 + Prisma 6 + Redis 7
- Frontend: SvelteKit 2 + Svelte 5 (Runes) + Tailwind CSS 4
- Infrastructure: Docker + Caddy reverse proxy

## User Preferences

1. **No Phase Development** - Complete all features at once
2. **Always Use Skills** - superpowers + agent-skills combined
3. **snake_case naming** for all code
4. **Simple, readable code**

## Workflow

```
brainstorming → writing-plans → subagent-driven-development →
finishing-a-development-branch
```

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

## Key Patterns

- **Shift = Business Date** - Reports filter by shift_start..shift_end
- **JWT Auth** - Tokens in httpOnly cookies, CSRF separate in localStorage
- **Database Safety** - Use SELECT FOR UPDATE for idempotent transitions

## Quick Start

1. Read CLAUDE.md for full project documentation
2. Invoke relevant skills at task start
3. Use agent-skills for parallel work
4. Commit frequently with clear messages
