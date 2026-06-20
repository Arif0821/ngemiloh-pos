import { Injectable, Logger } from '@nestjs/common';
import { AuditLog, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  IAuditRepository,
  AuditLogFilters,
} from '../../domain/interfaces/audit.repository.interface';

@Injectable()
export class PrismaAuditRepository implements IAuditRepository {
  private readonly logger = new Logger(PrismaAuditRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async applyImmutableTrigger(): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION prevent_audit_update_delete()
        RETURNS TRIGGER AS $$
        BEGIN
          RAISE EXCEPTION 'AuditLog is immutable. UPDATE and DELETE are strictly prohibited.';
        END;
        $$ LANGUAGE plpgsql;
      `);

      await this.prisma.$executeRawUnsafe(`
        DROP TRIGGER IF EXISTS immutable_audit_logs_trigger ON "AuditLog";
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE TRIGGER immutable_audit_logs_trigger
        BEFORE UPDATE OR DELETE ON "AuditLog"
        FOR EACH ROW EXECUTE FUNCTION prevent_audit_update_delete();
      `);

      this.logger.log('Immutable Audit Log trigger applied to database.');
    } catch {
      this.logger.error(
        'Failed to apply immutable trigger on AuditLog (Might be unsupported on SQLite/Other DBs)',
      );
    }
  }

  async findLogs(
    filters: AuditLogFilters,
    skip: number,
    take: number,
  ): Promise<[AuditLog[], number]> {
    const where: Prisma.AuditLogWhereInput = {};

    if (filters.actor_id) {
      where.actor_id = filters.actor_id;
    }
    if (filters.action) {
      where.action = filters.action;
    }
    if (filters.date_from || filters.date_to) {
      where.created_at = {};
      if (filters.date_from) where.created_at.gte = filters.date_from;
      if (filters.date_to) where.created_at.lte = filters.date_to;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take,
        include: {
          actor: { select: { username: true, role: true } },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return [logs, total];
  }

  async findLogsOlderThan(date: Date): Promise<AuditLog[]> {
    return this.prisma.auditLog.findMany({
      where: { created_at: { lt: date } },
      include: { actor: { select: { username: true } } },
    });
  }

  async deleteLogsOlderThan(date: Date): Promise<number> {
    const deleted = await this.prisma.auditLog.deleteMany({
      where: { created_at: { lt: date } },
    });
    return deleted.count;
  }

  async deleteLogs(ids: string[]): Promise<number> {
    const deleted = await this.prisma.auditLog.deleteMany({
      where: { id: { in: ids.map((id) => BigInt(id)) } },
    });
    return deleted.count;
  }

  async createAuditLog(
    data: Prisma.AuditLogUncheckedCreateInput,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        actor_id: data.actor_id,
        action: data.action,
        entity_type: data.entity_type,
        entity_id: data.entity_id,
        old_value: data.old_value,
        new_value: data.new_value,
        ip_address: data.ip_address,
      },
    });
  }
}
