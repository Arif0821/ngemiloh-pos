import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { OrderRepositoryInterface } from '../../domain/interfaces/order.repository.interface';
import { Order, CashRegister, Setting, AuditLog, OrderRefund, Discount, Product } from '@prisma/client';

@Injectable()
export class PrismaOrderRepository implements OrderRepositoryInterface {
  constructor(private readonly prisma: PrismaService) {}

  async findOrderByClientUuid(clientUuid: string): Promise<Order | null> {
    return this.prisma.order.findUnique({
      where: { client_uuid: clientUuid }
    });
  }

  async findActiveDiscounts(): Promise<Discount[]> {
    return this.prisma.discount.findMany({
      where: {
        is_active: true,
        valid_from: { lte: new Date() },
        OR: [
          { valid_until: null },
          { valid_until: { gte: new Date() } }
        ]
      }
    });
  }

  async findProductWithModifiers(productId: string): Promise<any> {
    return this.prisma.product.findUnique({
      where: { id: productId },
      include: { modifier_groups: { include: { options: true } } }
    });
  }

  async createOrder(data: any): Promise<Order> {
    return this.prisma.order.create(data);
  }

  async updateOrder(id: string, data: any): Promise<Order> {
    return this.prisma.order.update({
      where: { id },
      data
    });
  }

  async findOrderById(id: string): Promise<Order | null> {
    return this.prisma.order.findUnique({
      where: { id }
    });
  }

  async findOrders(where: any, orderBy: any, include?: any): Promise<any[]> {
    return this.prisma.order.findMany({
      where,
      orderBy,
      include
    });
  }

  async createAuditLog(data: any): Promise<AuditLog> {
    return this.prisma.auditLog.create({ data });
  }

  async findCurrentShift(kasirId: string, date: Date): Promise<CashRegister | null> {
    return this.prisma.cashRegister.findFirst({
      where: {
        cashier_id: kasirId,
        status: 'open',
        shift_date: date
      }
    });
  }

  async getSetting(key: string): Promise<Setting | null> {
    return this.prisma.setting.findUnique({
      where: { key }
    });
  }

  async createShift(data: any): Promise<CashRegister> {
    return this.prisma.cashRegister.create({ data });
  }

  async createOrderRefund(data: any): Promise<OrderRefund> {
    return this.prisma.orderRefund.create({ data });
  }

  async countRecentVoids(since: Date): Promise<number> {
    return this.prisma.auditLog.count({
      where: {
        action: 'ORDER_VOID',
        created_at: { gte: since }
      }
    });
  }

  async findShifts(where: any, include?: any, orderBy?: any, take?: number): Promise<any[]> {
    return this.prisma.cashRegister.findMany({
      where,
      include,
      orderBy,
      take
    });
  }
}
