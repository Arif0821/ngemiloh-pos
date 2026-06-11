import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';

@Injectable()
export class FinanceCronService {
  private readonly logger = new Logger(FinanceCronService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService
  ) {}

  // 0 8 1 * * => 08:00 on day 1 of every month
  @Cron('0 8 1 * *', { timeZone: 'Asia/Jakarta' })
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
      where: { period_month: periodMonth }
    });

    if (!log) {
      this.logger.warn(`Laporan bagi hasil untuk bulan ${month}/${year} belum ditutup. Sending reminder...`);
      await this.emailService.sendAlert(
        `Peringatan: Laporan Bagi Hasil Belum Ditutup - ${month}/${year}`,
        `<p>Laporan bagi hasil untuk bulan ${month} tahun ${year} <strong>belum ditutup</strong>.</p>
         <p>Mohon segera tutup buku laporan bagi hasil sebelum tanggal 5 bulan ini.</p>
         <p>Jika laporan sudah ditutup, abaikan email ini.</p>`
      ).catch(err => this.logger.error(`Failed to send profit share reminder: ${err instanceof Error ? err.message : String(err)}`));
      return;
    }

    if (!log.is_paid) {
      const amount = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(Number(log.cashier_share));
      await this.emailService.sendAlert(
        `Reminder: Tunggakan Bagi Hasil Bulan ${month}/${year}`,
        `<p>Peringatan dari sistem. Anda <strong>belum membayar bagi hasil kasir</strong> untuk periode bulan ${month} tahun ${year}.</p>
         <p>Total yang harus dibayarkan: <strong>${amount}</strong>.</p>
         <p>Deadline penyelesaian adalah <strong>tanggal 5 bulan ini</strong>. Mohon segera melunasi dan memperbarui status di halaman laporan.</p>`
      ).catch(err => this.logger.error(`Failed to send profit share reminder: ${err instanceof Error ? err.message : String(err)}`));
    }
  }
}
