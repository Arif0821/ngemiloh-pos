import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IInventoryRepository } from '../../domain/interfaces/inventory.repository.interface';
import { RawMaterial, Order, StockMovement } from '@prisma/client';

@Injectable()
export class PrismaInventoryRepository implements IInventoryRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly tx?: any
  ) {}

  private get client() {
    return this.tx || this.prisma;
  }

  async executeInTransaction<T>(fn: (repo: IInventoryRepository) => Promise<T>): Promise<T> {
    if (this.tx) {
      // Already in transaction
      return fn(this);
    }
    return this.prisma.$transaction(async (prismaTx) => {
      const txRepo = new PrismaInventoryRepository(this.prisma, prismaTx);
      return fn(txRepo);
    });
  }

  async findAllRawMaterials(): Promise<RawMaterial[]> {
    return this.client.rawMaterial.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async findActiveRawMaterials(): Promise<RawMaterial[]> {
    return this.client.rawMaterial.findMany({});
  }

  async findRawMaterialById(id: string): Promise<RawMaterial | null> {
    return this.client.rawMaterial.findUnique({
      where: { id },
    });
  }

  // PERFORMANCE: Batch fetch materials by IDs to avoid N+1 queries
  async findManyRawMaterialsByIds(ids: string[]): Promise<RawMaterial[]> {
    if (ids.length === 0) return [];
    return this.client.rawMaterial.findMany({
      where: { id: { in: ids } },
    });
  }

  async updateRawMaterialStock(id: string, amount: number, type: 'increment' | 'decrement' | 'set'): Promise<RawMaterial> {
    let data: any = {};
    if (type === 'increment') {
      data = { current_stock: { increment: amount } };
    } else if (type === 'decrement') {
      data = { current_stock: { decrement: amount } };
    } else {
      data = { current_stock: amount };
    }

    return this.client.rawMaterial.update({
      where: { id },
      data,
    });
  }

  async createInventoryTransaction(data: {
    raw_material_id: string;
    qty: number;
    transaction_type: string;
    notes: string;
    created_by?: string;
    reference_id?: string;
  }): Promise<StockMovement> {
    return this.client.stockMovement.create({
      data: {
        raw_material_id: data.raw_material_id,
        quantity: data.qty,
        type: data.transaction_type,
        notes: data.notes,
        created_by: data.created_by,
        reference_order_id: data.reference_id
      }
    });
  }

  async findOrderWithIngredients(orderId: string): Promise<any> {
    return this.client.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              include: { bom_recipes: true },
            },
          },
        },
      },
    });
  }

  async updateOrderCogs(orderId: string, cogsTotal: number): Promise<Order> {
    return this.client.order.update({
      where: { id: orderId },
      data: { cogs_total: cogsTotal },
    });
  }

  async findAvailableBatches(rawMaterialId: string): Promise<any[]> {
    // FEFO batch tracking using StockMovement as batch proxy
    // Orders movements by created_at for FIFO (First In, First Out)
    const movements = await this.client.stockMovement.findMany({
      where: {
        raw_material_id: rawMaterialId,
        type: { in: ['in', 'out'] },
      },
      orderBy: { created_at: 'asc' },
    });

    // Calculate remaining quantity per "batch" (by movement date)
    const batches: any[] = [];
    let runningBalance = 0;

    for (const m of movements) {
      const qty = Number(m.quantity);
      if (m.type === 'in') {
        runningBalance += qty;
        // Each IN movement creates a batch entry
        batches.push({
          id: m.id, // Using movement ID as batch proxy
          raw_material_id: rawMaterialId,
          qty_remaining: runningBalance,
          expiry_date: null, // No expiry tracking in current schema
          cost_per_unit: 0, // Cost tracked via RawMaterial cost_per_unit
        });
      } else {
        // Deduct from running balance
        runningBalance = Math.max(0, runningBalance - qty);
      }
    }

    return batches.filter(b => b.qty_remaining > 0);
  }

  async decrementBatchStock(batchId: string, amount: number): Promise<any> {
    // Decrement stock by creating OUT movement
    const movement = await this.client.stockMovement.findUnique({ where: { id: batchId } });
    if (!movement) {
      return null;
    }

    return this.client.stockMovement.create({
      data: {
        raw_material_id: movement.raw_material_id,
        type: 'out',
        quantity: amount,
        notes: `Batch deduction from movement ${batchId}`,
      },
    });
  }

  async createRawMaterial(data: any): Promise<RawMaterial> {
    return this.client.rawMaterial.create({ data });
  }

  async updateRawMaterial(id: string, data: any): Promise<RawMaterial> {
    return this.client.rawMaterial.update({
      where: { id },
      data
    });
  }

  async createBomRecipe(data: any): Promise<any> {
    return this.client.bomRecipe.create({ data });
  }

  async deleteBomRecipe(id: string): Promise<any> {
    return this.client.bomRecipe.delete({
      where: { id }
    });
  }
}
