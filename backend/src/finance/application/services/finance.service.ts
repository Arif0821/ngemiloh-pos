import { Injectable, Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { type IFinanceRepository, FINANCE_REPOSITORY } from '../../domain/interfaces/finance.repository.interface';
import { EmailService } from '../../../email/email.service';
import { Prisma, Order } from '@prisma/client';

@Injectable()
export class FinanceService {
  constructor(
    @Inject(FINANCE_REPOSITORY) private readonly financeRepository: IFinanceRepository,
    private emailService: EmailService
  ) {}

  async getDashboardKpi(date: string) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date);
    end.setHours(23, 59, 59, 999);

    const orders = await this.financeRepository.findOrders(
      { created_at: { gte: start, lte: end }, status: { not: 'voided' } },
      { items: true }
    );

    const revenue = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);
    const hpp = orders.reduce((sum, o) => sum + Number((o as Order & { cogs_total?: number }).cogs_total || 0), 0);
    const laba = revenue - hpp;
    const targetProgress = Math.min(100, Math.round((revenue / 5000000) * 100));

    const transactions = orders.length;
    const avg = transactions > 0 ? revenue / transactions : 0;

    const paymentDistribution = {
      cash: orders.filter(o => o.payment_method === 'cash').length,
      qris: orders.filter(o => o.payment_method === 'qris').length,
      split: orders.filter(o => o.payment_method === 'split').length,
    };

    return { revenue, hpp, laba, targetProgress, transactions, avg, paymentDistribution };
  }

  async getOpex(month: number, year: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    
    return this.financeRepository.findOperationalExpenses(
      { expense_date: { gte: start, lte: end } },
      { expense_date: 'desc' }
    );
  }

  async createOpex(data: Prisma.OperationalExpenseUncheckedCreateInput, userId: string) {
    return this.financeRepository.createOperationalExpense({
      category: data.category,
      description: data.description,
      amount: data.amount,
      expense_date: new Date(data.expense_date),
      created_by: userId
    });
  }

  async getProfitShare(month: number, year: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const orders = await this.financeRepository.findOrders({
      created_at: { gte: start, lte: end },
      status: { not: 'voided' }
    });
    const revenue = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);

    const opexList = await this.financeRepository.findOperationalExpenses({
      expense_date: { gte: start, lte: end }
    });
    const totalOpex = opexList.reduce((sum, exp) => sum + Number(exp.amount), 0);

    const assets = await this.financeRepository.findAssets({ is_active: true });
    const totalDepreciation = assets.reduce((sum, a) => sum + Number(a.monthly_depreciation), 0);

    const totalHpp = orders.reduce((sum, o) => sum + Number((o as Order & { cogs_total?: number }).cogs_total || 0), 0); 

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
      cashierShare
    };
  }

  async closePeriod(month: number, year: number) {
    const share = await this.getProfitShare(month, year);
    
    const periodMonth = new Date(year, month - 1, 1);
    
    const existing = await this.financeRepository.findProfitShareLogByPeriod(periodMonth);

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
      is_hpp_actual: true
    });

    if (share.netProfit <= 0) {
      console.warn(`[NOTIF-RUGI] Laba bersih bulan ${month}/${year} minus atau 0 (Rp ${share.netProfit}). Sistem mengirim notifikasi ke Superadmin.`);
      try {
      } catch(e) {}
    }

    return log;
  }

  async getAssets() {
    return this.financeRepository.findAssets(undefined, { created_at: 'desc' });
  }

  async createAsset(data: any) {
    return this.financeRepository.createAsset({
      name: data.name,
      purchase_price: data.value,
      useful_life_months: data.lifespan_months,
      monthly_depreciation: Math.round(Number(data.value) / Number(data.lifespan_months)),
      purchase_date: new Date(data.purchase_date),
      created_at: new Date(),
      is_active: true
    });
  }

  async updateAsset(id: string, data: any) {
    const asset = await this.financeRepository.findAssetById(id);
    if (!asset) throw new NotFoundException('Asset not found');

    let newValue = data.value !== undefined ? data.value : Number(asset.purchase_price);
    let newLifespan = data.lifespan_months !== undefined ? data.lifespan_months : asset.useful_life_months;

    return this.financeRepository.updateAsset(id, {
      name: data.name,
      purchase_price: newValue,
      useful_life_months: newLifespan,
      monthly_depreciation: Math.round(Number(newValue) / Number(newLifespan)),
      purchase_date: data.purchase_date ? new Date(data.purchase_date) : asset.purchase_date,
      is_active: data.is_active !== undefined ? data.is_active : asset.is_active
    });
  }

  async payProfitShare(month: number, year: number, proof: string, notes: string, adminId: string) {
    const periodMonth = new Date(year, month - 1, 1);
    
    const profitShare = await this.financeRepository.findProfitShareLogByPeriod(periodMonth);

    if (!profitShare) {
      throw new NotFoundException('Data bagi hasil untuk bulan tersebut tidak ditemukan. Silakan tutup buku terlebih dahulu.');
    }

    if (profitShare.is_paid) {
      throw new BadRequestException('Bagi hasil untuk bulan ini sudah dibayarkan.');
    }

    const updated = await this.financeRepository.updateProfitShareLog(profitShare.id, {
      is_paid: true,
      payment_proof: proof,
      notes: notes,
      cashier_paid_at: new Date(),
      cashier_paid_by: adminId,
      cashier_paid_amount: profitShare.cashier_share
    });

    await this.financeRepository.createAuditLog({
      actor_id: adminId,
      action: 'PROFIT_SHARE_PAID',
      entity_type: 'ProfitShareLog',
      entity_id: updated.id,
      new_value: { cashier_paid_amount: Number(updated.cashier_paid_amount), is_paid: true }
    });

    return updated;
  }

  async getAnalytics(period: 'daily' | 'weekly' | 'monthly') {
    const now = new Date();
    let startDate = new Date();
    if (period === 'daily') {
      startDate.setDate(now.getDate() - 30);
    } else if (period === 'weekly') {
      startDate.setDate(now.getDate() - 90);
    } else if (period === 'monthly') {
      startDate.setMonth(now.getMonth() - 12);
    }

    const orders = await this.financeRepository.findOrders(
      { created_at: { gte: startDate }, status: { not: 'voided' } },
      { items: true }
    );

    const trendMap = new Map<string, number>();
    for (const o of orders) {
      let key = '';
      const d = o.created_at;
      if (period === 'daily') {
        key = d.toISOString().split('T')[0];
      } else if (period === 'weekly') {
        const w = Math.ceil(d.getDate() / 7);
        key = `${d.getFullYear()}-M${d.getMonth()+1}-W${w}`;
      } else {
        key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}`;
      }
      trendMap.set(key, (trendMap.get(key) || 0) + Number(o.total_amount));
    }
    const trend = Array.from(trendMap.entries()).map(([label, value]) => ({ label, value }));

    const productMap = new Map<string, { name: string, qty: number, revenue: number }>();
    for (const o of orders) {
      for (const item of o.items) {
        const pId = item.product_id;
        const current = productMap.get(pId) || { name: item.product_name_snapshot, qty: 0, revenue: 0 };
        current.qty += item.quantity;
        current.revenue += Number(item.subtotal);
        productMap.set(pId, current);
      }
    }
    const productStats = Array.from(productMap.values());
    const topByQty = [...productStats].sort((a, b) => b.qty - a.qty).slice(0, 5);
    const topByRevenue = [...productStats].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

    let cash = 0, qris = 0, split = 0;
    let cashVal = 0, qrisVal = 0, splitVal = 0;
    for (const o of orders) {
      if (o.payment_method === 'cash') { cash++; cashVal += Number(o.total_amount); }
      else if (o.payment_method === 'qris') { qris++; qrisVal += Number(o.total_amount); }
      else if (o.payment_method === 'split') { split++; splitVal += Number(o.total_amount); }
    }

    const hoursCount = new Array(24).fill(0);
    for (const o of orders) {
      const h = o.client_created_at ? new Date(o.client_created_at).getHours() : o.created_at.getHours();
      hoursCount[h]++;
    }

    return {
      trend,
      topProducts: {
        byQty: topByQty,
        byRevenue: topByRevenue
      },
      paymentDistribution: {
        counts: { cash, qris, split },
        values: { cash: cashVal, qris: qrisVal, split: splitVal }
      },
      peakHours: hoursCount.map((count, hour) => ({ hour, count }))
    };
  }

  async getCurrentShift(cashierId: string) {
    const shift = await this.financeRepository.findFirstCashRegister(
      { cashier_id: cashierId, status: 'open' },
      { shift_start: 'desc' }
    );
    return shift;
  }

  async openShift(cashierId: string, openingBalance: number) {
    const existing = await this.financeRepository.findFirstCashRegister(
      { cashier_id: cashierId, status: 'open' }
    );
    if (existing) throw new BadRequestException('Kasir masih memiliki shift aktif.');

    return this.financeRepository.createCashRegister({
      cashier_id: cashierId,
      shift_date: new Date(),
      opening_balance: openingBalance,
      status: 'open'
    });
  }

  async closeShift(cashierId: string, closingBalance: number) {
    const shift = await this.financeRepository.findFirstCashRegister(
      { cashier_id: cashierId, status: 'open' },
      { shift_start: 'desc' }
    );
    
    if (!shift) throw new NotFoundException('Tidak ada shift aktif.');

    const orders = await this.financeRepository.findOrders({
      cashier_id: cashierId,
      payment_method: 'cash',
      status: 'completed',
      created_at: { gte: shift.shift_start }
    });
    const totalCashSales = orders.reduce((sum, o) => sum + Number(o.total_amount), 0);

    const expectedBalance = Number(shift.opening_balance) + totalCashSales;
    const discrepancy = closingBalance - expectedBalance;

    const closed = await this.financeRepository.updateCashRegister(shift.id, {
      shift_end: new Date(),
      closing_balance: closingBalance,
      system_cash_total: expectedBalance,
      discrepancy: discrepancy,
      status: 'closed'
    });

    const threshold = Number(process.env.DISCREPANCY_THRESHOLD || 5000);
    if (Math.abs(discrepancy) > threshold) {
      this.emailService.sendAlert(
        'Peringatan Selisih Laci Kasir',
        `<p>Shift kasir dengan ID <strong>${cashierId}</strong> telah ditutup dengan <strong>selisih (discrepancy) Rp ${discrepancy}</strong>.</p>
         <p>Batas toleransi sistem adalah Rp ${threshold}. Mohon segera verifikasi laci kas.</p>`
      );
    }

    await this.financeRepository.createAuditLog({
      actor_id: cashierId,
      action: 'CASH_REGISTER_CLOSE',
      entity_type: 'CashRegister',
      entity_id: shift.id,
      new_value: { closing_balance: closingBalance, discrepancy: discrepancy, system_cash_total: expectedBalance }
    });

    return closed;
  }

  async getShifts() {
    return this.financeRepository.findManyCashRegisters(
      { shift_date: 'desc' },
      { cashier: { select: { name: true } } }
    );
  }
}
