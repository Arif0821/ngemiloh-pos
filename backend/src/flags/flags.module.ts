import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FlagsController } from './presentation/flags.controller';
import { FlagsService } from './application/services/flags.service';
import { FLAG_REPOSITORY } from './domain/interfaces/flag.repository.interface';
import { PrismaFlagRepository } from './infrastructure/repositories/prisma-flag.repository';

@Module({
  imports: [PrismaModule],
  controllers: [FlagsController],
  providers: [
    FlagsService,
    {
      provide: FLAG_REPOSITORY,
      useClass: PrismaFlagRepository,
    },
  ],
  exports: [FlagsService],
})
export class FlagsModule {}
