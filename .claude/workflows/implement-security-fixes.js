export const meta = {
  name: 'implement-all-security-fixes',
  description: 'Fix all 20 security issues from audit report',
  phases: [
    { title: 'CRITICAL', detail: 'Fix #1-3: Timing attack, Race condition, CSRF localStorage' },
    { title: 'HIGH', detail: 'Fix #4-9: as any, Advisory lock, crypto.random, user data, IP hash, CIDR' },
    { title: 'MEDIUM', detail: 'Fix #10-16: JWT blocklist, CSP nonce, Division by zero, Rate limiting, etc.' },
    { title: 'LOW', detail: 'Fix #17-20: Magic numbers, DI, SRP, Batch processing' },
    { title: 'VERIFY', detail: 'Build + Test all changes' }
  ],
}

// Files to fix
const CRITICAL_FIXES = [
  { id: 1, file: 'backend/src/auth/middleware/csrf.middleware.ts', issue: 'Timing attack - use crypto.timingSafeEqual', priority: 'CRITICAL' },
  { id: 2, file: 'backend/src/members/application/services/member.service.ts', issue: 'Race condition - wrap in prisma.$transaction', priority: 'CRITICAL' },
  { id: 3, file: 'frontend/src/routes/login-admin/verify-otp/+page.svelte', issue: 'Remove CSRF from localStorage', priority: 'CRITICAL' },
]

const HIGH_FIXES = [
  { id: 4, file: 'backend/src/inventory/application/services/inventory.service.ts', issue: 'Remove as any casting', priority: 'HIGH' },
  { id: 5, file: 'backend/src/orders/application/services/orders.service.ts', issue: 'Advisory lock retry with pg_try_advisory_lock', priority: 'HIGH' },
  { id: 6, file: 'backend/src/members/application/services/loyalty.service.ts', issue: 'Use crypto.randomInt for member codes', priority: 'HIGH' },
  { id: 7, file: 'frontend/src/routes/login/+page.svelte', issue: 'Move user data from localStorage to cookie', priority: 'HIGH' },
  { id: 8, file: 'backend/src/auth/application/services/auth.service.ts', issue: 'IP lockout key = IP + User-Agent hash', priority: 'HIGH' },
  { id: 9, file: 'backend/src/orders/presentation/orders.controller.ts', issue: 'Proper CIDR validation with ip-address library', priority: 'HIGH' },
]

const MEDIUM_FIXES = [
  { id: 10, file: 'backend/src/auth/application/services/auth.service.ts', issue: 'JWT blocklist in Redis', priority: 'MEDIUM' },
  { id: 11, file: 'backend/src/main.ts', issue: 'CSP nonce implementation', priority: 'MEDIUM' },
  { id: 12, file: 'backend/src/finance/application/services/finance.service.ts', issue: 'Division by zero guard', priority: 'MEDIUM' },
  { id: 13, file: 'frontend/src/routes/login/+page.svelte', issue: 'Frontend rate limiting on PIN entry', priority: 'MEDIUM' },
  { id: 14, file: 'backend/src/finance/application/services/finance.service.ts', issue: 'Database aggregation instead of in-memory', priority: 'MEDIUM' },
  { id: 15, file: 'backend/src/orders/application/services/orders.service.ts', issue: 'Error propagation for points processing', priority: 'MEDIUM' },
]

const LOW_FIXES = [
  { id: 17, file: 'backend/src/members/application/services/loyalty.service.ts', issue: 'Centralized constants', priority: 'LOW' },
  { id: 18, file: 'backend/src/orders/application/services/orders.service.ts', issue: 'Dependency injection for Midtrans', priority: 'LOW' },
  { id: 20, file: 'backend/src/orders/application/services/orders.service.ts', issue: 'Parallel batch processing', priority: 'LOW' },
]

// Helper to create fix agent prompt
function create_fix_prompt(fix) {
  return `Fix issue #${fix.id} in ${fix.file}: ${fix.issue}

Read the file first, understand the current implementation, then implement the fix according to the audit report recommendations.

CRITICAL REQUIREMENTS:
1. Read the file before editing
2. Use crypto.timingSafeEqual for timing-safe comparisons
3. Use prisma.$transaction for atomic database operations
4. NEVER use localStorage for sensitive data (tokens, CSRF)
5. Use crypto.randomInt() instead of Math.random()
6. Use httpOnly cookies for sensitive data
7. Hash IP + User-Agent for rate limiting keys
8. Use ip-address library for CIDR validation

After implementing:
1. Run lint check
2. Run build to verify no compilation errors

Report what you fixed and any issues encountered.`
}

// ==================== PHASE 1: CRITICAL FIXES ====================
phase('CRITICAL')

log('Starting CRITICAL fixes (#1-3)...')

const critical_results = await parallel(
  CRITICAL_FIXES.map(fix => () => agent(
    create_fix_prompt(fix),
    { label: `fix:${fix.id}`, phase: 'CRITICAL' }
  ))
)

log(`CRITICAL fixes completed: ${critical_results.filter(Boolean).length}/${CRITICAL_FIXES.length}`)

// ==================== PHASE 2: HIGH PRIORITY ====================
phase('HIGH')

log('Starting HIGH priority fixes (#4-9)...')

const high_results = await parallel(
  HIGH_FIXES.map(fix => () => agent(
    create_fix_prompt(fix),
    { label: `fix:${fix.id}`, phase: 'HIGH' }
  ))
)

log(`HIGH priority fixes completed: ${high_results.filter(Boolean).length}/${HIGH_FIXES.length}`)

// ==================== PHASE 3: MEDIUM PRIORITY ====================
phase('MEDIUM')

log('Starting MEDIUM priority fixes (#10-16)...')

const medium_results = await parallel(
  MEDIUM_FIXES.map(fix => () => agent(
    create_fix_prompt(fix),
    { label: `fix:${fix.id}`, phase: 'MEDIUM' }
  ))
)

log(`MEDIUM priority fixes completed: ${medium_results.filter(Boolean).length}/${MEDIUM_FIXES.length}`)

// ==================== PHASE 4: LOW PRIORITY ====================
phase('LOW')

log('Starting LOW priority fixes (#17-20)...')

const low_results = await parallel(
  LOW_FIXES.map(fix => () => agent(
    create_fix_prompt(fix),
    { label: `fix:${fix.id}`, phase: 'LOW' }
  ))
)

log(`LOW priority fixes completed: ${low_results.filter(Boolean).length}/${LOW_FIXES.length}`)

// ==================== PHASE 5: VERIFICATION ====================
phase('VERIFY')

log('Running final verification...')

const backend_lint = await agent(
  'Run "cd backend && npm run lint" and report results. If there are errors, try to fix them.',
  { label: 'backend-lint', phase: 'VERIFY' }
)

const frontend_lint = await agent(
  'Run "cd frontend && npm run lint" and report results. If there are errors, try to fix them.',
  { label: 'frontend-lint', phase: 'VERIFY' }
)

const backend_build = await agent(
  'Run "cd backend && npm run build" and report results. If build fails, report the errors.',
  { label: 'backend-build', phase: 'VERIFY' }
)

const frontend_build = await agent(
  'Run "cd frontend && npm run build" and report results. If build fails, report the errors.',
  { label: 'frontend-build', phase: 'VERIFY' }
)

// ==================== SUMMARY ====================
const all_fixed = [
  ...CRITICAL_FIXES,
  ...HIGH_FIXES,
  ...MEDIUM_FIXES,
  ...LOW_FIXES
]

const successful = all_fixed.length - [
  ...critical_results,
  ...high_results,
  ...medium_results,
  ...low_results
].filter(r => !r || r.includes('ERROR') || r.includes('FAILED')).length

return {
  summary: {
    total_issues: all_fixed.length,
    critical_fixed: critical_results.filter(Boolean).length,
    high_fixed: high_results.filter(Boolean).length,
    medium_fixed: medium_results.filter(Boolean).length,
    low_fixed: low_results.filter(Boolean).length,
    backend_build: backend_build,
    frontend_build: frontend_build,
  },
  critical_results,
  high_results,
  medium_results,
  low_results,
  backend_lint,
  frontend_lint,
  backend_build,
  frontend_build
}
