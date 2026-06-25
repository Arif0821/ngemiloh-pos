import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * #20 Webhook Dead Letter Queue Service
 * Handles failed webhooks that need manual retry or acknowledgment
 */
@Injectable()
export class WebhookDLQService {
  private readonly logger = new Logger(WebhookDLQService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Add a failed webhook to the DLQ for later manual processing
   */
  async addToDLQ(data: {
    provider: string;
    event_type: string;
    payload: Record<string, unknown>;
    error_message: string;
    max_attempts?: number;
  }): Promise<string> {
    const entry = await this.prisma.webhookDLQ.create({
      data: {
        provider: data.provider,
        event_type: data.event_type,
        payload: data.payload as object,
        error_message: data.error_message,
        max_attempts: data.max_attempts || 3,
        status: 'pending',
      },
    });

    this.logger.warn(
      `Webhook added to DLQ: ${data.provider}/${data.event_type} - ${data.error_message}`,
    );

    return entry.id;
  }

  /**
   * Get DLQ entries with pagination
   */
  async getEntries(options?: {
    status?: string;
    provider?: string;
    page?: number;
    limit?: number;
  }) {
    const page = options?.page || 1;
    const limit = options?.limit || 20;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (options?.status) {
      where['status'] = options.status;
    }
    if (options?.provider) {
      where['provider'] = options.provider;
    }

    const [entries, total] = await Promise.all([
      this.prisma.webhookDLQ.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.webhookDLQ.count({ where }),
    ]);

    return {
      entries,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit),
    };
  }

  /**
   * Get a single DLQ entry by ID
   */
  async getEntry(id: string) {
    return await this.prisma.webhookDLQ.findUnique({
      where: { id },
    });
  }

  /**
   * Mark entry as resolved (acknowledged without retry)
   */
  async acknowledgeEntry(id: string, adminId: string, _notes?: string) {
    const entry = await this.prisma.webhookDLQ.update({
      where: { id },
      data: {
        status: 'resolved',
        resolved_by: adminId,
        resolved_at: new Date(),
        resolution: 'acknowledged',
      },
    });

    // Audit log
    await this.prisma.auditLog.create({
      data: {
        actor_id: adminId,
        action: 'WEBHOOK_DLQ_ACKNOWLEDGED',
        entity_type: 'WebhookDLQ',
        entity_id: id,
        new_value: {
          provider: entry.provider,
          event_type: entry.event_type,
          resolution: 'acknowledged',
        },
      },
    });

    return entry;
  }

  /**
   * Retry a failed webhook (manual retry)
   */
  async retryEntry(
    id: string,
    adminId: string,
    processor: (payload: Record<string, unknown>) => Promise<void>,
  ): Promise<{ success: boolean; error?: string }> {
    const entry = await this.prisma.webhookDLQ.findUnique({
      where: { id },
    });

    if (!entry) {
      return { success: false, error: 'Entry not found' };
    }

    if (entry.status === 'resolved') {
      return { success: false, error: 'Entry already resolved' };
    }

    // Mark as retrying
    await this.prisma.webhookDLQ.update({
      where: { id },
      data: {
        status: 'retrying',
        last_attempt_at: new Date(),
        attempt_count: entry.attempt_count + 1,
      },
    });

    try {
      // Attempt to process the webhook
      await processor(entry.payload as Record<string, unknown>);

      // Success - mark as resolved
      await this.prisma.webhookDLQ.update({
        where: { id },
        data: {
          status: 'resolved',
          resolved_by: adminId,
          resolved_at: new Date(),
          resolution: 'manual_retry',
        },
      });

      // Audit log
      await this.prisma.auditLog.create({
        data: {
          actor_id: adminId,
          action: 'WEBHOOK_DLQ_RETRY_SUCCESS',
          entity_type: 'WebhookDLQ',
          entity_id: id,
          new_value: {
            provider: entry.provider,
            event_type: entry.event_type,
            attempt_count: entry.attempt_count + 1,
          },
        },
      });

      this.logger.log(`Webhook DLQ retry successful: ${id}`);
      return { success: true };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      // Update with failure
      const newStatus =
        entry.attempt_count + 1 >= entry.max_attempts ? 'failed' : 'pending';

      await this.prisma.webhookDLQ.update({
        where: { id },
        data: {
          status: newStatus,
          error_message: errorMessage,
          last_attempt_at: new Date(),
        },
      });

      this.logger.error(
        `Webhook DLQ retry failed: ${id} - ${errorMessage} (attempt ${entry.attempt_count + 1}/${entry.max_attempts})`,
      );

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Get DLQ statistics
   */
  async getStats() {
    const [total, pending, failed, resolved] = await Promise.all([
      this.prisma.webhookDLQ.count(),
      this.prisma.webhookDLQ.count({ where: { status: 'pending' } }),
      this.prisma.webhookDLQ.count({ where: { status: 'failed' } }),
      this.prisma.webhookDLQ.count({ where: { status: 'resolved' } }),
    ]);

    // Group by provider
    const byProvider = await this.prisma.webhookDLQ.groupBy({
      by: ['provider', 'status'],
      _count: true,
    });

    const providerStats: Record<
      string,
      { pending: number; failed: number; resolved: number }
    > = {};
    for (const row of byProvider) {
      if (!providerStats[row.provider]) {
        providerStats[row.provider] = { pending: 0, failed: 0, resolved: 0 };
      }
      if (row.status === 'pending')
        providerStats[row.provider].pending = row._count;
      if (row.status === 'failed')
        providerStats[row.provider].failed = row._count;
      if (row.status === 'resolved')
        providerStats[row.provider].resolved = row._count;
    }

    return {
      total,
      pending,
      failed,
      resolved,
      by_provider: providerStats,
    };
  }
}
