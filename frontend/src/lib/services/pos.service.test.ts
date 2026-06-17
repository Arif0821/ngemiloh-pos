import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock the api client
const mock_api = {
	get: vi.fn(),
	post: vi.fn()
};

const mock_pos_store = {
	feature_flags: {},
	products: [],
	active_discounts: [] as Array<{
		id: string;
		name: string;
		type: string;
		value: number;
		scope: string;
		target_id: string | null;
		is_active: boolean;
		applicable_days?: number[];
	}>,
	history_orders: [],
	cart: [],
	is_offline: false,
	has_open_shift: false,
	is_checking_shift: false,
	show_close_shift_modal: false,
	show_history_modal: false,
	show_modifier_modal: false,
	show_payment_modal: false,
	show_success_modal: false,
	payment_method: 'cash' as 'cash' | 'qris' | 'split',
	cart_total: 50000,
	discount_total: 0,
	applied_discount: null,
	is_processing: false,
	is_waiting_qris: false,
	qris_countdown: 900,
	qris_order_info: null,
	opening_balance: 500000,
	closing_balance: 0,
	cash_amount: 0,
	split_cash_amount: 0,
	split_qris_amount: 0,
	cash_change: 0,
	last_order_details: null,
	reset_cart: vi.fn()
};

vi.mock('$lib/services/api.client', () => ({
	api: mock_api
}));

vi.mock('$lib/stores/pos.store.svelte', () => ({
	posStore: mock_pos_store
}));

vi.mock('$lib/db', () => ({
	db: {
		products: { toArray: vi.fn().mockResolvedValue([]), clear: vi.fn(), bulkAdd: vi.fn() },
		orders: {
			add: vi.fn().mockResolvedValue('order-1'),
			where: vi.fn().mockReturnValue({
				equals: vi.fn().mockReturnValue({ toArray: vi.fn().mockResolvedValue([]) })
			}),
			update: vi.fn().mockResolvedValue(1)
		}
	}
}));

describe('PosService', () => {
	let pos_service: any;

	beforeEach(async () => {
		vi.clearAllMocks();

		// Reset store state
		Object.assign(mock_pos_store, {
			feature_flags: {},
			products: [],
			active_discounts: [],
			history_orders: [],
			cart: [],
			is_offline: false,
			has_open_shift: false,
			is_checking_shift: false,
			is_processing: false
		});

		mock_pos_store.reset_cart = vi.fn();

		// Dynamically import to get fresh instance
		const module = await import('$lib/services/pos.service');
		pos_service = module.pos_service;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('fetch_flags', () => {
		it('should fetch and set feature flags', async () => {
			const mock_flags = { QRIS_PAYMENT: true, SPLIT_PAYMENT: false };

			mock_api.get.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: mock_flags })
			});

			await pos_service.fetch_flags();

			expect(mock_api.get).toHaveBeenCalledWith('/flags');
			expect(mock_pos_store.feature_flags).toEqual(mock_flags);
		});

		it('should handle fetch flags failure silently', async () => {
			mock_api.get.mockResolvedValueOnce({
				ok: false
			});

			// Should not throw
			await expect(pos_service.fetch_flags()).resolves.not.toThrow();
			expect(mock_pos_store.feature_flags).toEqual({});
		});

		it('should handle network error gracefully', async () => {
			mock_api.get.mockRejectedValueOnce(new Error('Network error'));

			// Should not throw
			await expect(pos_service.fetch_flags()).resolves.not.toThrow();
		});
	});

	describe('check_shift', () => {
		it('should check shift status and set has_open_shift to true', async () => {
			mock_pos_store.is_checking_shift = false;

			mock_api.get.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: { id: 'shift-1' } })
			});

			await pos_service.check_shift();

			expect(mock_api.get).toHaveBeenCalledWith('/cash/current');
			expect(mock_pos_store.is_checking_shift).toBe(true);
			expect(mock_pos_store.has_open_shift).toBe(true);
		});

		it('should set has_open_shift to false when no shift', async () => {
			mock_pos_store.is_checking_shift = false;

			mock_api.get.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: null })
			});

			await pos_service.check_shift();

			expect(mock_pos_store.has_open_shift).toBe(false);
		});

		it('should set is_checking_shift back to false on error', async () => {
			mock_pos_store.is_checking_shift = false;

			mock_api.get.mockRejectedValueOnce(new Error('Network error'));

			await pos_service.check_shift();

			expect(mock_pos_store.is_checking_shift).toBe(false);
		});
	});

	describe('handle_open_shift', () => {
		it('should open shift successfully', async () => {
			mock_api.post.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true })
			});

			const result = await pos_service.handle_open_shift(500000);

			expect(mock_api.post).toHaveBeenCalledWith('/cash/open', { opening_balance: 500000 });
			expect(mock_pos_store.has_open_shift).toBe(true);
			expect(result).toBe(true);
		});

		it('should handle open shift failure', async () => {
			const alert_spy = vi.spyOn(window, 'alert').mockImplementation(() => {});

			mock_api.post.mockResolvedValueOnce({
				ok: false,
				json: async () => ({ message: 'Gagal buka shift' })
			});

			const result = await pos_service.handle_open_shift(500000);

			expect(result).toBe(false);

			alert_spy.mockRestore();
		});
	});

	describe('handle_close_shift', () => {
		it('should close shift successfully', async () => {
			mock_pos_store.has_open_shift = true;

			mock_api.post.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true })
			});

			const result = await pos_service.handle_close_shift(600000);

			expect(mock_api.post).toHaveBeenCalledWith('/cash/close', { closing_balance: 600000 });
			expect(mock_pos_store.has_open_shift).toBe(false);
			expect(mock_pos_store.show_close_shift_modal).toBe(false);
			expect(result).toBe(true);
		});
	});

	describe('fetch_products_from_api', () => {
		it('should fetch and store products', async () => {
			const mock_products = [{ id: 'p1', name: 'Product 1', base_price: 10000 }];

			mock_api.get.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: mock_products })
			});

			await pos_service.fetch_products_from_api();

			expect(mock_api.get).toHaveBeenCalledWith('/products?include_modifiers=true');
		});

		it('should redirect to login on 401', async () => {
			const location_mock = { href: '' };
			Object.defineProperty(window, 'location', {
				value: location_mock,
				writable: true
			});

			mock_api.get.mockResolvedValueOnce({
				ok: false,
				status: 401
			});

			await pos_service.fetch_products_from_api();

			expect(location_mock.href).toBe('/login');

			Object.defineProperty(window, 'location', {
				value: { href: '' },
				writable: true
			});
		});
	});

	describe('fetch_discounts', () => {
		it('should fetch and filter active discounts', async () => {
			const mock_discounts = [
				{ id: 'd1', name: 'Diskon 10%', is_active: true },
				{ id: 'd2', name: 'Diskon 20%', is_active: false }
			];

			mock_api.get.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: mock_discounts })
			});

			await pos_service.fetch_discounts();

			expect(mock_pos_store.active_discounts).toHaveLength(1);
			expect(mock_pos_store.active_discounts[0].id).toBe('d1');
		});
	});

	describe('fetch_history', () => {
		it('should fetch order history', async () => {
			const mock_orders = [{ id: 'o1', client_uuid: 'uuid-1' }];

			mock_api.get.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: mock_orders })
			});

			await pos_service.fetch_history();

			expect(mock_pos_store.history_orders).toEqual(mock_orders);
		});
	});

	describe('process_payment', () => {
		beforeEach(() => {
			mock_pos_store.cart = [
				{
					id: 'p1',
					quantity: 2,
					base_price: 10000,
					is_out_of_stock: false,
					modifier_groups: [] as any[],
					selected_modifiers: [] as any[],
					cart_item_id: 'cart-1'
				}
			] as any;
			mock_pos_store.cart_total = 20000;
			mock_pos_store.payment_method = 'cash';
			mock_pos_store.is_processing = false;
		});

		it('should not process empty cart', async () => {
			mock_pos_store.cart = [];

			await pos_service.process_payment(vi.fn(), vi.fn());

			expect(mock_api.post).not.toHaveBeenCalled();
		});

		it('should not process while already processing', async () => {
			mock_pos_store.is_processing = true;

			await pos_service.process_payment(vi.fn(), vi.fn());

			expect(mock_api.post).not.toHaveBeenCalled();
		});

		it('should reject QRIS payment when offline', async () => {
			mock_pos_store.is_offline = true;
			mock_pos_store.payment_method = 'qris';

			const alert_spy = vi.spyOn(window, 'alert').mockImplementation(() => {});

			await pos_service.process_payment(vi.fn(), vi.fn());

			expect(mock_pos_store.is_processing).toBe(false);

			alert_spy.mockRestore();
		});

		it('should process online cash payment successfully', async () => {
			const mock_order_response = { id: 'order-1', client_uuid: 'uuid-1' };
			const on_success = vi.fn();

			mock_api.post.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: mock_order_response })
			});

			await pos_service.process_payment(vi.fn(), on_success);

			expect(mock_api.post).toHaveBeenCalledWith('/orders', expect.any(Object));
			expect(on_success).toHaveBeenCalledWith(mock_order_response);
		});

		it('should handle QRIS payment and call on_qris_wait', async () => {
			const mock_order_response = { id: 'order-1', client_uuid: 'uuid-1' };
			const on_qris_wait = vi.fn();

			mock_pos_store.payment_method = 'qris';

			mock_api.post.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: mock_order_response })
			});

			await pos_service.process_payment(on_qris_wait, vi.fn());

			expect(on_qris_wait).toHaveBeenCalledWith(mock_order_response);
		});

		it('should redirect to login on 401', async () => {
			const location_mock = { href: '' };
			Object.defineProperty(window, 'location', {
				value: location_mock,
				writable: true
			});

			mock_api.post.mockResolvedValueOnce({
				ok: false,
				status: 401
			});

			await pos_service.process_payment(vi.fn(), vi.fn());

			expect(location_mock.href).toBe('/login');

			Object.defineProperty(window, 'location', {
				value: { href: '' },
				writable: true
			});
		});
	});

	describe('cancel_qris_waiting', () => {
		it('should clear all QRIS waiting states', () => {
			mock_pos_store.is_waiting_qris = true;
			mock_pos_store.qris_countdown = 500;

			pos_service.cancel_qris_waiting();

			expect(mock_pos_store.is_waiting_qris).toBe(false);
		});
	});

	// ─── Trust but Verify – Integration Tests ──────────────────────────────────

	describe('process_payment – Trust but Verify Integration', () => {
		const makeCartItem = () => [
			{
				id: 'p1',
				quantity: 2,
				base_price: 10000,
				is_out_of_stock: false,
				modifier_groups: [] as any[],
				selected_modifiers: [] as any[],
				cart_item_id: 'cart-1'
			}
		];

		it('should send correct payload for cash payment', async () => {
			mock_pos_store.cart = makeCartItem();
			mock_pos_store.cart_total = 20000;
			mock_pos_store.discount_total = 0;
			mock_pos_store.applied_discount = null;
			mock_pos_store.payment_method = 'cash';
			mock_pos_store.cash_amount = 50000;
			mock_pos_store.is_processing = false;
			mock_pos_store.is_offline = false;

			mock_api.post.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					success: true,
					data: { id: 'order-1', client_uuid: 'uuid-1', status: 'completed' }
				})
			});

			await pos_service.process_payment(vi.fn(), vi.fn());

			expect(mock_api.post).toHaveBeenCalledWith('/orders', expect.objectContaining({
				client_uuid: expect.any(String),
				payment_method: 'cash',
				client_final_price: 20000,
				discount_total: 0,
				cash_amount: 50000,
				qris_amount: 0,
				items: [{ product_id: 'p1', quantity: 2, modifiers: [] }]
			}));
		});

		it('should send correct payload for split payment', async () => {
			mock_pos_store.cart = makeCartItem();
			mock_pos_store.cart_total = 20000;
			mock_pos_store.discount_total = 0;
			mock_pos_store.applied_discount = null;
			mock_pos_store.payment_method = 'split';
			mock_pos_store.split_cash_amount = 15000;
			mock_pos_store.split_qris_amount = 5000;
			mock_pos_store.is_processing = false;
			mock_pos_store.is_offline = false;

			mock_api.post.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					success: true,
					data: { id: 'order-1', client_uuid: 'uuid-1', status: 'pending_sync' }
				})
			});

			const on_qris_wait = vi.fn();
			await pos_service.process_payment(on_qris_wait, vi.fn());

			expect(mock_api.post).toHaveBeenCalledWith('/orders', expect.objectContaining({
				payment_method: 'split',
				cash_amount: 15000,
				qris_amount: 5000
			}));
		});

		it('should handle payment success and call on_success callback', async () => {
			mock_pos_store.cart = makeCartItem();
			mock_pos_store.cart_total = 20000;
			mock_pos_store.payment_method = 'cash';
			mock_pos_store.is_processing = false;
			mock_pos_store.is_offline = false;

			const mockOrder = { id: 'order-1', client_uuid: 'uuid-1', status: 'completed' };
			mock_api.post.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: mockOrder })
			});

			const on_success = vi.fn();
			await pos_service.process_payment(vi.fn(), on_success);

			expect(on_success).toHaveBeenCalledWith(mockOrder);
		});

		it('should call on_qris_wait for QRIS payment', async () => {
			mock_pos_store.cart = makeCartItem();
			mock_pos_store.cart_total = 20000;
			mock_pos_store.payment_method = 'qris';
			mock_pos_store.is_processing = false;
			mock_pos_store.is_offline = false;

			const mockOrder = { id: 'order-1', client_uuid: 'uuid-1', status: 'pending_sync' };
			mock_api.post.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ success: true, data: mockOrder })
			});

			const on_qris_wait = vi.fn();
			await pos_service.process_payment(on_qris_wait, vi.fn());

			expect(on_qris_wait).toHaveBeenCalledWith(mockOrder);
		});

		it('should block QRIS payment when offline and alert user', async () => {
			mock_pos_store.cart = makeCartItem();
			mock_pos_store.cart_total = 20000;
			mock_pos_store.payment_method = 'qris';
			mock_pos_store.is_processing = false;
			mock_pos_store.is_offline = true;

			const alert_spy = vi.spyOn(window, 'alert').mockImplementation(() => {});

			await pos_service.process_payment(vi.fn(), vi.fn());

			expect(mock_api.post).not.toHaveBeenCalled();
			expect(alert_spy).toHaveBeenCalledWith(
				'QRIS tidak dapat diproses saat offline. Gunakan pembayaran tunai.'
			);
			expect(mock_pos_store.is_processing).toBe(false);

			alert_spy.mockRestore();
		});

		it('should reject split payment when cash >= total', async () => {
			mock_pos_store.cart = makeCartItem();
			mock_pos_store.cart_total = 20000;
			mock_pos_store.payment_method = 'split';
			mock_pos_store.split_cash_amount = 20000; // cash not less than total
			mock_pos_store.is_processing = false;
			mock_pos_store.is_offline = false;

			const alert_spy = vi.spyOn(window, 'alert').mockImplementation(() => {});

			await pos_service.process_payment(vi.fn(), vi.fn());

			expect(mock_api.post).not.toHaveBeenCalled();
			expect(alert_spy).toHaveBeenCalledWith(
				'Uang tunai harus kurang dari total untuk split payment'
			);

			alert_spy.mockRestore();
		});
	});

	describe('sync_pending_orders – offline sync integration', () => {
		it('should send correct batch payload and update sync_status on success', async () => {
			const db = require('$lib/db').db;

			const pendingOrders = [
				{
					client_uuid: 'offline-1',
					payment_method: 'cash',
					final_price: 25000,
					items: [{ product_id: 'p1', quantity: 1, modifiers: [] }],
					customer_name: 'Walk-in',
					sync_status: 'pending'
				},
				{
					client_uuid: 'offline-2',
					payment_method: 'cash',
					final_price: 30000,
					items: [{ product_id: 'p2', quantity: 1, modifiers: [] }],
					customer_name: 'Walk-in',
					sync_status: 'pending'
				}
			];

			db.orders = {
				where: vi.fn().mockReturnValue({
					equals: vi.fn().mockReturnValue({
						toArray: vi.fn().mockResolvedValue(pendingOrders)
					})
				}),
				update: vi.fn().mockResolvedValue(1)
			};

			mock_api.post.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					success: true,
					data: [
						{ client_uuid: 'offline-1', status: 'success', id: 'order-1' },
						{ client_uuid: 'offline-2', status: 'success', id: 'order-2' }
					]
				})
			});

			await pos_service.sync_pending_orders();

			expect(mock_api.post).toHaveBeenCalledWith('/orders/sync-batch', {
				orders: expect.arrayContaining([
					expect.objectContaining({ client_uuid: 'offline-1', client_final_price: 25000 }),
					expect.objectContaining({ client_uuid: 'offline-2', client_final_price: 30000 })
				])
			});
			expect(db.orders.update).toHaveBeenCalledTimes(2);
		});

		it('should skip sync when no pending orders exist', async () => {
			const db = require('$lib/db').db;

			db.orders = {
				where: vi.fn().mockReturnValue({
					equals: vi.fn().mockReturnValue({
						toArray: vi.fn().mockResolvedValue([])
					})
				})
			};

			await pos_service.sync_pending_orders();

			expect(mock_api.post).not.toHaveBeenCalled();
		});

		it('should not update sync_status for failed orders in batch', async () => {
			const db = require('$lib/db').db;

			db.orders = {
				where: vi.fn().mockReturnValue({
					equals: vi.fn().mockReturnValue({
						toArray: vi.fn().mockResolvedValue([
							{
								client_uuid: 'offline-fail',
								payment_method: 'cash',
								final_price: 1000,
								items: [{ product_id: 'nonexistent', quantity: 1, modifiers: [] }],
								sync_status: 'pending'
							}
						])
					})
				}),
				update: vi.fn().mockResolvedValue(1)
			};

			mock_api.post.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					success: true,
					data: [{ client_uuid: 'offline-fail', status: 'error', message: 'not found' }]
				})
			});

			await pos_service.sync_pending_orders();

			expect(db.orders.update).not.toHaveBeenCalled();
		});
	});
