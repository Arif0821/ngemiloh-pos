import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { InventoryService } from '../../inventory/application/services/inventory.service';
import { OrderStatus } from '@prisma/client';

export interface SyncJobData {
  type: 'sync_order' | 'reduce_stock' | 'sync_batch';
  orderId?: string;
  orderIds?: string[];
  cashierId?: string;
  retryCount?: number;
}

interface SyncResult {
  success: boolean;
  orderId: string;
  error?: string;
}

@Processor('SYNC_OFFLINE')
export class SyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {
    super();
  }

  async process(job: Job<SyncJobData>): Promise<SyncResult[]> {
    this.logger.log(`Processing sync job ${job.id} - type: ${job.data.type}`);

    try {
      switch (job.data.type) {
        case 'sync_order':
          return [await this.syncSingleOrder(job.data.orderId)];

        case 'sync_batch':
          return await this.syncBatchOrders(job.data.orderIds || []);

        case 'reduce_stock':
          if (job.data.orderId) {
            await this.inventoryService.reduceStockForOrder(job.data.orderId);
            return [{ success: true, orderId: job.data.orderId }];
          }
          return [{ success: false, orderId: '', error: 'Missing orderId' }];

        default:
          this.logger.warn(`Unknown sync type: ${job.data.type}`);
          return [
            {
              success: false,
              orderId: '',
              error: `Unknown type: ${job.data.type}`,
            },
          ];
      }
    } catch (error) {
      this.logger.error(`Sync job ${job.id} failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Sync a single order - mark as completed if QRIS payment settled
   */
  private async syncSingleOrder(orderId?: string): Promise<SyncResult> {
    if (!orderId) {
      return { success: false, orderId: '', error: 'Missing orderId' };
    }

    try {
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: { items: true },
      });

      if (!order) {
        return { success: false, orderId, error: 'Order not found' };
      }

      // If order is pending_sync and payment is settled, mark as completed
      if (
        order.status === OrderStatus.pending_sync &&
        order.payment_status === 'paid'
      ) {
        await this.prisma.order.update({
          where: { id: orderId },
          data: {
            status: OrderStatus.completed,
          },
        });

        // Also reduce stock
        await this.inventoryService.reduceStockForOrder(orderId);

        this.logger.log(`Order ${orderId} synced successfully`);
        return { success: true, orderId };
      }

      // If still pending, don't change anything
      return { success: true, orderId };
    } catch (error) {
      this.logger.error(`Failed to sync order ${orderId}: ${error.message}`);
      return { success: false, orderId, error: error.message };
    }
  }

  /**
   * Sync multiple orders in batch
   */
  private async syncBatchOrders(orderIds: string[]): Promise<SyncResult[]> {
    const results: SyncResult[] = [];

    for (const orderId of orderIds) {
      const result = await this.syncSingleOrder(orderId);
      results.push(result);
    }

    const successCount = results.filter((r) => r.success).length;
    this.logger.log(
      `Batch sync completed: ${successCount}/${orderIds.length} successful`,
    );

    return results;
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<SyncJobData>) {
    this.logger.log(`Sync job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<SyncJobData>, error: Error) {
    this.logger.error(`Sync job ${job.id} failed: ${error.message}`);

    // Implement retry logic - max 3 retries
    const attemptNumber = job.attemptsMade || 0;
    if (attemptNumber < 3) {
      this.logger.log(
        `Will retry sync job ${job.id} (attempt ${attemptNumber + 1}/3)`,
      );
    }
  }

  @OnWorkerEvent('active')
  onActive(job: Job<SyncJobData>) {
    this.logger.debug(`Sync job ${job.id} is now active`);
  }

  @OnWorkerEvent('stalled')
  onStalled(job: Job<SyncJobData>) {
    this.logger.warn(`Sync job ${job.id} has stalled`);
  }
}
