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
  type CashRegister,
} from '../../domain/interfaces/finance.repository.interface';
import { EmailService } from '../../../email/email.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { Prisma, Order } from '@prisma/client';
import {
  CreateAssetDto,
  UpdateAssetDto,
} from '../../presentation/dto/finance.dto';
import { TAX_RATE } from '../../../common/utils/constants';

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);

  constructor(
    @Inject(FINANCE_REPOSITORY)
    private readonly financeRepository: IFinanceRepository,
    private emailService: EmailService,
    private prisma: PrismaService,
  ) {}

  async getDashboardKpi(date: string) {
    // TINGGI-06: Filter by SHIFT RANGE, bukan created_at date
    const query_date = new Date(date);
    query_date.setHours(0, 0, 0, 0);
    const query_date_end = new Date(date);
    query_date_end.setHours(23, 59, 59, 999);

    // Cari semua shift yang DIMULAI pada tanggal tersebut
    const shifts = await this.prisma.cashRegister.findMany({
      where: {
        shift_start: { gte: query_date, lte: query_date_end },
      },
      select: {
        id: true,
        cashier_id: true,
        shift_start: true,
        actual_close_at: true,
      },
    });

    if (shifts.length === 0) {
      return {
        revenue: 0,
        gross_revenue: 0,
        total_tax: 0,
        cogs: 0,
        net_profit: 0,
        order_count: 0,
        avg: 0,
        payment_distribution: { cash: 0, qris: 0, split: 0 },
      };
    }

    // Build OR conditions for each shift's time range
    const shiftConditions = shifts.map((shift) => ({
      cashier_id: shift.cashier_id,
      created_at: {
        gte: shift.shift_start,
        lt: shift.actual_close_at || new Date(),
      },
    }));

    // Query order berdasarkan cashier_id + created_at range (shift-based)
    const [aggregateResult, paymentCounts] = await Promise.all([
      this.prisma.order.aggregate({
        where: {
          OR: shiftConditions,
          status: { not: 'voided' },
        },
        _sum: { total_amount: true, cogs_total: true },
        _count: true,
      }),
      this.prisma.$queryRaw<{ payment_method: string; count: bigint }[]>`
        SELECT payment_method, COUNT(*)::bigint as count
        FROM orders
        WHERE (${Prisma.join(
          shifts.map(
            (s) =>
              Prisma.sql`(cashier_id = ${s.cashier_id} AND created_at >= ${s.shift_start} AND created_at < ${s.actual_close_at || new Date()})`,
          ),
          ' OR ',
        )})
          AND status != 'voided'
        GROUP BY payment_method
      `,
    ]);

    const revenue = Number(aggregateResult._sum.total_amount || 0);
    const cogs = Number(aggregateResult._sum.cogs_total || 0);
    const transactions = aggregateResult._count;

    // PPN 11% dari revenue (Tax Inclusive → Ekstrak)
    const gross_revenue = revenue / (1 + TAX_RATE);
    const total_tax = Math.round(revenue - gross_revenue);

    // Net profit = Gross Revenue - Tax - COGS
    const net_profit = Math.round(gross_revenue - cogs);

    // Payment distribution
    const payment_distribution = { cash: 0, qris: 0, split: 0 };
    for (const row of paymentCounts) {
      if (row.payment_method in payment_distribution) {
        payment_distribution[
          row.payment_method as keyof typeof payment_distribution
        ] = Number(row.count);
      }
    }

    // FIX: Use environment variable instead of hardcoded target
    const dailyRevenueTarget = Number(
      process.env.DAILY_REVENUE_TARGET || 5000000,
    );
    // SECURITY: Prevent division by zero
    const targetProgress =
      dailyRevenueTarget > 0
        ? Math.min(100, Math.round((revenue / dailyRevenueTarget) * 100))
        : 0;

    const avg = transactions > 0 ? revenue / Number(transactions) : 0;

    return {
      revenue,
      gross_revenue: Math.round(gross_revenue),
      total_tax,
      cogs,
      net_profit,
      order_count: transactions,
      avg,
      targetProgress,
      payment_distribution,
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

    // #9 FIX: Filter by SHIFT DATES instead of created_at
    // Find all shifts that started during the period
    const shifts = await this.prisma.cashRegister.findMany({
      where: {
        shift_start: { gte: start, lte: end },
      },
      select: {
        id: true,
        cashier_id: true,
        shift_start: true,
        actual_close_at: true,
      },
    });

    if (shifts.length === 0) {
      throw new NotFoundException('No shifts found for the specified period.');
    }

    // Build OR conditions for each shift's time range
    const shiftConditions = shifts.map((shift) => ({
      cashier_id: shift.cashier_id,
      created_at: {
        gte: shift.shift_start,
        lt: shift.actual_close_at || new Date(),
      },
    }));

    // ISSUE #14 FIX: Use Prisma aggregation instead of loading all orders to memory
    // This prevents OOM for large datasets and is much more efficient
    const [revenueResult, hppResult] = await Promise.all([
      this.prisma.order.aggregate({
        where: {
          OR: shiftConditions,
          status: { not: 'voided' },
        },
        _sum: { total_amount: true },
        _count: true,
      }),
      this.prisma.order.aggregate({
        where: {
          OR: shiftConditions,
          status: { not: 'voided' },
        },
        _sum: { cogs_total: true },
      }),
    ]);

    const revenue = Number(revenueResult._sum.total_amount || 0);
    const totalHpp = Number(hppResult._sum.cogs_total || 0);
    const ordersCount = revenueResult._count;

    if (ordersCount === 0) {
      throw new NotFoundException('No orders found for the specified period.');
    }

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

    const netProfit = revenue - totalHpp - totalOpex - totalDepreciation;

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
      shifts_count: shifts.length,
      orders_count: ordersCount,
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

      // ISSUE #14: Use database-level aggregation instead of in-memory processing
      // This is much more efficient for large datasets and avoids OOM issues
      const cashierAggregations =
        await this.financeRepository.aggregateOrdersByCashier(
          start,
          end,
          cashierIds,
        );

      // Map cashier aggregations with their shift counts
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

      // Get shift counts per cashier
      for (const cashierAgg of cashierAggregations) {
        const cashierShifts = closedShifts.filter(
          (s) => s.cashier_id === cashierAgg.cashier_id,
        );
        cashier_map.set(cashierAgg.cashier_id, {
          cashier_id: cashierAgg.cashier_id,
          cashier_name: cashierAgg.cashier_name,
          total_sales: cashierAgg.total_sales,
          total_orders: cashierAgg.total_orders,
          shift_count: cashierShifts.length,
        });
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
          // SECURITY: Prevent division by zero - use ternary for explicit guard
          const share_amount =
            share.revenue > 0
              ? (data.total_sales / share.revenue) * share.cashierShare
              : cashier_map.size > 0
                ? share.cashierShare / cashier_map.size
                : 0;
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
      new_value !== undefined
        ? Number(new_value)
        : Number(asset.purchase_price);
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

    // ISSUE #14: Use database-level aggregation instead of loading orders into memory
    // This is much more efficient for large datasets and avoids OOM issues
    const analytics = await this.financeRepository.aggregateAnalytics(
      startDate,
      now,
      period,
    );

    return {
      trend: analytics.trend,
      topProducts: {
        byQty: analytics.topProductsByQty.map((p) => ({
          name: p.product_name,
          qty: p.qty,
          revenue: p.revenue,
        })),
        byRevenue: analytics.topProductsByRevenue.map((p) => ({
          name: p.product_name,
          qty: p.qty,
          revenue: p.revenue,
        })),
      },
      paymentDistribution: analytics.paymentDistribution,
      peakHours: analytics.peakHours,
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
    outlet_id: string,
    planned_close_at?: string,
    carry_over_from_shift_id?: string,
  ) {
    // FASE 4: Multi-Outlet - validate cashier is assigned to this outlet
    const assignment = await this.prisma.userOutlet.findUnique({
      where: {
        user_id_outlet_id: {
          user_id: cashierId,
          outlet_id: outlet_id,
        },
      },
      include: {
        outlet: true,
      },
    });

    if (!assignment || !assignment.outlet.is_active) {
      throw new BadRequestException('Kasir tidak ditugaskan di outlet ini');
    }

    // Check if there's already an open shift for this cashier at this outlet today
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of day
    const existing = await this.financeRepository.findFirstCashRegister({
      cashier_id: cashierId,
      outlet_id: outlet_id,
      status: 'open',
      shift_date: today,
    });
    if (existing)
      throw new BadRequestException(
        'Kasir masih memiliki shift aktif di outlet ini.',
      );

    // PERFORMANCE: Use count instead of findMany when only counting records
    const closedShiftCount = await this.financeRepository.countCashRegisters({
      cashier_id: cashierId,
      outlet_id: outlet_id,
      status: 'closed',
    });
    const shift_number = closedShiftCount + 1;

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
      outlet_id: outlet_id,
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

    // FIX #13: Use advisory lock to prevent race condition with auto-close
    const lockKey = `shift:close:${shift.id}`;
    const lockId = this.hashStringToBigInt(lockKey);
    const maxRetries = 3;
    const retryDelayMs = 100;

    let closeResult: CashRegister | undefined = undefined;
    let lockAcquired = false;

    try {
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const acquired = await this.prisma
          .$executeRaw<number>`SELECT pg_try_advisory_lock(${lockId})`;

        if (acquired === 1) {
          lockAcquired = true;
          try {
            // Double-check shift is still open (optimistic locking)
            const currentShift = await this.prisma.cashRegister.findUnique({
              where: { id: shift.id },
              select: { status: true },
            });

            if (!currentShift || currentShift.status !== 'open') {
              throw new BadRequestException(
                'Shift sudah ditutup oleh proses lain.',
              );
            }

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

            const expected_balance =
              Number(shift.opening_balance) + totalCashSales;
            const discrepancy = actual_cash - expected_balance;

            closeResult = await this.financeRepository.updateCashRegister(
              shift.id,
              {
                actual_close_at: new Date(),
                closing_balance: actual_cash,
                system_cash_total: expected_balance,
                discrepancy: discrepancy,
                is_auto_closed: is_auto_closed,
                notes: notes ?? null,
                status: 'closed',
              },
            );

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
          } finally {
            await this.prisma.$executeRaw`SELECT pg_advisory_unlock(${lockId})`;
            lockAcquired = false;
          }
          return closeResult; // Success
        }

        // Lock not acquired, retry with backoff
        if (attempt < maxRetries) {
          const jitter = Math.floor(Math.random() * 50);
          await new Promise((resolve) =>
            setTimeout(resolve, retryDelayMs + jitter),
          );
        }
      }

      throw new Error('Gagal menutup shift: sibuk, coba lagi');
    } finally {
      // SECURITY: Outer finally as safety net - ensure lock is released if acquired
      if (lockAcquired) {
        await this.prisma.$executeRaw`SELECT pg_advisory_unlock(${lockId})`;
        this.logger.warn(
          `Outer finally released lock for shift close ${shift.id}`,
        );
      }
    }
  }

  /**
   * Admin escape hatch: Force close any shift by ID
   * Bypasses normal flow for stuck shifts
   */
  async forceCloseShift(
    shiftId: string,
    actualCash: number,
    reason: string,
    adminId: string,
  ) {
    const shift = await this.prisma.cashRegister.findUnique({
      where: { id: shiftId },
    });

    if (!shift) {
      throw new NotFoundException('Shift tidak ditemukan');
    }

    if (shift.status === 'closed') {
      throw new BadRequestException('Shift sudah ditutup');
    }

    // Calculate totals
    const orders = await this.financeRepository.findOrders({
      cashier_id: shift.cashier_id,
      status: 'completed',
      created_at: { gte: shift.shift_start },
    });

    const totalCashSales = orders.reduce((sum, o) => {
      if (o.payment_method === 'cash') return sum + Number(o.total_amount);
      if (o.payment_method === 'split') return sum + Number(o.cash_amount || 0);
      return sum;
    }, 0);

    const expectedBalance = Number(shift.opening_balance) + totalCashSales;
    const discrepancy = actualCash - expectedBalance;

    // Close shift
    const closed = await this.prisma.cashRegister.update({
      where: { id: shiftId },
      data: {
        status: 'closed',
        actual_close_at: new Date(),
        closing_balance: actualCash,
        system_cash_total: expectedBalance,
        discrepancy,
        notes: `[ESCAPE HATCH] ${reason}`,
        is_auto_closed: true,
      },
    });

    // Audit log with escape hatch marker
    await this.financeRepository.createAuditLog({
      actor_id: adminId,
      action: 'CASH_REGISTER_ESCAPE_HATCH',
      entity_type: 'CashRegister',
      entity_id: shiftId,
      old_value: { status: 'open', cashier: shift.cashier_id },
      new_value: {
        status: 'closed',
        closing_balance: actualCash,
        discrepancy,
        reason,
        forced_by: adminId,
      },
    });

    this.logger.warn(
      `ESCAPE HATCH: Shift ${shiftId} force-closed by admin ${adminId}. Reason: ${reason}`,
    );

    return closed;
  }

  /**
   * Convert string to bigint for PostgreSQL advisory lock
   */
  private hashStringToBigInt(str: string): bigint {
    let hash = 2166136261n;
    for (let i = 0; i < str.length; i++) {
      hash ^= BigInt(str.charCodeAt(i));
      hash *= 16777619n;
    }
    return hash & 0x7fffffffffffffffn;
  }

  async getShifts() {
    return this.financeRepository.findManyCashRegisters(
      undefined,
      { shift_date: 'desc' },
      { cashier: { select: { name: true } } },
    );
  }
}
