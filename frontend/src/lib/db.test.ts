import { describe, it, expect, beforeEach, vi } from 'vitest';
import type {
  LocalProduct,
  LocalOrder,
  LocalCartItem,
  Discount
} from './domain/models/types';

// ============================================
// MOCK IMPLEMENTATION (to test the mock pattern)
// ============================================

interface MockTable<T> {
  data: Map<string, T>;
  add: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  toArray: ReturnType<typeof vi.fn>;
  count: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
}

function createMockTable<T>(name: string): MockTable<T> {
  const data = new Map<string, T>();

  return {
    data,
    add: vi.fn(async (item: T & { id?: string }) => {
      const key = (item as any).id || (item as any).client_uuid;
      if (!key) throw new Error(`${name}: No key provided`);
      data.set(key, item);
      return key;
    }),
    put: vi.fn(async (item: T & { id?: string }) => {
      const key = (item as any).id || (item as any).client_uuid;
      if (!key) throw new Error(`${name}: No key provided`);
      data.set(key, item);
      return key;
    }),
    get: vi.fn(async (key: string) => data.get(key) || undefined),
    delete: vi.fn(async (key: string) => data.delete(key)),
    toArray: vi.fn(async () => Array.from(data.values())),
    count: vi.fn(async () => data.size),
    clear: vi.fn(async () => data.clear()),
    update: vi.fn(async (key: string, changes: Partial<T>) => {
      const item = data.get(key);
      if (item) data.set(key, { ...item, ...changes } as T);
    }),
    where: vi.fn((fieldName: string) => ({
      equals: vi.fn((value: unknown) => ({
        toArray: vi.fn(async () =>
          Array.from(data.values()).filter(item =>
            Object.values(item as object).includes(value)
          )
        ),
        count: vi.fn(async () =>
          Array.from(data.values()).filter(item =>
            Object.values(item as object).includes(value)
          ).length
        ),
      })),
      above: vi.fn(() => ({
        toArray: vi.fn(async () => Array.from(data.values())),
      })),
    })),
  };
}

describe('Dexie Mock Pattern', () => {
  // These tests verify the mock behavior for IndexedDB operations
  // In real tests with jsdom+dexie, you would use the actual Dexie

  let productsTable: MockTable<LocalProduct>;
  let ordersTable: MockTable<LocalOrder>;

  const createMockProduct = (id: string): LocalProduct => ({
    id,
    name: `Product ${id}`,
    base_price: 25000,
    category_id: 'cat-1',
    image_url: null,
    is_out_of_stock: false,
    modifier_groups: [],
  });

  const createMockOrder = (clientUuid: string): LocalOrder => ({
    client_uuid: clientUuid,
    kasir_id: 'kasir-1',
    subtotal: 50000,
    tax_total: 5500,
    final_price: 55500,
    payment_method: 'cash',
    status: 'completed',
    items: [],
    sync_status: 'pending',
    created_at: Date.now(),
  });

  beforeEach(() => {
    productsTable = createMockTable<LocalProduct>('products');
    ordersTable = createMockTable<LocalOrder>('orders');
  });

  describe('Table Operations', () => {
    // ============================================
    // HAPPY PATH
    // ============================================
    it('should add item and return key', async () => {
      const product = createMockProduct('p1');
      const key = await productsTable.add(product);

      expect(key).toBe('p1');
      expect(productsTable.add).toHaveBeenCalledWith(product);
    });

    it('should put item and return key', async () => {
      const order = createMockOrder('o1');
      const key = await ordersTable.put(order);

      expect(key).toBe('o1');
    });

    it('should get item by key', async () => {
      const product = createMockProduct('p1');
      await productsTable.add(product);

      const retrieved = await productsTable.get('p1');
      expect(retrieved).toEqual(product);
    });

    it('should delete item by key', async () => {
      await productsTable.add(createMockProduct('p1'));
      await productsTable.delete('p1');

      const retrieved = await productsTable.get('p1');
      expect(retrieved).toBeUndefined();
    });

    it('should get all items as array', async () => {
      await productsTable.add(createMockProduct('p1'));
      await productsTable.add(createMockProduct('p2'));

      const all = await productsTable.toArray();
      expect(all).toHaveLength(2);
    });

    it('should count items', async () => {
      await productsTable.add(createMockProduct('p1'));
      await productsTable.add(createMockProduct('p2'));

      const count = await productsTable.count();
      expect(count).toBe(2);
    });

    it('should clear all items', async () => {
      await productsTable.add(createMockProduct('p1'));
      await productsTable.add(createMockProduct('p2'));
      await productsTable.clear();

      const count = await productsTable.count();
      expect(count).toBe(0);
    });

    it('should update item', async () => {
      await productsTable.add(createMockProduct('p1'));
      await productsTable.update('p1', { name: 'Updated Product' });

      const updated = await productsTable.get('p1');
      expect(updated?.name).toBe('Updated Product');
    });

    // ============================================
    // ERROR CASES
    // ============================================
    it('should return undefined for non-existent key', async () => {
      const retrieved = await productsTable.get('non-existent');
      expect(retrieved).toBeUndefined();
    });

    it('should throw when adding without key', async () => {
      const item = { name: 'No ID' } as LocalProduct;
      await expect(productsTable.add(item)).rejects.toThrow('products: No key provided');
    });

    // ============================================
    // EDGE CASES
    // ============================================
    it('should handle concurrent adds', async () => {
      const items = Array.from({ length: 10 }, (_, i) => createMockProduct(`p${i}`));
      await Promise.all(items.map(p => productsTable.add(p)));

      const count = await productsTable.count();
      expect(count).toBe(10);
    });

    it('should update with partial data', async () => {
      await productsTable.add(createMockProduct('p1'));
      await productsTable.update('p1', { is_out_of_stock: true });

      const updated = await productsTable.get('p1');
      expect(updated?.name).toBe('Product p1'); // Original preserved
      expect(updated?.is_out_of_stock).toBe(true);
    });
  });

  describe('Query Operations', () => {
    // ============================================
    // HAPPY PATH
    // ============================================
    it('should get all items as array', async () => {
      await productsTable.add(createMockProduct('p1'));
      await productsTable.add(createMockProduct('p2'));

      const all = await productsTable.toArray();
      expect(all).toHaveLength(2);
    });

    it('should count items', async () => {
      await productsTable.add(createMockProduct('p1'));
      await productsTable.add(createMockProduct('p2'));

      const count = await productsTable.count();
      expect(count).toBe(2);
    });

    // ============================================
    // EDGE CASES
    // ============================================
    it('should return empty array when no data', async () => {
      const all = await productsTable.toArray();
      expect(all).toHaveLength(0);
    });
  });

  describe('Data Types', () => {
    // ============================================
    // EDGE CASES
    // ============================================
    it('should preserve numeric precision', async () => {
      const product = createMockProduct('p1');
      product.base_price = 123456789;
      await productsTable.add(product);

      const retrieved = await productsTable.get('p1');
      expect(retrieved?.base_price).toBe(123456789);
    });

    it('should handle unicode in strings', async () => {
      const product = createMockProduct('p1');
      product.name = 'Produk 中文 日本語 한국어 🎉';
      await productsTable.add(product);

      const retrieved = await productsTable.get('p1');
      expect(retrieved?.name).toContain('中文');
    });

    it('should handle timestamps', async () => {
      const order = createMockOrder('o1');
      const before = Date.now();
      await ordersTable.add(order);
      const after = Date.now();

      const retrieved = await ordersTable.get('o1');
      expect(retrieved?.created_at).toBeGreaterThanOrEqual(before);
      expect(retrieved?.created_at).toBeLessThanOrEqual(after);
    });

    it('should handle complex nested objects', async () => {
      const product = createMockProduct('p1');
      product.modifier_groups = [
        {
          id: 'mod-1',
          name: 'Size',
          is_required: true,
          max_selections: 1,
          is_active: true,
          options: [
            { id: 'opt-1', name: 'Small', additional_price: 0 },
            { id: 'opt-2', name: 'Large', additional_price: 5000 },
          ],
        },
      ];
      await productsTable.add(product);

      const retrieved = await productsTable.get('p1');
      expect(retrieved?.modifier_groups).toHaveLength(1);
      expect(retrieved?.modifier_groups[0].options).toHaveLength(2);
    });
  });
});

describe('Local Types', () => {
  // Verify that our type definitions work correctly

  it('should accept valid LocalProduct', () => {
    const product: LocalProduct = {
      id: 'p1',
      name: 'Test',
      base_price: 10000,
      category_id: 'cat1',
      is_out_of_stock: false,
      modifier_groups: [],
    };
    expect(product.id).toBe('p1');
  });

  it('should accept valid LocalOrder', () => {
    const order: LocalOrder = {
      client_uuid: 'uuid-123',
      kasir_id: 'kasir-1',
      subtotal: 50000,
      tax_total: 5500,
      final_price: 55500,
      payment_method: 'qris',
      status: 'completed',
      items: [],
      sync_status: 'pending',
      created_at: Date.now(),
    };
    expect(order.payment_method).toBe('qris');
  });

  it('should accept valid Discount', () => {
    const discount: Discount = {
      id: 'd1',
      name: 'Test Discount',
      type: 'percentage',
      value: 10,
      scope: 'all_products',
      is_active: true,
    };
    expect(discount.type).toBe('percentage');
  });

  it('should accept valid LocalCartItem', () => {
    const cartItem: LocalCartItem = {
      id: 'c1',
      items: [],
    };
    expect(cartItem.id).toBe('c1');
  });
});
