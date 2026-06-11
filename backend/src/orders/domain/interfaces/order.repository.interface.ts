import {
  Order,
  CashRegister,
  Setting,
  AuditLog,
  OrderRefund,
  Discount,
  Prisma,
} from '@prisma/client';

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');

export interface OrderRepositoryInterface {
  findOrderByClientUuid(clientUuid: string): Promise<Order | null>;
  findActiveDiscounts(): Promise<Discount[]>;
  findProductWithModifiers(productId: string): Promise<any>;
  findProductsWithModifiers(productIds: string[]): Promise<any[]>;
  createOrder(data: Prisma.OrderUncheckedCreateInput): Promise<Order>;
  updateOrder(
    id: string,
    data: Prisma.OrderUncheckedUpdateInput,
  ): Promise<Order>;
  findOrderById(id: string): Promise<Order | null>;
  findOrders(
    where: Prisma.OrderWhereInput,
    orderBy?: Prisma.OrderOrderByWithRelationInput,
    include?: Prisma.OrderInclude,
    take?: number,
    skip?: number,
  ): Promise<any[]>;
  createAuditLog(data: Prisma.AuditLogUncheckedCreateInput): Promise<AuditLog>;
  findCurrentShift(kasirId: string, date: Date): Promise<CashRegister | null>;
  getSetting(key: string): Promise<Setting | null>;
  createShift(
    data: Prisma.CashRegisterUncheckedCreateInput,
  ): Promise<CashRegister>;
  createOrderRefund(
    data: Prisma.OrderRefundUncheckedCreateInput,
  ): Promise<OrderRefund>;
  countRecentVoids(since: Date): Promise<number>;
  findShifts(
    where: Prisma.CashRegisterWhereInput,
    include?: Prisma.CashRegisterInclude,
    orderBy?: Prisma.CashRegisterOrderByWithRelationInput,
    take?: number,
  ): Promise<any[]>;
}
