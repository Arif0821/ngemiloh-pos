import { Injectable, Inject, Logger, OnModuleInit } from '@nestjs/common';
import { AUDIT_REPOSITORY, type IAuditRepository } from '../../domain/interfaces/audit.repository.interface';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AuditService implements OnModuleInit {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @Inject(AUDIT_REPOSITORY) private readonly auditRepository: IAuditRepository
  ) {}

  async onModuleInit() {
    await this.auditRepository.applyImmutableTrigger();
  }

  async getLogs(filters: { actor_id?: string; action?: string; date_from?: string; date_to?: string }, page: number = 1, limit: number = 50) {
    const parsedFilters: any = {
      actor_id: filters.actor_id,
      action: filters.action,
    };

    if (filters.date_from) {
      parsedFilters.date_from = new Date(filters.date_from);
    }
    if (filters.date_to) {
      parsedFilters.date_to = new Date(filters.date_to + 'T23:59:59.999Z');
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await this.auditRepository.findLogs(parsedFilters, skip, limit);

    // Handle BigInt serialization
    const serializedLogs = logs.map(l => ({
      ...l,
      id: l.id.toString()
    }));

    return { logs: serializedLogs, total };
  }

  async archiveOldLogs() {
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

    const oldLogs = await this.auditRepository.findLogsOlderThan(threeYearsAgo);

    if (oldLogs.length === 0) {
      return { message: 'No old logs to archive' };
    }

    // Export to JSON file
    const archiveDir = path.join(process.cwd(), 'archives');
    if (!fs.existsSync(archiveDir)) {
      fs.mkdirSync(archiveDir, { recursive: true });
    }

    const filename = `audit_archive_${Date.now()}.json`;
    const filePath = path.join(archiveDir, filename);

    const dataToSave = oldLogs.map(l => ({
      ...l,
      id: l.id.toString()
    }));

    fs.writeFileSync(filePath, JSON.stringify(dataToSave, null, 2));

    // Delete archived logs
    const deletedCount = await this.auditRepository.deleteLogsOlderThan(threeYearsAgo);

    this.logger.log(`Archived ${deletedCount} audit logs older than 3 years to ${filename}`);
    return { success: true, archived_count: deletedCount, file: filename };
  }
}
