/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { version } from '$service-worker';

declare const self: ServiceWorkerGlobalScope;

// Cache names
const APP_SHELL_CACHE = `app-shell-${version}`;
const API_CACHE = `api-cache-${version}`;
const STATIC_CACHE = `static-cache-${version}`;

// App shell routes that should be cached for offline
const APP_SHELL_ROUTES = ['/', '/pos', '/login', '/admin'];

// Static asset patterns (cache-first)
const CACHE_FIRST_PATTERNS = [
	/\.(?:js|css|woff2?|ttf|eot|ico|png|jpg|jpeg|gif|svg|webp|avif)$/,
	/\/manifest\.json$/
];

// API patterns (network-first)
const API_PATTERNS = [/\/api\//, /\/auth\//];

// Install: cache app shell
self.addEventListener('install', (event) => {
	event.waitUntil(
		caches
			.open(APP_SHELL_CACHE)
			.then((cache) => {
				return cache.addAll(APP_SHELL_ROUTES);
			})
			.then(() => {
				self.skipWaiting();
			})
	);
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) => {
				return Promise.all(
					keys
						.filter((key) => {
							return (
								key.startsWith('app-shell-') ||
								key.startsWith('api-cache-') ||
								key.startsWith('static-cache-')
							);
						})
						.filter((key) => {
							return key !== APP_SHELL_CACHE && key !== API_CACHE && key !== STATIC_CACHE;
						})
						.map((key) => caches.delete(key))
				);
			})
			.then(() => {
				self.clients.claim();
			})
	);
});

// Fetch handler
self.addEventListener('fetch', (event) => {
	const { request } = event;
	const url = new URL(request.url);

	// Skip non-GET requests
	if (request.method !== 'GET') {
		return;
	}

	// Skip chrome-extension and other non-http(s) requests
	if (!url.protocol.startsWith('http')) {
		return;
	}

	// Determine caching strategy
	const isApiRequest = API_PATTERNS.some((pattern) => pattern.test(url.pathname));
	const isCacheFirst = CACHE_FIRST_PATTERNS.some((pattern) => pattern.test(url.pathname));
	const isAppShellRoute = APP_SHELL_ROUTES.includes(url.pathname);

	if (isApiRequest) {
		// Network-first for API (fresh data, fallback to cache)
		event.respondWith(network_first(request, API_CACHE));
	} else if (isCacheFirst) {
		// Cache-first for static assets (performance)
		event.respondWith(cache_first(request, STATIC_CACHE));
	} else if (isAppShellRoute) {
		// Network-first for app shell routes, cache offline fallback
		event.respondWith(network_first_with_fallback(request, APP_SHELL_CACHE));
	} else {
		// Default: network with cache fallback
		event.respondWith(network_first_with_fallback(request, STATIC_CACHE));
	}
});

// Network-first strategy
async function network_first(request: Request, cacheName: string): Promise<Response> {
	const cache = await caches.open(cacheName);

	try {
		const response = await fetch(request);

		// Only cache successful responses
		if (response.ok) {
			cache.put(request, response.clone());
		}

		return response;
	} catch {
		// Network failed, try cache
		const cached = await cache.match(request);
		if (cached) {
			return cached;
		}

		// Return offline response for API
		return new Response(
			JSON.stringify({
				success: false,
				error: { code: 'OFFLINE', message: 'You are offline' }
			}),
			{
				status: 503,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
}

// Cache-first strategy
async function cache_first(request: Request, cacheName: string): Promise<Response> {
	const cache = await caches.open(cacheName);

	const cached = await cache.match(request);
	if (cached) {
		return cached;
	}

	try {
		const response = await fetch(request);
		if (response.ok) {
			cache.put(request, response.clone());
		}
		return response;
	} catch {
		// Return a basic offline response for missing static assets
		return new Response('', { status: 503, statusText: 'Service Unavailable' });
	}
}

// Network-first with offline fallback
async function network_first_with_fallback(request: Request, cacheName: string): Promise<Response> {
	const cache = await caches.open(cacheName);

	try {
		const response = await fetch(request);

		if (response.ok) {
			cache.put(request, response.clone());
		}

		return response;
	} catch {
		// Network failed, try cache
		const cached = await cache.match(request);
		if (cached) {
			return cached;
		}

		// Return offline page
		return (
			caches.match('/') ||
			new Response('Offline - Please check your connection', {
				status: 503,
				headers: { 'Content-Type': 'text/html' }
			})
		);
	}
}

// Handle messages from main thread
self.addEventListener('message', (event) => {
	if (event.data === 'SKIP_WAITING') {
		self.skipWaiting();
	}
});
