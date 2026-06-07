import { Module } from '@nestjs/common';
import { AuditService } from './application/services/audit.service';
import { AuditController } from './presentation/audit.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { AUDIT_REPOSITORY } from './domain/interfaces/audit.repository.interface';
import { PrismaAuditRepository } from './infrastructure/repositories/prisma-audit.repository';

@Module({
  imports: [PrismaModule],
  controllers: [AuditController],
  providers: [
    AuditService,
    {
      provide: AUDIT_REPOSITORY,
      useClass: PrismaAuditRepository,
    },
  ],
  exports: [AuditService, AUDIT_REPOSITORY]
})
export class AuditModule {}
