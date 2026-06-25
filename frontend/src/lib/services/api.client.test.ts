import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ApiClient } from './api.client';

// ============================================
// API CLIENT TEST SUITE
// ============================================

describe('ApiClient', () => {
	let mock_fetch: ReturnType<typeof vi.fn>;
	let original_location: { href: string; pathname: string };

	beforeEach(() => {
		// Reset singleton before each test
		ApiClient.reset();

		// Mock fetch globally
		mock_fetch = vi.fn();
		vi.stubGlobal('fetch', mock_fetch);

		// Mock window.location without triggering navigation
		original_location = { href: 'http://localhost/', pathname: '/pos' };
		Object.defineProperty(window, 'location', {
			value: { ...original_location, href: original_location.href },
			writable: true,
			configurable: true
		});

		// Mock navigator.onLine
		Object.defineProperty(navigator, 'onLine', {
			value: true,
			writable: true,
			configurable: true
		});

		// Mock clearTimeout and setTimeout to run immediately in tests
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.restoreAllMocks();
		vi.useRealTimers();
		ApiClient.reset();
	});

	// ============================================
	// SINGLETON PATTERN TESTS
	// ============================================

	describe('singleton pattern', () => {
		it('getInstance returns the same instance', () => {
			const instance1 = ApiClient.getInstance();
			const instance2 = ApiClient.getInstance();
			expect(instance1).toBe(instance2);
		});

		it('reset clears the singleton', () => {
			const instance1 = ApiClient.getInstance();
			ApiClient.reset();
			const instance2 = ApiClient.getInstance();
			expect(instance1).not.toBe(instance2);
		});

		it('exported api works correctly', async () => {
			// Reset first to ensure clean state
			ApiClient.reset();

			// Test that the exported api module works without comparing to fresh instance
			const { api } = await import('./api.client');

			// Set up a mock response
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

			// Use the exported api - it should work correctly
			await api.get('/products');

			// Verify the request was made
			expect(mock_fetch).toHaveBeenCalled();
		});
	});

	// ============================================
	// URL BUILDING TESTS
	// ============================================

	describe('URL building', () => {
		it('prepends /api/v1 to relative endpoints', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

			const client = ApiClient.getInstance();
			await client.get('/products');

			expect(mock_fetch).toHaveBeenCalledWith(
				expect.stringContaining('/api/v1/products'),
				expect.any(Object)
			);
		});

		it('does not double-prepend /api/v1', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

			const client = ApiClient.getInstance();
			await client.get('/api/v1/products');

			expect(mock_fetch).toHaveBeenCalledWith(
				expect.stringContaining('/api/v1/products'),
				expect.any(Object)
			);
		});

		it('passes through absolute URLs unchanged', async () => {
			const absolute_url = 'https://custom.api.com/endpoint';
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

			const client = ApiClient.getInstance();
			await client.get(absolute_url);

			expect(mock_fetch).toHaveBeenCalledWith(absolute_url, expect.any(Object));
		});
	});

	// ============================================
	// AUTHORIZATION HEADER TESTS
	// ============================================

	describe('Authorization header', () => {
		it('adds access_token for non-admin routes', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));
			// Mock auth token from cookie (httpOnly cookie set by backend)
			Object.defineProperty(document, 'cookie', {
				value: 'access_token=kasir-token-123',
				configurable: true
			});

			const client = ApiClient.getInstance();
			await client.get('/products');

			expect(mock_fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({ Authorization: 'Bearer kasir-token-123' })
				})
			);
		});

		it('adds admin_token for /admin/ routes', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));
			// Mock auth token from cookie (httpOnly cookie set by backend)
			Object.defineProperty(document, 'cookie', {
				value: 'admin_token=admin-secret-456',
				configurable: true
			});

			const client = ApiClient.getInstance();
			await client.get('/admin/products');

			expect(mock_fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({ Authorization: 'Bearer admin-secret-456' })
				})
			);
		});

		it('adds admin_token for /auth/admin routes', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));
			// Mock auth token from cookie (httpOnly cookie set by backend)
			Object.defineProperty(document, 'cookie', {
				value: 'admin_token=admin-secret-456; csrf_token=test-csrf-token',
				configurable: true
			});

			const client = ApiClient.getInstance();
			await client.post('/auth/admin/verify-otp', { email: 'admin@test.com', otp: '123456' });

			expect(mock_fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({ Authorization: 'Bearer admin-secret-456' })
				})
			);
		});

		it('does not add Authorization header if no token exists', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));
			// Mock empty cookies
			Object.defineProperty(document, 'cookie', {
				value: '',
				configurable: true
			});

			const client = ApiClient.getInstance();
			await client.get('/products');

			expect(mock_fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.not.objectContaining({ Authorization: expect.anything() })
				})
			);
		});
	});

	// ============================================
	// CSRF TOKEN TESTS
	// ============================================

	describe('CSRF token', () => {
		beforeEach(() => {
			// Mock CSRF token from httpOnly cookie (set by backend on login)
			Object.defineProperty(document, 'cookie', {
				value: 'csrf_token=test-csrf-abc123',
				configurable: true
			});
		});

		it('adds X-CSRF-Token for POST requests', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

			const client = ApiClient.getInstance();
			await client.post('/orders', { items: [] });

			expect(mock_fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({ 'X-CSRF-Token': 'test-csrf-abc123' })
				})
			);
		});

		it('adds X-CSRF-Token for PUT requests', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

			const client = ApiClient.getInstance();
			await client.put('/products/p1', { name: 'Updated' });

			expect(mock_fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({ 'X-CSRF-Token': 'test-csrf-abc123' })
				})
			);
		});

		it('adds X-CSRF-Token for PATCH requests', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

			const client = ApiClient.getInstance();
			await client.patch('/products/p1', { is_active: false });

			expect(mock_fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({ 'X-CSRF-Token': 'test-csrf-abc123' })
				})
			);
		});

		it('adds X-CSRF-Token for DELETE requests', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

			const client = ApiClient.getInstance();
			await client.delete('/products/p1');

			expect(mock_fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({ 'X-CSRF-Token': 'test-csrf-abc123' })
				})
			);
		});

		it('does not add X-CSRF-Token for GET requests', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

			const client = ApiClient.getInstance();
			await client.get('/products');

			const call_args = mock_fetch.mock.calls[0][1] as Record<string, unknown>;
			const headers = call_args.headers as Record<string, string>;
			expect(headers['X-CSRF-Token']).toBeUndefined();
		});

		it('throws and redirects to login when CSRF token is missing on mutating request', async () => {
			// Remove CSRF token from cookie
			Object.defineProperty(document, 'cookie', {
				value: '',
				configurable: true
			});

			const client = ApiClient.getInstance();

			await expect(client.post('/orders', { items: [] })).rejects.toThrow('CSRF token missing');
			expect(window.location.href).toBe('/login');
		});
	});

	// ============================================
	// 401 REDIRECT TESTS
	// ============================================

	describe('401 redirect', () => {
		it('redirects to /login on 401 for non-admin routes', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 401 }));

			const client = ApiClient.getInstance();
			await client.get('/products');

			expect(window.location.href).toBe('/login');
		});

		it('redirects to /login-admin on 401 for admin routes', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 401 }));

			const client = ApiClient.getInstance();
			await client.get('/admin/products');

			expect(window.location.href).toBe('/login-admin');
		});

		it('does not redirect on 401 for /auth/login endpoints', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 401 }));
			// CSRF token from cookie for mutating requests
			Object.defineProperty(document, 'cookie', {
				value: 'csrf_token=test-csrf-token',
				configurable: true
			});

			const client = ApiClient.getInstance();
			await client.post('/auth/login', { pin: '1234' });

			// Should NOT redirect for auth endpoints
			expect(window.location.href).toBe('http://localhost/');
		});

		it('returns the 401 response even after redirect', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 401 }));

			const client = ApiClient.getInstance();
			const response = await client.get('/products');

			expect(response.status).toBe(401);
		});

		it('does not double-redirect if already on login page', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 401 }));

			// Simulate being on login page
			Object.defineProperty(window, 'location', {
				value: { href: 'http://localhost/login', pathname: '/login' },
				writable: true,
				configurable: true
			});

			const client = ApiClient.getInstance();
			await client.get('/products');

			// Should not change location since already on login page
			expect(window.location.href).toBe('http://localhost/login');
		});
	});

	// ============================================
	// TIMEOUT TESTS
	// ============================================

	describe('request timeout', () => {
		it('handles aborted requests gracefully', async () => {
			// Simulate a request that gets aborted (like a timeout would)
			mock_fetch.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'));

			const client = ApiClient.getInstance();

			// Should reject when the request is aborted
			await expect(client.get('/slow-endpoint')).rejects.toThrow();
		});

		it('does not timeout for fast requests', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{"success":true}', { status: 200 }));

			const client = ApiClient.getInstance();
			const response = await client.get('/products');

			expect(response.ok).toBe(true);
		});
	});

	// ============================================
	// OFFLINE DETECTION TESTS
	// ============================================

	describe('offline detection', () => {
		it('logs warning when browser is offline', async () => {
			const warn_spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			Object.defineProperty(navigator, 'onLine', {
				value: false,
				writable: true,
				configurable: true
			});

			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

			const client = ApiClient.getInstance();
			await client.get('/products');

			expect(warn_spy).toHaveBeenCalled();
			// The warning message should contain 'Offline'
			const warnCall = warn_spy.mock.calls[0][0];
			expect(typeof warnCall === 'string' ? warnCall : String(warnCall)).toContain('Offline');

			warn_spy.mockRestore();
		});
	});

	// ============================================
	// CREDENTIALS & HEADERS TESTS
	// ============================================

	describe('credentials and headers', () => {
		it('sets credentials to include for cookies', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

			const client = ApiClient.getInstance();
			await client.get('/products');

			expect(mock_fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({ credentials: 'include' })
			);
		});

		it('sets Content-Type to application/json for POST with body', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));
			// CSRF token from cookie for mutating requests
			Object.defineProperty(document, 'cookie', {
				value: 'csrf_token=test-csrf-token',
				configurable: true
			});

			const client = ApiClient.getInstance();
			await client.post('/orders', { items: [] });

			expect(mock_fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({
					headers: expect.objectContaining({ 'Content-Type': 'application/json' })
				})
			);
		});

		it('stringifies body as JSON', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));
			// CSRF token from cookie for mutating requests
			Object.defineProperty(document, 'cookie', {
				value: 'csrf_token=test-csrf-token',
				configurable: true
			});

			const body = { items: [{ product_id: 'p1', quantity: 2 }] };
			const client = ApiClient.getInstance();
			await client.post('/orders', body);

			const call_args = mock_fetch.mock.calls[0][1] as Record<string, unknown>;
			expect(call_args.body).toBe(JSON.stringify(body));
		});
	});

	// ============================================
	// HELPER METHODS TESTS
	// ============================================

	describe('helper methods', () => {
		it('get() uses GET method', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));

			const client = ApiClient.getInstance();
			await client.get('/products');

			expect(mock_fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({ method: 'GET' })
			);
		});

		it('post() uses POST method', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));
			// CSRF token from cookie for mutating requests
			Object.defineProperty(document, 'cookie', {
				value: 'csrf_token=test-csrf-token',
				configurable: true
			});

			const client = ApiClient.getInstance();
			await client.post('/orders', {});

			expect(mock_fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({ method: 'POST' })
			);
		});

		it('put() uses PUT method', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));
			// CSRF token from cookie for mutating requests
			Object.defineProperty(document, 'cookie', {
				value: 'csrf_token=test-csrf-token',
				configurable: true
			});

			const client = ApiClient.getInstance();
			await client.put('/products/p1', {});

			expect(mock_fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({ method: 'PUT' })
			);
		});

		it('patch() uses PATCH method', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));
			// CSRF token from cookie for mutating requests
			Object.defineProperty(document, 'cookie', {
				value: 'csrf_token=test-csrf-token',
				configurable: true
			});

			const client = ApiClient.getInstance();
			await client.patch('/products/p1', {});

			expect(mock_fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({ method: 'PATCH' })
			);
		});

		it('delete() uses DELETE method', async () => {
			mock_fetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));
			// CSRF token from cookie for mutating requests
			Object.defineProperty(document, 'cookie', {
				value: 'csrf_token=test-csrf-token',
				configurable: true
			});

			const client = ApiClient.getInstance();
			await client.delete('/products/p1');

			expect(mock_fetch).toHaveBeenCalledWith(
				expect.any(String),
				expect.objectContaining({ method: 'DELETE' })
			);
		});
	});
});
