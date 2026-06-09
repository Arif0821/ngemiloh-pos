# CI/CD Automation Command
# Use: /ci <optional action>

## Purpose
Automate quality gates for every change. Catch problems early.

## Usage
```
/ci
/ci Review current pipeline
/ci Add integration tests
/ci Optimize build speed
```

## Quality Gate Pipeline Order
1. **Lint** - eslint, prettier
2. **Type Check** - tsc --noEmit
3. **Unit Tests** - jest
4. **Build** - npm run build
5. **Security Audit** - npm audit
6. **E2E Tests** (optional) - playwright

## Quick Reference
```yaml
# GitHub Actions structure
jobs:
  lint: { run: npm run lint }
  typecheck: { run: npx tsc --noEmit }
  test: { run: npm test -- --coverage }
  build: { run: npm run build }
  audit: { run: npm audit --audit-level=high }
```
