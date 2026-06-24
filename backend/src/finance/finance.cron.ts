import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { InventoryService } from '../inventory/application/services/inventory.service';
import {
  AUTO_CLOSE_GRACE_MS,
  AUTO_CLOSE_WARNING_MS,
} from '../common/utils/constants';

@Injectable()
export class FinanceCronService {
  private readonly logger = new Logger(FinanceCronService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    private inventoryService: InventoryService,
  ) {}

  // Run every 15 minutes to check for shifts needing auto-close
  @Cron('*/15 * * * *', { timeZone: process.env.TZ || 'Asia/Jakarta' })
  async checkAutoCloseShifts() {
    this.logger.log('Checking for shifts needing auto-close...');

    const now = new Date();

    // Find open shifts that are past their planned_close_at + grace period
    const overdueShifts = await this.prisma.cashRegister.findMany({
      where: {
        status: 'open',
        planned_close_at: {
          not: null,
          lte: new Date(now.getTime() - AUTO_CLOSE_GRACE_MS),
        },
      },
      include: {
        cashier: { select: { name: true, email: true } },
      },
    });

    if (overdueShifts.length === 0) {
      this.logger.log('No overdue shifts found.');
      return;
    }

    // PERFORMANCE: Close shifts in parallel instead of sequentially
    await Promise.all(overdueShifts.map((shift) => this.autoCloseShift(shift)));
  }

  // Run every 15 minutes to send 90-minute warnings
  @Cron('*/15 * * * *', { timeZone: process.env.TZ || 'Asia/Jakarta' })
  async sendAutoCloseWarnings() {
    const now = new Date();
    const warningWindow = new Date(now.getTime() + AUTO_CLOSE_WARNING_MS); // 90 min ahead

    // Find open shifts whose planned_close_at is within 90 minutes from now
    const shiftsNearClose = await this.prisma.cashRegister.findMany({
      where: {
        status: 'open',
        planned_close_at: {
          not: null,
          gt: now,
          lte: warningWindow,
        },
      },
      include: {
        cashier: { select: { name: true, email: true } },
      },
    });

    for (const shift of shiftsNearClose) {
      const plannedClose = shift.planned_close_at;
      const minutesLeft = Math.round(
        (plannedClose.getTime() - now.getTime()) / 60000,
      );
      this.logger.log(
        `Shift warning: ${shift.id} closes in ${minutesLeft} minutes`,
      );

      // Kirim email peringatan ke kasir (TINGGI-05)
      if (shift.cashier.email) {
        await this.emailService
          .sendAlert(
            `Peringatan: Shift Anda akan otomatis ditutup dalam ${minutesLeft} menit`,
            `
              <p>Halo <strong>${shift.cashier.name}</strong>,</p>
              <p>Shift Anda akan <strong>otomatis ditutup</strong> dalam
                 <strong>${minutesLeft} menit</strong>.</p>
              <p>Mohon segera tutup shift secara manual melalui aplikasi POS
                 dan hitung uang tunai Anda.</p>
              <p>Jika Anda sudah tutup shift, abaikan pesan ini.</p>
            `,
          )
          .catch((err) =>
            this.logger.error(
              `Gagal kirim warning email ke ${shift.cashier.email}: ${err.message}`,
            ),
          );
      }

      // CATAT KE DATABASE UNTUK DASHBOARD NOTIFIKASI
      await this.prisma.systemLog.create({
        data: {
          level: 'warn',
          source: 'finance.cron',
          message: `Shift warning: ${shift.id} closes in ${minutesLeft} minutes`,
          metadata: JSON.stringify({
            shift_id: shift.id,
            cashier_id: shift.cashier_id,
            cashier_name: shift.cashier.name,
            minutes_left: minutesLeft,
          }),
        },
      });
    }
  }

  private async autoCloseShift(shift: {
    id: string;
    cashier_id: string;
    opening_balance: unknown;
    shift_start: Date;
    cashier: { name: string; email: string | null };
  }) {
    // FIX #13: Use advisory lock to prevent race condition with manual close
    // Each shift gets its own lock key to allow parallel processing of different shifts
    const lockKey = `shift:auto_close:${shift.id}`;
    const lockId = this.hashStringToBigInt(lockKey);
    const maxRetries = 3;
    const retryDelayMs = 100;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const lockAcquired = await this.prisma
        .$executeRaw<number>`SELECT pg_try_advisory_lock(${lockId})`;

      if (lockAcquired === 1) {
        try {
          await this.doAutoCloseShift(shift);
        } finally {
          await this.prisma.$executeRaw`SELECT pg_advisory_unlock(${lockId})`;
        }
        return; // Success
      }

      // Lock not acquired, retry with backoff
      if (attempt < maxRetries) {
        const jitter = Math.floor(Math.random() * 50);
        await new Promise((resolve) =>
          setTimeout(resolve, retryDelayMs + jitter),
        );
      }
    }

    this.logger.warn(
      `Could not acquire lock for auto-close of shift ${shift.id}, will retry next cron run`,
    );
  }

  private async doAutoCloseShift(shift: {
    id: string;
    cashier_id: string;
    opening_balance: unknown;
    shift_start: Date;
    cashier: { name: string; email: string | null };
  }) {
    this.logger.warn(
      `Auto-closing shift ${shift.id} for cashier ${shift.cashier.name}`,
    );

    // FIX #13: Double-check shift is still open (optimistic locking)
    const currentShift = await this.prisma.cashRegister.findUnique({
      where: { id: shift.id },
      select: { status: true },
    });

    if (!currentShift || currentShift.status !== 'open') {
      this.logger.log(
        `Shift ${shift.id} is no longer open (status: ${currentShift?.status}), skipping auto-close`,
      );
      return;
    }

    try {
      // Waktu auto-close = sekarang (saat cron berjalan)
      const auto_close_time = new Date();

      // Calculate cash totals for this shift using shift_start as anchor
      // FIXED: Gunakan boundary shift_start to auto_close_time
      const orders = await this.prisma.order.findMany({
        where: {
          cashier_id: shift.cashier_id,
          status: 'completed',
          created_at: {
            gte: shift.shift_start, // mulai shift dibuka
            lt: auto_close_time, // sampai saat auto-close
          },
        },
      });

      const totalCashSales = orders.reduce((sum, o) => {
        if (o.payment_method === 'cash') return sum + Number(o.total_amount);
        if (o.payment_method === 'split')
          return sum + Number(o.cash_amount || 0);
        return sum;
      }, 0);

      const expectedBalance = Number(shift.opening_balance) + totalCashSales;

      await this.prisma.cashRegister.update({
        where: { id: shift.id },
        data: {
          status: 'closed',
          actual_close_at: new Date(),
          closing_balance: expectedBalance,
          system_cash_total: expectedBalance,
          discrepancy: 0,
          is_auto_closed: true,
        },
      });

      await this.prisma.auditLog.create({
        data: {
          actor_id: shift.cashier_id,
          action: 'CASH_REGISTER_AUTO_CLOSE',
          entity_type: 'CashRegister',
          entity_id: shift.id,
          new_value: {
            reason: 'Auto-closed: planned_close_at exceeded grace period',
            system_cash_total: expectedBalance,
          },
        },
      });

      this.logger.log(`Shift ${shift.id} auto-closed successfully.`);
    } catch (err) {
      this.logger.error(
        `Failed to auto-close shift ${shift.id}: ${(err as Error).message}`,
      );
    }
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

  // Run at 08:00 on day 1 of every month in Asia/Jakarta timezone
  // NOTE: NestJS @Cron timeZone option is NOT reliably applied by the scheduler library.
  // The TZ env var (set to Asia/Jakarta in docker-compose.yml) is the authoritative timezone.
  @Cron('0 8 1 * *', { timeZone: process.env.TZ || 'Asia/Jakarta' })
  async checkUnpaidProfitShare() {
    this.logger.log('Running monthly profit share reminder check...');

    // Get previous month
    // JS Date.getMonth() is 0-indexed: January=0, December=11
    // We want the profit share for the month that just ended.
    // E.g., if today is June 1st (month=5), we want May (month=4)
    const now = new Date();
    let month = now.getMonth(); // Current month index (0-11)
    let year = now.getFullYear();

    // Convert current month to previous month (index conversion for new Date())
    // If month=0 (January), we want December of previous year
    if (month === 0) {
      month = 12;
      year--;
    }
    // month - 1 converts from current month to previous month index for new Date()
    // e.g., June (5) -> May (4) because new Date(2026, 4, 1) = May 1, 2026
    const periodMonth = new Date(year, month - 1, 1);

    const log = await this.prisma.profitShareLog.findUnique({
      where: { period_month: periodMonth },
    });

    if (!log) {
      this.logger.warn(
        `Laporan bagi hasil untuk bulan ${month}/${year} belum ditutup. Sending reminder...`,
      );
      await this.emailService
        .sendAlert(
          `Peringatan: Laporan Bagi Hasil Belum Ditutup - ${month}/${year}`,
          `<p>Laporan bagi hasil untuk bulan ${month} tahun ${year} <strong>belum ditutup</strong>.</p>
         <p>Mohon segera tutup buku laporan bagi hasil sebelum tanggal 5 bulan ini.</p>
         <p>Jika laporan sudah ditutup, abaikan email ini.</p>`,
        )
        .catch((err) =>
          this.logger.error(
            `Failed to send profit share reminder: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
      return;
    }

    if (!log.is_paid) {
      const amount = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
      }).format(Number(log.cashier_share));
      await this.emailService
        .sendAlert(
          `Reminder: Tunggakan Bagi Hasil Bulan ${month}/${year}`,
          `<p>Peringatan dari sistem. Anda <strong>belum membayar bagi hasil kasir</strong> untuk periode bulan ${month} tahun ${year}.</p>
         <p>Total yang harus dibayarkan: <strong>${amount}</strong>.</p>
         <p>Deadline penyelesaian adalah <strong>tanggal 5 bulan ini</strong>. Mohon segera melunasi dan memperbarui status di halaman laporan.</p>`,
        )
        .catch((err) =>
          this.logger.error(
            `Failed to send profit share reminder: ${err instanceof Error ? err.message : String(err)}`,
          ),
        );
    }
  }

  /**
   * Cron job to check and void expired QRIS orders
   * Runs every 5 minutes
   */
  @Cron('*/5 * * * *', { timeZone: process.env.TZ || 'Asia/Jakarta' })
  async checkExpiredQrisOrders() {
    this.logger.log('Checking for expired QRIS orders...');

    // Check feature flag
    const flags = await this.prisma.featureFlag.findFirst({
      where: { name: 'FEATURE_QRIS_EXPIRY_ENFORCEMENT' },
    });

    if (!flags || !flags.is_enabled) {
      this.logger.log(
        'FEATURE_QRIS_EXPIRY_ENFORCEMENT is disabled, skipping check',
      );
      return;
    }

    // Calculate expiry minutes from env
    const expiry_seconds = parseInt(process.env.QRIS_EXPIRY_SECONDS || '900', 10);
    const expiry_minutes = Math.round(expiry_seconds / 60);

    const now = new Date();

    // Find expired QRIS orders: payment_method in ['qris', 'split'],
    // status='pending_sync', payment_status='unpaid', qris_expiry_at < now
    const expiredOrders = await this.prisma.order.findMany({
      where: {
        payment_method: { in: ['qris', 'split'] },
        status: 'pending_sync',
        payment_status: 'unpaid',
        qris_expiry_at: { not: null, lt: now },
      },
      select: {
        id: true,
        order_number: true,
        total_amount: true,
        qris_expiry_at: true,
      },
    });

    if (expiredOrders.length === 0) {
      this.logger.log('No expired QRIS orders found.');
      return;
    }

    this.logger.log(
      `Found ${expiredOrders.length} expired QRIS orders to void`,
    );

    let success_count = 0;
    let failure_count = 0;
    let total_amount = 0;
    const order_numbers: (string | null)[] = [];

    for (const order of expiredOrders) {
      const void_reason = `QRIS expired: no payment received within ${expiry_minutes} minutes`;
      try {
        await this.voidExpiredQrisOrder(order.id, void_reason);
        success_count++;
        total_amount += Number(order.total_amount);
        order_numbers.push(order.order_number);
      } catch (err) {
        failure_count++;
        this.logger.error(
          `Failed to void expired QRIS order ${order.id}: ${(err as Error).message}`,
        );
      }
    }

    // Send email alert
    await this.sendExpiryAlert(
      success_count,
      failure_count,
      total_amount,
      order_numbers,
    );

    // Create system log entry
    await this.prisma.systemLog.create({
      data: {
        level: failure_count > 0 ? 'warn' : 'info',
        source: 'finance.cron',
        message: `QRIS expiry enforcement: ${success_count} voided, ${failure_count} failed`,
        metadata: JSON.stringify({
          success_count,
          failure_count,
          total_amount,
          order_numbers,
        }),
      },
    });

    this.logger.log(
      `QRIS expiry enforcement completed: ${success_count} voided, ${failure_count} failed`,
    );
  }

  /**
   * Void a single expired QRIS order
   * Restores inventory and updates order status
   */
  private async voidExpiredQrisOrder(orderId: string, voidReason: string) {
    // Restore inventory (try/catch, log error but continue)
    try {
      await this.inventoryService.restoreStockForOrder(orderId);
      this.logger.log(`Restored inventory for order ${orderId}`);
    } catch (err) {
      this.logger.error(
        `Failed to restore inventory for order ${orderId}: ${(err as Error).message}`,
      );
      // Continue with voiding even if inventory restore fails
    }

    // Update order status
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        status: 'voided',
        payment_status: 'expired',
        void_reason: voidReason,
        voided_at: new Date(),
        voided_by: null, // System void
      },
    });

    // Create audit log
    await this.prisma.auditLog.create({
      data: {
        action: 'QRIS_EXPIRY_VOID',
        entity_type: 'Order',
        entity_id: orderId,
        new_value: { reason: voidReason, source: 'system' },
      },
    });

    this.logger.log(`Voided expired QRIS order ${orderId}: ${voidReason}`);
  }

  /**
   * Send email alert about QRIS expiry enforcement results
   */
  private async sendExpiryAlert(
    successCount: number,
    failureCount: number,
    totalAmount: number,
    orderNumbers: (string | null)[],
  ) {
    if (successCount === 0 && failureCount === 0) {
      return;
    }

    const formattedAmount = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
    }).format(totalAmount);

    const orderList =
      orderNumbers.length > 0
        ? orderNumbers.map((num) => `<li>${num || 'Unknown'}</li>`).join('')
        : '<li>Tidak ada pesanan</li>';

    const statusIcon = failureCount > 0 ? '⚠️' : '✅';
    const statusText = failureCount > 0 ? 'dengan kesalahan' : 'berhasil';

    const htmlBody = `
      <p>${statusIcon} <strong>Laporan Void QRIS Kadaluarsa</strong></p>
      <p>Sistem telah memproses void otomatis untuk pesanan QRIS yang kadaluarsa.</p>
      <hr/>
      <p><strong>Ringkasan:</strong></p>
      <ul>
        <li>Void ${statusText}: <strong>${successCount}</strong></li>
        <li>Gagal: <strong>${failureCount}</strong></li>
        <li>Total nilai: <strong>${formattedAmount}</strong></li>
      </ul>
      <p><strong>Pesanan yang di-void:</strong></p>
      <ul>
        ${orderList}
      </ul>
      <hr/>
      <p><em>Dipesan oleh sistem secara otomatis. Jika ada pertanyaan, silakan hubungi administrator.</em></p>
    `;

    await this.emailService
      .sendAlert('Laporan Void QRIS Kadaluarsa', htmlBody)
      .catch((err) =>
        this.logger.error(`Failed to send QRIS expiry alert: ${err instanceof Error ? err.message : String(err)}`),
      );
  }
}
