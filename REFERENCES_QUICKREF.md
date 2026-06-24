# References Quick Reference

Quick lookup card untuk references dalam agent-skills.

---

## The 5 References

| # | File | Companion Skill | Key Items |
|---|------|----------------|-----------|
| 1 | `agent-skills/references/testing-patterns.md` | `test-driven-development` | AAA, naming, mocking |
| 2 | `agent-skills/references/security-checklist.md` | `security-and-hardening` | OWASP Top 10, auth |
| 3 | `agent-skills/references/performance-checklist.md` | `performance-optimization` | CWV, TTFB, bundle |
| 4 | `agent-skills/references/accessibility-checklist.md` | `frontend-ui-engineering` | WCAG 2.1 AA, ARIA |
| 5 | `agent-skills/references/orchestration-patterns.md` | `git-workflow-and-versioning` | Multi-agent patterns |

---

## When to Load (MANDATORY)

```
┌─────────────────────────────────────────────────────────────────┐
│ TASK TYPE                  │ LOAD THIS REFERENCE                    │
├─────────────────────────────────────────────────────────────────┤
│ Writing tests              │ agent-skills/references/testing-patterns.md │
│ Building UI components     │ agent-skills/references/accessibility-checklist.md │
│ Security/auth changes      │ agent-skills/references/security-checklist.md   │
│ Performance work           │ agent-skills/references/performance-checklist.md │
│ Pre-launch/deploy         │ agent-skills/references/security-checklist.md + │
│                           │ agent-skills/references/performance-checklist.md │
│ Code review               │ agent-skills/references/security-checklist.md   │
│ Multi-agent work          │ agent-skills/references/orchestration-patterns.md │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Checklist by Reference

### 1. Testing Patterns (`agent-skills/references/testing-patterns.md`)

- [ ] Follow AAA pattern (Arrange-Act-Assert)
- [ ] Name tests descriptively: `it('should do X when Y')`
- [ ] Use real implementations > fakes > stubs > mocks
- [ ] Test state, not interactions
- [ ] DAMP over DRY in tests
- [ ] One assertion per concept
- [ ] Avoid: snapshot abuse, shared state, flaky tests

### 2. Security Checklist (`agent-skills/references/security-checklist.md`)

- [ ] Input validation at boundaries (Zod schema)
- [ ] Parameterized queries (no string concatenation)
- [ ] Passwords hashed with bcrypt ≥12 rounds
- [ ] Session tokens: httpOnly, secure, sameSite
- [ ] Rate limiting on auth endpoints
- [ ] Security headers configured (CSP, HSTS)
- [ ] No secrets in code/logs
- [ ] `npm audit` passes
- [ ] CORS restricted (not wildcard `*`)

### 3. Performance Checklist (`agent-skills/references/performance-checklist.md`)

**Core Web Vitals Targets:**
- [ ] LCP ≤ 2.5s (Good)
- [ ] INP ≤ 200ms (Good)
- [ ] CLS ≤ 0.1 (Good)

**Frontend:**
- [ ] Images: WebP/AVIF, srcset, fetchpriority
- [ ] JS: Bundle size checked, code splitting
- [ ] CSS: Critical CSS, no render-blocking
- [ ] Fonts: WOFF2, self-hosted
- [ ] Cache-Control headers set

**Backend:**
- [ ] No N+1 queries
- [ ] Database indexes on queried columns
- [ ] Pagination on list endpoints
- [ ] Response compression enabled

### 4. Accessibility Checklist (`agent-skills/references/accessibility-checklist.md`)

**Keyboard:**
- [ ] All interactive elements focusable
- [ ] Visible focus indicator
- [ ] No focus traps (except modals)
- [ ] Skip-to-content link present

**Screen Reader:**
- [ ] Semantic HTML (button, not div)
- [ ] Proper heading hierarchy (h1→h2→h3)
- [ ] Form labels associated with inputs
- [ ] aria-label on icon-only buttons

**Visual:**
- [ ] Color contrast ≥4.5:1 (text), ≥3:1 (large)
- [ ] Color not sole indicator of state
- [ ] Touch targets ≥44x44px

### 5. Orchestration Patterns (`agent-skills/references/orchestration-patterns.md`)

**Endorsed Patterns:**
- [ ] Direct invocation (simple tasks)
- [ ] Single-persona slash command
- [ ] Parallel fan-out with merge (`/ship` pattern)
- [ ] Sequential as user-driven

**Anti-Patterns (AVOID):**
- [ ] Router persona
- [ ] Persona calling persona
- [ ] Deep persona trees

---

## Verification Checklist

Before any task is complete:

```
□ Reference loaded (if applicable)
□ Checklist items verified
□ No skipped items (unless justified)
□ Evidence shown for verification
```

---

## Location

All references are in: `agent-skills/references/`

For VSCode Extension: `~/.claude/skills/references/`
