# Frontend Testing Guide - NGEMILOH POS

> Comprehensive testing guide for POS workflow and Admin dashboard using Vitest + Playwright.

**Tech Stack:** SvelteKit 2 + Svelte 5 Runes + Vitest (unit) + Playwright (E2E)

---

## Table of Contents

1. [Testing Strategy Overview](#1-testing-strategy-overview)
2. [Vitest Setup (Unit & Integration)](#2-vitest-setup-unit--integration)
3. [Playwright Setup (E2E)](#3-playwright-setup-e2e)
4. [POS Workflow Test Cases](#4-pos-workflow-test-cases)
5. [Admin Dashboard Test Cases](#5-admin-dashboard-test-cases)
6. [Offline Sync Testing](#6-offline-sync-testing)
7. [Smoke Testing Checklist](#7-smoke-testing-checklist)
8. [Performance Benchmarks](#8-performance-benchmarks)
9. [CI/CD Integration](#9-cicd-integration)

---

## 1. Testing Strategy Overview

### Test Pyramid

```
         ┌─────────────┐
         │     E2E     │  ← Playwright (5-10 critical flows)
         │   (Top)     │
        ┌┴─────────────┴┐
        │  Integration  │  ← Vitest + Testing Library (module interaction)
       ┌┴──────────────┴┐
       │     Unit        │  ← Vitest (business logic, stores, utilities)
      ┌┴────────────────┴┐
      │      Types       │  ← TypeScript + Svelte (compile-time safety)
      └──────────────────┘
```

### Test Responsibilities

| Level | Framework | What to Test | Coverage Target |
|-------|----------|-------------|-----------------|
| **Unit** | Vitest | Stores, utilities, API client | 80%+ |
| **Integration** | Vitest + Testing Library | Components, page interactions | 70%+ |
| **E2E** | Playwright | Critical user flows | 100% of critical paths |

### Critical Paths for E2E Testing

1. **Kasir Login** → Product browsing → Add to cart → Checkout → Payment → Receipt
2. **Admin Login** → Dashboard → View transactions
3. **Member Registration** → Member login → Loyalty discount applied
4. **Offline Mode** → Order creation → Sync on reconnect

---

## 2. Vitest Setup (Unit & Integration)

### Current Configuration

The frontend already has Vitest configured. Global setup is in `frontend/src/test/setup.ts`.

### Running Unit Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- pos.store.test
```

### Existing Test Files

| Test File | Path | Description |
|-----------|------|-------------|
| `pos.store.test.ts` | `src/test/stores/` | POS store unit tests |
| `auth.store.test.ts` | `src/lib/stores/` | Auth store tests (silent refresh) |
| `api.client.test.ts` | `src/lib/services/` | API client tests |

### Writing New Unit Tests

Follow the existing pattern:

```typescript
// src/lib/services/my-service.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('MyService', () => {
	let mock_fetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		vi.useFakeTimers();
		mock_fetch = vi.fn();
		global.fetch = mock_fetch;
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
	});

	describe('myFunction', () => {
		it('should return expected result', async () => {
			mock_fetch.mockResolvedValueOnce({
				ok: true,
				json: () => Promise.resolve({ data: 'test' })
			});

			const result = await myFunction();
			expect(result.data).toBe('test');
		});
	});
});
```

---

## 3. Playwright Setup (E2E)

### Installation

```bash
cd frontend
npm install -D @playwright/test
npx playwright install chromium
```

### Configuration

Create `frontend/playwright.config.ts`:

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: 'html',
	use: {
		baseURL: process.env.BASE_URL || 'http://localhost:5173',
		trace: 'on-first-retry',
		screenshot: 'only-on-failure'
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	],
	webServer: {
		command: 'npm run dev',
		url: 'http://localhost:5173',
		reuseExistingServer: !process.env.CI
	}
});
```

### Environment Variables

Create `frontend/tests/e2e/.env`:

```env
BASE_URL=http://localhost:5173
API_URL=http://localhost:3000
TEST_CASHIER_PIN=123456
TEST_ADMIN_EMAIL=admin@test.com
TEST_ADMIN_PASSWORD=TestPassword123!
```

### Project Structure

```
frontend/tests/e2e/
├── pages/
│   ├── LoginPage.ts
│   ├── POSPage.ts
│   └── AdminDashboardPage.ts
├── helpers/
│   └── offline-helper.ts
├── fixtures/
│   ├── products.ts
│   └── members.ts
├── pos/
│   ├── login.spec.ts
│   ├── cart.spec.ts
│   └── payment.spec.ts
├── admin/
│   ├── login.spec.ts
│   └── dashboard.spec.ts
├── smoke/
│   └── smoke.spec.ts
└── performance/
    └── performance.spec.ts
```

### Page Object Models

**`tests/e2e/pages/LoginPage.ts`**:

```typescript
import { type Page, expect } from '@playwright/test';

export class LoginPage {
	constructor(private page: Page) {}

	async goto() {
		await this.page.goto('/login');
	}

	async loginAsCashier(username: string, pin: string) {
		await this.page.fill('[data-testid="username-input"]', username);
		await this.enterPin(pin);
		await this.page.click('[data-testid="login-button"]');
	}

	async enterPin(pin: string) {
		for (const digit of pin.split('')) {
			await this.page.click(`[data-testid="pin-keypad-${digit}"]`);
		}
	}

	async expectError(message: string) {
		await expect(this.page.locator('[data-testid="error-message"]')).toContainText(message);
	}
}
```

**`tests/e2e/pages/POSPage.ts`**:

```typescript
import { type Page, expect } from '@playwright/test';

export class POSPage {
	constructor(private page: Page) {}

	async goto() {
		await this.page.goto('/pos');
	}

	async waitForProducts() {
		await expect(this.page.locator('[data-testid="product-grid"]')).toBeVisible({ timeout: 5000 });
	}

	async addProductToCart(productId: string) {
		await this.page.click(`[data-testid="product-${productId}"]`);
	}

	async openCart() {
		await this.page.click('[data-testid="cart-toggle"]');
	}

	async checkout() {
		await this.page.click('[data-testid="checkout-button"]');
	}

	async selectPaymentMethod(method: 'cash' | 'qris') {
		await this.page.click(`[data-testid="payment-${method}"]`);
	}

	async confirmPayment() {
		await this.page.click('[data-testid="confirm-payment"]');
	}
}
```

---

## 4. POS Workflow Test Cases

### 4.1 Login Flow

#### TC-POS-001: Kasir Login with Valid PIN

**File:** `tests/e2e/pos/login.spec.ts`

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';

test.describe('POS Login Flow', () => {
	test('TC-POS-001: Kasir login with valid PIN', async ({ page }) => {
		const loginPage = new LoginPage(page);

		await loginPage.goto();
		await loginPage.loginAsCashier('kasir1', '123456');

		// Should redirect to POS page
		await expect(page).toHaveURL(/\/pos/);

		// Should show open shift modal if no active shift
		await expect(page.locator('[data-testid="shift-modal"]')).toBeVisible();
	});
});
```

#### TC-POS-002: Kasir Login with Invalid PIN (Rate Limiting)

```typescript
test('TC-POS-002: Kasir login rate limiting after 5 failed attempts', async ({ page }) => {
	const loginPage = new LoginPage(page);

	await loginPage.goto();

	// Attempt 5 failed logins
	for (let i = 0; i < 5; i++) {
		await loginPage.enterPin('000000');
		await loginPage.page.click('[data-testid="login-button"]');
		await loginPage.page.waitForTimeout(500);
	}

	// Should show lockout message
	await expect(page.locator('[data-testid="lockout-message"]')).toContainText('30');

	// PIN pad should be disabled
	await expect(page.locator('[data-testid="pin-keypad-0"]')).toBeDisabled();
});
```

#### TC-POS-003: Admin Login with OTP

**File:** `tests/e2e/admin/login.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('Admin Login Flow', () => {
	test('TC-POS-003: Admin login with valid credentials and OTP', async ({ page }) => {
		await page.goto('/login-admin');

		// Fill email and password
		await page.fill('[data-testid="email-input"]', 'admin@test.com');
		await page.fill('[data-testid="password-input"]', 'TestPassword123!');
		await page.click('[data-testid="login-button"]');

		// Should redirect to OTP verification
		await expect(page).toHaveURL(/\/verify-otp/);

		// Enter OTP (mocked for testing)
		await page.fill('[data-testid="otp-input"]', '123456');
		await page.click('[data-testid="verify-button"]');

		// Should redirect to admin dashboard
		await expect(page).toHaveURL(/\/admin\/dashboard/);
	});
});
```

### 4.2 Product Browsing and Cart Operations

#### TC-POS-004: Product Search

```typescript
test('TC-POS-004: Search products by name', async ({ page }) => {
	await page.goto('/pos');

	// Search for product
	await page.fill('[data-testid="product-search"]', 'Nasi Goreng');

	// Should filter products
	const productCards = page.locator('[data-testid^="product-"]');
	await expect(productCards).toHaveCount(1);
	await expect(productCards.first()).toContainText('Nasi Goreng');
});
```

#### TC-POS-005: Add Product with Modifiers

```typescript
test('TC-POS-005: Add product with required modifier selection', async ({ page }) => {
	await page.goto('/pos');

	// Click on a product with modifiers
	await page.click('[data-testid="product-mie-ayam"]');

	// Modifier modal should appear
	await expect(page.locator('[data-testid="modifier-modal"]')).toBeVisible();

	// Select required modifier
	await page.click('[data-testid="modifier-level-besar"]');

	// Confirm selection
	await page.click('[data-testid="add-to-cart"]');

	// Cart should show the item with modifier
	await expect(page.locator('[data-testid="cart-item"]')).toContainText('Level Besar');
});
```

#### TC-POS-006: Update Cart Item Quantity

```typescript
test('TC-POS-006: Update quantity and remove cart items', async ({ page }) => {
	await page.goto('/pos');

	// Add product to cart
	await page.click('[data-testid="product-es-teh"]');

	// Open cart
	await page.click('[data-testid="cart-toggle"]');

	// Increase quantity
	await page.click('[data-testid="quantity-increase"]');
	await expect(page.locator('[data-testid="quantity-display"]')).toHaveText('2');

	// Decrease quantity
	await page.click('[data-testid="quantity-decrease"]');
	await expect(page.locator('[data-testid="quantity-display"]')).toHaveText('1');

	// Remove item
	await page.click('[data-testid="remove-item"]');
	await expect(page.locator('[data-testid="cart-empty"]')).toBeVisible();
});
```

### 4.3 Order Creation and Payment

#### TC-POS-007: Cash Payment Flow

```typescript
test('TC-POS-007: Complete order with cash payment', async ({ page }) => {
	await page.goto('/pos');

	// Add products
	await page.click('[data-testid="product-nasi-goreng"]');
	await page.click('[data-testid="product-es-teh"]');

	// Open cart and checkout
	await page.click('[data-testid="cart-toggle"]');
	await page.click('[data-testid="checkout-button"]');

	// Select cash payment
	await page.click('[data-testid="payment-cash"]');

	// Enter cash amount
	await page.fill('[data-testid="cash-amount"]', '100000');

	// Confirm payment
	await page.click('[data-testid="confirm-payment"]');

	// Should show success modal
	await expect(page.locator('[data-testid="success-modal"]')).toBeVisible();
	await expect(page.locator('[data-testid="total-paid"]')).toContainText('Rp 50.000');
});
```

#### TC-POS-008: QRIS Payment Flow

```typescript
test('TC-POS-008: Complete order with QRIS payment', async ({ page }) => {
	await page.goto('/pos');

	// Add product
	await page.click('[data-testid="product-nasi-goreng"]');

	// Checkout
	await page.click('[data-testid="cart-toggle"]');
	await page.click('[data-testid="checkout-button"]');

	// Select QRIS
	await page.click('[data-testid="payment-qris"]');

	// QRIS modal should show
	await expect(page.locator('[data-testid="qris-modal"]')).toBeVisible();
	await expect(page.locator('[data-testid="qr-code"]')).toBeVisible();

	// Mock payment completion (in real test, use webhook mocking)
	await page.evaluate(() => {
		window.postMessage({ type: 'payment-success', transactionId: 'TEST-123' }, '*');
	});

	// Should show success
	await expect(page.locator('[data-testid="success-modal"]')).toBeVisible();
});
```

### 4.4 Offline Mode Testing

#### TC-POS-009: Detect Offline Mode

```typescript
test('TC-POS-009: Detect and indicate offline mode', async ({ page, context }) => {
	await page.goto('/pos');

	// Emulate offline
	await context.setOffline(true);

	// Should show offline banner
	await expect(page.locator('[data-testid="offline-banner"]')).toBeVisible();
	await expect(page.locator('[data-testid="offline-banner"]')).toContainText('OFFLINE');

	// Products should still be visible (from cache)
	await expect(page.locator('[data-testid="product-grid"]')).toBeVisible();

	// Restore online
	await context.setOffline(false);
	await expect(page.locator('[data-testid="offline-banner"]')).toBeHidden();
});
```

#### TC-POS-010: Create Order While Offline

```typescript
test('TC-POS-010: Create and save order while offline', async ({ page, context }) => {
	await page.goto('/pos');

	// Go offline
	await context.setOffline(true);

	// Add product
	await page.click('[data-testid="product-nasi-goreng"]');

	// Checkout - should still work
	await page.click('[data-testid="cart-toggle"]');
	await page.click('[data-testid="checkout-button"]');
	await page.click('[data-testid="payment-cash"]');
	await page.fill('[data-testid="cash-amount"]', '50000');
	await page.click('[data-testid="confirm-payment"]');

	// Should show success with offline indicator
	await expect(page.locator('[data-testid="success-modal"]')).toBeVisible();
	await expect(page.locator('[data-testid="sync-status"]')).toContainText('pending');

	// Order should be stored in IndexedDB
	const orderStored = await page.evaluate(() => {
		return indexedDB.databases().then((dbs) => dbs.some((db) => db.name === 'pos_offline'));
	});
	expect(orderStored).toBe(true);
});
```

### 4.5 Receipt Generation and Printing

#### TC-POS-011: Browser Print Receipt

```typescript
test('TC-POS-011: Generate and print receipt via browser', async ({ page }) => {
	await page.goto('/pos/print');

	// Should show print preview
	await expect(page.locator('[data-testid="receipt-preview"]')).toBeVisible();

	// Paper size selector
	await page.selectOption('[data-testid="paper-size"]', '58mm');
	await expect(page.locator('[data-testid="receipt-preview"]')).toHaveAttribute('data-width', '58');

	// Trigger print (intercepted)
	const printPromise = page.waitForEvent('print');
	await page.click('[data-testid="print-button"]');

	// Browser print dialog should be triggered
	await expect(printPromise).toBeTruthy();
});
```

#### TC-POS-012: Offline Receipt Caching

```typescript
test('TC-POS-012: Cache receipt for later printing when offline', async ({ page, context }) => {
	await page.goto('/pos');

	// Create offline order
	await context.setOffline(true);
	await page.click('[data-testid="product-es-teh"]');
	await page.checkoutFlow();

	// Save receipt for later
	await page.click('[data-testid="save-for-later"]');
	await expect(page.locator('[data-testid="receipt-queued"]')).toBeVisible();

	// Check IndexedDB
	const receiptQueued = await page.evaluate(() => {
		return new Promise((resolve) => {
			const request = indexedDB.open('pos_offline');
			request.onsuccess = () => {
				const db = request.result;
				if (db.objectStoreNames.contains('receipts')) {
					const tx = db.transaction('receipts', 'readonly');
					const store = tx.objectStore('receipts');
					const countReq = store.count();
					countReq.onsuccess = () => resolve(countReq.result > 0);
				} else {
					resolve(false);
				}
			};
		});
	});

	expect(receiptQueued).toBe(true);
});
```

---

## 5. Admin Dashboard Test Cases

### 5.1 Dashboard Loading

#### TC-ADMIN-001: Dashboard KPIs Load

```typescript
import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {
	test('TC-ADMIN-001: Dashboard KPIs display correctly', async ({ page }) => {
		await page.goto('/admin/dashboard');

		// Wait for KPI cards
		await expect(page.locator('[data-testid="kpi-revenue"]')).toBeVisible();
		await expect(page.locator('[data-testid="kpi-transactions"]')).toBeVisible();
		await expect(page.locator('[data-testid="kpi-hpp"]')).toBeVisible();

		// Charts should render
		await expect(page.locator('[data-testid="revenue-chart"]')).toBeVisible();
		await expect(page.locator('[data-testid="top-products-chart"]')).toBeVisible();

		// Values should be formatted as currency
		await expect(page.locator('[data-testid="kpi-revenue"]')).toContainText('Rp');
	});
});
```

### 5.2 Member Management

#### TC-ADMIN-002: Search and View Members

```typescript
test('TC-ADMIN-002: Search members by phone or name', async ({ page }) => {
	await page.goto('/admin/members');

	// Search by phone
	await page.fill('[data-testid="member-search"]', '081234567890');
	await page.waitForTimeout(300); // Debounce

	// Should filter results
	await expect(page.locator('[data-testid="member-list"] tr')).toHaveCount(1);
	await expect(page.locator('[data-testid="member-list"]')).toContainText('081234567890');
});
```

#### TC-ADMIN-003: View Member Details

```typescript
test('TC-ADMIN-003: View member detail page with loyalty info', async ({ page }) => {
	await page.goto('/admin/members');

	// Click on member row
	await page.click('[data-testid="member-row-1"]');

	// Should navigate to detail page
	await expect(page).toHaveURL(/\/admin\/members\/\d+/);

	// Should show tier badge
	await expect(page.locator('[data-testid="tier-badge"]')).toBeVisible();
	await expect(page.locator('[data-testid="tier-badge"]')).toContainText(/Bronze|Silver|Gold|Platinum/);

	// Should show points balance
	await expect(page.locator('[data-testid="points-balance"]')).toBeVisible();

	// Should show transaction history
	await expect(page.locator('[data-testid="transaction-history"]')).toBeVisible();
});
```

### 5.3 Product CRUD

#### TC-ADMIN-004: Create New Product

```typescript
test('TC-ADMIN-004: Create product with all fields', async ({ page }) => {
	await page.goto('/admin/products');

	// Click add product
	await page.click('[data-testid="add-product-button"]');

	// Fill product form
	await page.fill('[data-testid="product-name"]', 'Mie Ayam Spesial');
	await page.fill('[data-testid="product-price"]', '25000');
	await page.selectOption('[data-testid="product-category"]', 'Makanan');
	await page.fill('[data-testid="product-stock"]', '50');

	// Set modifier groups
	await page.click('[data-testid="add-modifier-group"]');
	await page.fill('[data-testid="modifier-group-name"]', 'Level Pedas');
	await page.fill('[data-testid="modifier-option"]', 'Biasa');
	await page.fill('[data-testid="modifier-price"]', '0');
	await page.click('[data-testid="add-modifier-option"]');

	// Submit
	await page.click('[data-testid="save-product"]');

	// Should show success and return to list
	await expect(page.locator('[data-testid="toast-success"]')).toContainText('Produk berhasil dibuat');
	await expect(page).toHaveURL(/\/admin\/products/);

	// New product should appear in list
	await expect(page.locator('[data-testid="product-list"]')).toContainText('Mie Ayam Spesial');
});
```

#### TC-ADMIN-005: Update Product Price

```typescript
test('TC-ADMIN-005: Update product price with validation', async ({ page }) => {
	await page.goto('/admin/products');

	// Click edit on existing product
	await page.click('[data-testid="edit-product-1"]');

	// Change price
	await page.fill('[data-testid="product-price"]', '30000');
	await page.click('[data-testid="save-product"]');

	// Should show success
	await expect(page.locator('[data-testid="toast-success"]')).toContainText('Harga berhasil diperbarui');
});
```

#### TC-ADMIN-006: Delete Product (Soft Delete)

```typescript
test('TC-ADMIN-006: Soft delete product with confirmation', async ({ page }) => {
	await page.goto('/admin/products');

	// Click delete
	await page.click('[data-testid="delete-product-1"]');

	// Confirmation dialog
	await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible();
	await page.click('[data-testid="confirm-delete"]');

	// Should show success
	await expect(page.locator('[data-testid="toast-success"]')).toContainText('Produk berhasil dihapus');

	// Product should be hidden from list
	await expect(page.locator('[data-testid="product-list"]')).not.toContainText('Deleted Product');
});
```

### 5.4 Shift Monitoring

#### TC-ADMIN-007: View Shift History

```typescript
test('TC-ADMIN-007: View and filter shift history', async ({ page }) => {
	await page.goto('/admin/shifts');

	// Default view: today's shifts
	await expect(page.locator('[data-testid="shift-list"]')).toBeVisible();

	// Filter by date
	await page.fill('[data-testid="date-filter"]', '2024-01-15');
	await page.click('[data-testid="apply-filter"]');

	// Should show shifts from that date
	const shifts = page.locator('[data-testid^="shift-row-"]');
	await expect(shifts.first()).toBeVisible();
});
```

#### TC-ADMIN-008: View Shift Discrepancies

```typescript
test('TC-ADMIN-008: Display shift cash discrepancies', async ({ page }) => {
	await page.goto('/admin/shifts');

	// Find shift with discrepancy
	await page.click('[data-testid="shift-row-with-discrepancy"]');

	// Should show discrepancy modal
	await expect(page.locator('[data-testid="discrepancy-modal"]')).toBeVisible();
	await expect(page.locator('[data-testid="expected-cash"]')).toBeVisible();
	await expect(page.locator('[data-testid="actual-cash"]')).toBeVisible();
	await expect(page.locator('[data-testid="discrepancy-amount"]')).toBeVisible();
});
```

---

## 6. Offline Sync Testing

### Sync Testing Procedures

#### ST-001: Online to Offline Transition

```typescript
import { test, expect } from '@playwright/test';
import { openIndexedDB } from '../helpers/offline-helper';

test.describe('Offline Sync', () => {
	test('ST-001: Products cached when online before going offline', async ({ page, context }) => {
		// 1. Ensure online and load POS
		await page.goto('/pos');
		await expect(page.locator('[data-testid="product-grid"]')).toBeVisible();

		// 2. Verify products are cached in IndexedDB
		const productCount = await page.evaluate(async () => {
			const db = await openIndexedDB('pos_offline');
			return db.count('products');
		});
		expect(productCount).toBeGreaterThan(0);

		// 3. Go offline
		await context.setOffline(true);

		// 4. Products should still load from cache
		await page.reload();
		await expect(page.locator('[data-testid="product-grid"]')).toBeVisible();
		await expect(page.locator('[data-testid="offline-banner"]')).toBeVisible();
	});
});
```

#### ST-002: Offline Order Sync Queue

```typescript
test('ST-002: Order queued in IndexedDB when created offline', async ({ page, context }) => {
	await context.setOffline(true);
	await page.goto('/pos');

	// Create order
	await page.click('[data-testid="product-es-teh"]');
	await page.checkoutFlow();

	// Verify order in IndexedDB with pending status
	const pendingOrder = await page.evaluate(async () => {
		const db = await openIndexedDB('pos_offline');
		const orders = await db.getAll('orders');
		return orders.find((o) => o.sync_status === 'pending');
	});

	expect(pendingOrder).toBeDefined();
	expect(pendingOrder.items).toBeDefined();
	expect(pendingOrder.items.length).toBeGreaterThan(0);
});
```

#### ST-003: Automatic Sync on Reconnection

```typescript
test('ST-003: Pending orders sync automatically when back online', async ({ page, context }) => {
	// 1. Create offline order
	await context.setOffline(true);
	await page.goto('/pos');
	await page.createOfflineOrder();

	// 2. Go back online
	await context.setOffline(false);

	// 3. Wait for sync indicator
	await expect(page.locator('[data-testid="sync-indicator"]')).toBeVisible();

	// 4. Order status should change to synced
	await page.waitForFunction(() => {
		return new Promise(async (resolve) => {
			const db = await openIndexedDB('pos_offline');
			const orders = await db.getAll('orders');
			const syncedOrder = orders.find((o) => o.sync_status === 'synced');
			resolve(syncedOrder !== undefined);
		});
	}, { timeout: 10000 });
});
```

#### ST-004: Sync Conflict Resolution

```typescript
test('ST-004: Handle sync conflict with server validation', async ({ page, context }) => {
	await context.setOffline(true);
	await page.goto('/pos');

	// Create order with stale price
	await page.createOrderWithPrice('5000'); // Price changed to 6000 on server

	// Go online and sync
	await context.setOffline(false);
	await page.reload();

	// Order should go to pending_review
	await expect(page.locator('[data-testid="sync-conflict-banner"]')).toBeVisible();
	await expect(page.locator('[data-testid="conflict-type"]')).toContainText('price_mismatch');
});
```

### Offline Sync Helper

**`tests/e2e/helpers/offline-helper.ts`**:

```typescript
export async function openIndexedDB(name: string): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(name);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

export async function getOfflineOrders(): Promise<any[]> {
	const db = await openIndexedDB('pos_offline');
	return db.getAll('orders');
}

export async function getPendingReceipts(): Promise<any[]> {
	const db = await openIndexedDB('pos_offline');
	return db.getAllFromIndex('receipts', 'sync_status', 'pending');
}
```

---

## 7. Smoke Testing Checklist

### Pre-Deployment Smoke Test

Run these tests before any deployment to production:

#### POS Smoke Tests

- [ ] **TC-POS-001** Kasir login with valid PIN
- [ ] **TC-POS-002** Invalid PIN shows error and rate limiting
- [ ] **TC-POS-004** Products load and are searchable
- [ ] **TC-POS-005** Add product with modifiers to cart
- [ ] **TC-POS-007** Cash payment completes successfully
- [ ] **TC-POS-008** QRIS payment flow works
- [ ] **TC-POS-009** Offline mode detected and indicated
- [ ] **TC-POS-010** Order created while offline
- [ ] **TC-POS-011** Receipt generates correctly
- [ ] **TC-POS-012** Offline receipt cached

#### Admin Smoke Tests

- [ ] **TC-ADMIN-001** Dashboard KPIs load correctly
- [ ] **TC-ADMIN-002** Search members by phone
- [ ] **TC-ADMIN-003** View member details with tier
- [ ] **TC-ADMIN-004** Create new product
- [ ] **TC-ADMIN-005** Update product price
- [ ] **TC-ADMIN-006** Delete product
- [ ] **TC-ADMIN-007** View shift history
- [ ] **TC-ADMIN-008** View shift discrepancies

#### Sync Smoke Tests

- [ ] **ST-001** Products cached before going offline
- [ ] **ST-002** Order queued in IndexedDB
- [ ] **ST-003** Pending orders sync on reconnect
- [ ] **ST-004** Sync conflict handled

### Quick Smoke Test Command

```bash
# Run only smoke tests (tagged tests)
npx playwright test --grep "@smoke" --reporter=list

# Or run specific test files
npx playwright test tests/e2e/smoke/ --reporter=list
```

### Tag Tests for Smoke Runs

```typescript
test('TC-POS-001: Kasir login with valid PIN', async ({ page }) => {
	// ... test code
}).tag('@smoke');
```

---

## 8. Performance Benchmarks

### Performance Requirements

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| POS page load | < 2s | 3s |
| Payment processing | < 3s | 5s |
| Receipt generation | < 5s | 8s |
| Product search | < 500ms | 1s |
| Cart operations | < 200ms | 500ms |
| Offline detection | < 1s | 2s |
| Sync (100 orders) | < 60s | 120s |

### Performance Test Examples

#### PT-001: POS Page Load Performance

```typescript
test('PT-001: POS page loads within 2 seconds', async ({ page }) => {
	const startTime = Date.now();

	await page.goto('/pos');
	await page.waitForSelector('[data-testid="product-grid"]');

	const loadTime = Date.now() - startTime;
	console.log(`POS load time: ${loadTime}ms`);

	expect(loadTime).toBeLessThan(2000);
});
```

#### PT-002: Payment Processing Performance

```typescript
test('PT-002: Cash payment completes within 3 seconds', async ({ page }) => {
	await page.goto('/pos');
	await page.addProductToCart('nasi-goreng');

	const startTime = Date.now();

	await page.checkout();
	await page.selectPaymentMethod('cash');
	await page.fill('[data-testid="cash-amount"]', '50000');
	await page.confirmPayment();

	// Wait for success modal
	await page.waitForSelector('[data-testid="success-modal"]');

	const paymentTime = Date.now() - startTime;
	console.log(`Payment time: ${paymentTime}ms`);

	expect(paymentTime).toBeLessThan(3000);
});
```

#### PT-003: Receipt Generation Performance

```typescript
test('PT-003: Receipt generates within 5 seconds', async ({ page }) => {
	await page.goto('/pos/print?orderId=test-order-123');

	const startTime = Date.now();

	await page.waitForSelector('[data-testid="receipt-preview"]');

	const receiptTime = Date.now() - startTime;
	console.log(`Receipt generation time: ${receiptTime}ms`);

	expect(receiptTime).toBeLessThan(5000);
});
```

#### PT-004: Offline Detection Speed

```typescript
test('PT-004: Offline mode detected within 1 second', async ({ page, context }) => {
	await page.goto('/pos');
	await page.waitForSelector('[data-testid="product-grid"]');

	// Start monitoring
	const startTime = Date.now();

	// Trigger offline
	await context.setOffline(true);

	// Wait for offline indicator
	await page.waitForSelector('[data-testid="offline-banner"]');

	const detectionTime = Date.now() - startTime;
	console.log(`Offline detection time: ${detectionTime}ms`);

	expect(detectionTime).toBeLessThan(1000);
});
```

---

## 9. CI/CD Integration

### GitHub Actions Workflow

**`.github/workflows/frontend-tests.yml`**:

```yaml
name: Frontend Tests
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: frontend

      - name: Run unit tests
        run: npm run test:coverage
        working-directory: frontend

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: ./frontend/coverage/coverage-summary.json

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: frontend

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
        working-directory: frontend

      - name: Run E2E tests
        run: npx playwright test
        working-directory: frontend
        env:
          CI: true

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: frontend/test-results/

      - name: Upload HTML report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-html
          path: frontend/playwright-report/
```

### Test Reporting

```bash
# Generate HTML coverage report
npm run test:coverage

# View coverage
open frontend/coverage/index.html

# Generate Playwright HTML report
npx playwright show-report

# Or generate specific format
npx playwright test --reporter=html,json
```

---

## Appendix: Test Data Fixtures

### Sample Products

**`tests/e2e/fixtures/products.ts`**:

```typescript
export const testProducts = [
	{
		id: 'prod-001',
		name: 'Nasi Goreng Spesial',
		price: 35000,
		category: 'Makanan',
		stock: 100,
		modifiers: ['level', 'tambahan']
	},
	{
		id: 'prod-002',
		name: 'Mie Ayam',
		price: 25000,
		category: 'Makanan',
		stock: 50,
		modifiers: ['level', 'mie']
	},
	{
		id: 'prod-003',
		name: 'Es Teh Manis',
		price: 8000,
		category: 'Minuman',
		stock: 200
	},
	{
		id: 'prod-004',
		name: 'Es Jeruk',
		price: 10000,
		category: 'Minuman',
		stock: 150
	}
];
```

### Sample Members

**`tests/e2e/fixtures/members.ts`**:

```typescript
export const testMembers = [
	{
		id: 'member-001',
		phone: '081234567890',
		name: 'John Doe',
		tier: 'Gold',
		points: 2500,
		discount_rate: 0.1
	},
	{
		id: 'member-002',
		phone: '089876543210',
		name: 'Jane Smith',
		tier: 'Silver',
		points: 800,
		discount_rate: 0.05
	}
];
```

---

## Quick Reference Commands

```bash
# === Vitest (Unit Tests) ===
npm test                          # Run all tests
npm run test:watch               # Watch mode
npm run test:coverage            # With coverage
npm test -- src/lib/stores       # Specific folder

# === Playwright (E2E Tests) ===
npx playwright test              # Run all E2E tests
npx playwright test --grep="@smoke"  # Smoke tests only
npx playwright test tests/e2e/pos/   # POS tests only
npx playwright test tests/e2e/admin/ # Admin tests only
npx playwright test --debug      # Debug mode
npx playwright show-report        # View HTML report
```

---

## Adding data-testid to Components

For tests to work, components need `data-testid` attributes. Add them to interactive elements:

```svelte
<!-- Product Card -->
<button data-testid="product-{product.id}">
  {product.name}
</button>

<!-- PIN Keypad -->
<button data-testid="pin-keypad-{digit}">{digit}</button>

<!-- Cart Controls -->
<button data-testid="quantity-increase">+</button>
<button data-testid="quantity-decrease">-</button>
<button data-testid="remove-item">Hapus</button>

<!-- Payment -->
<button data-testid="payment-cash">Tunai</button>
<button data-testid="payment-qris">QRIS</button>

<!-- Offline Banner -->
<div data-testid="offline-banner" class="offline">
  OFFLINE - Data Tersimpan Lokal
</div>
```

---

*Last Updated: 2026-06-26*
*Maintained by: QA Team*
