# Skills Summary (Agent-Skills)

Quick reference for all available skills. Full documentation in `agent-skills/skills/*/SKILL.md`.

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

## All Skills by Phase

### Define Phase

| Skill | Description | Use When |
|-------|-------------|----------|
| `interview-me` | Extract what user actually wants | Request is underspecified |
| `idea-refine` | Turn vague ideas into concrete proposals | Rough concept needing exploration |
| `spec-driven-development` | Write PRD before any code | New project/feature/change |

### Plan Phase

| Skill | Description | Use When |
|-------|-------------|----------|
| `planning-and-task-breakdown` | Decompose into verifiable tasks | Have spec, need implementable units |

### Build Phase

| Skill | Description | Use When |
|-------|-------------|----------|
| `incremental-implementation` | Thin slices: implement → test → verify → commit | Any multi-file change |
| `test-driven-development` | RED-GREEN-REFACTOR cycle | Implementing logic, fixing bugs |
| `source-driven-development` | Verify against official docs | Need authoritative implementation |
| `doubt-driven-development` | Adversarial review of decisions | High stakes, unfamiliar code |
| `context-engineering` | Right context at right time | Session start, task switch |
| `frontend-ui-engineering` | Production-quality UI | Building UI components |
| `api-and-interface-design` | Stable API contracts | Designing APIs, modules |

### Verify Phase

| Skill | Description | Use When |
|-------|-------------|----------|
| `test-driven-development` | Failing test first | Implementing logic, fixing bugs |
| `browser-testing-with-devtools` | Chrome DevTools MCP | Browser-based debugging |
| `debugging-and-error-recovery` | 5-step triage | Tests fail, bugs, errors |

### Review Phase

| Skill | Description | Use When |
|-------|-------------|----------|
| `code-review-and-quality` | Five-axis review | Before merge |
| `code-simplification` | Reduce complexity | Code works but too complex |
| `security-and-hardening` | OWASP prevention | Input handling, auth, data |
| `performance-optimization` | Measure first | Performance requirements |

### Ship Phase

| Skill | Description | Use When |
|-------|-------------|----------|
| `git-workflow-and-versioning` | Trunk-based, atomic commits | Every code change |
| `ci-cd-and-automation` | Quality gate pipelines | CI/CD setup |
| `shipping-and-launch` | Pre-launch checklist | Deploying to production |
| `deprecation-and-migration` | Safe feature removal | Removing old systems |
| `documentation-and-adrs` | Document the why | Architectural decisions |

### Support

| Skill | Description | Use When |
|-------|-------------|----------|
| `using-agent-skills` | Meta-skill for skill discovery | Starting a session |
| `observability-and-instrumentation` | Logs, metrics, traces | Adding telemetry |

---

## Key Principles

### TDD Cycle
```
RED (write failing test) ──→ GREEN (minimal code) ──→ REFACTOR (clean up)
```

### Prove-It Pattern (Bug Fixes)
```
Bug report → Write reproduction test (FAIL) → Implement fix → Test PASSES → Run full suite
```

### Verification
**"Seems right" is NEVER sufficient** - Always show evidence:
- Test output proving tests pass
- Build output proving compilation succeeds
- Type check output proving no errors

### Incremental Implementation
```
Implement ──→ Test ──→ Verify ──→ Commit ──→ Next slice
```

### Five-Axis Code Review
1. **Correctness** - Does it do what it claims?
2. **Readability** - Can another engineer understand it?
3. **Architecture** - Does it fit the system design?
4. **Security** - Any vulnerabilities?
5. **Performance** - Any bottlenecks?

---

## Specialist Agents

| Agent | Role | Use When |
|-------|------|----------|
| `code-reviewer` | Senior Staff Engineer | Thorough code review |
| `security-auditor` | Security Engineer | Vulnerability scan |
| `test-engineer` | QA Specialist | Test strategy |
| `web-performance-auditor` | Performance Engineer | Core Web Vitals audit |

---

## Quick Command Reference

```bash
# Backend
cd backend && npm run lint && npm run build && npm run test

# Frontend
cd frontend && npm run lint && npm run check && npm run test && npm run build
```

---

## Core Operating Behaviors

1. **Surface Assumptions** - State assumptions before implementing
2. **Manage Confusion** - STOP when inconsistent, ask not guess
3. **Push Back** - Not a yes-machine
4. **Enforce Simplicity** - Resist overcomplication
5. **Scope Discipline** - Touch only what asked
6. **Verify** - Evidence before assertions
