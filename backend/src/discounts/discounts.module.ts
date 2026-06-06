import { Module } from '@nestjs/common';
import { DiscountsController } from './presentation/discounts.controller';
import { DiscountsService } from './application/services/discounts.service';
import { DiscountCronService } from './discount.cron.service';
import { PrismaDiscountRepository } from './infrastructure/repositories/prisma-discount.repository';
import { DISCOUNT_REPOSITORY } from './domain/interfaces/discount.repository.interface';

@Module({
  controllers: [DiscountsController],
  providers: [
    DiscountsService,
    DiscountCronService,
    {
      provide: DISCOUNT_REPOSITORY,
      useClass: PrismaDiscountRepository,
    },
  ],
})
export class DiscountsModule {}
