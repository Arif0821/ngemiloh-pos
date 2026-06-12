import {
  Order,
  CashRegister,
  Setting,
  AuditLog,
  OrderRefund,
  Discount,
  Prisma,
  Product,
  ProductModifierGroup,
  ProductModifierOption,
} from '@prisma/client';

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');

export type ProductWithModifiers = Product & {
  modifier_groups: Array<
    ProductModifierGroup & { options: ProductModifierOption[] }
  >;
};

export interface OrderRepositoryInterface {
  findOrderByClientUuid(clientUuid: string): Promise<Order | null>;
  findActiveDiscounts(): Promise<Discount[]>;
  findProductWithModifiers(
    productId: string,
  ): Promise<ProductWithModifiers | null>;
  findProductsWithModifiers(
    productIds: string[],
  ): Promise<ProductWithModifiers[]>;
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
  ): Promise<
    Array<
      Order & {
        cashier?: { name: string };
        items?: Array<{
          product_name_snapshot: string;
          quantity: number;
          base_price: Prisma.Decimal;
          discounted_base: Prisma.Decimal;
          discount?: { name: string } | null;
          final_price: Prisma.Decimal;
        }>;
      }
    >
  >;
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
  ): Promise<CashRegister[]>;
}
