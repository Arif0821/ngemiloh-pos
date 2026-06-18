# Comprehensive Codebase Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Audit and fix bugs, performance issues, security vulnerabilities, test coverage gaps, and refactor code quality in POS Nabil codebase.

**Architecture:** Parallel multi-agent approach with 5 specialized agents scanning backend (~80 files) and frontend (~50 files) simultaneously. Findings consolidated into unified fix plan executed in priority order.

**Tech Stack:** TypeScript, NestJS, SvelteKit, Prisma, PostgreSQL, Jest, Vitest

---

## File Structure Analysis

### Backend (backend/src/)
```
├── auth/           # JWT auth, PIN login, OTP (12 files)
├── orders/         # Order processing (8 files)
├── products/       # Product catalog (6 files)
├── inventory/      # Stock management (5 files)
├── finance/        # Cash register, shift (7 files)
├── discounts/      # Discount campaigns (5 files)
├── email/          # OTP and alert notifications (2 files)
├── audit/          # Audit logging (5 files)
├── payment/        # Midtrans integration (4 files)
├── receipts/       # Receipt generation (4 files)
├── common/         # Shared utilities, filters (8 files)
└── prisma/         # Database service (3 files)
```

### Frontend (frontend/src/)
```
├── lib/
│   ├── components/pos/  # POS UI components (8 files)
│   ├── services/        # API, POS, printer services (4 files)
│   ├── stores/          # Svelte 5 Runes stores (3 files)
│   └── utils/           # Formatting utilities (1 file)
├── routes/              # SvelteKit routes (25+ files)
└── test/                # Test setup (1 file)
```

---

## Phase 1: Parallel Discovery (Agents)

### Task 1: Bug Agent - Backend Scan

**Files to scan:**
- `backend/src/**/*.ts` (exclude *.spec.ts, *.module.ts)

- [ ] **Step 1: Spawn Bug Agent for backend**

```
Agent prompt:
Scan backend/src/**/*.ts for bugs including:
1. Error logic flaws - incorrect conditionals, wrong operators
2. Typos - misspelled variables, functions, strings
3. Duplications - identical or near-identical code blocks
4. Null handling - missing null checks, undefined access
5. Edge cases - division by zero, empty arrays, boundary conditions
6. Anomalies - inconsistent state, race conditions

Use grep patterns:
- "TODO" | "FIXME" | "HACK" for incomplete code
- "\.find\(" with missing null check
- "for...of" with potential empty array issues
- "JSON.parse" without try-catch
- ".catch" without handling

Output format:
- File:Line:Issue:Description:Severity
- Example: "auth.service.ts:42:NULL:Missing null check on user object:High"

Scope: backend/src/ excluding test files
```

- [ ] **Step 2: Parse agent findings**

Read agent output and categorize:
- P1-Critical: Data corruption risks
- P2-High: Breaking functionality
- P3-Medium: Edge cases
- P4-Low: Minor issues

---

### Task 2: Bug Agent - Frontend Scan

**Files to scan:**
- `frontend/src/**/*.{ts,svelte}`

- [ ] **Step 1: Spawn Bug Agent for frontend**

```
Agent prompt:
Scan frontend/src/**/*.{ts,svelte} for bugs including:
1. Error logic flaws - incorrect conditionals, wrong operators
2. Typos - misspelled variables, functions, strings
3. Duplications - identical or near-identical code blocks
4. Null handling - missing null checks, undefined access
5. TypeScript type errors - any types issues
6. Svelte reactivity issues - $state, $derived misuse
7. Async/await issues - missing awaits, unhandled promises

Use grep patterns:
- "TODO" | "FIXME" for incomplete code
- "as any" for type suppression
- "$state(" with potential undefined initialization
- "await" in non-async functions
- Unwrapped store access without $

Output format:
- File:Line:Issue:Description:Severity
```

---

### Task 3: Performance Agent - Backend Scan

**Files to scan:**
- `backend/src/**/*.{repository,service}.ts`

- [ ] **Step 1: Spawn Performance Agent**

```
Agent prompt:
Scan backend/src for performance issues:

1. N+1 Queries - Prisma queries in loops
   - Find: "for...of" or "forEach" containing "prisma." calls
   - Check: missing "include" on related queries

2. Missing Indexes
   - Check: frequently queried fields without @index in schema
   - Common: userId, orderId, shiftId in WHERE clauses

3. Inefficient Operations
   - Find: multiple database calls that could be batched
   - Find: loading full tables when limited data needed

4. Memory Issues
   - Find: large array accumulation without pagination
   - Find: missing .skip()/.take() on list queries

5. Unoptimized Queries
   - Find: SELECT * when specific fields needed
   - Find: missing .select() for specific fields

Schema location: backend/prisma/schema.prisma
Repository files: backend/src/**/prisma-*.repository.ts
Service files: backend/src/**/*.service.ts

Output format:
- File:Line:Issue:Description:Estimated_Impact
```

---

### Task 4: Security Agent - Backend Scan

**Files to scan:**
- `backend/src/auth/**`
- `backend/src/**/*controller.ts`
- `backend/src/**/dto/*.ts`

- [ ] **Step 1: Spawn Security Agent**

```
Agent prompt:
Scan backend/src for security vulnerabilities following OWASP Top 10:

1. A01 - Broken Access Control
   - Find: missing @UseGuards on endpoints
   - Find: role checks without proper validation
   - Check: user can access other user's data

2. A02 - Cryptographic Failures
   - Find: hardcoded secrets in code
   - Find: weak password hashing
   - Check: JWT secrets, API keys

3. A03 - Injection
   - Find: raw SQL queries (should use Prisma)
   - Find: user input without validation
   - Check: DTO validation presence

4. A04 - Insecure Design
   - Find: missing rate limiting
   - Find: missing CSRF protection

5. A05 - Security Misconfiguration
   - Find: CORS too permissive
   - Find: verbose error messages

6. A07 - Identification & Authentication Failures
   - Find: weak password requirements
   - Find: missing account lockout

7. A08 - Software and Data Integrity Failures
   - Find: untrusted data in deserialization

8. A09 - Security Logging Failures
   - Find: missing audit logging on sensitive operations

9. A10 - SSRF
   - Find: URL validation before fetch

Use grep patterns:
- "process.env" for environment variables
- "@Body()" without validation
- "@UseGuards" presence/absence
- "bcrypt" usage
- "jwt" configuration

Output format:
- File:Line:Vulnerability:OWASP_Category:Severity:Remediation
```

---

### Task 5: Security Agent - Frontend Scan

**Files to scan:**
- `frontend/src/**/*.{ts,svelte}`
- `frontend/src/hooks.server.ts`

- [ ] **Step 1: Spawn Security Agent for frontend**

```
Agent prompt:
Scan frontend/src for security issues:

1. XSS Vulnerabilities
   - Find: v-html without sanitization
   - Find: innerHTML usage
   - Find: dangerouslySetInnerHTML

2. Sensitive Data Exposure
   - Find: tokens in localStorage (should use httpOnly cookie)
   - Find: API keys in frontend code
   - Find: console.log of sensitive data

3. Authentication Issues
   - Find: missing auth checks
   - Find: token not refreshed

4. Input Validation
   - Find: missing form validation
   - Find: client-side only validation

5. HTTPS Usage
   - Check: fetch calls use https

Use grep patterns:
- "localStorage"
- "innerHTML"
- "v-html"
- "console.log"
- "fetch("

Output format:
- File:Line:Issue:Description:Severity
```

---

### Task 6: Test Agent - Backend Coverage

**Files to scan:**
- `backend/src/**/*.spec.ts`
- `backend/src/**/*.service.ts`

- [ ] **Step 1: Spawn Test Agent**

```
Agent prompt:
Analyze test coverage gaps in backend:

1. Find all service files:
   backend/src/**/*.service.ts (exclude test files)

2. Find all spec files:
   backend/src/**/*.spec.ts

3. Map coverage:
   - Which services have tests?
   - Which services lack tests?
   - What methods are tested vs untested?

4. Identify missing tests:
   - Error handling paths not tested
   - Edge cases not covered
   - Success paths missing assertions

5. Weak assertions:
   - Tests that only check "didn't throw"
   - Tests with no assertions
   - Tests with overly broad assertions

6. Mock usage issues:
   - Over-mocked (doesn't test real behavior)
   - Under-mocked (too coupled)

Existing spec files to analyze:
- auth: auth.service.spec.ts
- orders: orders.service.spec.ts
- finance: finance.service.spec.ts

Output format:
- File:Method:Issue:Priority
- Example: "orders.service.ts:createOrder:Missing error case test:P2"
```

---

### Task 7: Test Agent - Frontend Coverage

**Files to scan:**
- `frontend/src/**/*.test.ts`
- `frontend/src/lib/**/*.ts`

- [ ] **Step 1: Spawn Test Agent for frontend**

```
Agent prompt:
Analyze test coverage gaps in frontend:

1. Find all test files:
   frontend/src/**/*.test.ts

2. Find source files needing tests:
   frontend/src/lib/services/*.ts
   frontend/src/lib/stores/*.ts
   frontend/src/lib/utils/*.ts

3. Identify untested critical logic:
   - API client error handling
   - Store state transitions
   - Utility functions

4. Svelte component testing gaps:
   - Modal interactions
   - Form submissions
   - Toast notifications

Existing test files:
- api.client.test.ts

Output format:
- File:Function:Issue:Priority
```

---

### Task 8: Refactor Agent - Naming Convention

**Files to scan:**
- All source files (backend + frontend)

- [ ] **Step 1: Spawn Refactor Agent**

```
Agent prompt:
Scan codebase for snake_case naming violations:

Backend (TypeScript):
- Check: camelCase used instead of snake_case for:
  - Function names
  - Variable names
  - Method names
  - Property names
  - File names (already snake_case pattern exists)

Frontend (TypeScript + Svelte):
- Check: Same as above
- Check: Svelte component props
- Check: Store variable names
- Check: Event handler names

Expected patterns:
- snake_case: variable_name, function_name, file_name.ts
- camelCase: TypeScript constructor, class names

Note: TypeScript class names and interfaces should remain PascalCase.
Only variables, functions, files, and properties should be snake_case.

Files to check:
- backend/src/**/*.ts
- frontend/src/**/*.{ts,svelte}

Output format:
- File:Line:Current_Name:Should_Be:Line_Type
- Example: "auth.service.ts:15:userName:user_name:variable"
```

---

### Task 9: Refactor Agent - Code Duplication

**Files to scan:**
- All source files

- [ ] **Step 1: Spawn Refactor Agent for duplication**

```
Agent prompt:
Scan codebase for code duplication:

1. Find identical code blocks (>5 lines):
   - Use grep to find repeated patterns
   - Manual inspection of similar functions

2. Common duplication patterns:
   - Error handling (try-catch with similar logic)
   - Validation logic
   - Response formatting
   - Date manipulation

3. Duplicate Prisma queries:
   - Same query in multiple repositories
   - Common query patterns not extracted

4. Duplicate utility functions:
   - Multiple files with similar date helpers
   - Multiple files with similar formatting

Focus areas:
- backend/src/common/utils/*.ts
- backend/src/**/*repository.ts
- frontend/src/lib/utils/*.ts

Output format:
- File1-Line1 ↔ File2-Line2:Duplication_Description:Lines
- Example: "date.ts:15 ↔ format.ts:22:Date formatting logic:12 lines"
```

---

### Task 10: Refactor Agent - Complexity

**Files to scan:**
- Files identified as complex in previous scans

- [ ] **Step 1: Spawn Refactor Agent for complexity**

```
Agent prompt:
Scan for over-complex code:

1. Long functions (>100 lines):
   - Find functions with multiple responsibilities
   - Suggest extraction

2. Deep nesting (>4 levels):
   - Find callback hells
   - Find deeply nested conditionals

3. High cyclomatic complexity:
   - Many conditionals (>10)
   - Complex boolean expressions

4. God objects:
   - Services with too many methods (>30)
   - Files >500 lines

5. Dead code:
   - Unused exports
   - Unused imports
   - Commented-out code

Complexity heuristics:
- Lines per function: warn >50, error >100
- Nesting depth: warn >3, error >4
- Parameters: warn >5, error >8
- Methods per class: warn >20, error >30

Output format:
- File:Line:Complexity_Type:Current:Lines_Count:Suggestion
```

---

## Phase 2: Analysis & Consolidation

### Task 11: Consolidate All Findings

- [ ] **Step 1: Merge all agent outputs**

```
Collect from Tasks 1-10:
- Bug findings (P1-P4)
- Performance findings
- Security findings (Critical/High/Medium/Low)
- Test coverage gaps
- Naming violations
- Duplication instances
- Complexity issues
```

- [ ] **Step 2: Deduplicate and prioritize**

```
Combine duplicate findings:
- Same issue reported by multiple agents → keep highest severity
- Overlapping file/line → merge descriptions

Priority matrix:
┌─────────────────────┬──────────┬──────────┐
│ Type                │ Count    │ Priority │
├─────────────────────┼──────────┼──────────┤
│ Security-Critical   │ X        │ P1       │
│ Data Loss Risk      │ X        │ P1       │
│ Bug-High            │ X        │ P2       │
│ Performance-Critical│ X        │ P2       │
│ Bug-Medium          │ X        │ P3       │
│ Test-Gap            │ X        │ P3       │
│ Naming              │ X        │ P4       │
│ Duplication         │ X        │ P4       │
└─────────────────────┴──────────┴──────────┘
```

- [ ] **Step 3: Create unified fix plan**

```
Format:
### Fix Group 1: P1-Critical Security [Immediate]

1. [File:Line] - Fix description
2. [File:Line] - Fix description

### Fix Group 2: P1-Critical Data Loss

... and so on
```

---

## Phase 3: Implementation

### Implementation Rules

1. **Order matters**: Fix P1 before P2, P2 before P3, P3 before P4
2. **One fix per file**: If multiple fixes in same file, group them
3. **Test after each fix**: Run relevant tests before moving on
4. **Commit after each group**: P1 fixes = one commit, P2 = one commit, etc.

---

### Task 12: Implement P1-Critical Security Fixes

- [ ] **Step 1: Implement each security fix**

```
For each P1-Security finding:
1. Read the file
2. Understand the vulnerability
3. Apply fix
4. Run: npm run lint (backend) or npm run lint (frontend)
5. Run: npm test (backend) or npm test (frontend)
6. Verify fix
```

- [ ] **Step 2: Commit P1-Security fixes**

```bash
git add -A
git commit -m "fix(security): resolve P1 critical vulnerabilities"
```

---

### Task 13: Implement P1-Critical Data Loss Fixes

- [ ] **Step 1: Implement each data loss prevention fix**

```
For each P1-DataLoss finding:
1. Identify the data loss scenario
2. Add null checks, validations, transactions
3. Add tests for the edge case
4. Verify with existing tests
```

- [ ] **Step 2: Commit P1-DataLoss fixes**

```bash
git add -A
git commit -m "fix(data-integrity): prevent potential data loss"
```

---

### Task 14: Implement P2-High Priority Fixes (Bug + Performance)

- [ ] **Step 1: Implement bug fixes**

```
For each P2-Bug finding:
1. Read the file
2. Understand the bug
3. Apply minimal fix
4. Verify with tests
```

- [ ] **Step 2: Implement performance fixes**

```
For each P2-Performance finding:
1. N+1 queries → add .include() or batch queries
2. Missing indexes → add to Prisma schema
3. Inefficient loops → optimize algorithm
4. Test performance impact
```

- [ ] **Step 3: Commit P2 fixes**

```bash
git add -A
git commit -m "fix(bugs+perf): resolve high priority issues"
```

---

### Task 15: Implement P3 Medium Priority Fixes

- [ ] **Step 1: Implement code quality fixes**

```
For each P3-CodeQuality finding:
1. Fix naming violations (camelCase → snake_case)
2. Add missing tests for untested code
3. Improve weak assertions
```

- [ ] **Step 2: Commit P3 fixes**

```bash
git add -A
git commit -m "refactor: improve code quality and test coverage"
```

---

### Task 16: Implement P4 Low Priority Fixes

- [ ] **Step 1: Clean up remaining issues**

```
For each P4-Low finding:
1. Rename variables to snake_case
2. Extract duplicated code to utilities
3. Break up complex functions
```

- [ ] **Step 2: Commit P4 fixes**

```bash
git add -A
git commit -m "refactor: naming conventions and cleanup"
```

---

## Phase 4: Verification

### Task 17: Final Verification

- [ ] **Step 1: Run backend lint**

```bash
cd backend && npm run lint
```

Expected: No errors

- [ ] **Step 2: Run backend tests**

```bash
cd backend && npm test
```

Expected: All tests passing

- [ ] **Step 3: Run backend build**

```bash
cd backend && npm run build
```

Expected: Build successful

- [ ] **Step 4: Run frontend lint**

```bash
cd frontend && npm run lint
```

Expected: No errors

- [ ] **Step 5: Run frontend type check**

```bash
cd frontend && npm run check
```

Expected: No TypeScript errors

- [ ] **Step 6: Run frontend tests**

```bash
cd frontend && npm test
```

Expected: All tests passing

- [ ] **Step 7: Run frontend build**

```bash
cd frontend && npm run build
```

Expected: Build successful

---

### Task 18: Generate Audit Report

- [ ] **Step 1: Create summary report**

```
Document in: docs/audit-report-2026-06-18.md

# Audit Summary

## Statistics
- Files audited: X backend + Y frontend
- Issues found: N total
  - P1-Critical: X
  - P2-High: X
  - P3-Medium: X
  - P4-Low: X
- Issues fixed: N (X%)
- Security vulnerabilities: X (all resolved)
- Performance issues: X (all resolved)

## By Category
- Bug fixes: X issues
- Performance optimizations: X issues
- Security hardening: X issues
- Test coverage improvements: X issues
- Refactoring: X issues

## Verification
- [x] Backend lint: PASS
- [x] Backend tests: PASS
- [x] Backend build: PASS
- [x] Frontend lint: PASS
- [x] Frontend type check: PASS
- [x] Frontend tests: PASS
- [x] Frontend build: PASS
```

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| 1 - Discovery | 1-10 | Parallel agents |
| 2 - Consolidation | 11 | Analysis |
| 3 - Implementation | 12-16 | Priority order |
| 4 - Verification | 17-18 | Final check |

---

## Execution Recommendation

**Recommended: Subagent-Driven Development**

- Dispatch parallel agents for Phase 1 (Tasks 1-10)
- Consolidate findings in Task 11
- Implement fixes in priority order (Tasks 12-16)
- Verify all in Task 17
- Generate report in Task 18

**Estimated time:**
- Phase 1: 30-45 minutes (parallel)
- Phase 2: 15 minutes
- Phase 3: Variable (depends on findings count)
- Phase 4: 15 minutes
