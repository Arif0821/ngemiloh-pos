# Naming Convention Standardization Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement task-by-task.

**Goal:** Standardize all code to snake_case naming convention per project preferences.

**Architecture:** Systematic rename of camelCase identifiers to snake_case across backend and frontend files. Database columns remain snake_case (already correct). TypeScript/JavaScript variables, functions, and Svelte state will be converted.

**Tech Stack:** ESLint with camelCase-to-snake_case rules, manual refactoring with search-and-replace.

---

## Scope Analysis

### Backend (50+ violations in finance.service.ts)

| Pattern | Example | Target |
|---------|---------|--------|
| Local variables | `cashierId` | `cashier_id` |
| Function params | `purchasePrice` | `purchase_price` |
| Map keys | `cashierMap` | `cashier_map` |
| Destructured | `{ cashierId }` | `{ cashier_id }` |

### Frontend (100+ violations in admin/*.svelte)

| Pattern | Example | Target |
|---------|---------|--------|
| State vars | `isLoading` | `is_loading` |
| Function names | `goBack` | `go_back` |
| Props | `showDetailModal` | `show_detail_modal` |

---

## Task List

### Task 1: Backend - finance.service.ts Refactoring

**File:** `backend/src/finance/application/services/finance.service.ts`

**Violations to fix:**
- Line 213-219: `cashierId`, `cashierName`, `totalSales`, `totalOrders`, `shiftCount`
- Line 223-224: `cashierId`, `ordersByCashier`
- Line 227-229: `existing.totalSales`, `existing.totalOrders`, `existing.shiftCount`
- Line 233-238: `cashierName`, `cashierId`
- Line 264: `shareAmount`
- Line 265-269: `share.revenue`, `data.totalSales`, `share.cashierShare`, `cashierMap.size`
- Line 280-287: `details[0].share_amount`
- Line 325: `purchasePrice`, `lifespanMonths`
- Line 349-350: `newValue`, `newLifespan`
- Line 352-357: `parsedValue`, `parsedLifespan`
- Line 393: `profitShare`
- Line 489-506: `productMap`, `pId`, `current.qty`, `current.revenue`
- Line 514-519: `cashVal`, `qrisVal`, `splitVal`
- Line 565-569: `openingBalance`, `plannedCloseAt`, `carryOverFromShiftId`
- Line 587-596: `plannedClose`
- Line 611-613: `actualCash`, `isAutoClosed`
- Line 649-650: `expectedBalance`
- Line 662: `discrepancy`

---

### Task 2: Frontend - admin/+error.svelte Refactoring

**File:** `frontend/src/routes/admin/+error.svelte`

**Violations to fix:**
- Line 4: `errorMessage` → `error_message`
- Line 5: `errorStatus` → `error_status`
- Line 7: `goAdminDashboard` → `go_admin_dashboard`
- Line 11: `goBack` → `go_back`
- Line 15: `is404` → `is_404`
- Line 16: `is403` → `is_403`

---

### Task 3: Frontend - admin/+layout.svelte Refactoring

**File:** `frontend/src/routes/admin/+layout.svelte`

**Violations to fix:**
- Line 14: `user_str` → `user_str` (already snake_case)
- Line 67: Various state variables
- Line 89: `admin_name` → already snake_case

---

### Task 4: Frontend - admin/transactions/+page.svelte Refactoring

**File:** `frontend/src/routes/admin/transactions/+page.svelte`

**Violations to fix:**
- Line 7: `orders` → already snake_case
- Line 8: `isLoading` → `is_loading`
- Line 10: `selectedOrder` → `selected_order`
- Line 11: `showDetailModal` → `show_detail_modal`
- Line 12: `showVoidModal` → `show_void_modal`
- Line 13: `voidReason` → `void_reason`

---

### Task 5: Verify All Tests Pass

**Command:** `npm run test`

---

## Implementation Notes

1. **Backend Tests:** Run `npm run test` after each file change
2. **Frontend Tests:** Run `npm run test` in frontend directory
3. **Build Verification:** Run `npm run build` after all changes
4. **No breaking changes:** Only rename variables, no logic changes

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking string references | Use IDE refactor (F2) not find-replace |
| Test failures | Run tests after each file |
| Missed references | Run full test suite before commit |
