// ============================================
// API CLIENT - HTTP Client Singleton
// Using snake_case naming convention
// ============================================

// SECURITY FIX: Use VITE_ prefix for environment variables (Vite requirement)
// Fallback to localhost for development, MUST be set in production via VITE_API_URL
const BASE_URL =
	(typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
	(typeof import.meta !== 'undefined' && import.meta.env?.DEV && 'http://localhost:3000') ||
	'';

if (!BASE_URL) {
	console.error('[ApiClient] FATAL: VITE_API_URL environment variable is not set');
}
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds

/**
 * Get a cookie value by name (client-side only)
 */
function get_cookie(name: string): string | undefined {
	if (typeof document === 'undefined') return undefined;
	const value = `; ${document.cookie}`;
	const parts = value.split(`; ${name}=`);
	if (parts.length === 2) return parts.pop()?.split(';').shift();
}

/**
 * Check if the browser is offline
 */
function is_offline(): boolean {
	return typeof navigator !== 'undefined' && !navigator.onLine;
}

// ============================================
// API CLIENT - Singleton HTTP Client
// ============================================

class ApiClient {
	private static _instance: ApiClient | null = null;

	/**
	 * Get the singleton instance
	 */
	static getInstance(): ApiClient {
		if (!ApiClient._instance) {
			ApiClient._instance = new ApiClient();
		}
		return ApiClient._instance;
	}

	/**
	 * Reset the singleton (useful for testing)
	 */
	static reset(): void {
		ApiClient._instance = null;
	}

	private constructor() {
		// Listen for offline/online events to warn users
		if (typeof window !== 'undefined') {
			window.addEventListener('offline', () => {
				console.warn('[ApiClient] Browser is offline. Requests will fail.');
			});
		}
	}

	/**
	 * Build the full URL from an endpoint
	 */
	private build_url(endpoint: string): string {
		if (endpoint.startsWith('http')) return endpoint;

		const path = endpoint.startsWith('/api/v1')
			? endpoint
			: `/api/v1${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;

		return `${BASE_URL}${path}`;
	}

	/**
	 * Get the appropriate auth token based on route
	 * - /admin/* routes use admin_token
	 * - All others use access_token
	 */
	private get_auth_token(endpoint: string): string | null {
		if (typeof localStorage === 'undefined') return null;

		// Check if this is an admin route
		const is_admin_route = endpoint.includes('/admin/') || endpoint.includes('/auth/admin');

		if (is_admin_route) {
			return localStorage.getItem('admin_token');
		}
		return localStorage.getItem('access_token');
	}

	/**
	 * Get the appropriate login redirect path
	 */
	private get_redirect_path(endpoint: string): string {
		const is_admin_route = endpoint.includes('/admin/') || endpoint.includes('/auth/admin');
		return is_admin_route ? '/login-admin' : '/login';
	}

	/**
	 * Core request method with timeout, auth, CSRF, and 401 handling
	 */
	async request(endpoint: string, options: RequestInit = {}): Promise<Response> {
		const url = this.build_url(endpoint);

		// Warn if offline before making request
		if (is_offline()) {
			console.warn(`[ApiClient] Offline: skipping request to ${endpoint}`);
		}

		// Clone options to avoid mutating the caller's object
		options = { ...options };
		options.credentials = 'include';
		options.headers = { ...((options.headers as Record<string, string>) || {}) };

		// Add Authorization header based on route
		const token = this.get_auth_token(endpoint);
		if (token) {
			options.headers['Authorization'] = `Bearer ${token}`;
		}

		// CSRF token for state-changing requests
		const is_mutating =
			options.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method.toUpperCase());
		if (is_mutating) {
			const csrf_token = get_cookie('csrf_token');
			if (csrf_token) {
				options.headers['X-CSRF-Token'] = csrf_token;
			} else {
				// CSRF token missing on mutating request - redirect to login
				console.warn('[ApiClient] CSRF token missing, redirecting to login');
				if (typeof window !== 'undefined') {
					window.location.href = this.get_redirect_path(endpoint);
				}
				throw new Error('CSRF token missing');
			}
		}

		// Add request timeout using AbortController
		const controller = new AbortController();
		const timeout_id = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
		options.signal = controller.signal;

		try {
			const response = await fetch(url, options);
			clearTimeout(timeout_id);

			// Global 401 handling - redirect to appropriate login page
			if (response.status === 401 && !endpoint.includes('/auth/')) {
				console.warn(`[ApiClient] 401 on ${endpoint}, redirecting to login`);
				if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
					window.location.href = this.get_redirect_path(endpoint);
				}
			}

			return response;
		} catch (error: unknown) {
			clearTimeout(timeout_id);

			if (error instanceof Error) {
				if (error.name === 'AbortError') {
					throw new Error(`Request timeout after ${REQUEST_TIMEOUT_MS}ms for ${endpoint}`);
				}
				// Network errors (offline, DNS failure, etc.)
				if (error.message === 'Failed to fetch' || error.message.includes('NetworkError')) {
					console.warn(`[ApiClient] Network error for ${endpoint}: ${error.message}`);
				}
			}
			throw error;
		}
	}

	/**
	 * GET request
	 */
	async get(endpoint: string, options?: RequestInit): Promise<Response> {
		return this.request(endpoint, { ...options, method: 'GET' });
	}

	/**
	 * POST request with JSON body
	 */
	async post(endpoint: string, body?: unknown, options?: RequestInit): Promise<Response> {
		const init: RequestInit = { ...options, method: 'POST' };
		if (body !== undefined) {
			init.headers = {
				'Content-Type': 'application/json',
				...((init.headers as Record<string, string>) || {})
			};
			init.body = JSON.stringify(body);
		}
		return this.request(endpoint, init);
	}

	/**
	 * PUT request with JSON body
	 */
	async put(endpoint: string, body?: unknown, options?: RequestInit): Promise<Response> {
		const init: RequestInit = { ...options, method: 'PUT' };
		if (body !== undefined) {
			init.headers = {
				'Content-Type': 'application/json',
				...((init.headers as Record<string, string>) || {})
			};
			init.body = JSON.stringify(body);
		}
		return this.request(endpoint, init);
	}

	/**
	 * PATCH request with JSON body
	 */
	async patch(endpoint: string, body?: unknown, options?: RequestInit): Promise<Response> {
		const init: RequestInit = { ...options, method: 'PATCH' };
		if (body !== undefined) {
			init.headers = {
				'Content-Type': 'application/json',
				...((init.headers as Record<string, string>) || {})
			};
			init.body = JSON.stringify(body);
		}
		return this.request(endpoint, init);
	}

	/**
	 * DELETE request
	 */
	async delete(endpoint: string, options?: RequestInit): Promise<Response> {
		return this.request(endpoint, { ...options, method: 'DELETE' });
	}
}

// ============================================
// EXPORTS - Singleton instance + class
// ============================================

export { ApiClient };
export const api = ApiClient.getInstance();
