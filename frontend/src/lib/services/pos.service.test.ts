import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock the api client
const mockApi = {
	get: vi.fn(),
	post: vi.fn()
};

const mockPosStore = {
	featureFlags: {},
	products: [],
	activeDiscounts: [] as Array<{
		id: string;
		name: string;
		type: string;
		value: number;
		scope: string;
		target_id: string | null;
		is_active: boolean;
		applicable_days?: number[];
	}>,
	historyOrders: [],
	cart: [],
	isOffline: false,
	hasOpenShift: false,
	showOpenShiftModal: false,
	showCloseShiftModal: false,
	showHistoryModal: false,
	paymentMethod: 'cash' as 'cash' | 'qris' | 'split',
	cartTotal: 50000,
	discountTotal: 0,
	appliedDiscount: null,
	isProcessing: false,
	isWaitingQris: false,
	qrisCountdown: 900,
	isCheckingShift: false,
	showPaymentModal: false,
	qrisOrderInfo: null,
	resetCart: vi.fn()
};

vi.mock('$lib/services/api.client', () => ({
	api: mockApi
}));

vi.mock('$lib/stores/pos.store.svelte', () => ({
	posStore: mockPosStore
}));

vi.mock('$lib/db', () => ({
	db: {
		products: { toArray: vi.fn().mockResolvedValue([]), clear: vi.fn(), bulkAdd: vi.fn() },
		orders: {
			add: vi.fn().mockResolvedValue('order-1'),
			where: vi.fn().mockReturnValue({
				equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) })
			})
		}
	}
}));

describe('PosService', () => {
	let PosService: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		// Reset store state
		Object.assign(mockPosStore, {
			featureFlags: {},
			products: [],
			activeDiscounts: [],
			historyOrders: [],
			cart: [],
			isOffline: false,
			hasOpenShift: false,
			isCheckingShift: false,
			isProcessing: false
		});

		mockPosStore.resetCart = vi.fn();

		// Dynamically import to get fresh instance
		const module = await import('$lib/services/pos.service');
		PosService = module.posService;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('fetchFlags', () => {
		it('should fetch and set feature flags', async () => {
			const mockFlags = { QRIS_ENABLED: true, SPLIT_PAYMENT: false };

			mockApi.get.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: mockFlags })
			});

			await PosService.fetchFlags();

			expect(mockApi.get).toHaveBeenCalledWith('/flags');
			expect(mockPosStore.featureFlags).toEqual(mockFlags);
		});

		it('should handle fetch flags failure silently', async () => {
			mockApi.get.mockResolvedValueOnce({
				ok: false
			});

			// Should not throw
			await expect(PosService.fetchFlags()).resolves.not.toThrow();
			expect(mockPosStore.featureFlags).toEqual({});
		});

		it('should handle network error gracefully', async () => {
			mockApi.get.mockRejectedValueOnce(new Error('Network error'));

			// Should not throw
			await expect(PosService.fetchFlags()).resolves.not.toThrow();
		});
	});

	describe('checkShift', () => {
		it('should check shift status and set hasOpenShift to true', async () => {
			mockPosStore.isCheckingShift = false;

			mockApi.get.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: { id: 'shift-1' } })
			});

			await PosService.checkShift();

			expect(mockApi.get).toHaveBeenCalledWith('/cash/current');
			expect(mockPosStore.isCheckingShift).toBe(true);
			expect(mockPosStore.hasOpenShift).toBe(true);
		});

		it('should set hasOpenShift to false when no shift', async () => {
			mockPosStore.isCheckingShift = false;

			mockApi.get.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: null })
			});

			await PosService.checkShift();

			expect(mockPosStore.hasOpenShift).toBe(false);
		});

		it('should set isCheckingShift back to false on error', async () => {
			mockPosStore.isCheckingShift = false;

			mockApi.get.mockRejectedValueOnce(new Error('Network error'));

			await PosService.checkShift();

			expect(mockPosStore.isCheckingShift).toBe(false);
		});
	});

	describe('handleOpenShift', () => {
		it('should open shift successfully', async () => {
			mockApi.post.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true })
			});

			const result = await PosService.handleOpenShift(500000);

			expect(mockApi.post).toHaveBeenCalledWith('/cash/open', { opening_balance: 500000 });
			expect(mockPosStore.hasOpenShift).toBe(true);
			expect(mockPosStore.showOpenShiftModal).toBe(false);
			expect(result).toBe(true);
		});

		it('should handle open shift failure', async () => {
			const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

			mockApi.post.mockResolvedValueOnce({
				ok: false,
				json: async () => ({ message: 'Gagal buka shift' })
			});

			const result = await PosService.handleOpenShift(500000);

			expect(alertSpy).toHaveBeenCalledWith('Gagal buka shift: Gagal buka shift');
			expect(result).toBe(false);

			alertSpy.mockRestore();
		});

		it('should handle open shift network error', async () => {
			const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

			mockApi.post.mockRejectedValueOnce(new Error('Network error'));

			const result = await PosService.handleOpenShift(500000);

			expect(alertSpy).toHaveBeenCalledWith('Error buka shift');
			expect(result).toBe(false);

			alertSpy.mockRestore();
		});
	});

	describe('handleCloseShift', () => {
		it('should close shift successfully', async () => {
			mockPosStore.hasOpenShift = true;

			mockApi.post.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true })
			});

			const result = await PosService.handleCloseShift(600000);

			expect(mockApi.post).toHaveBeenCalledWith('/cash/close', { closing_balance: 600000 });
			expect(mockPosStore.hasOpenShift).toBe(false);
			expect(mockPosStore.showCloseShiftModal).toBe(false);
			expect(result).toBe(true);
		});

		it('should handle close shift failure', async () => {
			const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

			mockApi.post.mockResolvedValueOnce({
				ok: false,
				json: async () => ({ message: 'Gagal tutup shift' })
			});

			const result = await PosService.handleCloseShift(600000);

			expect(alertSpy).toHaveBeenCalledWith('Gagal tutup shift: Gagal tutup shift');
			expect(result).toBe(false);

			alertSpy.mockRestore();
		});
	});

	describe('fetchProductsFromApi', () => {
		it('should fetch and store products', async () => {
			const mockProducts = [{ id: 'p1', name: 'Product 1', base_price: 10000 }];

			mockApi.get.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: mockProducts })
			});

			await PosService.fetchProductsFromApi();

			expect(mockApi.get).toHaveBeenCalledWith('/products?include_modifiers=true');
		});

		it('should redirect to login on 401', async () => {
			const originalLocation = window.location;
			const locationMock = { href: '' };
			Object.defineProperty(window, 'location', {
				value: locationMock,
				writable: true
			});

			mockApi.get.mockResolvedValueOnce({
				ok: false,
				status: 401
			});

			await PosService.fetchProductsFromApi();

			expect(locationMock.href).toBe('/login');

			Object.defineProperty(window, 'location', {
				value: originalLocation,
				writable: true
			});
		});
	});

	describe('fetchDiscounts', () => {
		it('should fetch and filter active discounts', async () => {
			const mockDiscounts = [
				{ id: 'd1', name: 'Diskon 10%', is_active: true },
				{ id: 'd2', name: 'Diskon 20%', is_active: false }
			];

			mockApi.get.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: mockDiscounts })
			});

			await PosService.fetchDiscounts();

			expect(mockPosStore.activeDiscounts).toHaveLength(1);
			expect(mockPosStore.activeDiscounts[0].id).toBe('d1');
		});
	});

	describe('fetchHistory', () => {
		it('should fetch order history', async () => {
			const mockOrders = [{ id: 'o1', order_number: '001' }];

			mockApi.get.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: mockOrders })
			});

			await PosService.fetchHistory();

			expect(mockPosStore.historyOrders).toEqual(mockOrders);
		});
	});

	describe('processPayment', () => {
		beforeEach(() => {
			mockPosStore.cart = [
				{
					id: 'p1',
					quantity: 2,
					base_price: 10000,
					is_out_of_stock: false,
					modifier_groups: [] as any[],
					selectedModifiers: [] as any[],
					cartItemId: 'cart-1'
				}
			] as any;
			mockPosStore.cartTotal = 20000;
			mockPosStore.paymentMethod = 'cash';
			mockPosStore.isProcessing = false;
		});

		it('should not process empty cart', async () => {
			mockPosStore.cart = [];

			await PosService.processPayment(vi.fn(), vi.fn());

			expect(mockApi.post).not.toHaveBeenCalled();
		});

		it('should not process while already processing', async () => {
			mockPosStore.isProcessing = true;

			await PosService.processPayment(vi.fn(), vi.fn());

			expect(mockApi.post).not.toHaveBeenCalled();
		});

		it('should handle offline cash payment', async () => {
			mockPosStore.isOffline = true;
			mockPosStore.paymentMethod = 'cash';

			const db = await import('$lib/db');

			await PosService.processPayment(vi.fn(), vi.fn());

			expect(db.db.orders.add).toHaveBeenCalled();
			expect(mockPosStore.resetCart).toHaveBeenCalled();
		});

		it('should reject QRIS payment when offline', async () => {
			mockPosStore.isOffline = true;
			mockPosStore.paymentMethod = 'qris';

			const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

			await PosService.processPayment(vi.fn(), vi.fn());

			expect(alertSpy).toHaveBeenCalledWith(
				'QRIS tidak dapat diproses saat sistem offline. Mohon arahkan ke pembayaran tunai.'
			);
			expect(mockPosStore.isProcessing).toBe(false);

			alertSpy.mockRestore();
		});

		it('should reject split payment when offline', async () => {
			mockPosStore.isOffline = true;
			mockPosStore.paymentMethod = 'split';

			const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

			await PosService.processPayment(vi.fn(), vi.fn());

			expect(alertSpy).toHaveBeenCalledWith(
				'QRIS tidak dapat diproses saat sistem offline. Mohon arahkan ke pembayaran tunai.'
			);

			alertSpy.mockRestore();
		});

		it('should process online cash payment successfully', async () => {
			const mockOrderResponse = { id: 'order-1', order_number: '001' };
			const onSuccess = vi.fn();

			mockApi.post.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: mockOrderResponse })
			});

			await PosService.processPayment(vi.fn(), onSuccess);

			expect(mockApi.post).toHaveBeenCalledWith('/orders', expect.any(Object));
			expect(onSuccess).toHaveBeenCalledWith(mockOrderResponse);
		});

		it('should handle QRIS payment and call onQrisWait', async () => {
			const mockOrderResponse = { id: 'order-1', order_number: '001' };
			const onQrisWait = vi.fn();

			mockPosStore.paymentMethod = 'qris';

			mockApi.post.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: mockOrderResponse })
			});

			await PosService.processPayment(onQrisWait, vi.fn());

			expect(onQrisWait).toHaveBeenCalledWith(mockOrderResponse);
		});

		it('should redirect to login on 401', async () => {
			const locationMock = { href: '' };
			Object.defineProperty(window, 'location', {
				value: locationMock,
				writable: true
			});

			mockApi.post.mockResolvedValueOnce({
				ok: false,
				status: 401
			});

			await PosService.processPayment(vi.fn(), vi.fn());

			expect(locationMock.href).toBe('/login');
		});
	});

	describe('syncPendingOrders', () => {
		it('should sync pending orders to server', async () => {
			const mockPendingOrders = [
				{ client_uuid: 'uuid-1', payment_method: 'cash', final_price: 20000, items: [] }
			];

			const db = await import('$lib/db');
			(db.db.orders.where as any).mockReturnValue({
				equals: vi.fn().mockReturnValue({
					toArray: vi.fn().mockResolvedValue(mockPendingOrders)
				})
			});

			mockApi.post.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: [{ client_uuid: 'uuid-1', status: 'success' }] })
			});

			await PosService.syncPendingOrders();

			expect(mockApi.post).toHaveBeenCalledWith('/orders/sync-batch', {
				orders: expect.arrayContaining([expect.objectContaining({ client_uuid: 'uuid-1' })])
			});
		});

		it('should do nothing when no pending orders', async () => {
			const db = await import('$lib/db');
			(db.db.orders.where as any).mockReturnValue({
				equals: vi.fn().mockReturnValue({
					toArray: vi.fn().mockResolvedValue([])
				})
			});

			await PosService.syncPendingOrders();

			expect(mockApi.post).not.toHaveBeenCalled();
		});
	});

	describe('cancelQrisWaiting', () => {
		it('should clear all QRIS waiting states', () => {
			mockPosStore.isWaitingQris = true;
			mockPosStore.qrisCountdown = 500;

			// Mock timers
			vi.useFakeTimers();

			PosService.cancelQrisWaiting();

			expect(mockPosStore.isWaitingQris).toBe(false);

			vi.useRealTimers();
		});
	});
});
