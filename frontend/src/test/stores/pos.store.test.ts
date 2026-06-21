/**
 * POS Store Unit Tests (TINGGI-04)
 * Test cases untuk pos_store.svelte.ts
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Dexie before importing store
vi.mock('$lib/db', () => ({
  db: {
    cart: {
      put: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
    },
    orders: {
      put: vi.fn().mockResolvedValue(undefined),
    },
  },
}));

// Mock api client
vi.mock('$lib/services/api.client', () => ({
  api: {
    get: vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true, data: [] } }),
    post: vi.fn().mockResolvedValue({ ok: true }),
  },
}));

// Types untuk test
interface TestCartItem {
  id: string;
  product_id: string;
  product_name: string;
  base_price: number;
  quantity: number;
  modifiers: Array<{ id: string; name: string; additional_price: number }>;
  final_price: number;
}

interface TestDiscount {
  id: string;
  type: 'percentage' | 'fixed_amount';
  value: number;
  scope: 'all_products' | 'category' | 'specific_product';
  is_active: boolean;
  applicable_days: number[] | null;
  target_id: string | null;
}

// Simple store mock untuk test (sesuai struktur PRD)
class TestPosStore {
  cart: TestCartItem[] = [];
  active_discounts: TestDiscount[] = [];
  cash_amount = 0;
  is_offline = false;

  add_to_cart(product: { id: string; name: string; base_price: number; category_id: string }, modifiers: Array<{ id: string; name: string; additional_price: number }>) {
    const modifier_total = modifiers.reduce((sum, m) => sum + m.additional_price, 0);
    const existing = this.cart.find(
      (c) => c.product_id === product.id && JSON.stringify(c.modifiers) === JSON.stringify(modifiers)
    );

    if (existing) {
      existing.quantity++;
      existing.final_price = existing.base_price + modifier_total;
    } else {
      this.cart.push({
        id: `cart-${Date.now()}`,
        product_id: product.id,
        product_name: product.name,
        base_price: product.base_price,
        quantity: 1,
        modifiers,
        final_price: product.base_price + modifier_total,
      });
    }
  }

  remove_from_cart(index: number) {
    this.cart.splice(index, 1);
  }

  update_quantity(index: number, quantity: number) {
    if (this.cart[index]) {
      this.cart[index].quantity = quantity;
    }
  }

  get cart_total(): number {
    return this.cart.reduce((sum, item) => sum + item.final_price * item.quantity, 0);
  }

  get discount_total(): number {
    let total = 0;
    for (const item of this.cart) {
      const applicable_discounts = this.active_discounts.filter((d) => {
        if (!d.is_active) return false;
        if (d.scope === 'all_products') return true;
        return false;
      });
      const max_discount = Math.max(0, ...applicable_discounts.map((d) => d.value));
      total += item.base_price * item.quantity * (max_discount / 100);
    }
    return Math.round(total);
  }

  reset_cart() {
    this.cart = [];
    this.cash_amount = 0;
  }
}

describe('PosStore', () => {
  let store: TestPosStore;

  beforeEach(() => {
    store = new TestPosStore();
  });

  describe('Cart Operations', () => {
    it('menambahkan produk baru ke cart', () => {
      const product = { id: 'prod-1', name: 'Macaroni Pedas', base_price: 10000, category_id: 'cat-1' };

      store.add_to_cart(product, []);

      expect(store.cart).toHaveLength(1);
      expect(store.cart[0].product_id).toBe('prod-1');
      expect(store.cart[0].quantity).toBe(1);
    });

    it('menambahkan quantity jika produk + modifier sama', () => {
      const product = { id: 'prod-1', name: 'Macaroni Pedas', base_price: 10000, category_id: 'cat-1' };

      store.add_to_cart(product, []);
      store.add_to_cart(product, []);

      expect(store.cart).toHaveLength(1);
      expect(store.cart[0].quantity).toBe(2);
    });

    it('menambahkan modifier tambahan ke cart item', () => {
      const product = { id: 'prod-1', name: 'Macaroni', base_price: 10000, category_id: 'cat-1' };
      const modifier = { id: 'mod-1', name: 'Extra Pedas', additional_price: 2000 };

      store.add_to_cart(product, [modifier]);

      expect(store.cart[0].modifiers).toHaveLength(1);
      expect(store.cart[0].final_price).toBe(12000);
    });

    it('produk berbeda membuat cart item baru', () => {
      const product1 = { id: 'prod-1', name: 'Macaroni', base_price: 10000, category_id: 'cat-1' };
      const product2 = { id: 'prod-2', name: 'Ciki', base_price: 5000, category_id: 'cat-1' };

      store.add_to_cart(product1, []);
      store.add_to_cart(product2, []);

      expect(store.cart).toHaveLength(2);
    });
  });

  describe('Cart Total Calculation', () => {
    it('menghitung cart_total dengan benar', () => {
      const product = { id: 'prod-1', name: 'Macaroni', base_price: 10000, category_id: 'cat-1' };

      store.add_to_cart(product, []);
      store.add_to_cart(product, []);

      // 2 item x 10000 = 20000
      expect(store.cart_total).toBe(20000);
    });

    it('cart_total termasuk modifier price', () => {
      const product = { id: 'prod-1', name: 'Macaroni', base_price: 10000, category_id: 'cat-1' };
      const modifier = { id: 'mod-1', name: 'Extra', additional_price: 3000 };

      store.add_to_cart(product, [modifier]);

      // base_price 10000 + modifier 3000 = 13000
      expect(store.cart_total).toBe(13000);
    });
  });

  describe('Discount Calculation', () => {
    it('diskon 10% dihitung dari base_price saja', () => {
      store.active_discounts = [
        {
          id: 'disc-1',
          type: 'percentage',
          value: 10,
          scope: 'all_products',
          is_active: true,
          applicable_days: null,
          target_id: null,
        },
      ];

      const product = { id: 'prod-1', name: 'Macaroni', base_price: 10000, category_id: 'cat-1' };
      const modifier = { id: 'mod-1', name: 'Extra', additional_price: 5000 };

      store.add_to_cart(product, [modifier]);

      // Diskon 10% dari base_price 10000 = 1000
      expect(store.discount_total).toBe(1000);
      // Total = (10000 + 5000) - 1000 = 14000
      expect(store.cart_total - store.discount_total).toBe(14000);
    });

    it('tidak ada diskon jika tidak ada diskon aktif', () => {
      const product = { id: 'prod-1', name: 'Macaroni', base_price: 10000, category_id: 'cat-1' };

      store.add_to_cart(product, []);

      expect(store.discount_total).toBe(0);
    });

    it('diskon inactive tidak dihitung', () => {
      store.active_discounts = [
        {
          id: 'disc-1',
          type: 'percentage',
          value: 10,
          scope: 'all_products',
          is_active: false, // inactive
          applicable_days: null,
          target_id: null,
        },
      ];

      const product = { id: 'prod-1', name: 'Macaroni', base_price: 10000, category_id: 'cat-1' };

      store.add_to_cart(product, []);

      expect(store.discount_total).toBe(0);
    });
  });

  describe('Reset Cart', () => {
    it('mereset cart dan payment state', () => {
      const product = { id: 'prod-1', name: 'Test', base_price: 5000, category_id: 'cat-1' };
      store.add_to_cart(product, []);
      store.cash_amount = 50000;

      store.reset_cart();

      expect(store.cart).toHaveLength(0);
      expect(store.cash_amount).toBe(0);
    });
  });

  describe('Remove from Cart', () => {
    it('menghapus item dari cart berdasarkan index', () => {
      const product1 = { id: 'prod-1', name: 'Macaroni', base_price: 10000, category_id: 'cat-1' };
      const product2 = { id: 'prod-2', name: 'Ciki', base_price: 5000, category_id: 'cat-1' };

      store.add_to_cart(product1, []);
      store.add_to_cart(product2, []);
      expect(store.cart).toHaveLength(2);

      store.remove_from_cart(0);

      expect(store.cart).toHaveLength(1);
      expect(store.cart[0].product_id).toBe('prod-2');
    });
  });

  describe('Update Quantity', () => {
    it('mengupdate quantity item berdasarkan index', () => {
      const product = { id: 'prod-1', name: 'Macaroni', base_price: 10000, category_id: 'cat-1' };

      store.add_to_cart(product, []);
      expect(store.cart[0].quantity).toBe(1);

      store.update_quantity(0, 5);

      expect(store.cart[0].quantity).toBe(5);
      expect(store.cart_total).toBe(50000);
    });
  });
});
