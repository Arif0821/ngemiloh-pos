import { Order, CashRegister, Setting, AuditLog, OrderRefund, Discount, Product } from '@prisma/client';

export const ORDER_REPOSITORY = Symbol('ORDER_REPOSITORY');

export interface OrderRepositoryInterface {
  findOrderByClientUuid(clientUuid: string): Promise<Order | null>;
  findActiveDiscounts(): Promise<Discount[]>;
  findProductWithModifiers(productId: string): Promise<any>;
  createOrder(data: any): Promise<Order>;
  updateOrder(id: string, data: any): Promise<Order>;
  findOrderById(id: string): Promise<Order | null>;
  findOrders(where: any, orderBy: any, include?: any): Promise<any[]>;
  createAuditLog(data: any): Promise<AuditLog>;
  findCurrentShift(kasirId: string, date: Date): Promise<CashRegister | null>;
  getSetting(key: string): Promise<Setting | null>;
  createShift(data: any): Promise<CashRegister>;
  createOrderRefund(data: any): Promise<OrderRefund>;
  countRecentVoids(since: Date): Promise<number>;
  findShifts(where: any, include?: any, orderBy?: any, take?: number): Promise<any[]>;
}
