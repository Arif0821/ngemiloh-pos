export const AUDIT_REPOSITORY = Symbol('AUDIT_REPOSITORY');

export interface AuditLogFilters {
  actor_id?: string;
  action?: string;
  date_from?: Date;
  date_to?: Date;
}

export interface IAuditRepository {
  applyImmutableTrigger(): Promise<void>;
  findLogs(filters: AuditLogFilters, skip: number, take: number): Promise<[any[], number]>;
  findLogsOlderThan(date: Date): Promise<any[]>;
  deleteLogsOlderThan(date: Date): Promise<number>;
}
