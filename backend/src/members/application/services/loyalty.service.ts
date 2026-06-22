import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class LoyaltyService {
  constructor(private readonly prisma: PrismaService) {}

  // Constants
  readonly POINTS_EARN_RATE = 5; // 5 points per Rp 1,000
  readonly POINTS_EARN_PER = 1000; // per Rp 1,000
  readonly POINTS_REDEEM_RATE = 5; // 5 points = Rp 1,000
  readonly POINTS_REDEEM_PER = 1000;
  readonly COOLDOWN_MINUTES = 2;
  readonly GRACE_DAYS = 30;

  calculate_points_earned(subtotal: number): number {
    return Math.floor(subtotal / this.POINTS_EARN_PER) * this.POINTS_EARN_RATE;
  }

  calculate_redeem_value(points: number): number {
    return (
      Math.floor(points / this.POINTS_REDEEM_RATE) * this.POINTS_REDEEM_PER
    );
  }

  generate_member_code(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `MBR-${code}`;
  }

  async evaluate_tier(
    memberId: string,
    currentPoints: number,
  ): Promise<{
    tier_id: string;
    tier_name: string;
    changed: boolean;
    is_upgrade: boolean;
  }> {
    // Get all tiers ordered by min_points DESC
    const tiers = await this.prisma.loyaltyTier.findMany({
      where: { is_active: true },
      orderBy: { min_points: 'desc' },
    });

    // Find appropriate tier
    let newTier = tiers.find((t) => currentPoints >= t.min_points);
    if (!newTier) {
      newTier = tiers[tiers.length - 1]; // Lowest tier
    }

    // Get current tier
    const member = await this.prisma.member.findUnique({
      where: { id: memberId },
      include: { tier: true },
    });

    const currentTierOrder = member?.tier?.sort_order || 0;
    const newTierOrder = newTier?.sort_order || 0;
    const isUpgrade = newTierOrder > currentTierOrder;

    return {
      tier_id: newTier?.id || '',
      tier_name: newTier?.name || 'Bronze',
      changed: member?.current_tier_id !== newTier?.id,
      is_upgrade: isUpgrade,
    };
  }

  async get_tier_benefits(
    tierId: string,
  ): Promise<{ free_item?: string } | null> {
    if (!tierId) return null;

    const tier = await this.prisma.loyaltyTier.findUnique({
      where: { id: tierId },
    });

    if (!tier?.free_item_id) return null;

    const product = await this.prisma.product.findUnique({
      where: { id: tier.free_item_id },
    });

    return product ? { free_item: product.name } : null;
  }
}
