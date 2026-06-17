/**
 * POS Store Unit Tests
 * Tests for the Svelte 5 POS store with runes reactivity
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Dexie database module before importing the store
vi.mock('$lib/db', () => ({
	db: {
		cart: {
			put: vi.fn().mockResolvedValue(undefined),
			get: vi.fn().mockResolvedValue(null),
			clear: vi.fn().mockResolvedValue(undefined)
		},
		products: {
			toArray: vi.fn().mockResolvedValue([]),
			clear: vi.fn().mockResolvedValue(undefined),
			bulkAdd: vi.fn().mockResolvedValue(undefined)
		},
		orders: {
			add: vi.fn().mockResolvedValue('order-1'),
			where: vi.fn().mockReturnValue({
				equals: vi.fn().mockReturnValue({
					toArray: vi.fn().mockResolvedValue([])
				})
			}),
			update: vi.fn().mockResolvedValue(1)
		}
	}
}));

// Import after mocks are set up
import { PosStore } from '$lib/stores/pos.store.svelte';
import { db } from '$lib/db';
import type { LocalProduct } from '$lib/domain/models/types';
import type { Discount } from '$lib/domain/models/types';

// Create a singleton instance for testing
const posStore = new PosStore();

// Test data factories
const create_mock_product = (overrides: Partial<LocalProduct> = {}): LocalProduct =>
	({
		id: 'product-1',
		name: 'Test Product',
		category_id: 'cat-1',
		base_price: 25000,
		image_url: null,
		is_active: true,
		is_out_of_stock: false,
		modifier_groups: [],
		...overrides
	}) as LocalProduct;

describe('POSStore', () => {
	// Reset store state before each test
	beforeEach(() => {
		posStore.cart = [];
		posStore.products = [];
		posStore.active_discounts = [];
		posStore.applied_discount = null;
		posStore.payment_method = 'cash';
		posStore.cash_amount = 0;
		posStore.split_cash_amount = 0;
		posStore.selected_modifiers = {};
		posStore.selected_product_for_modifier = null;
		posStore.show_modifier_modal = false;
		posStore.is_offline = false;
	});

	describe('Cart Operations', () => {
		it('should add a product to empty cart', () => {
			const product = create_mock_product({ id: 'p1', name: 'Nasi Goreng', base_price: 20000 });

			posStore.add_to_cart(product, []);

			expect(posStore.cart).toHaveLength(1);
			expect(posStore.cart[0].id).toBe('p1');
			expect(posStore.cart[0].quantity).toBe(1);
			expect(posStore.cart[0].selected_modifiers).toEqual([]);
		});

		it('should increment quantity for existing cart item', () => {
			const product = create_mock_product({ id: 'p1', base_price: 20000 });

			posStore.add_to_cart(product, []);
			posStore.add_to_cart(product, []);

			expect(posStore.cart).toHaveLength(1);
			expect(posStore.cart[0].quantity).toBe(2);
		});

		it('should update quantity correctly', () => {
			const product = create_mock_product({ id: 'p1', base_price: 20000 });
			posStore.add_to_cart(product, []);

			const cart_item_id = posStore.cart[0].cart_item_id;

			posStore.update_quantity(cart_item_id, 2);
			expect(posStore.cart[0].quantity).toBe(3);

			posStore.update_quantity(cart_item_id, -1);
			expect(posStore.cart[0].quantity).toBe(2);
		});

		it('should remove item from cart', () => {
			const product = create_mock_product({ id: 'p1', base_price: 20000 });
			posStore.add_to_cart(product, []);

			const cart_item_id = posStore.cart[0].cart_item_id;
			posStore.remove_from_cart(cart_item_id);

			expect(posStore.cart).toHaveLength(0);
		});

		it('should reset cart and payment state', () => {
			const product = create_mock_product({ id: 'p1', base_price: 20000 });
			posStore.add_to_cart(product, []);
			posStore.payment_method = 'qris';
			posStore.cash_amount = 50000;

			posStore.reset_cart();

			expect(posStore.cart).toHaveLength(0);
			expect(posStore.payment_method).toBe('cash');
			expect(posStore.cash_amount).toBe(0);
		});
	});

	describe('Price Calculations', () => {
		it('should calculate cart total without modifiers', () => {
			const p1 = create_mock_product({ id: 'p1', base_price: 20000 });
			const p2 = create_mock_product({ id: 'p2', base_price: 15000 });

			posStore.add_to_cart(p1, []);
			posStore.add_to_cart(p2, []);

			expect(posStore.cart_total_before_discount).toBe(35000);
		});

		it('should calculate cash change correctly', () => {
			posStore.payment_method = 'cash';
			posStore.cash_amount = 50000;

			const product = create_mock_product({ id: 'p1', base_price: 20000 });
			posStore.add_to_cart(product, []);

			expect(posStore.cash_change).toBe(30000);
		});
	});

	describe('Split Payment', () => {
		it('should calculate split payment correctly', () => {
			posStore.payment_method = 'split';
			posStore.split_cash_amount = 15000;

			const product = create_mock_product({ id: 'p1', base_price: 20000 });
			posStore.add_to_cart(product, []);

			expect(posStore.split_qris_amount).toBe(5000);
		});
	});

	describe('Shift Management', () => {
		it('should have default opening balance of 500000', () => {
			expect(posStore.opening_balance).toBe(500000);
		});
	});

	describe('Offline State', () => {
		it('should track offline status', () => {
			expect(posStore.is_offline).toBe(false);

			posStore.is_offline = true;
			expect(posStore.is_offline).toBe(true);
		});
	});

	describe('Discount Calculations (TINGGI-04)', () => {
		// TINGGI-04: Discount only applies to base_price, NOT modifiers
		// Product: Rp25,000 + Modifier Rp5,000 = Total Rp30,000
		// Discount 10% should = Rp2,500 (10% of base only, not modifiers)

		const create_discount = (overrides: Partial<Discount> = {}): Discount =>
			({
				id: 'disc-1',
				name: 'Test Discount',
				type: 'percentage',
				value: 10,
				scope: 'all_products',
				target_id: null,
				applicable_days: [1, 2, 3, 4, 5, 6, 7],
				...overrides
			}) as Discount;

		const create_product_with_modifier = (): LocalProduct =>
			create_mock_product({
				id: 'product-with-mod',
				name: 'Paket Komplit',
				base_price: 25000,
				modifier_groups: [
					{
						id: 'mod-level',
						name: 'Level Pedas',
						is_required: false,
						options: [{ id: 'opt-1', name: 'Extra Pedas', additional_price: 5000 }]
					}
				]
			});

		it('should apply discount only to base_price, not modifiers (TINGGI-04)', () => {
			// Setup: product with modifier
			const product = create_product_with_modifier();
			const modifier_option = (product.modifier_groups[0] as any).options[0];

			// Add discount
			posStore.active_discounts = [create_discount({ value: 10, type: 'percentage' })];

			// Add product with modifier to cart
			posStore.add_to_cart(product, [modifier_option]);

			// Expected: base_price = 25000, modifier = 5000
			// Discount 10% on base only: 25000 * 0.10 = 2500
			// cart_total_before_discount = 25000 + 5000 = 30000
			// discount_total = 2500
			// cart_total = 30000 - 2500 = 27500
			expect(posStore.cart_total_before_discount).toBe(30000);
			expect(posStore.discount_total).toBe(2500);
			expect(posStore.cart_total).toBe(27500);
		});

		it('should apply percentage discount correctly to base_price', () => {
			const product = create_mock_product({
				id: 'p1',
				base_price: 10000,
				modifier_groups: [
					{
						id: 'mod-1',
						name: 'Extra',
						is_required: false,
						options: [{ id: 'opt-1', name: 'Saus Extra', additional_price: 2000 }]
					}
				]
			});
			const modifier = (product.modifier_groups[0] as any).options[0];

			posStore.active_discounts = [create_discount({ value: 20, type: 'percentage' })];
			posStore.add_to_cart(product, [modifier]);

			// base = 10000, modifier = 2000, qty = 1
			// before_discount = 10000 + 2000 = 12000
			// discount = 20% of 10000 = 2000
			// total = 12000 - 2000 = 10000
			expect(posStore.cart_total_before_discount).toBe(12000);
			expect(posStore.discount_total).toBe(2000);
			expect(posStore.cart_total).toBe(10000);
		});

		it('should apply fixed amount discount correctly to base_price only', () => {
			const product = create_mock_product({
				id: 'p2',
				base_price: 15000,
				modifier_groups: [
					{
						id: 'mod-2',
						name: 'Topping',
						is_required: false,
						options: [{ id: 'opt-2', name: 'Keju', additional_price: 3000 }]
					}
				]
			});
			const modifier = (product.modifier_groups[0] as any).options[0];

			posStore.active_discounts = [create_discount({ value: 5000, type: 'fixed_amount' })];
			posStore.add_to_cart(product, [modifier]);

			// base = 15000, modifier = 3000
			// before_discount = 15000 + 3000 = 18000
			// discount = 5000 (fixed, applied per item)
			// total = 18000 - 5000 = 13000
			expect(posStore.cart_total_before_discount).toBe(18000);
			expect(posStore.discount_total).toBe(5000);
			expect(posStore.cart_total).toBe(13000);
		});

		it('should apply discount per item in cart with quantity > 1', () => {
			const product = create_mock_product({
				id: 'p3',
				base_price: 20000,
				modifier_groups: [
					{
						id: 'mod-3',
						name: 'Size',
						is_required: false,
						options: [{ id: 'opt-3', name: 'Large', additional_price: 5000 }]
					}
				]
			});
			const modifier = (product.modifier_groups[0] as any).options[0];

			posStore.active_discounts = [create_discount({ value: 10, type: 'percentage' })];
			posStore.add_to_cart(product, [modifier]);
			// Increment quantity to 3
			posStore.update_quantity(posStore.cart[0].cart_item_id, 2);

			// base = 20000, modifier = 5000, qty = 3
			// before_discount = (20000 + 5000) * 3 = 75000
			// discount = 10% of (20000 * 3) = 6000
			// total = 75000 - 6000 = 69000
			expect(posStore.cart_total_before_discount).toBe(75000);
			expect(posStore.discount_total).toBe(6000);
			expect(posStore.cart_total).toBe(69000);
		});

		it('should not apply discount when only modifiers (no base product discount)', () => {
			// This tests that modifiers are never discounted
			// even when product has no applicable discount
			const product = create_mock_product({
				id: 'p-no-disc',
				name: 'Only Modifiers',
				base_price: 10000,
				modifier_groups: [
					{
						id: 'mod-4',
						name: 'Extra',
						is_required: false,
						options: [{ id: 'opt-4', name: 'Spesial', additional_price: 8000 }]
					}
				]
			});
			const modifier = (product.modifier_groups[0] as any).options[0];

			// No discount applied
			posStore.active_discounts = [];
			posStore.add_to_cart(product, [modifier]);

			// base = 10000, modifier = 8000
			// no discount
			// total = 18000
			expect(posStore.cart_total_before_discount).toBe(18000);
			expect(posStore.discount_total).toBe(0);
			expect(posStore.cart_total).toBe(18000);
		});
	});

	describe('format_rp', () => {
		it('should format number as Indonesian Rupiah', () => {
			const formatted = posStore.format_rp(25000);
			expect(formatted).toContain('25.000');
			expect(formatted).toContain('Rp');
		});
	});
});
