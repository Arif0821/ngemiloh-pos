// Vitest setup file
import { beforeAll, afterAll, afterEach } from 'vitest';
import { cleanup } from '@testing-library/svelte';
import { vi } from 'vitest';

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

// Cleanup after each test
afterEach(() => {
	cleanup();
});
