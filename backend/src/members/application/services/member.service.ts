import {
  Injectable,
  Inject,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { RedisService } from '../../../common/redis/redis.service';
import { LoyaltyService } from './loyalty.service';
import { IMemberRepository } from '../../domain/interfaces/member.repository.interface';
import {
  MEMBER_CODE_MAX_ATTEMPTS,
  LOYALTY_COOLDOWN_MINUTES,
} from '../../../common/utils/constants';

@Injectable()
export class MemberService {
  constructor(
    @Inject('MEMBER_REPOSITORY')
    private readonly memberRepository: IMemberRepository,
    private readonly redisService: RedisService,
    private readonly loyaltyService: LoyaltyService,
    private readonly prisma: PrismaService,
  ) {}

  async register(data: {
    name: string;
    phone: string;
    email?: string;
    ref_code?: string;
  }) {
    // Check phone uniqueness
    const existing = await this.memberRepository.findByPhone(data.phone);
    if (existing) {
      throw new ConflictException(
        'No. HP sudah terdaftar. Silakan gunakan no. HP lain.',
      );
    }

    // Generate member code
    let memberCode: string;
    let attempts = 0;
    do {
      memberCode = this.loyaltyService.generate_member_code();
      const existingCode =
        await this.memberRepository.findByMemberCode(memberCode);
      if (!existingCode) break;
      attempts++;
    } while (attempts < MEMBER_CODE_MAX_ATTEMPTS);

    if (attempts >= MEMBER_CODE_MAX_ATTEMPTS) {
      throw new BadRequestException(
        'Gagal membuat kode member. Silakan coba lagi.',
      );
    }

    // Get Bronze tier (default)
    const bronzeTier = await this.get_bronze_tier();
    if (!bronzeTier) {
      throw new BadRequestException(
        'Bronze tier not found. Please run database seed.',
      );
    }

    // Create member
    const member = await this.memberRepository.create({
      member_code: memberCode,
      phone: data.phone,
      name: data.name,
      email: data.email,
      registered_via: 'qr_link',
      registered_outlet_id: this.decode_ref_code(data.ref_code),
      current_tier_id: bronzeTier.id,
    });

    return {
      id: member.id,
      member_code: member.member_code,
      name: member.name,
      phone: member.phone,
      tier: member.tier?.name || 'Bronze',
      loyalty_points: member.loyalty_points,
      registered_at: member.registered_at,
    };
  }

  async lookup(identifier: { phone?: string; code?: string; qr?: string }) {
    let member: {
      id: string;
      member_code: string;
      name: string;
      loyalty_points: number;
      tier?: { name: string } | null;
    } | null = null;

    if (identifier.phone) {
      member = await this.memberRepository.findByPhone(identifier.phone);
    } else if (identifier.code) {
      member = await this.memberRepository.findByMemberCode(identifier.code);
    } else if (identifier.qr) {
      member = await this.memberRepository.findByMemberCode(identifier.qr);
    }

    if (!member) {
      throw new NotFoundException('Member tidak ditemukan');
    }

    // Check cooldown
    const cooldownUntil = await this.get_cooldown_until(member.id);

    return {
      id: member.id,
      member_code: member.member_code,
      name: member.name,
      tier: member.tier?.name || 'Bronze',
      loyalty_points: member.loyalty_points,
      points_value: this.loyaltyService.calculate_redeem_value(
        member.loyalty_points,
      ),
      can_earn: !cooldownUntil,
      cooldown_until: cooldownUntil,
    };
  }

  async process_points(data: {
    member_id: string;
    order_id?: string;
    transaction_subtotal: number;
    redeem_requested: boolean;
    cashier_id?: string;
  }) {
    // Use transaction to prevent race conditions on concurrent point operations
    return await this.prisma.$transaction(async (tx) => {
      const member = await tx.member.findUnique({
        where: { id: data.member_id },
        include: { tier: true },
      });
      if (!member) {
        throw new NotFoundException('Member tidak ditemukan');
      }

      if (!member.is_active) {
        throw new BadRequestException('Member sudah tidak aktif');
      }

      let pointsEarned = 0;
      let pointsRedeemed = 0;
      let discountAmount = 0;
      let finalPayment: number | undefined;

      // Check cooldown for earning
      const cooldownUntil = await this.get_cooldown_until(data.member_id);
      const canEarn = !cooldownUntil;

      // Handle redemption (if requested)
      if (data.redeem_requested && member.loyalty_points > 0) {
        pointsRedeemed = member.loyalty_points;
        discountAmount =
          this.loyaltyService.calculate_redeem_value(pointsRedeemed);

        // Create redeem transaction
        await tx.memberTransaction.create({
          data: {
            member_id: data.member_id,
            order_id: data.order_id,
            type: 'redeem',
            points: -pointsRedeemed,
            balance_after: 0,
            description: `Redeem ${pointsRedeemed} pts`,
            cashier_id: data.cashier_id,
          },
        });

        // Update balance to 0
        await tx.member.update({
          where: { id: data.member_id },
          data: { loyalty_points: 0 },
        });
        finalPayment = Math.max(0, data.transaction_subtotal - discountAmount);
      }

      // Handle earning (after payment success, not during cooldown)
      if (canEarn) {
        pointsEarned = this.loyaltyService.calculate_points_earned(
          data.transaction_subtotal,
        );

        if (pointsEarned > 0) {
          const newBalance =
            member.loyalty_points - pointsRedeemed + pointsEarned;

          await tx.memberTransaction.create({
            data: {
              member_id: data.member_id,
              order_id: data.order_id,
              type: 'earn',
              points: pointsEarned,
              balance_after: newBalance,
              description: `Earn ${pointsEarned} pts`,
              cashier_id: data.cashier_id,
            },
          });

          // Set cooldown (Redis, outside transaction - intentional)
          const cooldownUntilDate = new Date(
            Date.now() + LOYALTY_COOLDOWN_MINUTES * 60 * 1000,
          );
          await this.set_cooldown(data.member_id, cooldownUntilDate);

          // Update balance
          await tx.member.update({
            where: { id: data.member_id },
            data: { loyalty_points: newBalance },
          });

          // Evaluate tier
          const tierResult = await this.loyaltyService.evaluate_tier(
            data.member_id,
            newBalance,
          );
          if (tierResult.changed) {
            await tx.member.update({
              where: { id: data.member_id },
              data: { current_tier_id: tierResult.tier_id },
            });
          }
        }
      }

      // Get updated member
      const updatedMember = await tx.member.findUnique({
        where: { id: data.member_id },
        include: { tier: true },
      });
      const tierBenefits = await this.loyaltyService.get_tier_benefits(
        updatedMember?.current_tier_id || '',
      );

      return {
        points_earned: pointsEarned,
        points_redeemed: pointsRedeemed,
        discount_amount: discountAmount,
        final_payment: finalPayment,
        new_balance: updatedMember?.loyalty_points || 0,
        cooldown_until: canEarn
          ? new Date(Date.now() + LOYALTY_COOLDOWN_MINUTES * 60 * 1000)
          : cooldownUntil,
        tier: updatedMember?.tier?.name || 'Bronze',
        tier_changed: false,
        tier_benefits: tierBenefits,
      };
    });
  }

  async revoke_points(orderId: string) {
    const transactions = await this.prisma.memberTransaction.findMany({
      where: { order_id: orderId },
      orderBy: { created_at: 'desc' },
    });

    if (transactions.length === 0) return;

    const memberId = transactions[0].member_id;

    for (const tx of transactions) {
      if (tx.type === 'earn') {
        await this.memberRepository.createTransaction({
          member_id: memberId,
          type: 'void_revoke',
          points: -tx.points,
          balance_after: tx.balance_after - tx.points,
          description: `Void: ${tx.reference_order || orderId}`,
          reference_order: orderId,
        });
      } else if (tx.type === 'redeem') {
        await this.memberRepository.createTransaction({
          member_id: memberId,
          type: 'void_restore',
          points: Math.abs(tx.points),
          balance_after: tx.balance_after + Math.abs(tx.points),
          description: `Void restore: ${tx.reference_order || orderId}`,
          reference_order: orderId,
        });
      }
    }

    // Recalculate balance
    const allTxs = await this.memberRepository.getTransactionHistory(
      memberId,
      1000,
    );
    const currentBalance: number = allTxs.reduce(
      (sum: number, tx: { points: number }) => sum + tx.points,
      0,
    );
    await this.memberRepository.updatePoints(
      memberId,
      Math.max(0, currentBalance),
    );
  }

  async get_all_members(options?: {
    page?: number;
    limit?: number;
    tier?: string;
    search?: string;
  }) {
    return this.memberRepository.findAll(options);
  }

  async get_member_detail(id: string) {
    const member = await this.memberRepository.findById(id);
    if (!member) {
      throw new NotFoundException('Member tidak ditemukan');
    }

    const transactions = await this.memberRepository.getTransactionHistory(id);
    const tierBenefits = await this.loyaltyService.get_tier_benefits(
      member.current_tier_id || '',
    );

    return {
      ...member,
      points_value: this.loyaltyService.calculate_redeem_value(
        member.loyalty_points,
      ),
      tier_benefits: tierBenefits,
      transactions,
    };
  }

  async get_stats() {
    const [totalMembers, newThisMonth, tierDistribution] = await Promise.all([
      this.prisma.member.count({ where: { is_active: true } }),
      this.prisma.member.count({
        where: {
          is_active: true,
          registered_at: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
      this.prisma.member.groupBy({
        by: ['current_tier_id'],
        where: { is_active: true },
        _count: true,
      }),
    ]);

    // Get tier names
    const tiers = await this.prisma.loyaltyTier.findMany();
    const tierMap = new Map(tiers.map((t) => [t.id, t.name]));

    const distribution: Record<string, number> = {};
    for (const td of tierDistribution) {
      const name = tierMap.get(td.current_tier_id || '') || 'Bronze';
      distribution[name] = td._count;
    }

    return {
      total_members: totalMembers,
      new_this_month: newThisMonth,
      tier_distribution: distribution,
    };
  }

  // Private helpers
  private async get_bronze_tier() {
    return this.prisma.loyaltyTier.findFirst({ where: { name: 'Bronze' } });
  }

  private decode_ref_code(ref?: string): string | null {
    if (!ref) return null;
    try {
      return Buffer.from(ref, 'base64').toString('utf-8');
    } catch {
      return ref;
    }
  }

  private async get_cooldown_until(memberId: string): Promise<Date | null> {
    const key = `member:cooldown:${memberId}`;
    const value = await this.redisService.get(key);
    if (!value) return null;
    const until = new Date(value);
    return until > new Date() ? until : null;
  }

  private async set_cooldown(memberId: string, until: Date): Promise<void> {
    const key = `member:cooldown:${memberId}`;
    const ttlSeconds = Math.max(
      0,
      Math.floor((until.getTime() - Date.now()) / 1000),
    );
    if (ttlSeconds > 0) {
      await this.redisService.set(key, until.toISOString(), ttlSeconds);
    }
  }
}
