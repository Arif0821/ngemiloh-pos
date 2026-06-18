import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { InventoryService } from './inventory.service';
import { INVENTORY_REPOSITORY } from '../../domain/interfaces/inventory.repository.interface';

const mockRepository = {
  findAllRawMaterials: jest.fn(),
  findActiveRawMaterials: jest.fn(),
  findRawMaterialById: jest.fn(),
  findOrderWithIngredients: jest.fn(),
  createRawMaterial: jest.fn(),
  createBomRecipe: jest.fn(),
  deleteBomRecipe: jest.fn(),
  updateRawMaterial: jest.fn(),
  executeInTransaction: jest.fn(),
  createInventoryTransaction: jest.fn(),
  updateRawMaterialStock: jest.fn(),
  findManyRawMaterialsByIds: jest.fn(),
  findAvailableBatches: jest.fn(),
  decrementBatchStock: jest.fn(),
  updateOrderCogs: jest.fn(),
  findStockMovementByOrderId: jest.fn(),
};

describe('InventoryService', () => {
  let service: InventoryService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        { provide: INVENTORY_REPOSITORY, useValue: mockRepository },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  describe('getAllRawMaterials', () => {
    it('should return all raw materials', async () => {
      const mockMaterials = [
        { id: 'rm-1', name: 'Flour', current_stock: 100 },
        { id: 'rm-2', name: 'Sugar', current_stock: 50 },
      ];
      mockRepository.findAllRawMaterials.mockResolvedValue(mockMaterials);

      const result = await service.getAllRawMaterials();

      expect(result).toEqual(mockMaterials);
      expect(mockRepository.findAllRawMaterials).toHaveBeenCalled();
    });
  });

  describe('createRawMaterial', () => {
    it('should create a raw material', async () => {
      const input = { name: 'Flour', current_stock: 100 };
      const mockResult = { id: 'rm-1', ...input };
      mockRepository.createRawMaterial.mockResolvedValue(mockResult);

      const result = await service.createRawMaterial(input);

      expect(result).toEqual(mockResult);
      expect(mockRepository.createRawMaterial).toHaveBeenCalledWith(input);
    });
  });

  describe('updateRawMaterial', () => {
    it('should update a raw material', async () => {
      const id = 'rm-1';
      const data = { name: 'Updated Flour' };
      const mockResult = { id, name: 'Updated Flour', current_stock: 100 };
      mockRepository.updateRawMaterial.mockResolvedValue(mockResult);

      const result = await service.updateRawMaterial(id, data);

      expect(result).toEqual(mockResult);
      expect(mockRepository.updateRawMaterial).toHaveBeenCalledWith(id, data);
    });
  });

  describe('createBomRecipe', () => {
    it('should create a BOM recipe', async () => {
      const input = { product_id: 'p-1', raw_material_id: 'rm-1' };
      const mockResult = { id: 'bom-1', ...input };
      mockRepository.createBomRecipe.mockResolvedValue(mockResult);

      const result = await service.createBomRecipe(input);

      expect(result).toEqual(mockResult);
      expect(mockRepository.createBomRecipe).toHaveBeenCalledWith(input);
    });
  });

  describe('deleteBomRecipe', () => {
    it('should delete a BOM recipe', async () => {
      const id = 'bom-1';
      mockRepository.deleteBomRecipe.mockResolvedValue({ id });

      await service.deleteBomRecipe(id);

      expect(mockRepository.deleteBomRecipe).toHaveBeenCalledWith(id);
    });
  });

  describe('getLowStockMaterials', () => {
    it('should return materials where current_stock <= min_stock', async () => {
      const mockMaterials = [
        { id: 'rm-1', name: 'Flour', current_stock: 10, min_stock: 20 },
        { id: 'rm-2', name: 'Sugar', current_stock: 50, min_stock: 10 },
        { id: 'rm-3', name: 'Salt', current_stock: 5, min_stock: 5 },
      ];
      mockRepository.findActiveRawMaterials.mockResolvedValue(mockMaterials);

      const result = await service.getLowStockMaterials();

      // Should include Flour (10 <= 20) and Salt (5 <= 5), but not Sugar (50 > 10)
      expect(result).toHaveLength(2);
      expect(result.map((m) => m.id)).toContain('rm-1');
      expect(result.map((m) => m.id)).toContain('rm-3');
    });

    it('should return empty array when all materials are above min_stock', async () => {
      const mockMaterials = [
        { id: 'rm-1', name: 'Flour', current_stock: 100, min_stock: 20 },
        { id: 'rm-2', name: 'Sugar', current_stock: 50, min_stock: 10 },
      ];
      mockRepository.findActiveRawMaterials.mockResolvedValue(mockMaterials);

      const result = await service.getLowStockMaterials();

      expect(result).toHaveLength(0);
    });

    it('should return empty array when no materials exist', async () => {
      mockRepository.findActiveRawMaterials.mockResolvedValue([]);

      const result = await service.getLowStockMaterials();

      expect(result).toHaveLength(0);
    });
  });

  describe('adjustStock', () => {
    it('should throw NotFoundException when raw material not found', async () => {
      mockRepository.findRawMaterialById.mockResolvedValue(null);

      await expect(
        service.adjustStock('rm-invalid', 10, 'in', 'test', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when quantity is zero or negative', async () => {
      mockRepository.findRawMaterialById.mockResolvedValue({ id: 'rm-1' });

      await expect(
        service.adjustStock('rm-1', 0, 'in', 'test', 'user-1'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.adjustStock('rm-1', -5, 'in', 'test', 'user-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should increment stock when type is "in"', async () => {
      const mockMaterial = { id: 'rm-1', name: 'Flour', current_stock: 100 };
      const mockUpdated = { ...mockMaterial, current_stock: 110 };
      mockRepository.findRawMaterialById.mockResolvedValue(mockMaterial);
      mockRepository.executeInTransaction.mockImplementation(async (fn) => {
        return fn(mockRepository);
      });
      mockRepository.createInventoryTransaction.mockResolvedValue({ id: 'tx-1' });
      mockRepository.updateRawMaterialStock.mockResolvedValue(mockUpdated);

      const result = await service.adjustStock('rm-1', 10, 'in', 'Restock', 'user-1');

      expect(result).toEqual(mockUpdated);
      expect(mockRepository.createInventoryTransaction).toHaveBeenCalledWith({
        raw_material_id: 'rm-1',
        qty: 10,
        transaction_type: 'in',
        notes: 'Restock',
        created_by: 'user-1',
      });
      expect(mockRepository.updateRawMaterialStock).toHaveBeenCalledWith(
        'rm-1',
        10,
        'increment',
      );
    });

    it('should decrement stock when type is "out"', async () => {
      const mockMaterial = { id: 'rm-1', name: 'Flour', current_stock: 100 };
      const mockUpdated = { ...mockMaterial, current_stock: 90 };
      mockRepository.findRawMaterialById.mockResolvedValue(mockMaterial);
      mockRepository.executeInTransaction.mockImplementation(async (fn) => {
        return fn(mockRepository);
      });
      mockRepository.createInventoryTransaction.mockResolvedValue({ id: 'tx-1' });
      mockRepository.updateRawMaterialStock.mockResolvedValue(mockUpdated);

      const result = await service.adjustStock('rm-1', 10, 'out', 'Used', 'user-1');

      expect(result).toEqual(mockUpdated);
      expect(mockRepository.updateRawMaterialStock).toHaveBeenCalledWith(
        'rm-1',
        10,
        'decrement',
      );
    });

    it('should decrement stock when type is "waste"', async () => {
      const mockMaterial = { id: 'rm-1', name: 'Flour', current_stock: 100 };
      const mockUpdated = { ...mockMaterial, current_stock: 95 };
      mockRepository.findRawMaterialById.mockResolvedValue(mockMaterial);
      mockRepository.executeInTransaction.mockImplementation(async (fn) => {
        return fn(mockRepository);
      });
      mockRepository.createInventoryTransaction.mockResolvedValue({ id: 'tx-1' });
      mockRepository.updateRawMaterialStock.mockResolvedValue(mockUpdated);

      await service.adjustStock('rm-1', 5, 'waste', 'Spoiled', 'user-1');

      expect(mockRepository.updateRawMaterialStock).toHaveBeenCalledWith(
        'rm-1',
        5,
        'decrement',
      );
    });

    it('should decrement stock when type is "adjustment"', async () => {
      const mockMaterial = { id: 'rm-1', name: 'Flour', current_stock: 100 };
      const mockUpdated = { ...mockMaterial, current_stock: 90 };
      mockRepository.findRawMaterialById.mockResolvedValue(mockMaterial);
      mockRepository.executeInTransaction.mockImplementation(async (fn) => {
        return fn(mockRepository);
      });
      mockRepository.createInventoryTransaction.mockResolvedValue({ id: 'tx-1' });
      mockRepository.updateRawMaterialStock.mockResolvedValue(mockUpdated);

      await service.adjustStock('rm-1', 10, 'adjustment', 'Count correction', 'user-1');

      expect(mockRepository.updateRawMaterialStock).toHaveBeenCalledWith(
        'rm-1',
        10,
        'decrement',
      );
    });
  });

  describe('submitOpname', () => {
    it('should process stock opname and update mismatched materials', async () => {
      const mockMaterials = [
        { id: 'rm-1', current_stock: 100 },
        { id: 'rm-2', current_stock: 50 },
      ];
      const items = [
        { id: 'rm-1', physical_stock: 95 }, // -5 difference
        { id: 'rm-2', physical_stock: 50 }, // no difference
      ];
      const mockUpdated = { id: 'rm-1', current_stock: 95 };

      mockRepository.executeInTransaction.mockImplementation(async (fn) => {
        return fn(mockRepository);
      });
      mockRepository.findManyRawMaterialsByIds.mockResolvedValue(mockMaterials);
      mockRepository.createInventoryTransaction.mockResolvedValue({ id: 'tx-1' });
      mockRepository.updateRawMaterialStock.mockResolvedValue(mockUpdated);

      const result = await service.submitOpname(items, 'user-1');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ id: 'rm-1', updated: true, difference: -5 });
      expect(mockRepository.createInventoryTransaction).toHaveBeenCalledWith({
        raw_material_id: 'rm-1',
        qty: 5,
        transaction_type: 'out',
        notes: 'Stock Opname. System: 100, Physical: 95, Diff: -5',
        created_by: 'user-1',
      });
      expect(mockRepository.updateRawMaterialStock).toHaveBeenCalledWith(
        'rm-1',
        95,
        'set',
      );
    });

    it('should handle positive difference (physical > system)', async () => {
      const mockMaterials = [{ id: 'rm-1', current_stock: 100 }];
      const items = [{ id: 'rm-1', physical_stock: 110 }];
      const mockUpdated = { id: 'rm-1', current_stock: 110 };

      mockRepository.executeInTransaction.mockImplementation(async (fn) => {
        return fn(mockRepository);
      });
      mockRepository.findManyRawMaterialsByIds.mockResolvedValue(mockMaterials);
      mockRepository.createInventoryTransaction.mockResolvedValue({ id: 'tx-1' });
      mockRepository.updateRawMaterialStock.mockResolvedValue(mockUpdated);

      const result = await service.submitOpname(items, 'user-1');

      expect(result).toHaveLength(1);
      expect(result[0].difference).toBe(10);
      expect(mockRepository.createInventoryTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          transaction_type: 'in',
          qty: 10,
        }),
      );
    });

    it('should skip materials not found in database', async () => {
      const mockMaterials = [{ id: 'rm-1', current_stock: 100 }];
      const items = [
        { id: 'rm-1', physical_stock: 95 },
        { id: 'rm-invalid', physical_stock: 50 },
      ];

      mockRepository.executeInTransaction.mockImplementation(async (fn) => {
        return fn(mockRepository);
      });
      mockRepository.findManyRawMaterialsByIds.mockResolvedValue(mockMaterials);

      const result = await service.submitOpname(items, 'user-1');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('rm-1');
    });

    it('should return empty results when all stocks match', async () => {
      const mockMaterials = [
        { id: 'rm-1', current_stock: 100 },
        { id: 'rm-2', current_stock: 50 },
      ];
      const items = [
        { id: 'rm-1', physical_stock: 100 },
        { id: 'rm-2', physical_stock: 50 },
      ];

      mockRepository.executeInTransaction.mockImplementation(async (fn) => {
        return fn(mockRepository);
      });
      mockRepository.findManyRawMaterialsByIds.mockResolvedValue(mockMaterials);

      const result = await service.submitOpname(items, 'user-1');

      expect(result).toHaveLength(0);
      expect(mockRepository.createInventoryTransaction).not.toHaveBeenCalled();
      expect(mockRepository.updateRawMaterialStock).not.toHaveBeenCalled();
    });
  });

  describe('reduceStockForOrder', () => {
    it('should do nothing when order is not found', async () => {
      mockRepository.findOrderWithIngredients.mockResolvedValue(null);

      await service.reduceStockForOrder('order-invalid');

      expect(mockRepository.executeInTransaction).not.toHaveBeenCalled();
    });

    it('should reduce stock based on BOM recipes', async () => {
      const mockOrder = {
        id: 'order-1',
        items: [
          {
            quantity: 2,
            product: {
              bom_recipes: [
                { raw_material_id: 'rm-1', quantity_per_serving: 10 },
                { raw_material_id: 'rm-2', quantity_per_serving: 5 },
              ],
            },
          },
        ],
      };
      const mockBatches = [
        { id: 'batch-1', raw_material_id: 'rm-1', qty_remaining: 15, cost_per_unit: 1000 },
        { id: 'batch-2', raw_material_id: 'rm-2', qty_remaining: 10, cost_per_unit: 2000 },
      ];

      mockRepository.findOrderWithIngredients.mockResolvedValue(mockOrder);
      mockRepository.executeInTransaction.mockImplementation(async (fn) => {
        return fn(mockRepository);
      });
      mockRepository.findAvailableBatches.mockResolvedValue(mockBatches);
      mockRepository.decrementBatchStock.mockResolvedValue({ id: 'mv-1' });
      mockRepository.createInventoryTransaction.mockResolvedValue({ id: 'tx-1' });
      mockRepository.updateRawMaterialStock.mockResolvedValue({ id: 'rm-1', current_stock: 0 });
      mockRepository.updateOrderCogs.mockResolvedValue({ id: 'order-1' });

      await service.reduceStockForOrder('order-1');

      // 2 items * 10 = 20 units for rm-1, 2 items * 5 = 10 units for rm-2
      expect(mockRepository.createInventoryTransaction).toHaveBeenCalledTimes(2);
      expect(mockRepository.updateRawMaterialStock).toHaveBeenCalledTimes(2);
      expect(mockRepository.updateOrderCogs).toHaveBeenCalledWith('order-1', expect.any(Number));
    });

    it('should skip items without BOM recipes', async () => {
      const mockOrder = {
        id: 'order-1',
        items: [
          {
            quantity: 1,
            product: {
              bom_recipes: null,
            },
          },
        ],
      };

      mockRepository.findOrderWithIngredients.mockResolvedValue(mockOrder);
      mockRepository.executeInTransaction.mockImplementation(async (fn) => {
        return fn(mockRepository);
      });
      mockRepository.createInventoryTransaction.mockResolvedValue({ id: 'tx-1' });
      mockRepository.updateRawMaterialStock.mockResolvedValue({ id: 'rm-1' });
      mockRepository.updateOrderCogs.mockResolvedValue({ id: 'order-1' });

      await service.reduceStockForOrder('order-1');

      expect(mockRepository.createInventoryTransaction).not.toHaveBeenCalled();
      expect(mockRepository.updateRawMaterialStock).not.toHaveBeenCalled();
    });

    it('should calculate COGS from batch costs', async () => {
      const mockOrder = {
        id: 'order-1',
        items: [
          {
            quantity: 1,
            product: {
              bom_recipes: [
                // Use Prisma Decimal-compatible values: plain number works with Number()
                { raw_material_id: 'rm-1', quantity_per_serving: 5 },
              ],
            },
          },
        ],
      };
      const mockBatches = [
        { id: 'batch-1', raw_material_id: 'rm-1', qty_remaining: 10, cost_per_unit: 1000 },
      ];

      mockRepository.findOrderWithIngredients.mockResolvedValue(mockOrder);
      mockRepository.executeInTransaction.mockImplementation(async (fn) => {
        return fn(mockRepository);
      });
      mockRepository.findAvailableBatches.mockResolvedValue(mockBatches);
      mockRepository.decrementBatchStock.mockResolvedValue({ id: 'mv-1' });
      mockRepository.createInventoryTransaction.mockResolvedValue({ id: 'tx-1' });
      mockRepository.updateRawMaterialStock.mockResolvedValue({ id: 'rm-1', current_stock: 0 });
      mockRepository.updateOrderCogs.mockResolvedValue({ id: 'order-1' });

      await service.reduceStockForOrder('order-1');

      // COGS = 5 units * 1000 = 5000
      expect(mockRepository.updateOrderCogs).toHaveBeenCalledWith('order-1', 5000);
    });

    it('should handle remaining stock not covered by batches', async () => {
      const mockOrder = {
        id: 'order-1',
        items: [
          {
            quantity: 5,
            product: {
              bom_recipes: [
                { raw_material_id: 'rm-1', quantity_per_serving: 10 }, // 50 total
              ],
            },
          },
        ],
      };
      // Only 20 units available in batches
      const mockBatches = [
        { id: 'batch-1', raw_material_id: 'rm-1', qty_remaining: 20, cost_per_unit: 1000 },
      ];

      mockRepository.findOrderWithIngredients.mockResolvedValue(mockOrder);
      mockRepository.executeInTransaction.mockImplementation(async (fn) => {
        return fn(mockRepository);
      });
      mockRepository.findAvailableBatches.mockResolvedValue(mockBatches);
      mockRepository.decrementBatchStock.mockResolvedValue({ id: 'mv-1' });
      mockRepository.findRawMaterialById.mockResolvedValue({
        id: 'rm-1',
        cost_per_unit: 1500,
      });
      mockRepository.createInventoryTransaction.mockResolvedValue({ id: 'tx-1' });
      mockRepository.updateRawMaterialStock.mockResolvedValue({ id: 'rm-1', current_stock: 0 });
      mockRepository.updateOrderCogs.mockResolvedValue({ id: 'order-1' });

      await service.reduceStockForOrder('order-1');

      // COGS = (20 * 1000) + (30 * 1500) = 20000 + 45000 = 65000
      expect(mockRepository.updateOrderCogs).toHaveBeenCalledWith('order-1', 65000);
    });
  });

  describe('restoreStockForOrder', () => {
    it('should do nothing when order is not found', async () => {
      mockRepository.findOrderWithIngredients.mockResolvedValue(null);

      await service.restoreStockForOrder('order-invalid');

      expect(mockRepository.executeInTransaction).not.toHaveBeenCalled();
    });

    it('should restore stock for voided order', async () => {
      const mockOrder = {
        id: 'order-1',
        items: [
          {
            quantity: 2,
            product: {
              bom_recipes: [
                { raw_material_id: 'rm-1', quantity_per_serving: 10 },
              ],
            },
          },
        ],
      };

      mockRepository.findOrderWithIngredients.mockResolvedValue(mockOrder);
      mockRepository.executeInTransaction.mockImplementation(async (fn) => {
        return fn(mockRepository);
      });
      mockRepository.findStockMovementByOrderId.mockResolvedValue({ id: 'mv-1' });
      mockRepository.createInventoryTransaction.mockResolvedValue({ id: 'tx-1' });
      mockRepository.updateRawMaterialStock.mockResolvedValue({ id: 'rm-1', current_stock: 120 });

      await service.restoreStockForOrder('order-1');

      // 2 items * 10 = 20 units to restore
      expect(mockRepository.createInventoryTransaction).toHaveBeenCalledWith({
        raw_material_id: 'rm-1',
        qty: 20,
        transaction_type: 'in',
        reference_id: 'order-1',
        notes: 'Auto-restore for voided Order order-1',
      });
      expect(mockRepository.updateRawMaterialStock).toHaveBeenCalledWith(
        'rm-1',
        20,
        'increment',
      );
    });

    it('should restore stock even without original stock movement', async () => {
      const mockOrder = {
        id: 'order-1',
        items: [
          {
            quantity: 1,
            product: {
              bom_recipes: [
                { raw_material_id: 'rm-1', quantity_per_serving: 5 },
              ],
            },
          },
        ],
      };

      mockRepository.findOrderWithIngredients.mockResolvedValue(mockOrder);
      mockRepository.executeInTransaction.mockImplementation(async (fn) => {
        return fn(mockRepository);
      });
      mockRepository.findStockMovementByOrderId.mockResolvedValue(null);
      mockRepository.createInventoryTransaction.mockResolvedValue({ id: 'tx-1' });
      mockRepository.updateRawMaterialStock.mockResolvedValue({ id: 'rm-1', current_stock: 105 });

      await service.restoreStockForOrder('order-1');

      // Note: createInventoryTransaction is only called when stockMovement exists
      // But updateRawMaterialStock is always called to restore the stock
      expect(mockRepository.createInventoryTransaction).not.toHaveBeenCalled();
      expect(mockRepository.updateRawMaterialStock).toHaveBeenCalledWith(
        'rm-1',
        5,
        'increment',
      );
    });

    it('should skip items without BOM recipes', async () => {
      const mockOrder = {
        id: 'order-1',
        items: [
          {
            quantity: 1,
            product: {
              bom_recipes: null,
            },
          },
        ],
      };

      mockRepository.findOrderWithIngredients.mockResolvedValue(mockOrder);
      mockRepository.executeInTransaction.mockImplementation(async (fn) => {
        return fn(mockRepository);
      });
      mockRepository.createInventoryTransaction.mockResolvedValue({ id: 'tx-1' });
      mockRepository.updateRawMaterialStock.mockResolvedValue({ id: 'rm-1' });

      await service.restoreStockForOrder('order-1');

      expect(mockRepository.createInventoryTransaction).not.toHaveBeenCalled();
      expect(mockRepository.updateRawMaterialStock).not.toHaveBeenCalled();
    });

    it('should handle multiple items with multiple ingredients', async () => {
      const mockOrder = {
        id: 'order-1',
        items: [
          {
            quantity: 2,
            product: {
              bom_recipes: [
                { raw_material_id: 'rm-1', quantity_per_serving: 10 },
                { raw_material_id: 'rm-2', quantity_per_serving: 5 },
              ],
            },
          },
          {
            quantity: 3,
            product: {
              bom_recipes: [
                { raw_material_id: 'rm-1', quantity_per_serving: 10 },
              ],
            },
          },
        ],
      };

      mockRepository.findOrderWithIngredients.mockResolvedValue(mockOrder);
      mockRepository.executeInTransaction.mockImplementation(async (fn) => {
        return fn(mockRepository);
      });
      mockRepository.findStockMovementByOrderId.mockResolvedValue({ id: 'mv-1' });
      mockRepository.createInventoryTransaction.mockResolvedValue({ id: 'tx-1' });
      mockRepository.updateRawMaterialStock.mockResolvedValue({ id: 'rm-1', current_stock: 100 });

      await service.restoreStockForOrder('order-1');

      // rm-1: (2 * 10) + (3 * 10) = 50
      // rm-2: (2 * 5) = 10
      expect(mockRepository.createInventoryTransaction).toHaveBeenCalledTimes(2);
    });
  });
});
