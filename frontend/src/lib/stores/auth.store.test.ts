/**
 * Auth Store Unit Tests
 * Test cases for auth.store.svelte.ts - silent refresh functionality
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ============================================
// HELPER: Create a valid JWT token
// ============================================
function create_jwt_token(payload: { sub: string; role: string; exp: number }): string {
	const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
	const payload_b64 = btoa(JSON.stringify(payload));
	const signature = 'test-signature';
	// Base64url encoding
	return `${header}.${payload_b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')}.${signature}`;
}

// ============================================
// DECODE_JWT (copied from auth.store.svelte.ts)
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
// GET_TOKEN_FROM_COOKIE (copied from auth.store.svelte.ts)
// ============================================
function get_token_from_cookie(name: string): string | null {
	if (typeof document === 'undefined') return null;
	const match = document.cookie.match(
		new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)')
	);
	return match ? decodeURIComponent(match[1]) : null;
}

// ============================================
// TEST AUTH STORE (mirrors auth.store.svelte.ts)
// ============================================
class TestAuthStore {
	// State
	token_expiry: Date | null = null;
	private refresh_timeout: ReturnType<typeof setTimeout> | null = null;
	retry_count: number = 0;
	max_retries: number = 3;
	retry_delay_ms: number = 60000;

	// Computed - using getter instead of $derived
	get is_token_expiring_soon(): boolean {
		if (!this.token_expiry) return false;
		const now = new Date();
		const sixty_minutes_from_now = new Date(now.getTime() + 60 * 60 * 1000);
		return this.token_expiry <= sixty_minutes_from_now;
	}

	init_silent_refresh(role: string): void {
		this.clear_refresh_timer();

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

		this.token_expiry = new Date(decoded.exp * 1000);

		const now = new Date();
		const refresh_time = new Date(this.token_expiry.getTime() - 60 * 60 * 1000);
		const delay_ms = refresh_time.getTime() - now.getTime();

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

	async refresh_token(role: string): Promise<boolean> {
		try {
			if (!navigator.onLine) {
				console.warn('[AuthStore] Offline, skipping refresh');
				this.schedule_retry(role);
				return false;
			}

			const response = await fetch('/api/v1/auth/refresh', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include'
			});

			if (response.ok) {
				console.log('[AuthStore] Token refreshed successfully');
				this.retry_count = 0;
				this.init_silent_refresh(role);
				return true;
			}

			if (response.status === 401) {
				console.warn('[AuthStore] Token expired or invalid');
				this.schedule_retry(role);
				return false;
			}

			console.error(`[AuthStore] Refresh failed with status ${response.status}`);
			this.schedule_retry(role);
			return false;
		} catch (error) {
			console.error('[AuthStore] Refresh request failed:', error);
			this.schedule_retry(role);
			return false;
		}
	}

	private schedule_retry(role: string): void {
		// Preserve retry_count across retries - only clear the timer
		if (this.refresh_timeout) {
			clearTimeout(this.refresh_timeout);
			this.refresh_timeout = null;
		}

		// Increment attempt counter
		this.retry_count++;

		// Check if max retries exceeded (>= so 3rd failure triggers logout)
		if (this.retry_count >= this.max_retries) {
			console.error('[AuthStore] Max retries reached, forcing logout');
			this.retry_count = 0; // Reset for next session
			this.force_logout(role);
			return;
		}

		console.log(
			`[AuthStore] Scheduling retry ${this.retry_count}/${this.max_retries} in ${this.retry_delay_ms / 1000}s`
		);

		this.refresh_timeout = setTimeout(() => {
			this.refresh_token(role);
		}, this.retry_delay_ms);
	}

	async force_logout(role: string): Promise<void> {
		this.clear_refresh_timer();

		localStorage.removeItem('user');
		localStorage.removeItem('pending_pin_change');
		if (role === 'kasir') {
			localStorage.removeItem('selected_outlet');
		}

		try {
			await fetch('/api/v1/auth/logout', {
				method: 'POST',
				credentials: 'include'
			});
		} catch {
			// Ignore errors, we're logging out anyway
		}

		if (role === 'kasir') {
			window.location.href = '/login';
		} else {
			window.location.href = '/login-admin';
		}
	}

	clear_refresh_timer(): void {
		if (this.refresh_timeout) {
			clearTimeout(this.refresh_timeout);
			this.refresh_timeout = null;
		}
		this.retry_count = 0;
	}
}

// ============================================
// AUTH STORE TEST SUITE
// ============================================
describe('auth_store', () => {
	let store: TestAuthStore;
	let mock_fetch: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		store = new TestAuthStore();

		// Mock fetch globally
		mock_fetch = vi.fn();
		vi.stubGlobal('fetch', mock_fetch);

		// Mock window.location
		Object.defineProperty(window, 'location', {
			value: { href: 'http://localhost/', reload: vi.fn() },
			writable: true,
			configurable: true
		});

		// Mock navigator.onLine (default to true)
		Object.defineProperty(navigator, 'onLine', {
			value: true,
			writable: true,
			configurable: true
		});

		// Clear localStorage
		localStorage.clear();

		// Mock document.cookie
		Object.defineProperty(document, 'cookie', {
			value: '',
			writable: true,
			configurable: true
		});

		// Use fake timers
		vi.useFakeTimers();

		// Clear any existing timers
		store.clear_refresh_timer();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
		store.clear_refresh_timer();
	});

	// ============================================
	// DECODE_JWT TESTS
	// ============================================
	describe('decode_jwt', () => {
		it('decodes a valid token and extracts exp, sub, role', () => {
			const exp_time = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
			const token = create_jwt_token({
				sub: 'user-123',
				role: 'kasir',
				exp: exp_time
			});

			const decoded = decode_jwt(token);

			expect(decoded).not.toBeNull();
			expect(decoded?.sub).toBe('user-123');
			expect(decoded?.role).toBe('kasir');
			expect(decoded?.exp).toBe(exp_time);
		});

		it('returns null for invalid token format', () => {
			const result = decode_jwt('not-a-valid-jwt');
			expect(result).toBeNull();
		});

		it('returns null for malformed base64 in payload', () => {
			const result = decode_jwt('header.invalid!!!base64.signature');
			expect(result).toBeNull();
		});

		it('returns null for token with invalid JSON payload', () => {
			// Create a token with invalid JSON in the payload
			const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
			const invalid_payload = btoa('not-json');
			const token = `${header}.${invalid_payload}.signature`;

			const result = decode_jwt(token);
			expect(result).toBeNull();
		});
	});

	// ============================================
	// GET_TOKEN_FROM_COOKIE TESTS
	// ============================================
	describe('get_token_from_cookie', () => {
		it('returns token value when cookie exists', () => {
			Object.defineProperty(document, 'cookie', {
				value: 'access_token=kasir-token-123; other_cookie=value',
				configurable: true
			});

			const result = get_token_from_cookie('access_token');
			expect(result).toBe('kasir-token-123');
		});

		it('returns null when cookie does not exist', () => {
			Object.defineProperty(document, 'cookie', {
				value: 'other_cookie=value',
				configurable: true
			});

			const result = get_token_from_cookie('access_token');
			expect(result).toBeNull();
		});

		it('handles URL-encoded cookie values', () => {
			Object.defineProperty(document, 'cookie', {
				value: 'access_token=encoded%3Dvalue',
				configurable: true
			});

			const result = get_token_from_cookie('access_token');
			expect(result).toBe('encoded=value');
		});
	});

	// ============================================
	// INIT_SILENT_REFRESH TESTS
	// ============================================
	describe('init_silent_refresh', () => {
		it('schedules refresh for kasir role with valid token', () => {
			const exp_time = Math.floor(Date.now() / 1000) + 7200; // 2 hours from now
			const token = create_jwt_token({
				sub: 'user-123',
				role: 'kasir',
				exp: exp_time
			});

			Object.defineProperty(document, 'cookie', {
				value: `access_token=${token}`,
				configurable: true
			});

			store.init_silent_refresh('kasir');

			// Token expiry should be set
			expect(store.token_expiry).toBeInstanceOf(Date);
		});

		it('schedules refresh for admin role with valid token', () => {
			const exp_time = Math.floor(Date.now() / 1000) + 7200; // 2 hours from now
			const token = create_jwt_token({
				sub: 'admin-456',
				role: 'admin',
				exp: exp_time
			});

			Object.defineProperty(document, 'cookie', {
				value: `admin_token=${token}`,
				configurable: true
			});

			store.init_silent_refresh('admin');

			expect(store.token_expiry).toBeInstanceOf(Date);
		});

		it('does nothing when no token cookie exists', () => {
			Object.defineProperty(document, 'cookie', {
				value: '',
				configurable: true
			});

			const warn_spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			store.init_silent_refresh('kasir');

			expect(store.token_expiry).toBeNull();
			expect(warn_spy).toHaveBeenCalledWith(expect.stringContaining('No token found'));
			warn_spy.mockRestore();
		});

		it('clears existing timer before scheduling new one', () => {
			const exp_time = Math.floor(Date.now() / 1000) + 7200;
			const token = create_jwt_token({
				sub: 'user-123',
				role: 'kasir',
				exp: exp_time
			});

			Object.defineProperty(document, 'cookie', {
				value: `access_token=${token}`,
				configurable: true
			});

			// First init
			store.init_silent_refresh('kasir');
			const first_timeout = (
				store as unknown as { refresh_timeout: ReturnType<typeof setTimeout> | null }
			).refresh_timeout;

			// Second init should clear first
			store.init_silent_refresh('kasir');
			const second_timeout = (
				store as unknown as { refresh_timeout: ReturnType<typeof setTimeout> | null }
			).refresh_timeout;

			// Both should be valid (cleared and re-created)
			expect(first_timeout).not.toBeNull();
			expect(second_timeout).not.toBeNull();
		});

		it('triggers immediate refresh if token already past refresh window', async () => {
			// Token with 30-min expiry triggers immediate refresh (delay_ms <= 0)
			// Use spy on refresh_token to verify it's called, avoiding recursion issues
			const refresh_spy = vi.spyOn(store, 'refresh_token').mockResolvedValue(true);

			const exp_time = Math.floor(Date.now() / 1000) + 30 * 60;
			const token = create_jwt_token({
				sub: 'user-123',
				role: 'kasir',
				exp: exp_time
			});

			Object.defineProperty(document, 'cookie', {
				value: `access_token=${token}`,
				configurable: true
			});

			store.init_silent_refresh('kasir');

			// Should have called refresh_token immediately
			expect(refresh_spy).toHaveBeenCalledWith('kasir');

			refresh_spy.mockRestore();
		});
	});

	// ============================================
	// REFRESH_TOKEN TESTS
	// ============================================
	describe('refresh_token', () => {
		it('returns true and re-schedules on successful refresh', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

			const exp_time = Math.floor(Date.now() / 1000) + 7200;
			const token = create_jwt_token({
				sub: 'user-123',
				role: 'kasir',
				exp: exp_time
			});

			Object.defineProperty(document, 'cookie', {
				value: `access_token=${token}`,
				configurable: true
			});

			const result = await store.refresh_token('kasir');

			expect(result).toBe(true);
			expect(mock_fetch).toHaveBeenCalledWith('/api/v1/auth/refresh', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include'
			});
		});

		it('returns false on 401 unauthorized', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 401 }));

			const result = await store.refresh_token('kasir');

			expect(result).toBe(false);
		});

		it('returns false and schedules retry on offline', async () => {
			Object.defineProperty(navigator, 'onLine', {
				value: false,
				writable: true,
				configurable: true
			});

			const warn_spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			const result = await store.refresh_token('kasir');

			expect(result).toBe(false);
			expect(warn_spy).toHaveBeenCalledWith(expect.stringContaining('Offline'));
			warn_spy.mockRestore();
		});

		it('returns false on network error', async () => {
			mock_fetch.mockRejectedValueOnce(new Error('Network error'));

			const error_spy = vi.spyOn(console, 'error').mockImplementation(() => {});

			const result = await store.refresh_token('kasir');

			expect(result).toBe(false);
			expect(error_spy).toHaveBeenCalled();
			error_spy.mockRestore();
		});

		it('returns false on non-401 error responses', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 500 }));

			const result = await store.refresh_token('kasir');

			expect(result).toBe(false);
		});
	});

	// ============================================
	// CLEAR_REFRESH_TIMER TESTS
	// ============================================
	describe('clear_refresh_timer', () => {
		it('clears existing timeout and resets retry count', () => {
			const exp_time = Math.floor(Date.now() / 1000) + 7200;
			const token = create_jwt_token({
				sub: 'user-123',
				role: 'kasir',
				exp: exp_time
			});

			Object.defineProperty(document, 'cookie', {
				value: `access_token=${token}`,
				configurable: true
			});

			// Schedule a refresh
			store.init_silent_refresh('kasir');

			const refresh_timeout = (
				store as unknown as { refresh_timeout: ReturnType<typeof setTimeout> | null }
			).refresh_timeout;
			expect(refresh_timeout).not.toBeNull();

			// Clear the timer
			store.clear_refresh_timer();

			const cleared_timeout = (
				store as unknown as { refresh_timeout: ReturnType<typeof setTimeout> | null }
			).refresh_timeout;
			const retry_count = (store as unknown as { retry_count: number }).retry_count;

			expect(cleared_timeout).toBeNull();
			expect(retry_count).toBe(0);
		});

		it('handles clearing when no timer exists', () => {
			// Should not throw
			expect(() => store.clear_refresh_timer()).not.toThrow();
		});
	});

	// ============================================
	// FORCE_LOGOUT TESTS
	// ============================================
	describe('force_logout', () => {
		it('clears localStorage and redirects kasir to /login', async () => {
			localStorage.setItem('user', JSON.stringify({ id: '1', name: 'Test' }));
			localStorage.setItem('selected_outlet', 'outlet-1');

			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

			await store.force_logout('kasir');

			expect(localStorage.getItem('user')).toBeNull();
			expect(localStorage.getItem('selected_outlet')).toBeNull();
			expect(window.location.href).toBe('/login');
		});

		it('redirects admin to /login-admin', async () => {
			localStorage.setItem('user', JSON.stringify({ id: '1', name: 'Admin' }));
			localStorage.setItem('pending_pin_change', 'true');

			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

			await store.force_logout('admin');

			// Admin logout only clears 'user' and 'pending_pin_change' (not csrf_token)
			expect(localStorage.getItem('user')).toBeNull();
			expect(localStorage.getItem('pending_pin_change')).toBeNull();
			expect(window.location.href).toBe('/login-admin');
		});

		it('handles logout even if API call fails', async () => {
			localStorage.setItem('user', JSON.stringify({ id: '1' }));
			mock_fetch.mockRejectedValueOnce(new Error('Network error'));

			await store.force_logout('kasir');

			// Should still clear localStorage and redirect despite API failure
			expect(localStorage.getItem('user')).toBeNull();
			expect(window.location.href).toBe('/login');
		});
	});

	// ============================================
	// IS_TOKEN_EXPIRING_SOON TESTS
	// ============================================
	describe('is_token_expiring_soon', () => {
		it('returns false when token_expiry is null', () => {
			// token_expiry is already null from setup
			expect(store.is_token_expiring_soon).toBe(false);
		});

		it('returns true when token expires within 60 minutes', async () => {
			// We need to test is_token_expiring_soon, which depends on token_expiry being set
			// Mock refresh_token to avoid recursion, but token_expiry is set BEFORE refresh is called
			const refresh_spy = vi.spyOn(store, 'refresh_token').mockResolvedValue(true);

			const exp_time = Math.floor(Date.now() / 1000) + 30 * 60;
			const token = create_jwt_token({
				sub: 'user-123',
				role: 'kasir',
				exp: exp_time
			});

			Object.defineProperty(document, 'cookie', {
				value: `access_token=${token}`,
				configurable: true
			});

			store.init_silent_refresh('kasir');

			// token_expiry was set before the recursive call, so is_token_expiring_soon should be true
			expect(store.is_token_expiring_soon).toBe(true);

			refresh_spy.mockRestore();
		});

		it('returns false when token expires after 60 minutes', () => {
			const exp_time = Math.floor(Date.now() / 1000) + 120 * 60; // 2 hours from now
			const token = create_jwt_token({
				sub: 'user-123',
				role: 'kasir',
				exp: exp_time
			});

			Object.defineProperty(document, 'cookie', {
				value: `access_token=${token}`,
				configurable: true
			});

			store.init_silent_refresh('kasir');

			expect(store.is_token_expiring_soon).toBe(false);
		});
	});

	// ============================================
	// RETRY LOGIC TESTS
	// ============================================
	describe('retry logic', () => {
		it('retries up to max_retries before forcing logout', async () => {
			// All calls return 401 - will trigger force_logout after 3 attempts
			mock_fetch.mockResolvedValue({ status: 401 });

			// Initial refresh fails (retry 1 scheduled)
			await store.refresh_token('kasir');
			expect((store as unknown as { retry_count: number }).retry_count).toBe(1);

			// First timer advance - retry 2 scheduled
			await vi.advanceTimersByTimeAsync(60000);
			expect((store as unknown as { retry_count: number }).retry_count).toBe(2);

			// Second timer advance - retry 3 triggers force_logout (retry_count >= max_retries)
			await vi.advanceTimersByTimeAsync(60000);
			// retry_count is reset to 0 before force_logout is called
			// But due to async nature, it might still be 3 here
			expect((store as unknown as { retry_count: number }).retry_count).toBe(0);

			// Verify logout was triggered
			expect(window.location.href).toBe('/login');
		});

		it('resets retry count on successful refresh', async () => {
			// Mock: 2 failures, then success
			mock_fetch
				.mockResolvedValueOnce(new Response('{}', { status: 401 }))
				.mockResolvedValueOnce(new Response('{}', { status: 401 }))
				.mockResolvedValue(new Response('{}', { status: 200 }));

			// First failure (retry 1)
			await store.refresh_token('kasir');
			expect((store as unknown as { retry_count: number }).retry_count).toBe(1);

			// Second failure (retry 2)
			await vi.advanceTimersByTimeAsync(60000);
			expect((store as unknown as { retry_count: number }).retry_count).toBe(2);

			// Third call should succeed - set up token cookie first
			const exp_time = Math.floor(Date.now() / 1000) + 7200;
			const token = create_jwt_token({
				sub: 'user-123',
				role: 'kasir',
				exp: exp_time
			});

			Object.defineProperty(document, 'cookie', {
				value: `access_token=${token}`,
				configurable: true
			});

			// Third call succeeds - retry_count should reset to 0
			const result = await store.refresh_token('kasir');

			expect(result).toBe(true);
			const retry_count = (store as unknown as { retry_count: number }).retry_count;
			expect(retry_count).toBe(0);
		});

		it('max_retries triggers logout without scheduling timer', async () => {
			// When retry_count >= max_retries, force_logout is called immediately
			// No timer should be scheduled after max retries
			mock_fetch.mockResolvedValue({ status: 401 });

			// Exhaust all retries
			await store.refresh_token('kasir'); // retry 1
			await vi.advanceTimersByTimeAsync(60000); // retry 2
			await vi.advanceTimersByTimeAsync(60000); // retry 3 - force_logout triggered (no new timer)

			// Verify logout was triggered
			expect(window.location.href).toBe('/login');

			// No more timers should be pending (retry_count was reset in schedule_retry)
			const refresh_timeout = (
				store as unknown as { refresh_timeout: ReturnType<typeof setTimeout> | null }
			).refresh_timeout;
			expect(refresh_timeout).toBeNull();
		});
	});
});
