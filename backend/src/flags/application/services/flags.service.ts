import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import {
  type IFlagRepository,
  FLAG_REPOSITORY,
} from '../../domain/interfaces/flag.repository.interface';

@Injectable()
export class FlagsService implements OnModuleInit {
  private cachedFlags: Record<string, boolean> | null = null;
  private cacheExpiresAt: number = 0;

  constructor(
    @Inject(FLAG_REPOSITORY) private readonly flagRepository: IFlagRepository,
  ) {}

  async onModuleInit() {
    await this.seedFlags();
  }

  private async seedFlags() {
    const defaultFlags = [
      {
        name: 'QRIS_PAYMENT',
        description: 'Enable/disable QRIS payment method',
      },
      {
        name: 'SPLIT_PAYMENT',
        description: 'Enable/disable split payment method',
      },
      {
        name: 'DISCOUNT_SYSTEM',
        description: 'Enable/disable global discount system',
      },
      {
        name: 'MODIFIER_SYSTEM',
        description: 'Enable/disable product variants/modifiers',
      },
      { name: 'INVENTORY_CHECK', description: 'Block sales if stock is zero' },
      { name: 'PRINT_RECEIPT', description: 'Enable thermal receipt printing' },
      { name: 'EMAIL_RECEIPT', description: 'Enable email receipt sending' },
      { name: 'PROFIT_SHARE', description: 'Enable profit sharing module' },
      // Issue #1: QRIS expiry enforcement cron job
      {
        name: 'FEATURE_QRIS_EXPIRY_ENFORCEMENT',
        description: 'Enable automatic void of expired unpaid QRIS orders',
      },
      // Issue #3: 4-eyes void approval workflow
      {
        name: 'FEATURE_VOID_APPROVAL',
        description: 'Require admin approval for void requests (4-eyes)',
      },
      // Issue #2: Silent JWT refresh
      {
        name: 'FEATURE_JWT_REFRESH',
        description: 'Enable silent refresh of expired access tokens',
      },
      // Issue #4: Offline receipt generation
      {
        name: 'FEATURE_OFFLINE_RECEIPT',
        description:
          'Enable offline receipt generation and auto-print on reconnect',
      },
    ];

    for (const flag of defaultFlags) {
      const exists = await this.flagRepository.findByName(flag.name);
      if (!exists) {
        await this.flagRepository.create({
          name: flag.name,
          description: flag.description,
          is_enabled: false,
        });
      }
    }
  }

  async getAllFlags() {
    return this.flagRepository.findAll({ name: 'asc' });
  }

  async getFlagsMap() {
    const now = Date.now();
    // 30 seconds TTL cache
    if (this.cachedFlags && now < this.cacheExpiresAt) {
      return this.cachedFlags;
    }

    const flags = await this.flagRepository.findAll();
    const map: Record<string, boolean> = {};
    for (const f of flags) {
      map[f.name] = f.is_enabled;
    }

    this.cachedFlags = map;
    this.cacheExpiresAt = now + 30 * 1000;

    return map;
  }

  async toggleFlag(name: string, isEnabled: boolean, adminId: string) {
    const res = await this.flagRepository.update(name, {
      is_enabled: isEnabled,
      updated_by: adminId,
      updated_at: new Date(),
    });

    // Invalidate cache immediately on update
    this.cachedFlags = null;
    this.cacheExpiresAt = 0;

    return res;
  }
}
