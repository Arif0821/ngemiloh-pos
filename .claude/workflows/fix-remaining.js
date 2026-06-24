export const meta = {
  name: 'fix-remaining-security-issues',
  description: 'Fix remaining security issues from audit report',
  phases: [
    { title: 'FIX_REMAINING', detail: 'Fix #10, #13, #14, #17, #18, #20' },
    { title: 'VERIFY', detail: 'Build + Lint checks' }
  ],
}

const REMAINING_FIXES = [
  { id: 10, file: 'backend/src/auth/application/services/auth.service.ts', issue: 'JWT blocklist in Redis for token revocation', priority: 'MEDIUM' },
  { id: 13, file: 'frontend/src/routes/login/+page.svelte', issue: 'Frontend rate limiting on PIN entry', priority: 'MEDIUM' },
  { id: 14, file: 'backend/src/finance/application/services/finance.service.ts', issue: 'Database aggregation instead of in-memory', priority: 'MEDIUM' },
  { id: 17, file: 'backend/src/members/application/services/loyalty.service.ts', issue: 'Centralized constants for magic numbers', priority: 'LOW' },
  { id: 18, file: 'backend/src/orders/application/services/orders.service.ts', issue: 'Dependency injection for Midtrans', priority: 'LOW' },
  { id: 20, file: 'backend/src/orders/application/services/orders.service.ts', issue: 'Parallel batch processing', priority: 'LOW' },
]

function create_fix_prompt(fix) {
  return `Fix issue #${fix.id} in ${fix.file}: ${fix.issue}

Read the file first, understand the current implementation, then implement the fix according to the audit report recommendations.

After implementing:
1. Run lint check
2. Run build to verify no compilation errors

Report what you fixed and any issues encountered.`
}

// ==================== PHASE 1: FIX REMAINING ====================
phase('FIX_REMAINING')

log('Starting remaining fixes...')

const fix_results = await parallel(
  REMAINING_FIXES.map(fix => () => agent(
    create_fix_prompt(fix),
    { label: `fix:${fix.id}`, phase: 'FIX_REMAINING' }
  ))
)

log(`Remaining fixes completed: ${fix_results.filter(Boolean).length}/${REMAINING_FIXES.length}`)

// ==================== PHASE 2: VERIFICATION ====================
phase('VERIFY')

log('Running final verification...')

const backend_build = await agent(
  'Run "cd backend && npm run build" and report results. If build fails, report the errors.',
  { label: 'backend-build', phase: 'VERIFY' }
)

const frontend_build = await agent(
  'Run "cd frontend && npm run build" and report results. If build fails, report the errors.',
  { label: 'frontend-build', phase: 'VERIFY' }
)

// ==================== SUMMARY ====================
return {
  summary: {
    total_remaining: REMAINING_FIXES.length,
    fixed: fix_results.filter(Boolean).length,
  },
  fix_results,
  backend_build,
  frontend_build
}
