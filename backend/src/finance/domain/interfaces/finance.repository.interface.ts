import {
  Prisma,
  Order,
  OperationalExpense,
  Asset,
  ProfitShareLog,
  ProfitShareDetail,
  AuditLog,
} from '@prisma/client';
import type { CashRegister } from '@prisma/client';

// Re-export CashRegister for use in other modules
export type { CashRegister };

/**
 * Interface for profit share detail record returned from createManyAndReturn
 */
export interface ProfitShareDetailResult {
  id: string;
  order_id: string;
  cashier_id: string;
  gross_profit: number;
  kasir_share: number;
  hq_share: number;
  created_at: Date;
  updated_at: Date;
}

/**
 * Interface for analytics aggregation results
 */
export interface AnalyticsTrendResult {
  label: string;
  value: number;
}

export interface ProductAnalyticsResult {
  product_id: string;
  product_name: string | null;
  qty: number;
  revenue: number;
}

export interface PaymentDistributionResult {
  payment_method: string;
  count: number;
  total_value: number;
}

export interface HourlyDistributionResult {
  hour: number;
  count: number;
}

export interface AggregatedAnalytics {
  trend: AnalyticsTrendResult[];
  topProductsByQty: ProductAnalyticsResult[];
  topProductsByRevenue: ProductAnalyticsResult[];
  paymentDistribution: {
    counts: { cash: number; qris: number; split: number };
    values: { cash: number; qris: number; split: number };
  };
  peakHours: { hour: number; count: number }[];
}

export interface ProfitShareAggregation {
  revenue: number;
  totalHpp: number;
  ordersCount: number;
}

export const FINANCE_REPOSITORY = Symbol('FINANCE_REPOSITORY');

export interface IFinanceRepository {
  findOrders(
    where: Prisma.OrderWhereInput,
    include?: Prisma.OrderInclude,
    take?: number,
  ): Promise<Order[]>;
  findOperationalExpenses(
    where: Prisma.OperationalExpenseWhereInput,
    orderBy?: Prisma.OperationalExpenseOrderByWithRelationInput,
  ): Promise<OperationalExpense[]>;
  createOperationalExpense(
    data: Prisma.OperationalExpenseUncheckedCreateInput,
  ): Promise<OperationalExpense>;
  findAssets(
    where?: Prisma.AssetWhereInput,
    orderBy?: Prisma.AssetOrderByWithRelationInput,
  ): Promise<Asset[]>;
  findAssetById(id: string): Promise<Asset | null>;
  createAsset(data: Prisma.AssetUncheckedCreateInput): Promise<Asset>;
  updateAsset(
    id: string,
    data: Prisma.AssetUncheckedUpdateInput,
  ): Promise<Asset>;
  findProfitShareLogByPeriod(periodMonth: Date): Promise<ProfitShareLog | null>;
  createProfitShareLog(
    data: Prisma.ProfitShareLogUncheckedCreateInput,
  ): Promise<ProfitShareLog>;
  updateProfitShareLog(
    id: string,
    data: Prisma.ProfitShareLogUncheckedUpdateInput,
  ): Promise<ProfitShareLog>;
  createAuditLog(data: Prisma.AuditLogUncheckedCreateInput): Promise<AuditLog>;
  findFirstCashRegister(
    where: Prisma.CashRegisterWhereInput,
    orderBy?: Prisma.CashRegisterOrderByWithRelationInput,
  ): Promise<CashRegister | null>;
  createCashRegister(
    data: Prisma.CashRegisterUncheckedCreateInput,
  ): Promise<CashRegister>;
  updateCashRegister(
    id: string,
    data: Prisma.CashRegisterUncheckedUpdateInput,
  ): Promise<CashRegister>;
  countCashRegisters(where: Prisma.CashRegisterWhereInput): Promise<number>;
  findManyCashRegisters(
    where?: Prisma.CashRegisterWhereInput,
    orderBy?: Prisma.CashRegisterOrderByWithRelationInput,
    include?: Prisma.CashRegisterInclude,
  ): Promise<CashRegister[]>;
  createProfitShareDetail(
    data: Prisma.ProfitShareDetailUncheckedCreateInput,
  ): Promise<ProfitShareDetail>;
  createManyProfitShareDetails(
    data: Prisma.ProfitShareDetailUncheckedCreateInput[],
  ): Promise<ProfitShareDetailResult[]>;
  findClosedCashRegistersForPeriod(
    start: Date,
    end: Date,
  ): Promise<
    Array<
      CashRegister & {
        cashier: { id: string; name: string };
      }
    >
  >;

  /**
   * ISSUE #14: Database-level aggregation for analytics instead of in-memory
   */
  aggregateAnalytics(
    startDate: Date,
    endDate: Date,
    period: 'daily' | 'weekly' | 'monthly',
  ): Promise<AggregatedAnalytics>;

  /**
   * ISSUE #14: Aggregate orders by cashier for profit share calculation
   */
  aggregateOrdersByCashier(
    start: Date,
    end: Date,
    cashierIds: string[],
  ): Promise<
    Array<{
      cashier_id: string;
      cashier_name: string;
      total_sales: number;
      total_orders: number;
    }>
  >;
}
