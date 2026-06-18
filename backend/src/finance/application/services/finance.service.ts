import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  type IFinanceRepository,
  FINANCE_REPOSITORY,
} from '../../domain/interfaces/finance.repository.interface';
import { EmailService } from '../../../email/email.service';
import { Prisma, Order } from '@prisma/client';
import {
  CreateAssetDto,
  UpdateAssetDto,
} from '../../presentation/dto/finance.dto';

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    @Inject(FINANCE_REPOSITORY)
    private readonly financeRepository: IFinanceRepository,
    private emailService: EmailService,
  ) {}

  async getDashboardKpi(date: string) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const orders = await this.financeRepository.findOrders(
      { created_at: { gte: start, lte: end }, status: { not: 'voided' } },
      { items: true },
    );

    const revenue = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);
    const hpp = orders.reduce(
      (sum, o) =>
        sum + Number((o as Order & { cogs_total?: number }).cogs_total || 0),
      0,
    );
    const laba = revenue - hpp;
    // FIX: Use environment variable instead of hardcoded target
    const dailyRevenueTarget = Number(
      process.env.DAILY_REVENUE_TARGET || 5000000,
    );
    // SECURITY: Prevent division by zero
    const targetProgress =
      dailyRevenueTarget > 0
        ? Math.min(100, Math.round((revenue / dailyRevenueTarget) * 100))
        : 0;

    const transactions = orders.length;
    const avg = transactions > 0 ? revenue / transactions : 0;

    const paymentDistribution = {
      cash: orders.filter((o) => o.payment_method === 'cash').length,
      qris: orders.filter((o) => o.payment_method === 'qris').length,
      split: orders.filter((o) => o.payment_method === 'split').length,
    };

    return {
      revenue,
      hpp,
      laba,
      targetProgress,
      transactions,
      avg,
      paymentDistribution,
    };
  }

  async getOpex(month: number, year: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    return this.financeRepository.findOperationalExpenses(
      { expense_date: { gte: start, lte: end } },
      { expense_date: 'desc' },
    );
  }

  async createOpex(
    data: Prisma.OperationalExpenseUncheckedCreateInput,
    userId: string,
  ) {
    return this.financeRepository.createOperationalExpense({
      category: data.category,
      description: data.description,
      amount: data.amount,
      expense_date: new Date(data.expense_date),
      created_by: userId,
    });
  }

  async getProfitShare(month: number, year: number) {
    if (month < 1 || month > 12) {
      throw new BadRequestException(
        'Invalid month. Month must be between 1 and 12.',
      );
    }

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const orders = await this.financeRepository.findOrders({
      created_at: { gte: start, lte: end },
      status: { not: 'voided' },
    });

    if (!orders || orders.length === 0) {
      throw new NotFoundException('No orders found for the specified period.');
    }

    const revenue = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);

    const opexList = await this.financeRepository.findOperationalExpenses({
      expense_date: { gte: start, lte: end },
    });
    const totalOpex = opexList.reduce(
      (sum, exp) => sum + Number(exp.amount),
      0,
    );

    const assets = await this.financeRepository.findAssets({ is_active: true });
    const totalDepreciation = assets.reduce(
      (sum, a) => sum + Number(a.monthly_depreciation),
      0,
    );

    const totalHpp = orders.reduce(
      (sum, o) =>
        sum + Number((o as Order & { cogs_total?: number }).cogs_total || 0),
      0,
    );

    const netProfit = revenue - totalOpex - totalDepreciation;

    const ownerShare = netProfit > 0 ? netProfit * 0.6 : 0;
    const cashierShare = netProfit > 0 ? netProfit * 0.4 : 0;

    return {
      period: `${year}-${String(month).padStart(2, '0')}`,
      revenue,
      totalHpp,
      totalOpex,
      totalDepreciation,
      netProfit,
      ownerShare,
      cashierShare,
    };
  }

  async closePeriod(month: number, year: number) {
    const share = await this.getProfitShare(month, year);

    const periodMonth = new Date(year, month - 1, 1);

    // F19: Define period boundaries for cashier aggregation
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const existing =
      await this.financeRepository.findProfitShareLogByPeriod(periodMonth);

    if (existing) {
      throw new Error('Periode ini sudah ditutup sebelumnya.');
    }

    const log = await this.financeRepository.createProfitShareLog({
      period_month: periodMonth,
      total_revenue: share.revenue,
      total_hpp: share.totalHpp,
      total_opex: share.totalOpex,
      total_depreciation: share.totalDepreciation,
      net_profit: share.netProfit,
      owner_share: share.ownerShare,
      cashier_share: share.cashierShare,
      is_hpp_actual: true,
    });

    // F19: Build per-cashier ProfitShareDetail breakdown
    if (share.netProfit > 0) {
      const closedShifts =
        await this.financeRepository.findClosedCashRegistersForPeriod(
          start,
          end,
        );

      // F19 FIX: Batch fetch all orders to avoid N+1
      const cashierIds = [...new Set(closedShifts.map((s) => s.cashier_id))];
      const allOrders = await this.financeRepository.findOrders({
        cashier_id: { in: cashierIds },
        status: { not: 'voided' },
        created_at: { gte: start, lte: end },
      });

      // Group orders by cashier_id
      const orders_by_cashier = new Map<string, typeof allOrders>();
      for (const order of allOrders) {
        const existing_cashier = orders_by_cashier.get(order.cashier_id) || [];
        existing_cashier.push(order);
        orders_by_cashier.set(order.cashier_id, existing_cashier);
      }

      // Aggregate sales + orders per cashier from pre-fetched data
      const cashier_map = new Map<
        string,
        {
          cashier_id: string;
          cashier_name: string;
          total_sales: number;
          total_orders: number;
          shift_count: number;
        }
      >();

      for (const shift of closedShifts) {
        const cashier_id = shift.cashier_id;
        const orders = orders_by_cashier.get(cashier_id) || [];
        const sales = orders.reduce((s, o) => s + Number(o.total_amount), 0);

        const existing = cashier_map.get(cashier_id);
        if (existing) {
          existing.total_sales += sales;
          existing.total_orders += orders.length;
          existing.shift_count += 1;
        } else {
          // Get cashier name from shift if available, otherwise use cashier_id
          const cashier_name =
            'cashier' in shift &&
            (shift as { cashier?: { name: string } }).cashier?.name
              ? (shift as { cashier?: { name: string } }).cashier.name
              : cashier_id;
          cashier_map.set(cashier_id, {
            cashier_id,
            cashier_name,
            total_sales: sales,
            total_orders: orders.length,
            shift_count: 1,
          });
        }
      }

      if (cashier_map.size > 0) {
        // Calculate proportional share per cashier
        // Proportional: (cashier_sales / total_revenue) * cashier_share
        // If revenue is 0 (edge case), fall back to equal split
        const details: Array<{
          profit_share_log_id: string;
          cashier_id: string;
          cashier_name: string;
          total_sales: number;
          total_orders: number;
          shift_count: number;
          share_amount: number;
        }> = [];

        for (const [, data] of cashier_map) {
          let share_amount: number;
          if (share.revenue > 0) {
            share_amount =
              (data.total_sales / share.revenue) * share.cashierShare;
          } else {
            share_amount = share.cashierShare / cashier_map.size;
          }
          details.push({
            profit_share_log_id: log.id,
            cashier_id: data.cashier_id,
            cashier_name: data.cashier_name,
            total_sales: Math.round(data.total_sales),
            total_orders: data.total_orders,
            shift_count: data.shift_count,
            share_amount: Math.round(share_amount),
          });
        }

        // Sum-equals check: accumulate rounding error on the first record
        const sumOfShares = details.reduce((s, d) => s + d.share_amount, 0);
        const diff = Math.round(share.cashierShare) - sumOfShares;
        if (diff !== 0 && details.length > 0) {
          details[0].share_amount += diff;
        }

        const verifiedSum = details.reduce((s, d) => s + d.share_amount, 0);
        this.logger.debug(
          `[F19] ProfitShareDetail verification: sum=${verifiedSum} vs cashier_share=${Math.round(share.cashierShare)}`,
        );

        await this.financeRepository.createManyProfitShareDetails(details);
      }
    }

    if (share.netProfit <= 0) {
      this.logger.warn(
        `[NOTIF-RUGI] Laba bersih bulan ${month}/${year} minus...`,
      );
      try {
        await this.emailService.sendAlert(
          'Laporan Rugi Bulanan',
          `<p>Total penjualan bulan ini tidak menghasilkan laba.</p><p>Mohon periksa laporan keuangan untuk detail.</p>`,
        );
      } catch (emailError: unknown) {
        const err = emailError as Error;
        this.logger.error(
          `Failed to send loss notification email: ${err.message}`,
          err.stack,
        );
        // Don't throw - this is a non-critical operation
      }
    }

    return log;
  }

  async getAssets() {
    return this.financeRepository.findAssets(undefined, { created_at: 'desc' });
  }

  async createAsset(data: CreateAssetDto) {
    const purchase_price = Number(data.purchase_price);
    const lifespan_months = Number(data.useful_life_months);

    if (!purchase_price || !lifespan_months || lifespan_months <= 0) {
      throw new BadRequestException(
        'Invalid asset data: purchase_price and useful_life_months (>0) are required',
      );
    }

    return this.financeRepository.createAsset({
      name: data.name,
      purchase_price: purchase_price,
      useful_life_months: lifespan_months,
      monthly_depreciation: Math.round(purchase_price / lifespan_months),
      purchase_date: new Date(data.purchase_date),
      created_at: new Date(),
      is_active: true,
    });
  }

  async updateAsset(id: string, data: UpdateAssetDto) {
    const asset = await this.financeRepository.findAssetById(id);
    if (!asset) throw new NotFoundException('Asset not found');

    const new_value = data.purchase_price;
    const new_lifespan = data.useful_life_months;

    let parsed_value =
      new_value !== undefined ? Number(new_value) : Number(asset.purchase_price);
    let parsed_lifespan =
      new_lifespan !== undefined
        ? Number(new_lifespan)
        : asset.useful_life_months;

    if (new_value !== undefined && isNaN(parsed_value))
      parsed_value = Number(asset.purchase_price);
    if (new_lifespan !== undefined && isNaN(parsed_lifespan))
      parsed_lifespan = asset.useful_life_months;

    // SECURITY: Prevent division by zero
    if (parsed_lifespan <= 0) {
      throw new BadRequestException(
        'useful_life_months must be greater than 0',
      );
    }

    return this.financeRepository.updateAsset(id, {
      name: data.name,
      purchase_price: parsed_value,
      useful_life_months: parsed_lifespan,
      monthly_depreciation: Math.round(parsed_value / parsed_lifespan),
      purchase_date: data.purchase_date
        ? new Date(data.purchase_date)
        : asset.purchase_date,
      is_active:
        data.is_active !== undefined ? data.is_active : asset.is_active,
    });
  }

  async payProfitShare(
    month: number,
    year: number,
    proof: string,
    notes: string,
    adminId: string,
  ) {
    const periodMonth = new Date(year, month - 1, 1);

    const profit_share =
      await this.financeRepository.findProfitShareLogByPeriod(periodMonth);

    if (!profit_share) {
      throw new NotFoundException(
        'Data bagi hasil untuk bulan tersebut tidak ditemukan. Silakan tutup buku terlebih dahulu.',
      );
    }

    if (profit_share.is_paid) {
      throw new BadRequestException(
        'Bagi hasil untuk bulan ini sudah dibayarkan.',
      );
    }

    const updated = await this.financeRepository.updateProfitShareLog(
      profit_share.id,
      {
        is_paid: true,
        payment_proof: proof,
        notes: notes,
        cashier_paid_at: new Date(),
        cashier_paid_by: adminId,
        cashier_paid_amount: profit_share.cashier_share,
      },
    );

    await this.financeRepository.createAuditLog({
      actor_id: adminId,
      action: 'PROFIT_SHARE_PAID',
      entity_type: 'ProfitShareLog',
      entity_id: updated.id,
      new_value: {
        cashier_paid_amount: Number(updated.cashier_paid_amount),
        is_paid: true,
      },
    });

    return updated;
  }

  private buildTrend(
    orders: Order[],
    period: 'daily' | 'weekly' | 'monthly',
  ): { label: string; value: number }[] {
    const map = new Map<string, number>();
    for (const o of orders) {
      const d = o.created_at;
      let key: string;
      if (period === 'daily') {
        key = d.toISOString().split('T')[0];
      } else if (period === 'weekly') {
        key = `${d.getFullYear()}-M${d.getMonth() + 1}-W${Math.ceil(d.getDate() / 7)}`;
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      }
      map.set(key, (map.get(key) || 0) + Number(o.total_amount));
    }
    return Array.from(map.entries()).map(([label, value]) => ({
      label,
      value,
    }));
  }

  async getAnalytics(period: 'daily' | 'weekly' | 'monthly') {
    const now = new Date();
    const startDate = new Date();
    if (period === 'daily') {
      startDate.setDate(now.getDate() - 30);
    } else if (period === 'weekly') {
      startDate.setDate(now.getDate() - 90);
    } else if (period === 'monthly') {
      startDate.setMonth(now.getMonth() - 12);
    }

    // PERFORMANCE: Limit orders to prevent OOM
    // For very large datasets, use database aggregations instead
    const MAX_ANALYTICS_ORDERS = 10000;

    type OrderWithItems = Order & {
      items: Array<{
        product_id: string;
        product_name_snapshot: string | null;
        quantity: number;
        subtotal: Prisma.Decimal;
      }>;
    };

    const orders = (await this.financeRepository.findOrders(
      { created_at: { gte: startDate }, status: { not: 'voided' } },
      { items: true },
      MAX_ANALYTICS_ORDERS, // take limit
    )) as OrderWithItems[];

    const trend = this.buildTrend(orders, period);

    const product_map = new Map<
      string,
      { name: string; qty: number; revenue: number }
    >();
    for (const o of orders) {
      for (const item of o.items) {
        const p_id = item.product_id;
        const current = product_map.get(p_id) || {
          name: item.product_name_snapshot,
          qty: 0,
          revenue: 0,
        };
        current.qty += item.quantity;
        current.revenue += Number(item.subtotal);
        product_map.set(p_id, current);
      }
    }
    const product_stats = Array.from(product_map.values());
    const top_by_qty = [...product_stats]
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);
    const top_by_revenue = [...product_stats]
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    let cash = 0,
      qris = 0,
      split = 0;
    let cash_val = 0,
      qris_val = 0,
      split_val = 0;
    for (const o of orders) {
      if (o.payment_method === 'cash') {
        cash++;
        cash_val += Number(o.total_amount);
      } else if (o.payment_method === 'qris') {
        qris++;
        qris_val += Number(o.total_amount);
      } else if (o.payment_method === 'split') {
        split++;
        split_val += Number(o.total_amount);
      }
    }
    const counts = { cash, qris, split };
    const values = { cash: cash_val, qris: qris_val, split: split_val };

    const hoursCount = new Array(24).fill(0);
    for (const o of orders) {
      const h = o.client_created_at
        ? new Date(o.client_created_at).getHours()
        : o.created_at.getHours();
      hoursCount[h]++;
    }

    return {
      trend,
      topProducts: {
        byQty: top_by_qty,
        byRevenue: top_by_revenue,
      },
      paymentDistribution: {
        counts,
        values,
      },
      peakHours: hoursCount.map((count, hour) => ({ hour, count })),
    };
  }

  async getCurrentShift(cashierId: string) {
    const shift = await this.financeRepository.findFirstCashRegister(
      { cashier_id: cashierId, status: 'open' },
      { shift_start: 'desc' },
    );
    return shift;
  }

  async openShift(
    cashierId: string,
    opening_balance: number,
    planned_close_at?: string,
    carry_over_from_shift_id?: string,
  ) {
    const existing = await this.financeRepository.findFirstCashRegister({
      cashier_id: cashierId,
      status: 'open',
    });
    if (existing)
      throw new BadRequestException('Kasir masih memiliki shift aktif.');

    // Count closed shifts in single query
    const closedShifts = await this.financeRepository.findManyCashRegisters({
      cashier_id: cashierId,
      status: 'closed',
    });
    const shift_number = closedShifts.length + 1;

    // Default planned_close_at: 04:00 WIB next day (or next 04:00 if before 04:00)
    let planned_close: Date;
    if (planned_close_at) {
      planned_close = new Date(planned_close_at);
    } else {
      const now = new Date();
      planned_close = new Date(now);
      planned_close.setHours(4, 0, 0, 0); // 04:00 today
      if (planned_close <= now) {
        planned_close.setDate(planned_close.getDate() + 1); // next day if past 04:00
      }
    }

    return this.financeRepository.createCashRegister({
      cashier_id: cashierId,
      shift_date: new Date(),
      opening_balance: opening_balance,
      shift_number: shift_number,
      carry_over_from_shift_id: carry_over_from_shift_id ?? null,
      planned_close_at: planned_close,
      status: 'open',
    });
  }

  async closeShift(
    cashierId: string,
    actual_cash: number,
    notes?: string,
    is_auto_closed = false,
  ) {
    // FIX: Validate actual_cash is a valid number and non-negative
    if (typeof actual_cash !== 'number' || isNaN(actual_cash)) {
      throw new BadRequestException('Actual cash must be a valid number');
    }
    if (actual_cash < 0) {
      throw new BadRequestException('Actual cash cannot be negative');
    }

    const shift = await this.financeRepository.findFirstCashRegister(
      { cashier_id: cashierId, status: 'open' },
      { shift_start: 'desc' },
    );

    if (!shift) throw new NotFoundException('Tidak ada shift aktif.');

    // TINGGI-01: Get all orders (cash + split) to calculate cash portion from split payment
    const allOrders = await this.financeRepository.findOrders({
      cashier_id: cashierId,
      status: 'completed',
      created_at: { gte: shift.shift_start },
    });

    // Calculate total cash from both cash and split payment methods
    const totalCashSales = allOrders.reduce((sum, o) => {
      if (o.payment_method === 'cash') {
        return sum + Number(o.total_amount);
      }
      if (o.payment_method === 'split') {
        // Only count the cash portion from split payment
        return sum + Number(o.cash_amount || 0);
      }
      return sum; // qris doesn't go into cash drawer
    }, 0);

    const expected_balance = Number(shift.opening_balance) + totalCashSales;
    const discrepancy = actual_cash - expected_balance;

    const closed = await this.financeRepository.updateCashRegister(shift.id, {
      actual_close_at: new Date(),
      closing_balance: actual_cash,
      system_cash_total: expected_balance,
      discrepancy: discrepancy,
      is_auto_closed: is_auto_closed,
      notes: notes ?? null,
      status: 'closed',
    });

    const threshold = Number(process.env.DISCREPANCY_THRESHOLD || 5000);
    if (Math.abs(discrepancy) > threshold) {
      await this.emailService
        .sendAlert(
          'Peringatan Selisih Laci Kasir',
          `<p>Shift kasir dengan ID <strong>${cashierId}</strong> telah ditutup dengan <strong>selisih (discrepancy) Rp ${discrepancy}</strong>.</p>
         <p>Batas toleransi sistem adalah Rp ${threshold}. Mohon segera verifikasi laci kas.</p>`,
        )
        .catch((err: unknown) =>
          this.logger.error(
            'Failed to send discrepancy alert:',
            (err as Error).message,
          ),
        );
    }

    await this.financeRepository.createAuditLog({
      actor_id: cashierId,
      action: 'CASH_REGISTER_CLOSE',
      entity_type: 'CashRegister',
      entity_id: shift.id,
      new_value: {
        closing_balance: actual_cash,
        discrepancy: discrepancy,
        system_cash_total: expected_balance,
        is_auto_closed: is_auto_closed,
      },
    });

    return closed;
  }

  async getShifts() {
    return this.financeRepository.findManyCashRegisters(
      undefined,
      { shift_date: 'desc' },
      { cashier: { select: { name: true } } },
    );
  }
}
