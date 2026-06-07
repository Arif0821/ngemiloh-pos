import { RawMaterial, Order, StockMovement } from '@prisma/client';

export const INVENTORY_REPOSITORY = 'INVENTORY_REPOSITORY';

export interface IInventoryRepository {
  executeInTransaction<T>(fn: (repo: IInventoryRepository) => Promise<T>): Promise<T>;

  findAllRawMaterials(): Promise<RawMaterial[]>;
  findActiveRawMaterials(): Promise<RawMaterial[]>;
  findRawMaterialById(id: string): Promise<RawMaterial | null>;
  
  updateRawMaterialStock(id: string, amount: number, type: 'increment' | 'decrement' | 'set'): Promise<RawMaterial>;
  
  createInventoryTransaction(data: {
    raw_material_id: string;
    qty: number;
    transaction_type: string;
    notes: string;
    created_by?: string;
    reference_id?: string;
  }): Promise<StockMovement>;

  findOrderWithIngredients(orderId: string): Promise<any>;
  updateOrderCogs(orderId: string, cogsTotal: number): Promise<Order>;

  findAvailableBatches(rawMaterialId: string): Promise<any[]>;
  decrementBatchStock(batchId: string, amount: number): Promise<any>;

  createRawMaterial(data: any): Promise<RawMaterial>;
  updateRawMaterial(id: string, data: any): Promise<RawMaterial>;
  createBomRecipe(data: any): Promise<any>;
  deleteBomRecipe(id: string): Promise<any>;
}
