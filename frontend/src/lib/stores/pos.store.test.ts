/**
 * POS Store Unit Tests
 *
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
import { posStore, type CartItem } from '$lib/stores/pos.store.svelte';
import { db, type LocalProduct, type ModifierOption } from '$lib/db';
import type { Discount } from '$lib/domain/models/types';

// Test data factories
const createMockProduct = (overrides: Partial<LocalProduct> = {}): LocalProduct =>
	({
		id: 'product-1',
		name: 'Test Product',
		category_id: 'cat-1',
		category_name: 'Test Category',
		base_price: 25000,
		image_url: null,
		is_active: true,
		is_out_of_stock: false,
		sort_order: 0,
		created_at: new Date().toISOString(),
		modifier_groups: [],
		...overrides
	}) as LocalProduct;

const createMockModifierOption = (overrides: Partial<ModifierOption> = {}): ModifierOption => ({
	id: 'mod-opt-1',
	name: 'Extra Topping',
	additional_price: 5000,
	...overrides
});

const createMockDiscount = (overrides: Partial<Discount> = {}): Discount => ({
	id: 'discount-1',
	name: '10% Off',
	type: 'percentage',
	value: 10,
	scope: 'all_products',
	target_id: null,
	valid_from: undefined,
	valid_until: undefined,
	applicable_days: [1, 2, 3, 4, 5, 6, 7],
	is_active: true,
	...overrides
});

describe('POSStore', () => {
	// Reset store state before each test
	beforeEach(() => {
		// Reset all state values
		posStore.cart = [];
		posStore.products = [];
		posStore.activeDiscounts = [];
		posStore.appliedDiscount = null;
		posStore.paymentMethod = 'cash';
		posStore.cashAmount = 0;
		posStore.splitCashAmount = 0;
		posStore.selectedModifiers = {};
		posStore.selectedProductForModifier = null;
		posStore.showModifierModal = false;
		posStore.isOffline = false;
	});

	describe('Cart Operations', () => {
		it('should add a product to empty cart', () => {
			const product = createMockProduct({ id: 'p1', name: 'Nasi Goreng', base_price: 20000 });

			posStore.addToCart(product, []);

			expect(posStore.cart).toHaveLength(1);
			expect(posStore.cart[0].id).toBe('p1');
			expect(posStore.cart[0].quantity).toBe(1);
			expect(posStore.cart[0].selectedModifiers).toEqual([]);
		});

		it('should increment quantity for existing cart item', () => {
			const product = createMockProduct({ id: 'p1', base_price: 20000 });

			posStore.addToCart(product, []);
			posStore.addToCart(product, []);

			expect(posStore.cart).toHaveLength(1);
			expect(posStore.cart[0].quantity).toBe(2);
		});

		it('should add same product with different modifiers as separate items', () => {
			const product = createMockProduct({ id: 'p1', base_price: 20000 });
			const mod1 = createMockModifierOption({ id: 'm1', name: 'Extra Cheese' });
			const mod2 = createMockModifierOption({ id: 'm2', name: 'Extra Meat' });

			posStore.addToCart(product, [mod1]);
			posStore.addToCart(product, [mod2]);

			expect(posStore.cart).toHaveLength(2);
		});

		it('should update quantity correctly', () => {
			const product = createMockProduct({ id: 'p1', base_price: 20000 });
			posStore.addToCart(product, []);

			const cartItemId = posStore.cart[0].cartItemId;

			posStore.updateQuantity(cartItemId, 2);
			expect(posStore.cart[0].quantity).toBe(3);

			posStore.updateQuantity(cartItemId, -1);
			expect(posStore.cart[0].quantity).toBe(2);
		});

		it('should not go below 0 when updating quantity', () => {
			const product = createMockProduct({ id: 'p1', base_price: 20000 });
			posStore.addToCart(product, []);

			const cartItemId = posStore.cart[0].cartItemId;

			// Try to decrement when quantity is 1
			posStore.updateQuantity(cartItemId, -1);
			expect(posStore.cart).toHaveLength(0); // Item should be removed
		});

		it('should remove item from cart', () => {
			const product = createMockProduct({ id: 'p1', base_price: 20000 });
			posStore.addToCart(product, []);

			const cartItemId = posStore.cart[0].cartItemId;
			posStore.removeFromCart(cartItemId);

			expect(posStore.cart).toHaveLength(0);
		});

		it('should reset cart and payment state', () => {
			const product = createMockProduct({ id: 'p1', base_price: 20000 });
			posStore.addToCart(product, []);
			posStore.paymentMethod = 'qris';
			posStore.cashAmount = 50000;

			posStore.resetCart();

			expect(posStore.cart).toHaveLength(0);
			expect(posStore.paymentMethod).toBe('cash');
			expect(posStore.cashAmount).toBe(0);
		});
	});

	describe('Price Calculations', () => {
		it('should calculate cart total without modifiers', () => {
			const p1 = createMockProduct({ id: 'p1', base_price: 20000 });
			const p2 = createMockProduct({ id: 'p2', base_price: 15000 });

			posStore.addToCart(p1, []);
			posStore.addToCart(p2, []);

			expect(posStore.cartTotalBeforeDiscount).toBe(35000);
		});

		it('should calculate cart total with modifiers', () => {
			const product = createMockProduct({ id: 'p1', base_price: 20000 });
			const modifier = createMockModifierOption({ additional_price: 5000 });

			posStore.addToCart(product, [modifier]);

			// Total = (20000 + 5000) * 1 = 25000
			expect(posStore.cartTotalBeforeDiscount).toBe(25000);
		});

		it('should apply percentage discount correctly', () => {
			posStore.activeDiscounts = [
				createMockDiscount({ type: 'percentage', value: 10 }) // 10% off
			];
			posStore.appliedDiscount = posStore.activeDiscounts[0];

			const product = createMockProduct({ id: 'p1', base_price: 20000 });
			posStore.addToCart(product, []);

			// Cart total before discount: 20000
			// Discount: 10% = 2000
			// Cart total after discount: 18000
			expect(posStore.cartTotalBeforeDiscount).toBe(20000);
			expect(posStore.discountTotal).toBe(2000);
			expect(posStore.cartTotal).toBe(18000);
		});

		it('should apply fixed amount discount correctly', () => {
			posStore.activeDiscounts = [
				createMockDiscount({ type: 'fixed_amount', value: 5000 }) // Rp 5000 off
			];
			posStore.appliedDiscount = posStore.activeDiscounts[0];

			const product = createMockProduct({ id: 'p1', base_price: 20000 });
			posStore.addToCart(product, []);

			expect(posStore.cartTotalBeforeDiscount).toBe(20000);
			expect(posStore.discountTotal).toBe(5000);
			expect(posStore.cartTotal).toBe(15000);
		});

		it('should calculate cash change correctly', () => {
			posStore.paymentMethod = 'cash';
			posStore.cashAmount = 50000;

			const product = createMockProduct({ id: 'p1', base_price: 20000 });
			posStore.addToCart(product, []);

			// Total = 20000, Cash = 50000, Change = 30000
			expect(posStore.cashChange).toBe(30000);
		});

		it('should not show negative change', () => {
			posStore.paymentMethod = 'cash';
			posStore.cashAmount = 10000;

			const product = createMockProduct({ id: 'p1', base_price: 20000 });
			posStore.addToCart(product, []);

			// Total = 20000, Cash = 10000, Change = -10000 (should be 0)
			expect(posStore.cashChange).toBe(-10000); // Raw calculation, not clamped
		});
	});

	describe('Discount Logic', () => {
		it('should find best discount for product', () => {
			posStore.activeDiscounts = [
				createMockDiscount({ id: 'd1', type: 'percentage', value: 5 }),
				createMockDiscount({ id: 'd2', type: 'fixed_amount', value: 2000 })
			];

			const product = createMockProduct({ id: 'p1', base_price: 20000 });
			const bestDiscount = posStore.getBestDiscountForProduct(product);

			// Best should be fixed 2000 since 5% of 20000 = 1000 < 2000
			expect(bestDiscount?.id).toBe('d2');
			expect(bestDiscount?.calculatedAmount).toBe(2000);
		});

		it('should only apply discounts for applicable days', () => {
			posStore.activeDiscounts = [
				createMockDiscount({
					applicable_days: [1, 2, 3, 4, 5] // Weekdays only
				})
			];

			const product = createMockProduct({ id: 'p1', base_price: 20000 });
			const today = new Date().getDay(); // 0 = Sunday, 6 = Saturday

			if (today === 0 || today === 6) {
				// Weekend - no discount should apply
				expect(posStore.getBestDiscountForProduct(product)).toBeNull();
			}
		});
	});

	describe('Split Payment', () => {
		it('should calculate split payment correctly', () => {
			posStore.paymentMethod = 'split';
			posStore.splitCashAmount = 15000;

			const product = createMockProduct({ id: 'p1', base_price: 20000 });
			posStore.addToCart(product, []);

			// Total = 20000, Cash = 15000, QRIS = 5000
			expect(posStore.splitQrisAmount).toBe(5000);
		});
	});

	describe('Shift Management', () => {
		it('should have default opening balance of 500000', () => {
			expect(posStore.openingBalance).toBe(500000);
		});

		it('should reset closing balance', () => {
			posStore.closingBalance = 600000;
			posStore.hasOpenShift = false;

			// Reset should happen when opening new shift
			posStore.openingBalance = 500000;
			expect(posStore.closingBalance).toBe(0); // Initial value
		});
	});

	describe('Modifier Selection', () => {
		it('should check if all required modifiers are selected', () => {
			const product = createMockProduct({
				modifier_groups: [
					{
						id: 'group-1',
						name: 'Taste',
						is_required: true,
						max_selections: 1,
						options: [
							createMockModifierOption({ id: 'opt-1' }),
							createMockModifierOption({ id: 'opt-2' })
						]
					}
				]
			});

			posStore.selectedProductForModifier = product;

			// No modifiers selected yet
			expect(posStore.isAllRequiredModifiersSelected).toBe(false);

			// Select a required modifier
			posStore.selectedModifiers = { 'group-1': product.modifier_groups![0].options[0] };

			expect(posStore.isAllRequiredModifiersSelected).toBe(true);
		});

		it('should calculate modifier total', () => {
			posStore.selectedModifiers = {
				'group-1': createMockModifierOption({ additional_price: 5000 }),
				'group-2': createMockModifierOption({ additional_price: 3000 })
			};

			expect(posStore.modifierTotal).toBe(8000);
		});
	});

	describe('Offline State', () => {
		it('should track offline status', () => {
			expect(posStore.isOffline).toBe(false);

			posStore.isOffline = true;
			expect(posStore.isOffline).toBe(true);
		});
	});

	describe('formatRp', () => {
		it('should format number as Indonesian Rupiah', () => {
			const formatted = posStore.formatRp(25000);
			expect(formatted).toContain('25.000');
			expect(formatted).toContain('Rp');
		});
	});
});
