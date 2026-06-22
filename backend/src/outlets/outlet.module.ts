import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OutletController } from './presentation/outlet.controller';
import { OutletService } from './application/outlet.service';

@Module({
  imports: [PrismaModule],
  controllers: [OutletController],
  providers: [OutletService],
  exports: [OutletService],
})
export class OutletModule {}
