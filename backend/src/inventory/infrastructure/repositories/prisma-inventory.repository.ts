import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { IInventoryRepository } from '../../domain/interfaces/inventory.repository.interface';
import { RawMaterial, InventoryTransaction, InventoryBatch, Order } from '@prisma/client';

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
    return this.client.rawMaterial.findMany({
      where: { is_active: true },
    });
  }

  async findRawMaterialById(id: string): Promise<RawMaterial | null> {
    return this.client.rawMaterial.findUnique({
      where: { id },
    });
  }

  async updateRawMaterialStock(id: string, amount: number, type: 'increment' | 'decrement' | 'set'): Promise<RawMaterial> {
    let data: any = {};
    if (type === 'increment') {
      data = { stock: { increment: amount } };
    } else if (type === 'decrement') {
      data = { stock: { decrement: amount } };
    } else {
      data = { stock: amount };
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
  }): Promise<InventoryTransaction> {
    return this.client.inventoryTransaction.create({
      data,
    });
  }

  async findOrderWithIngredients(orderId: string): Promise<any> {
    return this.client.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            product: {
              include: { ingredients: true },
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

  async findAvailableBatches(rawMaterialId: string): Promise<InventoryBatch[]> {
    return this.client.inventoryBatch.findMany({
      where: { raw_material_id: rawMaterialId, qty_remaining: { gt: 0 } },
      orderBy: { created_at: 'asc' },
    });
  }

  async decrementBatchStock(batchId: string, amount: number): Promise<InventoryBatch> {
    return this.client.inventoryBatch.update({
      where: { id: batchId },
      data: { qty_remaining: { decrement: amount } },
    });
  }
}
