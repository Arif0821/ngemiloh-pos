import { Module } from '@nestjs/common';
import { ReceiptsController } from './presentation/receipts.controller';
import { ReceiptsService } from './application/receipts.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ReceiptsController],
  providers: [ReceiptsService],
  exports: [ReceiptsService],
})
export class ReceiptsModule {}
