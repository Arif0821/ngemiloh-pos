export class ApiClient {
	private static recursionDepth = 0;
	// HIGH FIX F-04: Request timeout in milliseconds
	private static readonly REQUEST_TIMEOUT_MS = 30000; // 30 seconds

	private static getCookie(name: string) {
		if (typeof document === 'undefined') return undefined;
		const value = `; ${document.cookie}`;
		const parts = value.split(`; ${name}=`);
		if (parts.length === 2) return parts.pop()?.split(';').shift();
	}

	static async request(endpoint: string, options: RequestInit = {}): Promise<Response> {
		// Prevent infinite recursion in token refresh loop
		if (this.recursionDepth > 3) {
			this.recursionDepth = 0;
			if (typeof window !== 'undefined') {
				window.location.href = '/login';
			}
			throw new Error('Token refresh loop detected - redirecting to login');
		}

		// Automatically prepend /api/v1 if it's a relative path and doesn't already have it
		let url = endpoint;
		if (!url.startsWith('http')) {
			const path = url.startsWith('/api/v1')
				? url
				: `/api/v1${url.startsWith('/') ? url : '/' + url}`;
			const baseUrl = import.meta.env.VITE_API_URL || '';
			url = baseUrl ? `${baseUrl}${path}` : path;
		}

		options.credentials = 'include'; // Always include credentials
		options.headers = options.headers || {};

		// SECURITY: Make CSRF token mandatory for state-changing requests
		if (
			options.method &&
			['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method.toUpperCase())
		) {
			const csrfToken = this.getCookie('csrf_token');
			// SEDANG-05: Redirect to login when CSRF token is missing (session expired)
			if (!csrfToken) {
				if (typeof window !== 'undefined') {
					window.location.href = '/login';
				}
				throw new Error('Session expired - redirecting to login');
			}
			options.headers = {
				...options.headers,
				'X-CSRF-Token': csrfToken
			};
		}

		// HIGH FIX F-04: Add request timeout using AbortController
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.REQUEST_TIMEOUT_MS);
		options.signal = controller.signal;

		try {
			const response = await fetch(url, options);
			clearTimeout(timeoutId);

			// Global 401 handling
			if (
				response.status === 401 &&
				!endpoint.includes('/auth/login') &&
				!endpoint.includes('/auth/refresh')
			) {
				this.recursionDepth++;
				const refreshUrl = import.meta.env.VITE_API_URL
					? `${import.meta.env.VITE_API_URL}/api/v1/auth/refresh`
					: `/api/v1/auth/refresh`;
				const refreshRes = await fetch(refreshUrl, {
					method: 'POST',
					credentials: 'include'
				});

				if (refreshRes.ok) {
					// Retry the original request (re-fetch CSRF token for new request)
					try {
						const retryResponse = await this.request(endpoint, options);
						this.recursionDepth = 0;
						return retryResponse;
					} catch (e) {
						this.recursionDepth = 0;
						throw e;
					}
				} else {
					this.recursionDepth = 0;
					if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
						window.location.href = '/login';
					}
				}
			}

			return response;
		} catch (error: any) {
			clearTimeout(timeoutId);
			if (error.name === 'AbortError') {
				throw new Error(`Request timeout after ${this.REQUEST_TIMEOUT_MS}ms`);
			}
			throw error;
		}
	}

	static async get(endpoint: string, options?: RequestInit) {
		return this.request(endpoint, { ...options, method: 'GET' });
	}

	static async post(endpoint: string, body?: any, options?: RequestInit) {
		const init = { ...options, method: 'POST' };
		if (body) {
			init.headers = { 'Content-Type': 'application/json', ...init.headers };
			init.body = JSON.stringify(body);
		}
		return this.request(endpoint, init);
	}

	static async put(endpoint: string, body?: any, options?: RequestInit) {
		const init = { ...options, method: 'PUT' };
		if (body) {
			init.headers = { 'Content-Type': 'application/json', ...init.headers };
			init.body = JSON.stringify(body);
		}
		return this.request(endpoint, init);
	}

	static async patch(endpoint: string, body?: any, options?: RequestInit) {
		const init = { ...options, method: 'PATCH' };
		if (body) {
			init.headers = { 'Content-Type': 'application/json', ...init.headers };
			init.body = JSON.stringify(body);
		}
		return this.request(endpoint, init);
	}

	static async delete(endpoint: string, options?: RequestInit) {
		return this.request(endpoint, { ...options, method: 'DELETE' });
	}
}

export const api = ApiClient;
