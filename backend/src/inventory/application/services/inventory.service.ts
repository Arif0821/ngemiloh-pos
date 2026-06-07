import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { INVENTORY_REPOSITORY, type IInventoryRepository } from '../../domain/interfaces/inventory.repository.interface';

@Injectable()
export class InventoryService {
  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: IInventoryRepository
  ) {}

  async getAllRawMaterials() {
    return this.inventoryRepository.findAllRawMaterials();
  }

  async createRawMaterial(data: any) {
    return this.inventoryRepository.createRawMaterial(data);
  }

  async updateRawMaterial(id: string, data: any) {
    return this.inventoryRepository.updateRawMaterial(id, data);
  }

  async createBomRecipe(data: any) {
    return this.inventoryRepository.createBomRecipe(data);
  }

  async deleteBomRecipe(id: string) {
    return this.inventoryRepository.deleteBomRecipe(id);
  }

  async getLowStockMaterials() {
    const all = await this.inventoryRepository.findActiveRawMaterials();
    return all.filter(m => Number(m.current_stock) <= Number(m.min_stock));
  }

  async adjustStock(id: string, qty: number, type: 'IN' | 'OUT', notes: string, userId: string) {
    const material = await this.inventoryRepository.findRawMaterialById(id);
    if (!material) throw new NotFoundException('Raw material not found');

    const amount = Number(qty);
    if (amount <= 0) throw new Error('Quantity must be greater than 0');

    return this.inventoryRepository.executeInTransaction(async (repo) => {
      await repo.createInventoryTransaction({
        raw_material_id: id,
        qty: amount,
        transaction_type: type,
        notes,
        created_by: userId
      });

      return repo.updateRawMaterialStock(
        id, 
        amount, 
        type === 'IN' ? 'increment' : 'decrement'
      );
    });
  }

  async submitOpname(items: { id: string, physical_stock: number }[], userId: string) {
    return this.inventoryRepository.executeInTransaction(async (repo) => {
      const results: any[] = [];
      for (const item of items) {
        const material = await repo.findRawMaterialById(item.id);
        if (!material) continue;

        const sysStock = Number(material.current_stock);
        const physStock = Number(item.physical_stock);
        const difference = physStock - sysStock;

        if (difference !== 0) {
          const type = difference > 0 ? 'IN' : 'OUT';
          const absDiff = Math.abs(difference);

          await repo.createInventoryTransaction({
            raw_material_id: item.id,
            qty: absDiff,
            transaction_type: type,
            notes: `Stock Opname. System: ${sysStock}, Physical: ${physStock}, Diff: ${difference}`,
            created_by: userId
          });

          await repo.updateRawMaterialStock(item.id, physStock, 'set');
          
          results.push({ id: item.id, updated: true, difference });
        }
      }
      return results;
    });
  }

  async reduceStockForOrder(orderId: string) {
    const order = await this.inventoryRepository.findOrderWithIngredients(orderId);
    if (!order) return;

    const rawMaterialDeductions: Record<string, number> = {};

    for (const item of order.items) {
      const qtySold = item.quantity;
      if (item.product.bom_recipes) {
        for (const ingredient of item.product.bom_recipes) {
          const totalQtyRequired = Number(ingredient.quantity_per_serving) * qtySold;
          if (!rawMaterialDeductions[ingredient.raw_material_id]) {
            rawMaterialDeductions[ingredient.raw_material_id] = 0;
          }
          rawMaterialDeductions[ingredient.raw_material_id] += totalQtyRequired;
        }
      }
    }

    if (Object.keys(rawMaterialDeductions).length > 0) {
      await this.inventoryRepository.executeInTransaction(async (repo) => {
        let totalCogs = 0;

        for (const [rawMaterialId, qty] of Object.entries(rawMaterialDeductions)) {
          let qtyToDeduct = qty;
          
          const batches = await repo.findAvailableBatches(rawMaterialId);

          for (const batch of batches) {
            if (qtyToDeduct <= 0) break;

            const remainingInBatch = Number(batch.qty_remaining);
            const qtyFromThisBatch = Math.min(qtyToDeduct, remainingInBatch);
            
            await repo.decrementBatchStock(batch.id, qtyFromThisBatch);

            totalCogs += (qtyFromThisBatch * Number(batch.cost_per_unit));
            qtyToDeduct -= qtyFromThisBatch;
          }

          if (qtyToDeduct > 0) {
             const rm = await repo.findRawMaterialById(rawMaterialId);
             totalCogs += (qtyToDeduct * Number(rm?.cost_per_unit || 0));
          }

          await repo.createInventoryTransaction({
            raw_material_id: rawMaterialId,
            qty: qty,
            transaction_type: 'OUT',
            reference_id: order.id,
            notes: `Auto-deduct for Order ${order.id}`
          });
          
          await repo.updateRawMaterialStock(rawMaterialId, qty, 'decrement');
        }

        await repo.updateOrderCogs(order.id, totalCogs);
      });
    }
  }
}
