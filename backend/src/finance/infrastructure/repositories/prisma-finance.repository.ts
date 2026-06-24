import { Injectable } from '@nestjs/common';
import {
  IFinanceRepository,
  ProfitShareDetailResult,
  AggregatedAnalytics,
} from '../../domain/interfaces/finance.repository.interface';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PrismaFinanceRepository implements IFinanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findOrders(
    where: Prisma.OrderWhereInput,
    include?: Prisma.OrderInclude,
    take?: number,
  ) {
    return this.prisma.order.findMany({ where, include, take });
  }

  async findOperationalExpenses(
    where: Prisma.OperationalExpenseWhereInput,
    orderBy?: Prisma.OperationalExpenseOrderByWithRelationInput,
  ) {
    return this.prisma.operationalExpense.findMany({ where, orderBy });
  }

  async createOperationalExpense(
    data: Prisma.OperationalExpenseUncheckedCreateInput,
  ) {
    return this.prisma.operationalExpense.create({ data });
  }

  async findAssets(
    where?: Prisma.AssetWhereInput,
    orderBy?: Prisma.AssetOrderByWithRelationInput,
  ) {
    return this.prisma.asset.findMany({ where, orderBy });
  }

  async findAssetById(id: string) {
    return this.prisma.asset.findUnique({ where: { id } });
  }

  async createAsset(data: Prisma.AssetUncheckedCreateInput) {
    return this.prisma.asset.create({ data });
  }

  async updateAsset(id: string, data: Prisma.AssetUncheckedUpdateInput) {
    return this.prisma.asset.update({ where: { id }, data });
  }

  async findProfitShareLogByPeriod(periodMonth: Date) {
    return this.prisma.profitShareLog.findUnique({
      where: { period_month: periodMonth },
    });
  }

  async createProfitShareLog(data: Prisma.ProfitShareLogUncheckedCreateInput) {
    return this.prisma.profitShareLog.create({ data });
  }

  async updateProfitShareLog(
    id: string,
    data: Prisma.ProfitShareLogUncheckedUpdateInput,
  ) {
    return this.prisma.profitShareLog.update({ where: { id }, data });
  }

  async createAuditLog(data: Prisma.AuditLogUncheckedCreateInput) {
    return this.prisma.auditLog.create({ data });
  }

  async findFirstCashRegister(
    where: Prisma.CashRegisterWhereInput,
    orderBy?: Prisma.CashRegisterOrderByWithRelationInput,
  ) {
    return this.prisma.cashRegister.findFirst({ where, orderBy });
  }

  async createCashRegister(data: Prisma.CashRegisterUncheckedCreateInput) {
    return this.prisma.cashRegister.create({ data });
  }

  async updateCashRegister(
    id: string,
    data: Prisma.CashRegisterUncheckedUpdateInput,
  ) {
    return this.prisma.cashRegister.update({ where: { id }, data });
  }

  async countCashRegisters(
    where: Prisma.CashRegisterWhereInput,
  ): Promise<number> {
    return this.prisma.cashRegister.count({ where });
  }

  async findManyCashRegisters(
    where?: Prisma.CashRegisterWhereInput,
    orderBy?: Prisma.CashRegisterOrderByWithRelationInput,
    include?: Prisma.CashRegisterInclude,
  ) {
    return this.prisma.cashRegister.findMany({ where, orderBy, include });
  }

  async createProfitShareDetail(
    data: Prisma.ProfitShareDetailUncheckedCreateInput,
  ) {
    return this.prisma.profitShareDetail.create({ data });
  }

  async createManyProfitShareDetails(
    data: Prisma.ProfitShareDetailUncheckedCreateInput[],
  ): Promise<ProfitShareDetailResult[]> {
    // F19: Use createManyAndReturn for PostgreSQL to get created records with IDs
    const result = await this.prisma.profitShareDetail.createManyAndReturn({
      data,
    });
    return result as unknown as ProfitShareDetailResult[];
  }

  async findClosedCashRegistersForPeriod(start: Date, end: Date) {
    return this.prisma.cashRegister.findMany({
      where: {
        status: 'closed',
        shift_start: { gte: start, lte: end },
      },
      include: {
        cashier: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * ISSUE #14: Database-level aggregation for analytics instead of in-memory
   * Uses raw SQL queries to aggregate data at the database level for performance
   */
  async aggregateAnalytics(
    startDate: Date,
    endDate: Date,
    period: 'daily' | 'weekly' | 'monthly',
  ): Promise<AggregatedAnalytics> {
    // Determine date truncation based on period
    let dateTrunc: string;
    let dateFormat: string;
    if (period === 'daily') {
      dateTrunc = 'day';
      dateFormat = 'YYYY-MM-DD';
    } else if (period === 'weekly') {
      dateTrunc = 'week';
      dateFormat = 'IYYY-IW';
    } else {
      dateTrunc = 'month';
      dateFormat = 'YYYY-MM';
    }

    // Query 1: Trend aggregation (revenue by period)
    const trendQuery = Prisma.sql`
      SELECT
        TO_CHAR(DATE_TRUNC(${dateTrunc}, created_at), ${dateFormat}) as label,
        COALESCE(SUM(total_amount), 0)::float as value
      FROM orders
      WHERE created_at >= ${startDate}
        AND created_at <= ${endDate}
        AND status != 'voided'
      GROUP BY DATE_TRUNC(${dateTrunc}, created_at)
      ORDER BY DATE_TRUNC(${dateTrunc}, created_at)
    `;

    // Query 2: Top products by quantity
    const topByQtyQuery = Prisma.sql`
      SELECT
        oi.product_id,
        oi.product_name_snapshot as product_name,
        SUM(oi.quantity)::int as qty,
        COALESCE(SUM(oi.subtotal), 0)::float as revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.created_at >= ${startDate}
        AND o.created_at <= ${endDate}
        AND o.status != 'voided'
      GROUP BY oi.product_id, oi.product_name_snapshot
      ORDER BY qty DESC
      LIMIT 5
    `;

    // Query 3: Top products by revenue
    const topByRevenueQuery = Prisma.sql`
      SELECT
        oi.product_id,
        oi.product_name_snapshot as product_name,
        SUM(oi.quantity)::int as qty,
        COALESCE(SUM(oi.subtotal), 0)::float as revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.created_at >= ${startDate}
        AND o.created_at <= ${endDate}
        AND o.status != 'voided'
      GROUP BY oi.product_id, oi.product_name_snapshot
      ORDER BY revenue DESC
      LIMIT 5
    `;

    // Query 4: Payment distribution
    const paymentDistQuery = Prisma.sql`
      SELECT
        payment_method,
        COUNT(*)::int as count,
        COALESCE(SUM(total_amount), 0)::float as total_value
      FROM orders
      WHERE created_at >= ${startDate}
        AND created_at <= ${endDate}
        AND status != 'voided'
      GROUP BY payment_method
    `;

    // Query 5: Peak hours
    const peakHoursQuery = Prisma.sql`
      SELECT
        EXTRACT(HOUR FROM COALESCE(client_created_at, created_at))::int as hour,
        COUNT(*)::int as count
      FROM orders
      WHERE created_at >= ${startDate}
        AND created_at <= ${endDate}
        AND status != 'voided'
      GROUP BY EXTRACT(HOUR FROM COALESCE(client_created_at, created_at))
      ORDER BY hour
    `;

    // Execute all queries in parallel for better performance
    const [trend, topByQty, topByRevenue, paymentDist, peakHours] =
      await Promise.all([
        this.prisma.$queryRaw<Array<{ label: string; value: number }>>(
          trendQuery,
        ),
        this.prisma.$queryRaw<
          Array<{
            product_id: string;
            product_name: string | null;
            qty: number;
            revenue: number;
          }>
        >(topByQtyQuery),
        this.prisma.$queryRaw<
          Array<{
            product_id: string;
            product_name: string | null;
            qty: number;
            revenue: number;
          }>
        >(topByRevenueQuery),
        this.prisma.$queryRaw<
          Array<{
            payment_method: string;
            count: number;
            total_value: number;
          }>
        >(paymentDistQuery),
        this.prisma.$queryRaw<Array<{ hour: number; count: number }>>(
          peakHoursQuery,
        ),
      ]);

    // Transform payment distribution
    const counts = { cash: 0, qris: 0, split: 0 };
    const values = { cash: 0, qris: 0, split: 0 };
    for (const row of paymentDist) {
      if (row.payment_method in counts) {
        counts[row.payment_method as keyof typeof counts] = row.count;
        values[row.payment_method as keyof typeof values] = row.total_value;
      }
    }

    // Fill in missing hours (0-23) with zeros
    const hoursMap = new Map<number, number>();
    for (const row of peakHours) {
      hoursMap.set(row.hour, row.count);
    }
    const peakHoursResult: { hour: number; count: number }[] = [];
    for (let h = 0; h < 24; h++) {
      peakHoursResult.push({ hour: h, count: hoursMap.get(h) || 0 });
    }

    return {
      trend: trend.map((t) => ({
        label: t.label,
        value: Number(t.value),
      })),
      topProductsByQty: topByQty.map((p) => ({
        product_id: p.product_id,
        product_name: p.product_name,
        qty: Number(p.qty),
        revenue: Number(p.revenue),
      })),
      topProductsByRevenue: topByRevenue.map((p) => ({
        product_id: p.product_id,
        product_name: p.product_name,
        qty: Number(p.qty),
        revenue: Number(p.revenue),
      })),
      paymentDistribution: { counts, values },
      peakHours: peakHoursResult,
    };
  }

  /**
   * ISSUE #14: Aggregate orders by cashier for profit share calculation
   * Uses database aggregation instead of fetching all orders and reducing in-memory
   */
  async aggregateOrdersByCashier(
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
  > {
    if (cashierIds.length === 0) {
      return [];
    }

    const result = await this.prisma.$queryRaw<
      Array<{
        cashier_id: string;
        cashier_name: string;
        total_sales: number;
        total_orders: bigint;
      }>
    >`
      SELECT
        o.cashier_id,
        COALESCE(u.name, o.cashier_id) as cashier_name,
        COALESCE(SUM(o.total_amount), 0)::float as total_sales,
        COUNT(o.id) as total_orders
      FROM orders o
      LEFT JOIN users u ON u.id = o.cashier_id
      WHERE o.cashier_id IN (${Prisma.join(cashierIds)})
        AND o.created_at >= ${start}
        AND o.created_at <= ${end}
        AND o.status != 'voided'
      GROUP BY o.cashier_id, u.name
      ORDER BY total_sales DESC
    `;

    return result.map((row) => ({
      cashier_id: row.cashier_id,
      cashier_name: row.cashier_name,
      total_sales: Number(row.total_sales),
      total_orders: Number(row.total_orders),
    }));
  }
}
