import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  INVENTORY_REPOSITORY,
  type IInventoryRepository,
} from '../../domain/interfaces/inventory.repository.interface';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @Inject(INVENTORY_REPOSITORY)
    private readonly inventoryRepository: IInventoryRepository,
    private readonly prisma: PrismaService,
  ) {}

  async getAllRawMaterials() {
    return this.inventoryRepository.findAllRawMaterials();
  }

  async createRawMaterial(data: Prisma.RawMaterialUncheckedCreateInput) {
    return this.inventoryRepository.createRawMaterial(data);
  }

  async updateRawMaterial(
    id: string,
    data: Prisma.RawMaterialUncheckedUpdateInput,
  ) {
    return this.inventoryRepository.updateRawMaterial(id, data);
  }

  async createBomRecipe(data: Prisma.BomRecipeUncheckedCreateInput) {
    return this.inventoryRepository.createBomRecipe(data);
  }

  async deleteBomRecipe(id: string) {
    return this.inventoryRepository.deleteBomRecipe(id);
  }

  async getLowStockMaterials() {
    const all = await this.inventoryRepository.findActiveRawMaterials();
    return all.filter((m) => Number(m.current_stock) <= Number(m.min_stock));
  }

  async adjustStock(
    id: string,
    qty: number,
    type: 'in' | 'out' | 'adjustment' | 'waste',
    notes: string,
    userId: string,
  ) {
    const material = await this.inventoryRepository.findRawMaterialById(id);
    if (!material) throw new NotFoundException('Raw material not found');

    const amount = Number(qty);
    if (amount <= 0) {
      throw new BadRequestException('Quantity must be greater than 0');
    }

    return this.inventoryRepository.executeInTransaction(async (repo) => {
      await repo.createInventoryTransaction({
        raw_material_id: id,
        qty: amount,
        transaction_type: type,
        notes,
        created_by: userId,
      });

      return repo.updateRawMaterialStock(
        id,
        amount,
        type === 'in' ? 'increment' : 'decrement',
      );
    });
  }

  async submitOpname(
    items: { id: string; physical_stock: number }[],
    userId: string,
  ) {
    return this.inventoryRepository.executeInTransaction(async (repo) => {
      const results: Array<{
        id: string;
        updated: boolean;
        difference: number;
      }> = [];

      const materialIds = items.map((i) => i.id);
      const materials = await repo.findManyRawMaterialsByIds(materialIds);
      const materialMap = new Map(materials.map((m) => [m.id, m]));

      for (const item of items) {
        const material = materialMap.get(item.id);
        if (!material) continue;

        const sysStock = Number(material.current_stock);
        const physStock = Number(item.physical_stock);
        const difference = physStock - sysStock;

        if (difference !== 0) {
          const type = difference > 0 ? 'in' : 'out';
          const absDiff = Math.abs(difference);

          await repo.createInventoryTransaction({
            raw_material_id: item.id,
            qty: absDiff,
            transaction_type: type,
            notes: `Stock Opname. System: ${sysStock}, Physical: ${physStock}, Diff: ${difference}`,
            created_by: userId,
          });

          await repo.updateRawMaterialStock(item.id, physStock, 'set');

          results.push({ id: item.id, updated: true, difference });
        }
      }
      return results;
    });
  }

  async reduceStockForOrder(orderId: string) {
    const order = (await this.inventoryRepository.findOrderWithIngredients(
      orderId,
    )) as {
      items: Array<{
        quantity: number;
        product: {
          bom_recipes: Array<{
            raw_material_id: string;
            quantity_per_serving: { toNumber(): number };
          }>;
        };
      }>;
    } | null;
    if (!order) {
      this.logger.warn(`Order ${orderId} not found for stock reduction`);
      return;
    }

    // Use advisory lock to prevent race conditions when multiple orders are processed
    // concurrently. Each raw material gets its own lock to allow parallel processing
    // of different materials.
    const lockKey = `stock:reduce:${orderId}`;
    const lockId = this.hashStringToBigInt(lockKey);
    const maxRetries = 5;
    const retryDelayMs = 50;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const lockAcquired = await this.prisma
        .$executeRaw<number>`SELECT pg_try_advisory_lock(${lockId})`;

      if (lockAcquired === 1) {
        try {
          await this.inventoryRepository.executeInTransaction(async (repo) => {
            let totalCogs = 0;
            const deductions: Record<string, number> = {};
            for (const item of order.items) {
              if (!item.product.bom_recipes) continue;
              for (const ingredient of item.product.bom_recipes) {
                deductions[ingredient.raw_material_id] =
                  (deductions[ingredient.raw_material_id] || 0) +
                  Number(ingredient.quantity_per_serving) * item.quantity;
              }
            }
            for (const [rawMaterialId, qty] of Object.entries(deductions)) {
              let remaining = qty;
              for (const batch of await repo.findAvailableBatches(
                rawMaterialId,
              )) {
                if (remaining <= 0) break;
                const used = Math.min(remaining, Number(batch.qty_remaining));
                await repo.decrementBatchStock(
                  batch.id,
                  used,
                  undefined,
                  orderId,
                );
                totalCogs += used * Number(batch.cost_per_unit);
                remaining -= used;
              }
              if (remaining > 0) {
                const rm = await repo.findRawMaterialById(rawMaterialId);
                if (rm) {
                  totalCogs += remaining * Number(rm.cost_per_unit || 0);
                } else {
                  this.logger.warn(
                    `Raw material ${rawMaterialId} not found for COGS calculation`,
                  );
                }
              }
              await repo.createInventoryTransaction({
                raw_material_id: rawMaterialId,
                qty,
                transaction_type: 'out',
                reference_id: orderId,
                notes: `Auto-deduct for Order ${orderId}`,
              });
              await repo.updateRawMaterialStock(
                rawMaterialId,
                qty,
                'decrement',
              );
            }
            await repo.updateOrderCogs(orderId, totalCogs);
          });
        } finally {
          // Always release the lock
          await this.prisma.$executeRaw`SELECT pg_advisory_unlock(${lockId})`;
        }
        return; // Success - exit retry loop
      }

      // Lock not acquired, retry
      if (attempt < maxRetries) {
        const jitter = Math.floor(Math.random() * 30);
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelayMs + jitter),
        );
      }
    }

    this.logger.error(
      `Failed to acquire advisory lock for stock reduction on order ${orderId}`,
    );
  }

  /**
   * Convert string to bigint for PostgreSQL advisory lock
   */
  private hashStringToBigInt(str: string): bigint {
    let hash = 2166136261n;
    for (let i = 0; i < str.length; i++) {
      hash ^= BigInt(str.charCodeAt(i));
      hash *= 16777619n;
    }
    return hash & 0x7fffffffffffffffn;
  }

  /**
   * Restore inventory stock when an order is voided
   * This reverses the stock deduction made during order creation
   */
  async restoreStockForOrder(orderId: string) {
    const order = (await this.inventoryRepository.findOrderWithIngredients(
      orderId,
    )) as {
      items: Array<{
        quantity: number;
        product: {
          bom_recipes: Array<{
            raw_material_id: string;
            quantity_per_serving: { toNumber(): number };
          }>;
        };
      }>;
    } | null;

    if (!order) {
      this.logger.warn(`Order ${orderId} not found for stock restoration`);
      return;
    }

    await this.inventoryRepository.executeInTransaction(async (repo) => {
      const restorations: Record<string, number> = {};

      // Calculate total quantity to restore per raw material
      for (const item of order.items) {
        if (!item.product.bom_recipes) continue;
        for (const ingredient of item.product.bom_recipes) {
          restorations[ingredient.raw_material_id] =
            (restorations[ingredient.raw_material_id] || 0) +
            Number(ingredient.quantity_per_serving) * item.quantity;
        }
      }

      // Restore stock for each raw material
      for (const [rawMaterialId, qty] of Object.entries(restorations)) {
        // Find the stock movement that deducted this quantity
        const stockMovement = await repo.findStockMovementByOrderId(
          orderId,
          rawMaterialId,
        );

        if (stockMovement) {
          // Restore from the original stock movement reference
          await repo.createInventoryTransaction({
            raw_material_id: rawMaterialId,
            qty,
            transaction_type: 'in',
            reference_id: orderId,
            notes: `Auto-restore for voided Order ${orderId}`,
          });
        }

        // Restore stock to raw material
        await repo.updateRawMaterialStock(rawMaterialId, qty, 'increment');

        this.logger.log(
          `Restored ${qty} units of raw material ${rawMaterialId} for voided order ${orderId}`,
        );
      }
    });
  }

  async recordWaste(
    rawMaterialId: string,
    quantity: number,
    reason: string,
    notes: string,
    userId: string,
  ) {
    const material =
      await this.inventoryRepository.findRawMaterialById(rawMaterialId);
    if (!material) throw new NotFoundException('Raw material not found');

    if (Number(material.current_stock) < quantity) {
      throw new BadRequestException('Insufficient stock for waste recording');
    }

    return this.inventoryRepository.executeInTransaction(async (repo) => {
      // Decrease stock
      await repo.updateRawMaterialStock(rawMaterialId, quantity, 'decrement');

      // Record waste movement
      const wasteMovement = await repo.createInventoryTransaction({
        raw_material_id: rawMaterialId,
        qty: quantity,
        transaction_type: 'waste',
        notes: `[${reason}] ${notes}`.trim(),
        created_by: userId,
      });

      return wasteMovement;
    });
  }

  async getWasteHistory(limit = 50) {
    return this.inventoryRepository.findWasteMovements(limit);
  }

  async getBomRecipesByProduct(productId: string) {
    return this.inventoryRepository.findBomRecipesByProduct(productId);
  }

  async updateBomRecipe(id: string, quantity: number) {
    return this.inventoryRepository.updateBomRecipe(id, quantity);
  }

  async getBomCoverage() {
    return this.inventoryRepository.getBomCoverage();
  }
}
