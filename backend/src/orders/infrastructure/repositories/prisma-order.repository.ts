import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { OrderRepositoryInterface } from '../../domain/interfaces/order.repository.interface';
import {
  Order,
  CashRegister,
  Setting,
  AuditLog,
  OrderRefund,
  Discount,
  Product,
  Prisma,
} from '@prisma/client';

@Injectable()
export class PrismaOrderRepository implements OrderRepositoryInterface {
  constructor(private readonly prisma: PrismaService) {}

  async findOrderByClientUuid(clientUuid: string): Promise<Order | null> {
    return this.prisma.order.findUnique({
      where: { client_uuid: clientUuid },
    });
  }

  async findActiveDiscounts(): Promise<Discount[]> {
    return this.prisma.discount.findMany({
      where: {
        is_active: true,
        valid_from: { lte: new Date() },
        OR: [{ valid_until: null }, { valid_until: { gte: new Date() } }],
      },
    });
  }

  async findProductWithModifiers(productId: string): Promise<any> {
    return this.prisma.product.findUnique({
      where: { id: productId },
      include: { modifier_groups: { include: { options: true } } },
    });
  }

  async findProductsWithModifiers(productIds: string[]): Promise<any[]> {
    return this.prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { modifier_groups: { include: { options: true } } },
    });
  }

  async createOrder(data: Prisma.OrderUncheckedCreateInput): Promise<Order> {
    return this.prisma.order.create({ data });
  }

  async updateOrder(
    id: string,
    data: Prisma.OrderUncheckedUpdateInput,
  ): Promise<Order> {
    return this.prisma.order.update({
      where: { id },
      data,
    });
  }

  async findOrderById(id: string): Promise<Order | null> {
    return this.prisma.order.findUnique({
      where: { id },
    });
  }

  async findOrders(
    where: Prisma.OrderWhereInput,
    orderBy: Prisma.OrderOrderByWithRelationInput,
    include?: Prisma.OrderInclude,
    take?: number,
    skip?: number,
  ): Promise<any[]> {
    return this.prisma.order.findMany({
      where,
      orderBy,
      include,
      take,
      skip,
    });
  }

  async createAuditLog(
    data: Prisma.AuditLogUncheckedCreateInput,
  ): Promise<AuditLog> {
    return this.prisma.auditLog.create({ data });
  }

  async findCurrentShift(
    kasirId: string,
    date: Date,
  ): Promise<CashRegister | null> {
    return this.prisma.cashRegister.findFirst({
      where: {
        cashier_id: kasirId,
        status: 'open',
        shift_date: date,
      },
    });
  }

  async getSetting(key: string): Promise<Setting | null> {
    return this.prisma.setting.findUnique({
      where: { key },
    });
  }

  async createShift(
    data: Prisma.CashRegisterUncheckedCreateInput,
  ): Promise<CashRegister> {
    return this.prisma.cashRegister.create({ data });
  }

  async createOrderRefund(
    data: Prisma.OrderRefundUncheckedCreateInput,
  ): Promise<OrderRefund> {
    return this.prisma.orderRefund.create({ data });
  }

  async countRecentVoids(since: Date): Promise<number> {
    return this.prisma.auditLog.count({
      where: {
        action: 'ORDER_VOID',
        created_at: { gte: since },
      },
    });
  }

  async findShifts(
    where: Prisma.CashRegisterWhereInput,
    include?: Prisma.CashRegisterInclude,
    orderBy?: Prisma.CashRegisterOrderByWithRelationInput,
    take?: number,
  ): Promise<any[]> {
    return this.prisma.cashRegister.findMany({
      where,
      include,
      orderBy,
      take,
    });
  }
}
