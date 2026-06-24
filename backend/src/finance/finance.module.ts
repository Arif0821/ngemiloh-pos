import { Module } from '@nestjs/common';
import { FinanceController } from './presentation/finance.controller';
import { FinanceService } from './application/services/finance.service';
import { FinanceCronService } from './finance.cron';
import { FINANCE_REPOSITORY } from './domain/interfaces/finance.repository.interface';
import { PrismaFinanceRepository } from './infrastructure/repositories/prisma-finance.repository';
import { EmailModule } from '../email/email.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [EmailModule, InventoryModule],
  controllers: [FinanceController],
  providers: [
    FinanceService,
    FinanceCronService,
    {
      provide: FINANCE_REPOSITORY,
      useClass: PrismaFinanceRepository,
    },
  ],
})
export class FinanceModule {}
