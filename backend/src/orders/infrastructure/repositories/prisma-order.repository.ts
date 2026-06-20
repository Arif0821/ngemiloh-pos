import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
import {
  OrderRepositoryInterface,
  type ProductWithModifiers,
} from '../../domain/interfaces/order.repository.interface';
import {
  Order,
  CashRegister,
  Setting,
  AuditLog,
  OrderRefund,
  Discount,
  Prisma,
} from '@prisma/client';

@Injectable()
export class PrismaOrderRepository implements OrderRepositoryInterface {
  private readonly ACTIVE_DISCOUNTS_CACHE_KEY = 'active_discounts';
  private readonly ACTIVE_DISCOUNTS_CACHE_TTL = 60; // seconds

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async findOrderByClientUuid(clientUuid: string): Promise<Order | null> {
    return this.prisma.order.findUnique({
      where: { client_uuid: clientUuid },
    });
  }

  async findActiveDiscounts(): Promise<Discount[]> {
    // PERFORMANCE: Cache active discounts with 60s TTL
    try {
      const cached = await this.redisService.get(
        this.ACTIVE_DISCOUNTS_CACHE_KEY,
      );
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {
      // Redis unavailable, fall through to DB
    }

    const discounts = await this.prisma.discount.findMany({
      where: {
        is_active: true,
        valid_from: { lte: new Date() },
        OR: [{ valid_until: null }, { valid_until: { gte: new Date() } }],
      },
    });

    // Cache result asynchronously (don't block on Redis)
    this.redisService
      .set(
        this.ACTIVE_DISCOUNTS_CACHE_KEY,
        JSON.stringify(discounts),
        this.ACTIVE_DISCOUNTS_CACHE_TTL,
      )
      .catch(() => {
        // Ignore cache set errors
      });

    return discounts;
  }

  async aggregateOrders(
    where: Prisma.OrderWhereInput,
  ): Promise<{
    _sum: { cash_amount: number | null; qris_amount: number | null; total_amount: number | null };
    _count: number;
  }> {
    const result = await this.prisma.order.aggregate({
      where,
      _sum: {
        cash_amount: true,
        qris_amount: true,
        total_amount: true,
      },
      _count: true,
    });
    return {
      _sum: {
        cash_amount: result._sum.cash_amount ? Number(result._sum.cash_amount) : null,
        qris_amount: result._sum.qris_amount ? Number(result._sum.qris_amount) : null,
        total_amount: result._sum.total_amount ? Number(result._sum.total_amount) : null,
      },
      _count: result._count,
    };
  }

  async findProductWithModifiers(
    productId: string,
  ): Promise<ProductWithModifiers | null> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: { modifier_groups: { include: { options: true } } },
    });
    return product;
  }

  async findProductsWithModifiers(
    productIds: string[],
  ): Promise<ProductWithModifiers[]> {
    return await this.prisma.product.findMany({
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
    orderBy?: Prisma.OrderOrderByWithRelationInput,
    include?: Prisma.OrderInclude,
    take?: number,
    skip?: number,
  ) {
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
  ): Promise<CashRegister[]> {
    return this.prisma.cashRegister.findMany({
      where,
      include,
      orderBy,
      take,
    });
  }
}
