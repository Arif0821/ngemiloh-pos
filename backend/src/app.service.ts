import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  constructor(private prisma: PrismaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getSettings() {
    return this.prisma.setting.findMany();
  }

  async updateSettings(data: Record<string, string>, userId: string) {
    const promises = Object.entries(data).map(([key, value]) => {
      return this.prisma.setting.upsert({
        where: { key },
        update: { value, updated_by: userId, updated_at: new Date() },
        create: { key, value, updated_by: userId, updated_at: new Date() }
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
      data: { is_enabled: isEnabled, updated_by: userId, updated_at: new Date() }
    });
  }

  async getAuditLogs() {
    return this.prisma.auditLog.findMany({
      orderBy: { created_at: 'desc' },
      take: 100, // Limit to recent 100 for MVP
      include: { actor: { select: { name: true, role: true } } }
    });
  }
}
