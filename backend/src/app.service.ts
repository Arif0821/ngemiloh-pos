import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

// Application version - read from package.json at build time
const APP_VERSION = process.env.npm_package_version || '1.0.0';

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async healthCheck() {
    const startDb = Date.now();
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const dbLatency = Date.now() - startDb;
      return {
        status: 'ok',
        database: 'connected',
        latency_ms: dbLatency,
        version: APP_VERSION,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        status: 'error',
        database: 'disconnected',
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
      where: { key: { in: ['store_name', 'store_address', 'store_phone', 'store_whatsapp'] } },
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

  async getFeatureFlags() {
    return this.prisma.featureFlag.findMany();
  }

  async toggleFeatureFlag(id: string, isEnabled: boolean, userId: string) {
    return this.prisma.featureFlag.update({
      where: { id },
      data: {
        is_enabled: isEnabled,
        updated_by: userId,
        updated_at: new Date(),
      },
    });
  }

  async getAuditLogs() {
    return this.prisma.auditLog.findMany({
      orderBy: { created_at: 'desc' },
      take: 1000, // Increased for security audit investigation
      include: { actor: { select: { name: true, role: true } } },
    });
  }
}
