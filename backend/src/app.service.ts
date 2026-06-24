import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

// Application version - read from package.json at build time
const APP_VERSION = process.env.npm_package_version || '1.0.0';

// Memory thresholds
const MEMORY_WARNING_THRESHOLD_MB = 512; // Warn if using > 512MB
const MEMORY_CRITICAL_THRESHOLD_MB = 768; // Consider restart if > 768MB

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(private prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  private getMemoryUsage(): {
    used_mb: number;
    total_mb: number;
    usage_pct: number;
  } {
    const usage = process.memoryUsage();
    const used_mb = Math.round(usage.heapUsed / 1024 / 1024);
    const total_mb = Math.round(usage.heapTotal / 1024 / 1024);
    const usage_pct = Math.round((usage.heapUsed / usage.heapTotal) * 100);
    return { used_mb, total_mb, usage_pct };
  }

  async healthCheck() {
    const startDb = Date.now();
    const memory = this.getMemoryUsage();

    // Log warning if memory usage is high
    if (memory.used_mb > MEMORY_CRITICAL_THRESHOLD_MB) {
      this.logger.warn(
        `High memory usage: ${memory.used_mb}MB/${memory.total_mb}MB (${memory.usage_pct}%)`,
      );
    } else if (memory.used_mb > MEMORY_WARNING_THRESHOLD_MB) {
      this.logger.warn(
        `Elevated memory usage: ${memory.used_mb}MB/${memory.total_mb}MB (${memory.usage_pct}%)`,
      );
    }

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const dbLatency = Date.now() - startDb;

      // Determine overall status
      const isHealthy = memory.used_mb <= MEMORY_CRITICAL_THRESHOLD_MB;

      return {
        status: isHealthy ? 'ok' : 'degraded',
        database: 'connected',
        latency_ms: dbLatency,
        memory: {
          heap_used_mb: memory.used_mb,
          heap_total_mb: memory.total_mb,
          heap_usage_pct: memory.usage_pct,
          is_high: memory.used_mb > MEMORY_WARNING_THRESHOLD_MB,
          is_critical: memory.used_mb > MEMORY_CRITICAL_THRESHOLD_MB,
        },
        version: APP_VERSION,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        database: 'disconnected',
        memory: {
          heap_used_mb: memory.used_mb,
          heap_total_mb: memory.total_mb,
          heap_usage_pct: memory.usage_pct,
        },
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  async getSettings() {
    return this.prisma.setting.findMany();
  }

  async getStoreInfo() {
    const settings = await this.prisma.setting.findMany({
      where: {
        key: {
          in: ['store_name', 'store_address', 'store_phone', 'store_whatsapp'],
        },
      },
    });
    const result: Record<string, string> = {};
    for (const s of settings) {
      result[s.key] = s.value;
    }
    return result;
  }

  async updateSettings(data: Record<string, string>, userId: string) {
    const promises = Object.entries(data).map(([key, value]) => {
      return this.prisma.setting.upsert({
        where: { key },
        update: { value, updated_by: userId, updated_at: new Date() },
        create: { key, value, updated_by: userId, updated_at: new Date() },
      });
    });
    await Promise.all(promises);
    return { message: 'Settings updated' };
  }
}
