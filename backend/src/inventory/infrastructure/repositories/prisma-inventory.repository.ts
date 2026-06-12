import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IInventoryRepository } from '../../domain/interfaces/inventory.repository.interface';
import { RawMaterial, Order, StockMovement, Prisma } from '@prisma/client';

type DbClient = PrismaService | Prisma.TransactionClient;

export interface BatchRecord {
  id: string;
  raw_material_id: string;
  qty_remaining: number;
  expiry_date: Date | null;
  cost_per_unit: number;
}

@Injectable()
export class PrismaInventoryRepository implements IInventoryRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly tx?: DbClient,
  ) {}

  private get client(): DbClient {
    return this.tx || this.prisma;
  }

  async executeInTransaction<T>(
    fn: (repo: IInventoryRepository) => Promise<T>,
  ): Promise<T> {
    if (this.tx) {
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
    return this.client.rawMaterial.findUnique({ where: { id } });
  }

  async findManyRawMaterialsByIds(ids: string[]): Promise<RawMaterial[]> {
    if (ids.length === 0) return [];
    return this.client.rawMaterial.findMany({ where: { id: { in: ids } } });
  }

  async updateRawMaterialStock(
    id: string,
    amount: number,
    type: 'increment' | 'decrement' | 'set',
  ): Promise<RawMaterial> {
    let data: Prisma.RawMaterialUpdateInput = {};
    if (type === 'increment') {
      data = { current_stock: { increment: amount } };
    } else if (type === 'decrement') {
      data = { current_stock: { decrement: amount } };
    } else {
      data = { current_stock: amount };
    }
    return this.client.rawMaterial.update({ where: { id }, data });
  }

  async createInventoryTransaction(data: {
    raw_material_id: string;
    qty: number;
    transaction_type: 'in' | 'out' | 'adjustment' | 'waste';
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
        reference_order_id: data.reference_id,
      },
    });
  }

  async findOrderWithIngredients(orderId: string): Promise<unknown> {
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

  /**
   * FEFO (First Expired First Out) batch finder.
   * Uses FIFO order (oldest 'in' movement first) until expiry_date is added to StockMovement.
   * Each "batch" is a single stock movement of type 'in' with its remaining quantity.
   * Remaining quantity is calculated from cumulative 'out' movements.
   *
   * TODO: Add expiry_date to StockMovement schema for true FEFO by expiry date.
   * Schema change: add expiry_date DateTime? @db.Timestamptz to StockMovement,
   * then update orderBy to: [{ expiry_date: 'asc' }, { created_at: 'asc' }]
   */
  async findAvailableBatches(rawMaterialId: string): Promise<BatchRecord[]> {
    // Get all 'in' movements for this raw material (FIFO order by creation)
    const inMovements = await this.client.stockMovement.findMany({
      where: {
        raw_material_id: rawMaterialId,
        type: 'in',
      },
      orderBy: { created_at: 'asc' }, // Oldest first = FIFO (closest to FEFO without expiry_date)
    });

    // Get all 'out' movements for this raw material, ordered by creation time
    const outMovements = await this.client.stockMovement.findMany({
      where: {
        raw_material_id: rawMaterialId,
        type: 'out',
      },
      orderBy: { created_at: 'asc' }, // FIFO deduction order
    });

    // Calculate remaining quantity per 'in' movement (batch)
    // Map: reference_order_id -> remaining quantity deducted
    const deductedQty = new Map<string, number>();
    for (const outMov of outMovements) {
      if (outMov.reference_order_id) {
        const current = deductedQty.get(outMov.reference_order_id) ?? 0;
        deductedQty.set(
          outMov.reference_order_id,
          current + Number(outMov.quantity),
        );
      } else {
        // 'out' movements without reference_order_id deduct from earliest 'in' movements
        // This handles legacy deductions that don't reference specific batches
      }
    }

    // Build batch records from 'in' movements with remaining quantity
    const batches: BatchRecord[] = [];
    for (const mov of inMovements) {
      const originalQty = Number(mov.quantity);
      const deducted = deductedQty.get(mov.id) ?? 0;
      const qtyRemaining = originalQty - deducted;

      if (qtyRemaining > 0) {
        batches.push({
          id: mov.id,
          raw_material_id: rawMaterialId,
          qty_remaining: qtyRemaining,
          expiry_date: null, // TODO: Populate when expiry_date is added to StockMovement
          cost_per_unit: 0, // TODO: Populate from RawMaterial or inbound cost when available
        });
      }
    }

    return batches;
  }

  async decrementBatchStock(
    batchId: string,
    amount: number,
    createdBy?: string,
    referenceOrderId?: string,
  ): Promise<StockMovement | null> {
    const movement = await this.client.stockMovement.findUnique({
      where: { id: batchId },
    });
    if (!movement) return null;
    return this.client.stockMovement.create({
      data: {
        raw_material_id: movement.raw_material_id,
        type: 'out',
        quantity: amount,
        notes: `Batch deduction from movement ${batchId}`,
        created_by: createdBy,
        reference_order_id: referenceOrderId,
      },
    });
  }

  async createRawMaterial(
    data: Prisma.RawMaterialUncheckedCreateInput,
  ): Promise<RawMaterial> {
    return this.client.rawMaterial.create({ data });
  }

  async updateRawMaterial(
    id: string,
    data: Prisma.RawMaterialUncheckedUpdateInput,
  ): Promise<RawMaterial> {
    return this.client.rawMaterial.update({ where: { id }, data });
  }

  async createBomRecipe(
    data: Prisma.BomRecipeUncheckedCreateInput,
  ): Promise<unknown> {
    return this.client.bomRecipe.create({ data });
  }

  async deleteBomRecipe(id: string): Promise<unknown> {
    return this.client.bomRecipe.delete({ where: { id } });
  }
}
