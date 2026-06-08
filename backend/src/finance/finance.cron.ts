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
    const now = new Date();
    // we want the profit share for the month that just ended.
    // E.g., if today is June 1st, we check May's profit share.
    let month = now.getMonth(); // 0-11, so if June (5), we want May (5), wait JS month is 0-indexed.
    let year = now.getFullYear();
    
    if (month === 0) { // If Jan 1st
      month = 12;
      year--;
    }

    const periodMonth = new Date(year, month - 1, 1);

    const log = await this.prisma.profitShareLog.findUnique({
      where: { period_month: periodMonth }
    });

    if (!log) {
      this.logger.warn(`Laporan bagi hasil untuk bulan ${month}/${year} belum ditutup. Cannot send reminder.`);
      return;
    }

    if (!log.is_paid) {
      const amount = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(Number(log.cashier_share));
      this.emailService.sendAlert(
        `Reminder: Tunggakan Bagi Hasil Bulan ${month}/${year}`,
        `<p>Peringatan dari sistem. Anda <strong>belum membayar bagi hasil kasir</strong> untuk periode bulan ${month} tahun ${year}.</p>
         <p>Total yang harus dibayarkan: <strong>${amount}</strong>.</p>
         <p>Deadline penyelesaian adalah <strong>tanggal 5 bulan ini</strong>. Mohon segera melunasi dan memperbarui status di halaman laporan.</p>`
      );
    }
  }
}
