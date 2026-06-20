import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class FinanceCronService {
  private readonly logger = new Logger(FinanceCronService.name);
  private readonly AUTO_CLOSE_GRACE_MS = 30 * 60 * 1000; // 30 minutes grace period

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
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
          lte: new Date(now.getTime() - this.AUTO_CLOSE_GRACE_MS),
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
    await Promise.all(overdueShifts.map(shift => this.autoCloseShift(shift)));
  }

  // Run every 15 minutes to send 90-minute warnings
  @Cron('*/15 * * * *', { timeZone: process.env.TZ || 'Asia/Jakarta' })
  async sendAutoCloseWarnings() {
    const now = new Date();
    const warningWindow = new Date(now.getTime() + 90 * 60 * 1000); // 90 min ahead

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
      // Warning email could be sent here if needed
    }
  }

  private async autoCloseShift(shift: {
    id: string;
    cashier_id: string;
    opening_balance: unknown;
    shift_start: Date;
    cashier: { name: string; email: string | null };
  }) {
    this.logger.warn(
      `Auto-closing shift ${shift.id} for cashier ${shift.cashier.name}`,
    );

    try {
      // Calculate cash totals for this shift using shift_start as anchor
      const orders = await this.prisma.order.findMany({
        where: {
          cashier_id: shift.cashier_id,
          status: 'completed',
          created_at: { gte: shift.shift_start },
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
}
