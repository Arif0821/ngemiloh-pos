import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PosStore } from '$lib/stores/pos.store.svelte';
import type { LocalProduct, Discount, ModifierOption } from '$lib/domain/models/types';

// Mock product for testing
const createMockProduct = (overrides = {}): LocalProduct => ({
	id: 'product-1',
	name: 'Test Product',
	category_id: 'cat-1',
	base_price: 25000,
	image_url: undefined,
	is_out_of_stock: false,
	modifier_groups: [],
	...overrides
});

describe('PosStore', () => {
	let store: PosStore;

	beforeEach(() => {
		store = new PosStore();
	});

	describe('Cart Operations', () => {
		it('should add item to cart', () => {
			const product = createMockProduct();
			store.add_to_cart(product, []);

			expect(store.cart).toHaveLength(1);
			expect(store.cart[0].id).toBe('product-1');
			expect(store.cart[0].quantity).toBe(1);
		});

		it('should increase quantity when adding same product', () => {
			const product = createMockProduct();
			store.add_to_cart(product, []);
			store.add_to_cart(product, []);

			expect(store.cart).toHaveLength(1);
			expect(store.cart[0].quantity).toBe(2);
		});

		it('should add different products separately', () => {
			const product1 = createMockProduct({ id: 'p1', name: 'Product 1' });
			const product2 = createMockProduct({ id: 'p2', name: 'Product 2' });
			store.add_to_cart(product1, []);
			store.add_to_cart(product2, []);

			expect(store.cart).toHaveLength(2);
		});

		it('should update item quantity', () => {
			const product = createMockProduct();
			store.add_to_cart(product, []);
			const cart_item_id = store.cart[0].cart_item_id;

			store.update_quantity(cart_item_id, 2);
			expect(store.cart[0].quantity).toBe(3);

			store.update_quantity(cart_item_id, -1);
			expect(store.cart[0].quantity).toBe(2);
		});

		it('should remove item when quantity becomes zero', () => {
			const product = createMockProduct();
			store.add_to_cart(product, []);
			const cart_item_id = store.cart[0].cart_item_id;

			store.update_quantity(cart_item_id, -1);
			expect(store.cart).toHaveLength(0);
		});

		it('should remove item from cart', () => {
			const product = createMockProduct();
			store.add_to_cart(product, []);
			const cart_item_id = store.cart[0].cart_item_id;

			store.remove_from_cart(cart_item_id);
			expect(store.cart).toHaveLength(0);
		});

		it('should reset cart', () => {
			const product = createMockProduct();
			store.add_to_cart(product, []);
			store.cash_amount = 50000;

			store.reset_cart();

			expect(store.cart).toHaveLength(0);
			expect(store.cash_amount).toBe(0);
			expect(store.applied_discount).toBeNull();
		});
	});

	describe('Discount Calculations', () => {
		it('should calculate cart total before discount', () => {
			store.cart = [
				{
					...createMockProduct({ base_price: 10000 }),
					quantity: 2,
					cart_item_id: 'c1',
					selected_modifiers: []
				},
				{
					...createMockProduct({ base_price: 15000 }),
					quantity: 1,
					cart_item_id: 'c2',
					selected_modifiers: []
				}
			];

			// cart_total_before_discount = (10000 * 2) + (15000 * 1) = 35000
			expect(store.cart_total_before_discount).toBe(35000);
		});

		it('should calculate cart total with percentage discount', () => {
			store.cart = [
				{
					...createMockProduct({ base_price: 10000 }),
					quantity: 1,
					cart_item_id: 'c1',
					selected_modifiers: []
				}
			];

			store.applied_discount = {
				id: 'disc-1',
				name: '10% Off',
				type: 'percentage',
				value: 10,
				scope: 'all_products',
				applicable_days: [],
				is_active: true
			};

			// cart_total_before_discount = 10000
			// discount_total = 10000 * 10/100 = 1000
			// cart_total = 10000 - 1000 = 9000
			expect(store.discount_total).toBe(1000);
			expect(store.cart_total).toBe(9000);
		});

		it('should calculate cart total with fixed discount', () => {
			store.cart = [
				{
					...createMockProduct({ base_price: 25000 }),
					quantity: 1,
					cart_item_id: 'c1',
					selected_modifiers: []
				}
			];

			store.applied_discount = {
				id: 'disc-1',
				name: 'Rp 5.000 Off',
				type: 'fixed_amount',
				value: 5000,
				scope: 'all_products',
				applicable_days: [],
				is_active: true
			};

			expect(store.discount_total).toBe(5000);
			expect(store.cart_total).toBe(20000);
		});

		it('should not go below zero with large discount', () => {
			store.cart = [
				{
					...createMockProduct({ base_price: 5000 }),
					quantity: 1,
					cart_item_id: 'c1',
					selected_modifiers: []
				}
			];

			store.applied_discount = {
				id: 'disc-1',
				name: 'Big Discount',
				type: 'fixed_amount',
				value: 10000, // More than item price
				scope: 'all_products',
				applicable_days: [],
				is_active: true
			};

			expect(store.cart_total).toBeGreaterThanOrEqual(0);
		});
	});

	describe('Payment Calculations', () => {
		it('should calculate cash change', () => {
			store.cart_total = 25000;
			store.cash_amount = 50000;
			store.payment_method = 'cash';

			expect(store.cash_change).toBe(25000);
		});

		it('should calculate split payment correctly', () => {
			store.cart_total = 50000;
			store.split_cash_amount = 30000;

			expect(store.split_qris_amount).toBe(20000);
		});
	});

	describe('Currency Formatting', () => {
		it('should format currency correctly', () => {
			const formatted = store.format_rp(50000);
			expect(formatted).toContain('50');
			expect(formatted).toContain('000');
		});
	});

	describe('Discount Selection', () => {
		it('should find best discount for product', () => {
			const product = createMockProduct({ id: 'p1', category_id: 'cat-1' });

			store.active_discounts = [
				{
					id: 'd1',
					name: '5% All',
					type: 'percentage',
					value: 5,
					scope: 'all_products',
					applicable_days: [1, 2, 3, 4, 5, 6, 7],
					is_active: true
				},
				{
					id: 'd2',
					name: 'Rp 1.000 Off',
					type: 'fixed_amount',
					value: 1000,
					scope: 'all_products',
					applicable_days: [1, 2, 3, 4, 5, 6, 7],
					is_active: true
				}
			];

			const discount = store.get_best_discount_for_product(product);

			// For base_price 25000: 5% = 1250, which is better than 1000
			expect(discount?.id).toBe('d1');
			expect(discount?.calculated_amount).toBe(1250);
		});
	});
});
