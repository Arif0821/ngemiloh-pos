import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { LoyaltyService } from './loyalty.service';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  LOYALTY_POINTS_EARN_RATE,
  LOYALTY_POINTS_EARN_PER,
  LOYALTY_POINTS_REDEEM_RATE,
  LOYALTY_POINTS_REDEEM_PER,
  LOYALTY_CODE_PREFIX,
  LOYALTY_CODE_CHARS,
  LOYALTY_CODE_LENGTH,
} from '../../../common/utils/constants';

// Jest globals are available in Jest environment

declare const jest: any;

declare const describe: any;

declare const it: any;

declare const expect: any;

declare const beforeEach: any;

// Mock Prisma
const mockPrisma = {
  loyaltyTier: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
  },
  member: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  product: {
    findUnique: jest.fn(),
  },
  auditLog: {
    create: jest.fn(),
  },
};

// Helper to create mock tier
const createMockTier = (name: string, minPoints: number, sortOrder: number) =>
  ({
    id: `tier-${name.toLowerCase()}`,
    name,
    min_points: minPoints,
    free_item_id: null as string | null,
    is_active: true,
    sort_order: sortOrder,
  }) as {
    id: string;
    name: string;
    min_points: number;
    free_item_id: string | null;
    is_active: boolean;
    sort_order: number;
  };

// Helper to create mock member
const createMockMember = (overrides = {}) => ({
  id: 'member-123',
  member_code: 'MBR-ABC123',
  name: 'Test Member',
  loyalty_points: 100,
  current_tier_id: 'tier-bronze',
  tier: createMockTier('Bronze', 0, 1),
  ...overrides,
});

describe('LoyaltyService', () => {
  let service: LoyaltyService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoyaltyService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<LoyaltyService>(LoyaltyService);
  });

  describe('calculate_points_earned', () => {
    // ============================================
    // HAPPY PATH
    // ============================================
    it('should calculate points earned correctly for exact amount', () => {
      // For every 1000 spent, earn 5 points
      const subtotal = 10000;
      const expected =
        (subtotal / LOYALTY_POINTS_EARN_PER) * LOYALTY_POINTS_EARN_RATE;

      const result = service.calculate_points_earned(subtotal);

      expect(result).toBe(expected);
    });

    it('should floor partial points', () => {
      // 5500 / 1000 = 5.5 -> floor to 5, * 5 = 25 points
      const subtotal = 5500;
      const expected =
        Math.floor(subtotal / LOYALTY_POINTS_EARN_PER) *
        LOYALTY_POINTS_EARN_RATE;

      const result = service.calculate_points_earned(subtotal);

      expect(result).toBe(expected);
    });

    it('should return 0 for amounts below earn threshold', () => {
      const subtotal = 500; // Below 1000

      const result = service.calculate_points_earned(subtotal);

      expect(result).toBe(0);
    });

    // ============================================
    // EDGE CASES
    // ============================================
    it('should handle zero amount', () => {
      const result = service.calculate_points_earned(0);
      expect(result).toBe(0);
    });

    it('should handle very large amounts', () => {
      const subtotal = 100000000; // 100 million
      const result = service.calculate_points_earned(subtotal);

      expect(result).toBe(
        (subtotal / LOYALTY_POINTS_EARN_PER) * LOYALTY_POINTS_EARN_RATE,
      );
    });

    it('should handle decimal amounts (price with tax)', () => {
      // Simulate price after tax: 11000.5
      const subtotal = 11000.5;
      const result = service.calculate_points_earned(subtotal);

      // Should floor before calculation: floor(11000.5) = 11000
      expect(result).toBe(
        Math.floor(11000 / LOYALTY_POINTS_EARN_PER) * LOYALTY_POINTS_EARN_RATE,
      );
    });

    it('should handle negative amounts gracefully', () => {
      const subtotal = -5000;
      const result = service.calculate_points_earned(subtotal);

      // Math.floor(-5500/1000) = Math.floor(-5.5) = -6, * 5 = -30
      // But we expect it to floor in a reasonable way
      expect(result).toBeLessThanOrEqual(0);
    });
  });

  describe('calculate_redeem_value', () => {
    // ============================================
    // HAPPY PATH
    // ============================================
    it('should calculate redeem value correctly for exact points', () => {
      // For every 5 points, redeem 1000
      const points = 100;
      const expected =
        (points / LOYALTY_POINTS_REDEEM_RATE) * LOYALTY_POINTS_REDEEM_PER;

      const result = service.calculate_redeem_value(points);

      expect(result).toBe(expected);
    });

    it('should floor partial redemption', () => {
      // 55 points / 5 = 11 -> floor = 11, * 1000 = 11000
      const points = 55;
      const expected =
        Math.floor(points / LOYALTY_POINTS_REDEEM_RATE) *
        LOYALTY_POINTS_REDEEM_PER;

      const result = service.calculate_redeem_value(points);

      expect(result).toBe(expected);
    });

    it('should return 0 for points below redeem threshold', () => {
      const points = 3;

      const result = service.calculate_redeem_value(points);

      expect(result).toBe(0);
    });

    // ============================================
    // EDGE CASES
    // ============================================
    it('should handle zero points', () => {
      const result = service.calculate_redeem_value(0);
      expect(result).toBe(0);
    });

    it('should handle very large point values', () => {
      const points = 10000000;
      const result = service.calculate_redeem_value(points);

      expect(result).toBe(
        (points / LOYALTY_POINTS_REDEEM_RATE) * LOYALTY_POINTS_REDEEM_PER,
      );
    });

    it('should handle decimal points (floor them)', () => {
      const points = 55.7;
      const result = service.calculate_redeem_value(points);

      expect(result).toBe(
        Math.floor(points / LOYALTY_POINTS_REDEEM_RATE) *
          LOYALTY_POINTS_REDEEM_PER,
      );
    });

    it('should handle negative points gracefully', () => {
      const points = -50;
      const result = service.calculate_redeem_value(points);

      expect(result).toBeLessThanOrEqual(0);
    });
  });

  describe('generate_member_code', () => {
    // ============================================
    // HAPPY PATH
    // ============================================
    it('should generate code with correct prefix', () => {
      const code = service.generate_member_code();

      expect(code.startsWith(LOYALTY_CODE_PREFIX)).toBe(true);
    });

    it('should generate code with correct length', () => {
      const code = service.generate_member_code();
      const codeWithoutPrefix = code.replace(LOYALTY_CODE_PREFIX, '');

      expect(codeWithoutPrefix.length).toBe(LOYALTY_CODE_LENGTH);
    });

    it('should generate code with valid characters only', () => {
      const code = service.generate_member_code();
      const codeWithoutPrefix = code.replace(LOYALTY_CODE_PREFIX, '');

      for (const char of codeWithoutPrefix) {
        expect(LOYALTY_CODE_CHARS.includes(char)).toBe(true);
      }
    });

    // ============================================
    // EDGE CASES
    // ============================================
    it('should generate unique codes on multiple calls', () => {
      const codes = new Set<string>();

      // Generate 100 codes and check for uniqueness
      for (let i = 0; i < 100; i++) {
        codes.add(service.generate_member_code());
      }

      // Should have high uniqueness (allow for statistical edge case)
      expect(codes.size).toBeGreaterThan(90);
    });

    it('should generate consistent format: prefix + 6 chars', () => {
      const code = service.generate_member_code();
      const pattern = new RegExp(
        `^${LOYALTY_CODE_PREFIX}[${LOYALTY_CODE_CHARS}]{${LOYALTY_CODE_LENGTH}}$`,
      );

      expect(pattern.test(code)).toBe(true);
    });
  });

  describe('evaluate_tier', () => {
    // Helper to create tiers in DESC order (as returned by findMany with orderBy: { min_points: 'desc' })
    const createTiersDesc = () => [
      createMockTier('Platinum', 5000, 4),
      createMockTier('Gold', 1500, 3),
      createMockTier('Silver', 500, 2),
      createMockTier('Bronze', 0, 1),
    ];

    // ============================================
    // HAPPY PATH
    // ============================================
    it('should return Bronze for 0 points', async () => {
      const tiers = createTiersDesc();

      mockPrisma.loyaltyTier.findMany.mockResolvedValue(tiers);
      mockPrisma.member.findUnique.mockResolvedValue(
        createMockMember({
          current_tier_id: 'tier-bronze',
          tier: tiers[3],
        }),
      );

      const result = await service.evaluate_tier('member-123', 0);

      expect(result.tier_name).toBe('Bronze');
      expect(result.changed).toBe(false);
      expect(result.is_upgrade).toBe(false);
    });

    it('should return Silver for 500+ points', async () => {
      const tiers = createTiersDesc();

      mockPrisma.loyaltyTier.findMany.mockResolvedValue(tiers);
      mockPrisma.member.findUnique.mockResolvedValue(
        createMockMember({
          current_tier_id: 'tier-bronze',
          tier: tiers[3],
        }),
      );

      const result = await service.evaluate_tier('member-123', 500);

      expect(result.tier_name).toBe('Silver');
    });

    it('should return Gold for 1500+ points', async () => {
      const tiers = createTiersDesc();

      mockPrisma.loyaltyTier.findMany.mockResolvedValue(tiers);
      mockPrisma.member.findUnique.mockResolvedValue(
        createMockMember({
          current_tier_id: 'tier-bronze',
          tier: tiers[3],
        }),
      );

      const result = await service.evaluate_tier('member-123', 1500);

      expect(result.tier_name).toBe('Gold');
    });

    it('should return Platinum for 5000+ points', async () => {
      const tiers = createTiersDesc();

      mockPrisma.loyaltyTier.findMany.mockResolvedValue(tiers);
      mockPrisma.member.findUnique.mockResolvedValue(
        createMockMember({
          current_tier_id: 'tier-bronze',
          tier: tiers[3],
        }),
      );

      const result = await service.evaluate_tier('member-123', 5000);

      expect(result.tier_name).toBe('Platinum');
    });

    it('should detect tier upgrade', async () => {
      const tiers = createTiersDesc();

      mockPrisma.loyaltyTier.findMany.mockResolvedValue(tiers);
      mockPrisma.member.findUnique.mockResolvedValue(
        createMockMember({
          current_tier_id: 'tier-bronze',
          tier: tiers[3],
        }),
      );

      const result = await service.evaluate_tier('member-123', 600);

      expect(result.changed).toBe(true);
      expect(result.is_upgrade).toBe(true);
    });

    it('should detect tier change to lower tier', async () => {
      const tiers = [
        createMockTier('Bronze', 0, 1),
        createMockTier('Silver', 500, 2),
      ];

      mockPrisma.loyaltyTier.findMany.mockResolvedValue(tiers);
      mockPrisma.member.findUnique.mockResolvedValue(
        createMockMember({
          current_tier_id: 'tier-silver',
          tier: tiers[1],
        }),
      );

      const result = await service.evaluate_tier('member-123', 0);

      expect(result.changed).toBe(true);
      expect(result.is_upgrade).toBe(false);
      expect(result.tier_name).toBe('Bronze');
    });

    // ============================================
    // ERROR CASES
    // ============================================
    it('should handle no active tiers - returns lowest tier', async () => {
      mockPrisma.loyaltyTier.findMany.mockResolvedValue([]);

      // When no tiers, should return Bronze as default
      const result = await service.evaluate_tier('member-123', 1000);

      expect(result.tier_name).toBe('Bronze');
      expect(result.changed).toBe(true); // current_tier_id !== undefined !== 'tier-bronze'
    });

    it('should handle non-existent member', async () => {
      mockPrisma.loyaltyTier.findMany.mockResolvedValue([
        createMockTier('Bronze', 0, 1),
      ]);
      mockPrisma.member.findUnique.mockResolvedValue(null);

      // Should still return lowest tier (Bronze)
      const result = await service.evaluate_tier('member-123', 0);

      expect(result.tier_name).toBe('Bronze');
    });

    // ============================================
    // EDGE CASES
    // ============================================
    it('should handle exact tier boundary points', async () => {
      const tiers = createTiersDesc();

      mockPrisma.loyaltyTier.findMany.mockResolvedValue(tiers);
      mockPrisma.member.findUnique.mockResolvedValue(
        createMockMember({
          current_tier_id: 'tier-bronze',
          tier: tiers[3],
        }),
      );

      // Exact boundary: 500 points should be Silver (not Bronze)
      // The find algorithm: tiers.find((t) => currentPoints >= t.min_points)
      // Platinum(5000) >= 500? No
      // Gold(1500) >= 500? No
      // Silver(500) >= 500? Yes! -> Silver
      const result = await service.evaluate_tier('member-123', 500);

      expect(result.tier_name).toBe('Silver');
    });

    it('should handle negative points', async () => {
      const tiers = [createMockTier('Bronze', 0, 1)];

      mockPrisma.loyaltyTier.findMany.mockResolvedValue(tiers);
      mockPrisma.member.findUnique.mockResolvedValue(
        createMockMember({
          current_tier_id: 'tier-bronze',
          tier: tiers[0],
        }),
      );

      // Negative points should still get Bronze
      const result = await service.evaluate_tier('member-123', -100);

      expect(result.tier_name).toBe('Bronze');
    });

    it('should handle very high points', async () => {
      // Use DESC order as the service expects (orderBy: { min_points: 'desc' })
      const tiers = createTiersDesc();

      mockPrisma.loyaltyTier.findMany.mockResolvedValue(tiers);
      mockPrisma.member.findUnique.mockResolvedValue(
        createMockMember({
          current_tier_id: 'tier-bronze',
          tier: tiers[3], // Bronze is last in DESC order
        }),
      );

      const result = await service.evaluate_tier('member-123', 1000000000);

      expect(result.tier_name).toBe('Platinum');
    });
  });

  describe('get_tier_benefits', () => {
    // ============================================
    // HAPPY PATH
    // ============================================
    it('should return free item for tier with benefit', async () => {
      const tier = createMockTier('Gold', 1500, 3);
      tier.free_item_id = 'product-123';
      const product = { id: 'product-123', name: 'Gratis Minuman' };

      mockPrisma.loyaltyTier.findUnique.mockResolvedValue(tier);
      mockPrisma.product.findUnique.mockResolvedValue(product);

      const result = await service.get_tier_benefits(tier.id);

      expect(result).toEqual({ free_item: 'Gratis Minuman' });
    });

    // ============================================
    // ERROR CASES
    // ============================================
    it('should return null for empty tierId', async () => {
      const result = await service.get_tier_benefits('');
      expect(result).toBeNull();
    });

    it('should return null for non-existent tier', async () => {
      mockPrisma.loyaltyTier.findUnique.mockResolvedValue(null);

      const result = await service.get_tier_benefits('non-existent');

      expect(result).toBeNull();
    });

    it('should return null for tier without free item', async () => {
      const tier = createMockTier('Bronze', 0, 1);
      tier.free_item_id = null;

      mockPrisma.loyaltyTier.findUnique.mockResolvedValue(tier);

      const result = await service.get_tier_benefits(tier.id);

      expect(result).toBeNull();
    });

    it('should return null when free item product not found', async () => {
      const tier = createMockTier('Gold', 1500, 3);
      tier.free_item_id = 'deleted-product';

      mockPrisma.loyaltyTier.findUnique.mockResolvedValue(tier);
      mockPrisma.product.findUnique.mockResolvedValue(null);

      const result = await service.get_tier_benefits(tier.id);

      expect(result).toBeNull();
    });

    // ============================================
    // EDGE CASES
    // ============================================
    it('should handle null/undefined free_item_id', async () => {
      const tier = createMockTier('Silver', 500, 2);
      tier.free_item_id = null;

      mockPrisma.loyaltyTier.findUnique.mockResolvedValue(tier);

      const result = await service.get_tier_benefits(tier.id);

      expect(result).toBeNull();
    });
  });

  describe('admin_adjust_tier', () => {
    // ============================================
    // HAPPY PATH
    // ============================================
    it('should upgrade member tier successfully', async () => {
      const bronzeTier = createMockTier('Bronze', 0, 1);
      const silverTier = createMockTier('Silver', 500, 2);
      const member = createMockMember({ tier: bronzeTier });

      mockPrisma.loyaltyTier.findFirst.mockResolvedValue(silverTier);
      mockPrisma.member.findUnique.mockResolvedValue(member);
      mockPrisma.member.update.mockResolvedValue({
        ...member,
        current_tier_id: silverTier.id,
        tier: silverTier,
      });
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await service.admin_adjust_tier('member-123', 'Silver');

      expect(result.old_tier).toBe('Bronze');
      expect(result.new_tier).toBe('Silver');
      expect(result.tier).toEqual(silverTier);
    });

    it('should downgrade member tier successfully', async () => {
      const bronzeTier = createMockTier('Bronze', 0, 1);
      const goldTier = createMockTier('Gold', 1500, 3);
      const member = createMockMember({ tier: goldTier });

      mockPrisma.loyaltyTier.findFirst.mockResolvedValue(bronzeTier);
      mockPrisma.member.findUnique.mockResolvedValue(member);
      mockPrisma.member.update.mockResolvedValue({
        ...member,
        current_tier_id: bronzeTier.id,
        tier: bronzeTier,
      });
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await service.admin_adjust_tier('member-123', 'Bronze');

      expect(result.old_tier).toBe('Gold');
      expect(result.new_tier).toBe('Bronze');
    });

    it('should be case insensitive for tier name', async () => {
      const silverTier = createMockTier('Silver', 500, 2);
      const member = createMockMember({ tier: createMockTier('Bronze', 0, 1) });

      mockPrisma.loyaltyTier.findFirst.mockResolvedValue(silverTier);
      mockPrisma.member.findUnique.mockResolvedValue(member);
      mockPrisma.member.update.mockResolvedValue({
        ...member,
        current_tier_id: silverTier.id,
        tier: silverTier,
      });
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      // Using lowercase tier name
      const result = await service.admin_adjust_tier('member-123', 'silver');

      expect(result.new_tier).toBe('Silver');
    });

    it('should create audit log entry', async () => {
      const silverTier = createMockTier('Silver', 500, 2);
      const member = createMockMember({ tier: createMockTier('Bronze', 0, 1) });

      mockPrisma.loyaltyTier.findFirst.mockResolvedValue(silverTier);
      mockPrisma.member.findUnique.mockResolvedValue(member);
      mockPrisma.member.update.mockResolvedValue({
        ...member,
        current_tier_id: silverTier.id,
        tier: silverTier,
      });
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      await service.admin_adjust_tier('member-123', 'Silver');

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actor_id: 'admin',
          action: 'MEMBER_TIER_ADJUSTED',
          entity_type: 'Member',
          entity_id: 'member-123',
        }),
      });
    });

    // ============================================
    // ERROR CASES
    // ============================================
    it('should throw BadRequestException for non-existent tier', async () => {
      mockPrisma.loyaltyTier.findFirst.mockResolvedValue(null);

      await expect(
        service.admin_adjust_tier('member-123', 'NonExistentTier'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for non-existent member', async () => {
      mockPrisma.loyaltyTier.findFirst.mockResolvedValue(
        createMockTier('Silver', 500, 2),
      );
      mockPrisma.member.findUnique.mockResolvedValue(null);

      await expect(
        service.admin_adjust_tier('non-existent', 'Silver'),
      ).rejects.toThrow(BadRequestException);
    });

    // ============================================
    // EDGE CASES
    // ============================================
    it('should handle inactive tier (should still work for admin override)', async () => {
      const inactiveTier = {
        ...createMockTier('Special', 0, 0),
        is_active: false,
      };
      const member = createMockMember({ tier: createMockTier('Bronze', 0, 1) });

      mockPrisma.loyaltyTier.findFirst.mockResolvedValue(inactiveTier);
      mockPrisma.member.findUnique.mockResolvedValue(member);
      mockPrisma.member.update.mockResolvedValue({
        ...member,
        current_tier_id: inactiveTier.id,
        tier: inactiveTier,
      });
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await service.admin_adjust_tier('member-123', 'Special');

      expect(result.new_tier).toBe('Special');
    });

    it('should handle same tier adjustment (no change)', async () => {
      const silverTier = createMockTier('Silver', 500, 2);
      const member = createMockMember({ tier: silverTier });

      mockPrisma.loyaltyTier.findFirst.mockResolvedValue(silverTier);
      mockPrisma.member.findUnique.mockResolvedValue(member);
      mockPrisma.member.update.mockResolvedValue({
        ...member,
        current_tier_id: silverTier.id,
        tier: silverTier,
      });
      mockPrisma.auditLog.create.mockResolvedValue({} as any);

      const result = await service.admin_adjust_tier('member-123', 'Silver');

      expect(result.old_tier).toBe('Silver');
      expect(result.new_tier).toBe('Silver');
    });
  });
});
