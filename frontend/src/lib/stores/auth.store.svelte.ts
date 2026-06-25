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
	const match = document.cookie.match(
		new RegExp('(?:^|; )' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '=([^;]*)')
	);
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
					'Content-Type': 'application/json'
				},
				credentials: 'include' // Include cookies
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
				credentials: 'include'
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
