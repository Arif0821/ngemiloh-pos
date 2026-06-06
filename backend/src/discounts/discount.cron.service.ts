import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
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
          valid_until: { lt: now }
        }
      });

      if (expiredDiscounts.length > 0) {
        await this.prisma.discount.updateMany({
          where: {
            id: { in: expiredDiscounts.map(d => d.id) }
          },
          data: {
            is_active: false
          }
        });
        this.logger.log(`Deactivated ${expiredDiscounts.length} expired discounts`);
      }

      // Get all inactive discounts that should be active
      const activeDiscountsToStart = await this.prisma.discount.findMany({
        where: {
          is_active: false,
          valid_from: { lte: now },
          OR: [
            { valid_until: null },
            { valid_until: { gte: now } }
          ]
        }
      });

      if (activeDiscountsToStart.length > 0) {
        await this.prisma.discount.updateMany({
          where: {
            id: { in: activeDiscountsToStart.map(d => d.id) }
          },
          data: {
            is_active: true
          }
        });
        this.logger.log(`Activated ${activeDiscountsToStart.length} scheduled discounts`);
      }

    } catch (error) {
      this.logger.error('Error running discount cron job:', error);
    }
  }
}
