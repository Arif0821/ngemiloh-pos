import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DiscountCronService {
  private readonly logger = new Logger(DiscountCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('*/5 * * * *')
  async handleDiscountCron() {
    this.logger.log('Running discount cron job...');
    try {
      const now = new Date();

      // Get all active discounts that should be expired
      const expiredDiscounts = await this.prisma.discount.findMany({
        where: {
          is_active: true,
          valid_until: { lt: now },
        },
      });

      if (expiredDiscounts.length > 0) {
        await this.prisma.discount.updateMany({
          where: {
            id: { in: expiredDiscounts.map((d) => d.id) },
          },
          data: {
            is_active: false,
          },
        });
        this.logger.log(
          `Deactivated ${expiredDiscounts.length} expired discounts`,
        );
      }

      // TINGGI-02: Only activate discounts that are NOT manually disabled
      // This prevents cron from re-activating discounts that admin intentionally turned off
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
      const activeDiscountsToStart = await this.prisma.discount.findMany({
        where: {
          is_active: false,
          manually_disabled: false, // Skip manually disabled discounts
          valid_from: { lte: now, gte: fiveMinutesAgo }, // Only activate if valid_from is within last 5 minutes
          OR: [{ valid_until: null }, { valid_until: { gte: now } }],
        },
      });

      if (activeDiscountsToStart.length > 0) {
        await this.prisma.discount.updateMany({
          where: {
            id: { in: activeDiscountsToStart.map((d) => d.id) },
          },
          data: {
            is_active: true,
          },
        });
        this.logger.log(
          `Activated ${activeDiscountsToStart.length} scheduled discounts`,
        );
      }
    } catch (error) {
      this.logger.error('Error running discount cron job:', error);
    }
  }
}
