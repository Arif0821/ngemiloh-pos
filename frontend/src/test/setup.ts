// Vitest setup file
import { beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/svelte';
import { vi } from 'vitest';

// ============================================
// GLOBAL MOCKS - Applied before each test
// ============================================

beforeEach(() => {
	// Mock document.cookie with CSRF token globally
	Object.defineProperty(document, 'cookie', {
		value: 'csrf_token=test-csrf-abc123',
		configurable: true,
		writable: true
	});

	// Mock localStorage
	const storage: Record<string, string> = {};
	Object.defineProperty(globalThis, 'localStorage', {
		value: {
			getItem: (key: string) => storage[key] ?? null,
			setItem: (key: string, value: string) => {
				storage[key] = value;
			},
			removeItem: (key: string) => {
				delete storage[key];
			},
			clear: () => {
				Object.keys(storage).forEach((k) => delete storage[k]);
			},
			key: (_: number) => null,
			get length() {
				return Object.keys(storage).length;
			}
		},
		configurable: true,
		writable: true
	});
});

// ============================================
// DEXIE (IndexedDB) MOCK
// ============================================

// Mock Dexie (IndexedDB)
vi.mock('$lib/db', () => ({
	db: {
		products: {
			toArray: vi.fn().mockResolvedValue([]),
			clear: vi.fn().mockResolvedValue(undefined),
			bulkAdd: vi.fn().mockResolvedValue(undefined)
		},
		orders: {
			add: vi.fn().mockResolvedValue('order-1'),
			where: vi.fn().mockReturnValue({
				equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) })
			}),
			update: vi.fn().mockResolvedValue(1)
		},
		cart: {
			put: vi.fn().mockResolvedValue(undefined),
			get: vi.fn().mockResolvedValue(null),
			clear: vi.fn().mockResolvedValue(undefined)
		}
	}
}));

// ============================================
// CLEANUP
// ============================================

// Cleanup after each test
afterEach(() => {
	cleanup();
});
