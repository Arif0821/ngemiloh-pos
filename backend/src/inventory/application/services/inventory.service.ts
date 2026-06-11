import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { INVENTORY_REPOSITORY, type IInventoryRepository } from '../../domain/interfaces/inventory.repository.interface';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

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

      // PERFORMANCE: Fetch all materials at once instead of N queries
      const materialIds = items.map(i => i.id);
      const materials = await repo.findManyRawMaterialsByIds(materialIds);
      const materialMap = new Map(materials.map(m => [m.id, m]));

      for (const item of items) {
        const material = materialMap.get(item.id);
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
    await this.inventoryRepository.executeInTransaction(async (repo) => {
      let totalCogs = 0;
      const deductions: Record<string, number> = {};
      for (const item of order.items) {
        if (!item.product.bom_recipes) continue;
        for (const ingredient of item.product.bom_recipes) {
          deductions[ingredient.raw_material_id] = (deductions[ingredient.raw_material_id] || 0)
            + Number(ingredient.quantity_per_serving) * item.quantity;
        }
      }
      for (const [rawMaterialId, qty] of Object.entries(deductions)) {
        let remaining = qty;
        for (const batch of await repo.findAvailableBatches(rawMaterialId)) {
          if (remaining <= 0) break;
          const used = Math.min(remaining, Number(batch.qty_remaining));
          await repo.decrementBatchStock(batch.id, used);
          totalCogs += used * Number(batch.cost_per_unit);
          remaining -= used;
        }
        if (remaining > 0) {
          const rm = await repo.findRawMaterialById(rawMaterialId);
          if (rm) {
            totalCogs += remaining * Number(rm.cost_per_unit || 0);
          } else {
            this.logger.warn(`Raw material ${rawMaterialId} not found for COGS calculation`);
          }
        }
        await repo.createInventoryTransaction({ raw_material_id: rawMaterialId, qty, transaction_type: 'OUT', reference_id: orderId, notes: `Auto-deduct for Order ${orderId}` });
        await repo.updateRawMaterialStock(rawMaterialId, qty, 'decrement');
      }
      await repo.updateOrderCogs(orderId, totalCogs);
    });
  }
}
