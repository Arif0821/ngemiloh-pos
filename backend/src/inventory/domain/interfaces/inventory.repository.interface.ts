import { RawMaterial, Order, StockMovement, Prisma } from '@prisma/client';

export const INVENTORY_REPOSITORY = 'INVENTORY_REPOSITORY';

export interface BatchRecord {
  id: string;
  raw_material_id: string;
  qty_remaining: number;
  expiry_date: Date | null;
  cost_per_unit: number;
}

export interface IInventoryRepository {
  executeInTransaction<T>(
    fn: (repo: IInventoryRepository) => Promise<T>,
  ): Promise<T>;

  findAllRawMaterials(): Promise<RawMaterial[]>;
  findActiveRawMaterials(): Promise<RawMaterial[]>;
  findRawMaterialById(id: string): Promise<RawMaterial | null>;
  findManyRawMaterialsByIds(ids: string[]): Promise<RawMaterial[]>;

  updateRawMaterialStock(
    id: string,
    amount: number,
    type: 'increment' | 'decrement' | 'set',
  ): Promise<RawMaterial>;

  createInventoryTransaction(data: {
    raw_material_id: string;
    qty: number;
    transaction_type: 'in' | 'out' | 'adjustment' | 'waste';
    notes: string;
    created_by?: string;
    reference_id?: string;
  }): Promise<StockMovement>;

  findOrderWithIngredients(orderId: string): Promise<unknown>;
  updateOrderCogs(orderId: string, cogsTotal: number): Promise<Order>;

  findAvailableBatches(rawMaterialId: string): Promise<BatchRecord[]>;
  decrementBatchStock(
    batchId: string,
    amount: number,
    createdBy?: string,
    referenceOrderId?: string,
  ): Promise<StockMovement | null>;

  createRawMaterial(
    data: Prisma.RawMaterialUncheckedCreateInput,
  ): Promise<RawMaterial>;
  updateRawMaterial(
    id: string,
    data: Prisma.RawMaterialUncheckedUpdateInput,
  ): Promise<RawMaterial>;
  createBomRecipe(data: Prisma.BomRecipeUncheckedCreateInput): Promise<unknown>;
  deleteBomRecipe(id: string): Promise<unknown>;

  /**
   * Find a stock movement by order ID and raw material
   * Used for tracking stock deductions for void/restore operations
   */
  findStockMovementByOrderId(
    orderId: string,
    rawMaterialId: string,
  ): Promise<StockMovement | null>;

  /**
   * Find waste movements for waste tracking history
   */
  findWasteMovements(limit?: number): Promise<unknown>;

  /**
   * Find BOM recipes for a specific product
   */
  findBomRecipesByProduct(productId: string): Promise<unknown>;

  /**
   * Update BOM recipe quantity
   */
  updateBomRecipe(id: string, quantity: number): Promise<unknown>;

  /**
   * Get BOM coverage statistics for products
   * Returns counts of products with/without BOM recipes
   */
  getBomCoverage(): Promise<{
    total_products: number;
    products_with_bom: number;
    products_missing_bom: number;
    coverage_percentage: number;
  }>;
}
