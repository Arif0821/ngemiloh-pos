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
}
