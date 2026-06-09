# AI Agent Commands - POS Nabil

## Quick Reference

Gunakan perintah ini untuk memanggil skill agent dengan prefix `/`:

| Command | Purpose | Example |
|---------|---------|----------|
| `/debug` | Debugging & Error Recovery | `/debug webhook signature validation fails` |
| `/review` | Code Review (5-axis) | `/review orders service` |
| `/security` | Security & Hardening | `/security audit payment endpoints` |
| `/simplify` | Code Simplification | `/simplify batch processing` |
| `/ship` | Deployment & Launch | `/ship deploy to coolify` |
| `/ci` | CI/CD Pipeline | `/ci optimize build speed` |
| `/plan` | Task Breakdown | `/plan implement offline sync` |
| `/test` | TDD Pattern | `/test payment validation` |
| `/spec` | Requirements First | `/spec webhook handling` |

## Quick Start

```
1. Something broke?     → /debug <error description>
2. Writing code?      → /plan <feature> → /spec <requirements>
3. Code works, messy? → /simplify
4. Ready to deploy?    → /ship
```

## Command Details

### /debug
Systematic root-cause debugging following 6-step process:
1. Reproduce → 2. Localize → 3. Reduce → 4. Fix → 5. Guard → 6. Verify

### /review
5-axis code review:
1. Correctness
2. Readability
3. Architecture
4. Security
5. Performance

### /security
Threat modeling dengan STRIDE framework. Fokus pada trust boundaries.

### /simplify
Reduce complexity tanpa ubah behavior. Preserve tests.

### /ship
Pre-launch checklist + Rollback plan + Monitoring setup.

### /ci
Quality gates: lint → typecheck → test → build → audit.

### /plan
Decompose requirements jadi actionable tasks.

### /test
TDD cycle: Red → Green → Refactor.

### /spec
Define requirements & acceptance criteria sebelum coding.

## Full Skill Reference

Lihat `agent-skills/skills/` untuk dokumentasi lengkap setiap skill.
