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
    return [];
  }

  async decrementBatchStock(batchId: string, amount: number): Promise<any> {
    return null;
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
