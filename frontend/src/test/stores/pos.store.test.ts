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
  ...overrides,
});

describe('PosStore', () => {
  let store: PosStore;

  beforeEach(() => {
    store = new PosStore();
  });

  describe('Cart Operations', () => {
    it('should add item to cart', () => {
      const product = createMockProduct();
      store.addToCart(product, []);

      expect(store.cart).toHaveLength(1);
      expect(store.cart[0].id).toBe('product-1');
      expect(store.cart[0].quantity).toBe(1);
    });

    it('should increase quantity when adding same product', () => {
      const product = createMockProduct();
      store.addToCart(product, []);
      store.addToCart(product, []);

      expect(store.cart).toHaveLength(1);
      expect(store.cart[0].quantity).toBe(2);
    });

    it('should add different products separately', () => {
      const product1 = createMockProduct({ id: 'p1', name: 'Product 1' });
      const product2 = createMockProduct({ id: 'p2', name: 'Product 2' });
      store.addToCart(product1, []);
      store.addToCart(product2, []);

      expect(store.cart).toHaveLength(2);
    });

    it('should update item quantity', () => {
      const product = createMockProduct();
      store.addToCart(product, []);
      const cartItemId = store.cart[0].cartItemId;

      store.updateQuantity(cartItemId, 2);
      expect(store.cart[0].quantity).toBe(3);

      store.updateQuantity(cartItemId, -1);
      expect(store.cart[0].quantity).toBe(2);
    });

    it('should remove item when quantity becomes zero', () => {
      const product = createMockProduct();
      store.addToCart(product, []);
      const cartItemId = store.cart[0].cartItemId;

      store.updateQuantity(cartItemId, -1);
      expect(store.cart).toHaveLength(0);
    });

    it('should remove item from cart', () => {
      const product = createMockProduct();
      store.addToCart(product, []);
      const cartItemId = store.cart[0].cartItemId;

      store.removeFromCart(cartItemId);
      expect(store.cart).toHaveLength(0);
    });

    it('should reset cart', () => {
      const product = createMockProduct();
      store.addToCart(product, []);
      store.cashAmount = 50000;

      store.resetCart();

      expect(store.cart).toHaveLength(0);
      expect(store.cashAmount).toBe(0);
      expect(store.appliedDiscount).toBeNull();
    });
  });

  describe('Discount Calculations', () => {
    it('should calculate cart total before discount', () => {
      store.cart = [
        { ...createMockProduct({ base_price: 10000 }), quantity: 2, cartItemId: 'c1', selectedModifiers: [] },
        { ...createMockProduct({ base_price: 15000 }), quantity: 1, cartItemId: 'c2', selectedModifiers: [] },
      ];

      // cartTotalBeforeDiscount = (10000 * 2) + (15000 * 1) = 35000
      expect(store.cartTotalBeforeDiscount).toBe(35000);
    });

    it('should calculate cart total with percentage discount', () => {
      store.cart = [
        { ...createMockProduct({ base_price: 10000 }), quantity: 1, cartItemId: 'c1', selectedModifiers: [] },
      ];

      store.appliedDiscount = {
        id: 'disc-1',
        name: '10% Off',
        type: 'percentage',
        value: 10,
        scope: 'all_products',
        applicable_days: [],
        is_active: true,
      };

      // cartTotalBeforeDiscount = 10000
      // discountTotal = 10000 * 10/100 = 1000
      // cartTotal = 10000 - 1000 = 9000
      expect(store.discountTotal).toBe(1000);
      expect(store.cartTotal).toBe(9000);
    });

    it('should calculate cart total with fixed discount', () => {
      store.cart = [
        { ...createMockProduct({ base_price: 25000 }), quantity: 1, cartItemId: 'c1', selectedModifiers: [] },
      ];

      store.appliedDiscount = {
        id: 'disc-1',
        name: 'Rp 5.000 Off',
        type: 'fixed_amount',
        value: 5000,
        scope: 'all_products',
        applicable_days: [],
        is_active: true,
      };

      expect(store.discountTotal).toBe(5000);
      expect(store.cartTotal).toBe(20000);
    });

    it('should not go below zero with large discount', () => {
      store.cart = [
        { ...createMockProduct({ base_price: 5000 }), quantity: 1, cartItemId: 'c1', selectedModifiers: [] },
      ];

      store.appliedDiscount = {
        id: 'disc-1',
        name: 'Big Discount',
        type: 'fixed_amount',
        value: 10000, // More than item price
        scope: 'all_products',
        applicable_days: [],
        is_active: true,
      };

      expect(store.cartTotal).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Payment Calculations', () => {
    it('should calculate cash change', () => {
      store.cartTotal = 25000;
      store.cashAmount = 50000;
      store.paymentMethod = 'cash';

      expect(store.cashChange).toBe(25000);
    });

    it('should calculate split payment correctly', () => {
      store.cartTotal = 50000;
      store.splitCashAmount = 30000;

      expect(store.splitQrisAmount).toBe(20000);
    });
  });

  describe('Currency Formatting', () => {
    it('should format currency correctly', () => {
      const formatted = store.formatRp(50000);
      expect(formatted).toContain('50');
      expect(formatted).toContain('000');
    });
  });

  describe('Discount Selection', () => {
    it('should find best discount for product', () => {
      const product = createMockProduct({ id: 'p1', category_id: 'cat-1' });

      store.activeDiscounts = [
        {
          id: 'd1',
          name: '5% All',
          type: 'percentage',
          value: 5,
          scope: 'all_products',
          applicable_days: [1, 2, 3, 4, 5, 6, 7],
          is_active: true,
        },
        {
          id: 'd2',
          name: 'Rp 1.000 Off',
          type: 'fixed_amount',
          value: 1000,
          scope: 'all_products',
          applicable_days: [1, 2, 3, 4, 5, 6, 7],
          is_active: true,
        },
      ];

      const discount = store.getBestDiscountForProduct(product);

      // For base_price 25000: 5% = 1250, which is better than 1000
      expect(discount?.id).toBe('d1');
      expect(discount?.calculatedAmount).toBe(1250);
    });
  });
});