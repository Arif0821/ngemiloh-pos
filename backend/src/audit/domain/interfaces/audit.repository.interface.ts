export const AUDIT_REPOSITORY = Symbol('AUDIT_REPOSITORY');

import { AuditLog, Prisma } from '@prisma/client';

export interface AuditLogFilters {
  actor_id?: string;
  action?: string;
  date_from?: Date;
  date_to?: Date;
}

export interface IAuditRepository {
  applyImmutableTrigger(): Promise<void>;
  findLogs(filters: AuditLogFilters, skip: number, take: number): Promise<[AuditLog[], number]>;
  findLogsOlderThan(date: Date): Promise<AuditLog[]>;
  deleteLogsOlderThan(date: Date): Promise<number>;
  deleteLogs(ids: string[]): Promise<number>;
  createAuditLog(data: Prisma.AuditLogUncheckedCreateInput): Promise<void>;
}
