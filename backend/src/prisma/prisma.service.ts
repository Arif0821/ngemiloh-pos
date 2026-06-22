import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { SLOW_QUERY_THRESHOLD_MS } from '../common/utils/constants';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger('PrismaQuery');

  constructor() {
    super({
      // P1-PERF: Only log errors and warnings in production to reduce log volume
      log:
        process.env.NODE_ENV === 'production'
          ? [
              { emit: 'event', level: 'error' },
              { emit: 'event', level: 'warn' },
            ]
          : [
              { emit: 'event', level: 'query' },
              { emit: 'event', level: 'error' },
              { emit: 'event', level: 'info' },
              { emit: 'event', level: 'warn' },
            ],
    });
  }

  async onModuleInit() {
    await this.$connect();

    this.$on('error' as never, (e: { message: string; target: string }) => {
      this.logger.error(`Prisma Error: ${e.message}`, e.target);
    });

    this.$on('warn' as never, (e: { message: string }) => {
      this.logger.warn(`Prisma Warning: ${e.message}`);
    });

    if (process.env.NODE_ENV !== 'production') {
      this.$on(
        'query' as never,
        (e: { duration: number; query: string; params: string }) => {
          if (e.duration > SLOW_QUERY_THRESHOLD_MS) {
            this.logger.warn(`[SLOW QUERY] ${e.duration}ms - ${e.query}`);
          }
        },
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
