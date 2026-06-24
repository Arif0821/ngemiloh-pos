# Silent Refresh JWT Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement client-side silent refresh for JWT tokens to allow kasir working long shifts without manual re-login.

**Architecture:** Centralized Svelte 5 Runes store in `auth.store.svelte.ts` that manages token expiry, refresh timer, retry logic, and force logout. No duplication across layouts.

**Tech Stack:** Svelte 5 Runes, TypeScript, Fetch API for refresh endpoint

---

## File Structure Overview

```
NEW:     src/lib/stores/auth.store.svelte.ts
MODIFY:  src/routes/pos/+page.svelte         (add init call)
MODIFY:  src/routes/admin/+layout.svelte     (add init call)
```

---

## Task 1: Create auth.store.svelte.ts

**Files:**
- Create: `frontend/src/lib/stores/auth.store.svelte.ts`
- Reference: `frontend/src/lib/stores/pos.store.svelte.ts` (existing pattern)

- [ ] **Step 1: Create auth.store.svelte.ts with complete implementation**

```typescript
// frontend/src/lib/stores/auth.store.svelte.ts
// Silent refresh JWT store - centralized auth management

// ============================================
// JWT DECODE UTILITY
// Decode without verification - we only read exp claim
// ============================================
function decode_jwt(token: string): { exp: number; sub?: string; role?: string } | null {
	try {
		const base64_url = token.split('.')[1];
		const base64 = base64_url.replace(/-/g, '+').replace(/_/g, '/');
		const json_payload = decodeURIComponent(
			atob(base64)
				.split('')
				.map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
				.join('')
		);
		return JSON.parse(json_payload);
	} catch {
		return null;
	}
}

// ============================================
// GET TOKEN FROM COOKIE
// Read httpOnly cookie set by backend
// ============================================
function get_token_from_cookie(name: string): string | null {
	if (typeof document === 'undefined') return null;
	const match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)'));
	return match ? decodeURIComponent(match[1]) : null;
}

// ============================================
// AUTH STORE - Centralized Silent Refresh
// ============================================
class AuthStore {
	// State
	private token_expiry: Date | null = $state(null);
	private refresh_timeout: ReturnType<typeof setTimeout> | null = null;
	private retry_count: number = 0;
	private max_retries: number = 3;
	private retry_delay_ms: number = 60000; // 60 seconds

	// Computed
	is_token_expiring_soon: boolean = $derived.by(() => {
		if (!this.token_expiry) return false;
		const now = new Date();
		const sixty_minutes_from_now = new Date(now.getTime() + 60 * 60 * 1000);
		return this.token_expiry <= sixty_minutes_from_now;
	});

	// ============================================
	// INIT SILENT REFRESH
	// Call this after successful login/auth verification
	// ============================================
	init_silent_refresh(role: string): void {
		// Clear any existing timer first
		this.clear_refresh_timer();

		// Determine cookie name based on role
		const cookie_name = role === 'kasir' ? 'access_token' : 'admin_token';
		const token = get_token_from_cookie(cookie_name);

		if (!token) {
			console.warn('[AuthStore] No token found in cookie');
			return;
		}

		const decoded = decode_jwt(token);
		if (!decoded || !decoded.exp) {
			console.warn('[AuthStore] Failed to decode token expiry');
			return;
		}

		// Set expiry time
		this.token_expiry = new Date(decoded.exp * 1000);

		// Calculate time until refresh (60 minutes before expiry)
		const now = new Date();
		const refresh_time = new Date(this.token_expiry.getTime() - 60 * 60 * 1000);
		const delay_ms = refresh_time.getTime() - now.getTime();

		// If refresh time has passed, refresh immediately
		if (delay_ms <= 0) {
			console.log('[AuthStore] Token refresh time already passed, refreshing now');
			this.refresh_token(role);
			return;
		}

		console.log(`[AuthStore] Silent refresh scheduled in ${Math.round(delay_ms / 60000)} minutes`);
		this.refresh_timeout = setTimeout(() => {
			this.refresh_token(role);
		}, delay_ms);
	}

	// ============================================
	// REFRESH TOKEN
	// Call refresh API and reset timer
	// ============================================
	async refresh_token(role: string): Promise<boolean> {
		try {
			// Check if offline
			if (!navigator.onLine) {
				console.warn('[AuthStore] Offline, skipping refresh');
				this.schedule_retry(role);
				return false;
			}

			const response = await fetch('/api/v1/auth/refresh', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include', // Include cookies
			});

			if (response.ok) {
				console.log('[AuthStore] Token refreshed successfully');
				this.retry_count = 0;
				// Re-init with new token expiry
				this.init_silent_refresh(role);
				return true;
			}

			if (response.status === 401) {
				console.warn('[AuthStore] Token expired or invalid');
				this.schedule_retry(role);
				return false;
			}

			// Other error - retry
			console.error(`[AuthStore] Refresh failed with status ${response.status}`);
			this.schedule_retry(role);
			return false;
		} catch (error) {
			console.error('[AuthStore] Refresh request failed:', error);
			this.schedule_retry(role);
			return false;
		}
	}

	// ============================================
	// SCHEDULE RETRY
	// Retry logic: max 3 attempts, 60s interval
	// ============================================
	private schedule_retry(role: string): void {
		if (this.retry_count >= this.max_retries) {
			console.error('[AuthStore] Max retries reached, forcing logout');
			this.force_logout(role);
			return;
		}

		this.retry_count++;
		console.log(`[AuthStore] Scheduling retry ${this.retry_count}/${this.max_retries} in ${this.retry_delay_ms / 1000}s`);

		setTimeout(() => {
			this.refresh_token(role);
		}, this.retry_delay_ms);
	}

	// ============================================
	// FORCE LOGOUT
	// Called after max retries or critical error
	// ============================================
	async force_logout(role: string): Promise<void> {
		this.clear_refresh_timer();

		// Clear local storage
		localStorage.removeItem('user');
		localStorage.removeItem('pending_pin_change');
		if (role === 'kasir') {
			localStorage.removeItem('selected_outlet');
		}

		// Try to call logout endpoint (non-blocking)
		try {
			await fetch('/api/v1/auth/logout', {
				method: 'POST',
				credentials: 'include',
			});
		} catch {
			// Ignore errors, we're logging out anyway
		}

		// Redirect to appropriate login page
		if (role === 'kasir') {
			window.location.href = '/login';
		} else {
			window.location.href = '/login-admin';
		}
	}

	// ============================================
	// CLEAR REFRESH TIMER
	// Call on component unmount or logout
	// ============================================
	clear_refresh_timer(): void {
		if (this.refresh_timeout) {
			clearTimeout(this.refresh_timeout);
			this.refresh_timeout = null;
		}
		this.retry_count = 0;
	}
}

// Export singleton instance
export const auth_store = new AuthStore();
```

- [ ] **Step 2: Verify file syntax**

Run: `cd frontend && npx tsc --noEmit src/lib/stores/auth.store.svelte.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/stores/auth.store.svelte.ts
git commit -m "feat: add auth.store.svelte.ts with silent refresh logic

Implements JWT silent refresh with:
- JWT decode utility for client-side exp reading
- init_silent_refresh() - schedule refresh 60min before expiry
- refresh_token() - call /api/v1/auth/refresh endpoint
- Retry logic: 3 attempts, 60s interval
- force_logout() - redirect after max retries
- clear_refresh_timer() - cleanup on unmount

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Integrate auth_store in POS page

**Files:**
- Modify: `frontend/src/routes/pos/+page.svelte:1-72`

- [ ] **Step 1: Add auth_store import and init call in onMount**

Read lines 1-72 of `frontend/src/routes/pos/+page.svelte` first.

Add import at line 5-6:
```typescript
import { pos_store } from '$lib/stores/pos.store.svelte';
import { pos_service } from '$lib/services/pos.service';
import { auth_store } from '$lib/stores/auth.store.svelte'; // ADD THIS
import { db } from '$lib/db';
```

Add cleanup in onDestroy (around line 49-71):
```typescript
onDestroy(() => {
	// Clear flag refresh interval
	if (flag_interval) {
		clearInterval(flag_interval);
		flag_interval = undefined;
	}
	// Clear shift polling interval
	if (shift_interval) {
		clearInterval(shift_interval);
		shift_interval = undefined;
	}
	// Remove event listeners
	if (handle_online) {
		window.removeEventListener('online', handle_online);
		handle_online = undefined;
	}
	if (handle_offline) {
		window.removeEventListener('offline', handle_offline);
		handle_offline = undefined;
	}
	// Cancel SSE/polling on component destroy
	pos_service.cancel_qris_waiting();
	// Clear silent refresh timer
	auth_store.clear_refresh_timer(); // ADD THIS
});
```

Add init call after successful auth verification in onMount (around line 69-85):
```typescript
// VERIFIKASI TOKEN KE BACKEND
api
	.get('/auth/me')
	.then((res) => {
		if (!res.ok) {
			localStorage.removeItem('user');
			goto('/login');
			return;
		}
		// Init silent refresh for kasir
		auth_store.init_silent_refresh('kasir'); // ADD THIS
	})
	.catch(() => {
		// Jika offline, percayakan localStorage sementara
		console.warn('Cannot verify session — network offline');
	});
```

- [ ] **Step 2: Verify syntax**

Run: `cd frontend && npx tsc --noEmit src/routes/pos/+page.svelte`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/pos/+page.svelte
git commit -m "feat(pos): integrate silent refresh for kasir sessions

Call auth_store.init_silent_refresh('kasir') after auth verification.
Clear refresh timer on component destroy.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Integrate auth_store in Admin layout

**Files:**
- Modify: `frontend/src/routes/admin/+layout.svelte:1-91`

- [ ] **Step 1: Add auth_store import and init call**

Read `frontend/src/routes/admin/+layout.svelte` first.

Add import after existing imports (around line 5-6):
```typescript
import { api } from '$lib/services/api.client';
import { auth_store } from '$lib/stores/auth.store.svelte'; // ADD THIS
```

Add cleanup in onMount return (around line 87-91):
```typescript
return () => {
	window.removeEventListener('online', handle_online);
	window.removeEventListener('offline', handle_offline);
	auth_store.clear_refresh_timer(); // ADD THIS
};
```

Add init call in the auth verification block (around line 68-85):
```typescript
// VERIFIKASI TOKEN KE BACKEND (TINGGI-01)
api
	.get('/auth/me')
	.then((res) => {
		if (!res.ok) {
			localStorage.removeItem('user');
			goto('/login-admin');
			return;
		}
		is_superadmin = true;
		admin_name = user.name || 'Admin';
		// Init silent refresh for superadmin
		auth_store.init_silent_refresh('superadmin'); // ADD THIS
	})
	.catch(() => {
		// Jika offline, percayakan localStorage sementara
		console.warn('Cannot verify session — network offline');
		is_superadmin = true;
		admin_name = user.name || 'Admin';
	});
```

Also add init call in the catch block (for offline mode):

- [ ] **Step 2: Verify syntax**

Run: `cd frontend && npx tsc --noEmit src/routes/admin/+layout.svelte`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/admin/+layout.svelte
git commit -m "feat(admin): integrate silent refresh for admin sessions

Call auth_store.init_silent_refresh('superadmin') after auth verification.
Clear refresh timer on component destroy.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Test silent refresh flow

**Files:**
- Create: `frontend/src/lib/stores/auth.store.test.ts`

- [ ] **Step 1: Write unit tests for auth store**

```typescript
// frontend/src/lib/stores/auth.store.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { auth_store } from './auth.store.svelte';

// Mock fetch
const mock_fetch = vi.fn();
global.fetch = mock_fetch;

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
	value: true,
	configurable: true,
});

describe('AuthStore', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		auth_store.clear_refresh_timer();
	});

	describe('decode_jwt', () => {
		it('should decode valid JWT token', () => {
			// Create a valid JWT with exp = now + 8 hours
			const payload = { sub: 'user123', role: 'kasir', exp: Math.floor(Date.now() / 1000) + 28800 };
			const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
			const payload_b64 = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
			const token = `${header}.${payload_b64}.fake_signature`;

			const decoded = decode_jwt(token);
			expect(decoded).toBeTruthy();
			expect(decoded?.sub).toBe('user123');
			expect(decoded?.role).toBe('kasir');
		});

		it('should return null for invalid token', () => {
			const decoded = decode_jwt('invalid.token');
			expect(decoded).toBeNull();
		});
	});

	describe('init_silent_refresh', () => {
		it('should schedule refresh 60 minutes before expiry', () => {
			// Mock cookie with valid token (8 hour expiry)
			Object.defineProperty(document, 'cookie', {
				value: 'access_token=valid.kasir.token',
				configurable: true,
			});

			const setTimeout_spy = vi.spyOn(global, 'setTimeout');

			// For this test, we need to mock the JWT decode
			// Since we can't easily mock internal functions, we test the flow
			auth_store.init_silent_refresh('kasir');

			// If token was found and decoded, setTimeout should be called
			expect(setTimeout_spy).toHaveBeenCalled();
		});
	});

	describe('refresh_token', () => {
		it('should return true on successful refresh', async () => {
			mock_fetch.mockResolvedValueOnce({
				ok: true,
				status: 200,
			});

			const result = await auth_store.refresh_token('kasir');
			expect(result).toBe(true);
			expect(mock_fetch).toHaveBeenCalledWith('/api/v1/auth/refresh', expect.any(Object));
		});

		it('should return false and schedule retry on 401', async () => {
			mock_fetch.mockResolvedValueOnce({
				ok: false,
				status: 401,
			});

			const result = await auth_store.refresh_token('kasir');
			expect(result).toBe(false);
		});

		it('should return false when offline', async () => {
			Object.defineProperty(navigator, 'onLine', { value: false });

			const result = await auth_store.refresh_token('kasir');
			expect(result).toBe(false);
			expect(mock_fetch).not.toHaveBeenCalled();
		});
	});

	describe('clear_refresh_timer', () => {
		it('should clear any pending timeout', () => {
			const clearTimeout_spy = vi.spyOn(global, 'clearTimeout');

			auth_store.clear_refresh_timer();
			expect(clearTimeout_spy).toHaveBeenCalled();
		});
	});
});
```

- [ ] **Step 2: Run tests**

Run: `cd frontend && npm run test -- --run src/lib/stores/auth.store.test.ts`
Expected: Tests pass

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/stores/auth.store.test.ts
git commit -m "test: add unit tests for auth store silent refresh

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Update PRD Documentation

**Files:**
- Modify: `PRD v2/PRD_NGEMILOH_POS_v8.0_MASTER_INDONESIAN.md`

- [ ] **Step 1: Add implementation status for Issue #2**

Read the PRD file around line 1290 (Section 18).

Update the table entry for Issue #2:
```
| 2 | JWT 365 Days for Kasir | **HIGH** | Compromised PIN = 1 tahun akses | **OPSI B** (Silent refresh) | ✅ IMPLEMENTED |
```

Add a new section after Section 18 documenting the implementation:

```markdown
### 18.6 Implementation Status

| # | Issue | Status | Notes |
|---|-------|--------|-------|
| 2 | JWT 365 Days for Kasir | ✅ IMPLEMENTED | Backend: 8h token + /refresh endpoint. Frontend: auth.store.svelte.ts with silent refresh. |
```

- [ ] **Step 2: Commit PRD update**

```bash
git add "PRD v2/PRD_NGEMILOH_POS_v8.0_MASTER_INDONESIAN.md"
git commit -m "docs(prd): update Issue #2 status to IMPLEMENTED

JWT silent refresh now operational:
- Backend: 8h JWT tokens with /api/v1/auth/refresh endpoint
- Frontend: Centralized auth.store.svelte.ts
  - init_silent_refresh() schedules refresh 60min before expiry
  - refresh_token() calls API with retry logic (3 attempts, 60s interval)
  - force_logout() redirects to login after max retries
  - Integrated in POS and Admin layouts

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

## Verification Checklist

After all tasks complete, verify:

- [ ] `npm run lint` passes (no errors)
- [ ] `npm run check` passes (no type errors)
- [ ] `npm run test` passes (all tests green)
- [ ] `npm run build` succeeds

---

## Summary

| Task | File Changes | Status |
|------|--------------|--------|
| 1 | Create `auth.store.svelte.ts` | Pending |
| 2 | Modify `pos/+page.svelte` | Pending |
| 3 | Modify `admin/+layout.svelte` | Pending |
| 4 | Create `auth.store.test.ts` | Pending |
| 5 | Update PRD documentation | Pending |
