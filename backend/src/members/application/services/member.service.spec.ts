import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { MemberService } from './member.service';
import { LoyaltyService } from './loyalty.service';
import { RedisService } from '../../../common/redis/redis.service';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  IMemberRepository,
  MemberWithTier,
} from '../../domain/interfaces/member.repository.interface';
import { LOYALTY_COOLDOWN_MINUTES } from '../../../common/utils/constants';

// Jest globals are available in Jest environment

declare const jest: any;

declare const describe: any;

declare const it: any;

declare const expect: any;

declare const beforeEach: any;

// Mock Redis
const mockRedisService = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  exists: jest.fn(),
  isAvailable: jest.fn().mockReturnValue(true),
};

// Mock Prisma
const mockPrisma: Record<string, any> = {
  $executeRaw: jest.fn(),
  $transaction: jest.fn(),
  member: {
    findUnique: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    groupBy: jest.fn(),
  },
  memberTransaction: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  loyaltyTier: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
  },
  product: {
    findUnique: jest.fn(),
  },
};

// Helper to create mock member
const createMockMember = (overrides = {}): MemberWithTier => ({
  id: 'member-123',
  member_code: 'MBR-ABC123',
  phone: '081234567890',
  name: 'Test Member',
  email: 'test@example.com',
  loyalty_points: 100,
  current_tier_id: 'tier-bronze',
  registered_at: new Date(),
  registered_via: 'qr_link',
  is_active: true,
  tier: {
    id: 'tier-bronze',
    name: 'Bronze',
    min_points: 0,
    free_item_id: null,
    sort_order: 1,
  },
  ...overrides,
});

// Helper to create mock tier
const createMockTier = (
  name: string,
  minPoints: number,
  sortOrder: number,
) => ({
  id: `tier-${name.toLowerCase()}`,
  name,
  min_points: minPoints,
  free_item_id: null,
  is_active: true,
  sort_order: sortOrder,
});

describe('MemberService', () => {
  let service: MemberService;
  let mockMemberRepository: jest.Mocked<IMemberRepository>;

  beforeEach(async () => {
    jest.clearAllMocks();

    mockMemberRepository = {
      findByPhone: jest.fn(),
      findByMemberCode: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      updatePoints: jest.fn(),
      updateTier: jest.fn(),
      deactivate: jest.fn(),
      findAll: jest.fn(),
      createTransaction: jest.fn(),
      getTransactionHistory: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemberService,
        LoyaltyService,
        { provide: 'MEMBER_REPOSITORY', useValue: mockMemberRepository },
        { provide: RedisService, useValue: mockRedisService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MemberService>(MemberService);
  });

  describe('register', () => {
    // ============================================
    // HAPPY PATH
    // ============================================
    it('should successfully register a new member with Bronze tier', async () => {
      const bronzeTier = createMockTier('Bronze', 0, 1);
      const newMember = createMockMember({
        member_code: 'MBR-ABC123',
        phone: '081234567890',
        name: 'New Member',
      });

      mockMemberRepository.findByPhone.mockResolvedValue(null);
      mockMemberRepository.findByMemberCode.mockResolvedValue(null);
      mockPrisma.loyaltyTier.findFirst.mockResolvedValue(bronzeTier);
      mockMemberRepository.create.mockResolvedValue(newMember);

      const result = await service.register({
        name: 'New Member',
        phone: '081234567890',
      });

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('member_code');
      expect(result.name).toBe('New Member');
      expect(result.phone).toBe('081234567890');
      expect(result.tier).toBe('Bronze');
    });

    it('should register member with referral code', async () => {
      const bronzeTier = createMockTier('Bronze', 0, 1);
      const newMember = createMockMember({
        registered_via: 'outlet-123',
      });

      mockMemberRepository.findByPhone.mockResolvedValue(null);
      mockMemberRepository.findByMemberCode.mockResolvedValue(null);
      mockPrisma.loyaltyTier.findFirst.mockResolvedValue(bronzeTier);
      mockMemberRepository.create.mockResolvedValue(newMember);

      // Base64 encoded 'outlet-123'
      const refCode = Buffer.from('outlet-123').toString('base64');

      await service.register({
        name: 'New Member',
        phone: '081234567890',
        ref_code: refCode,
      });

      expect(mockMemberRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          registered_outlet_id: 'outlet-123',
        }),
      );
    });

    // ============================================
    // ERROR CASES
    // ============================================
    it('should throw ConflictException when phone already registered', async () => {
      mockMemberRepository.findByPhone.mockResolvedValue(createMockMember());

      await expect(
        service.register({
          name: 'Duplicate',
          phone: '081234567890',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException when member code generation fails', async () => {
      mockMemberRepository.findByPhone.mockResolvedValue(null);
      mockMemberRepository.findByMemberCode.mockResolvedValue(
        createMockMember(),
      ); // Always exists
      mockPrisma.loyaltyTier.findFirst.mockResolvedValue(
        createMockTier('Bronze', 0, 1),
      );

      await expect(
        service.register({
          name: 'New Member',
          phone: '081234567890',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when Bronze tier not found', async () => {
      mockMemberRepository.findByPhone.mockResolvedValue(null);
      mockMemberRepository.findByMemberCode.mockResolvedValue(null);
      mockPrisma.loyaltyTier.findFirst.mockResolvedValue(null);

      await expect(
        service.register({
          name: 'New Member',
          phone: '081234567890',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    // ============================================
    // EDGE CASES
    // ============================================
    it('should generate unique member code on retry', async () => {
      const bronzeTier = createMockTier('Bronze', 0, 1);
      const newMember = createMockMember();

      mockMemberRepository.findByPhone.mockResolvedValue(null);
      // First code exists, second doesn't
      mockMemberRepository.findByMemberCode
        .mockResolvedValueOnce(createMockMember())
        .mockResolvedValueOnce(null);
      mockPrisma.loyaltyTier.findFirst.mockResolvedValue(bronzeTier);
      mockMemberRepository.create.mockResolvedValue(newMember);

      const result = await service.register({
        name: 'New Member',
        phone: '081234567890',
      });

      expect(result).toHaveProperty('member_code');
    });

    it('should handle email field when provided', async () => {
      const bronzeTier = createMockTier('Bronze', 0, 1);
      const newMember = createMockMember({ email: 'test@example.com' });

      mockMemberRepository.findByPhone.mockResolvedValue(null);
      mockMemberRepository.findByMemberCode.mockResolvedValue(null);
      mockPrisma.loyaltyTier.findFirst.mockResolvedValue(bronzeTier);
      mockMemberRepository.create.mockResolvedValue(newMember);

      await service.register({
        name: 'New Member',
        phone: '081234567890',
        email: 'test@example.com',
      });

      expect(mockMemberRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
        }),
      );
    });
  });

  describe('lookup', () => {
    // ============================================
    // HAPPY PATH
    // ============================================
    it('should lookup member by phone', async () => {
      const member = createMockMember();
      mockMemberRepository.findByPhone.mockResolvedValue(member);
      mockRedisService.get.mockResolvedValue(null);

      const result = await service.lookup({ phone: '081234567890' });

      expect(result.id).toBe(member.id);
      expect(result.member_code).toBe(member.member_code);
      expect(result.name).toBe(member.name);
      expect(result.can_earn).toBe(true);
    });

    it('should lookup member by code', async () => {
      const member = createMockMember();
      mockMemberRepository.findByMemberCode.mockResolvedValue(member);
      mockRedisService.get.mockResolvedValue(null);

      const result = await service.lookup({ code: 'MBR-ABC123' });

      expect(result.id).toBe(member.id);
    });

    it('should lookup member by QR code', async () => {
      const member = createMockMember();
      mockMemberRepository.findByMemberCode.mockResolvedValue(member);
      mockRedisService.get.mockResolvedValue(null);

      const result = await service.lookup({ qr: 'MBR-ABC123' });

      expect(result.id).toBe(member.id);
    });

    it('should return cooldown status when active', async () => {
      const member = createMockMember();
      const cooldownUntil = new Date(
        Date.now() + LOYALTY_COOLDOWN_MINUTES * 60 * 1000,
      );
      mockMemberRepository.findByPhone.mockResolvedValue(member);
      mockRedisService.get.mockResolvedValue(cooldownUntil.toISOString());

      const result = await service.lookup({ phone: '081234567890' });

      expect(result.can_earn).toBe(false);
      expect(result.cooldown_until).toBeDefined();
    });

    // ============================================
    // ERROR CASES
    // ============================================
    it('should throw NotFoundException when member not found', async () => {
      mockMemberRepository.findByPhone.mockResolvedValue(null);
      mockMemberRepository.findByMemberCode.mockResolvedValue(null);

      await expect(service.lookup({ phone: '081234567890' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException when no identifier provided', async () => {
      await expect(service.lookup({})).rejects.toThrow(NotFoundException);
    });

    // ============================================
    // EDGE CASES
    // ============================================
    it('should handle expired cooldown', async () => {
      const member = createMockMember();
      const expiredCooldown = new Date(Date.now() - 60000); // 1 minute ago
      mockMemberRepository.findByPhone.mockResolvedValue(member);
      mockRedisService.get.mockResolvedValue(expiredCooldown.toISOString());

      const result = await service.lookup({ phone: '081234567890' });

      expect(result.can_earn).toBe(true);
      expect(result.cooldown_until).toBeNull();
    });

    it('should calculate points value correctly', async () => {
      const member = createMockMember({ loyalty_points: 1000 });
      mockMemberRepository.findByPhone.mockResolvedValue(member);
      mockRedisService.get.mockResolvedValue(null);

      const result = await service.lookup({ phone: '081234567890' });

      // Points value should be calculated based on redemption rate
      expect(result.points_value).toBeDefined();
      expect(typeof result.points_value).toBe('number');
    });
  });

  describe('process_points', () => {
    const mockMember = createMockMember({ loyalty_points: 500 });
    // Advisory lock returns 1 for acquired

    beforeEach(() => {
      // Mock advisory lock
      mockPrisma.$executeRaw.mockResolvedValue(1);
    });

    // ============================================
    // HAPPY PATH
    // ============================================
    it('should earn points for a transaction', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          member: {
            findUnique: jest.fn().mockResolvedValue(mockMember),
            update: jest
              .fn()
              .mockResolvedValue({ ...mockMember, loyalty_points: 600 }),
          },
          memberTransaction: {
            findFirst: jest.fn().mockResolvedValue(null), // No cooldown
            create: jest.fn(),
          },
        };
        return callback(tx);
      });
      mockPrisma.$executeRaw.mockResolvedValue(1); // Lock acquired
      mockPrisma.loyaltyTier.findMany.mockResolvedValue([
        createMockTier('Bronze', 0, 1),
        createMockTier('Silver', 500, 2),
      ]);
      mockPrisma.member.update.mockResolvedValue({
        ...mockMember,
        loyalty_points: 600,
      });
      mockPrisma.product.findUnique.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(undefined);

      const result = await service.process_points({
        member_id: mockMember.id,
        transaction_subtotal: 50000,
        redeem_requested: false,
        cashier_id: 'cashier-123',
      });

      expect(result.points_earned).toBeGreaterThan(0);
      // Balance returned from the transaction
      expect(result.new_balance).toBeDefined();
    });

    it('should redeem points successfully', async () => {
      const memberWithPoints = createMockMember({ loyalty_points: 1000 });
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          member: {
            findUnique: jest.fn().mockResolvedValue(memberWithPoints),
            update: jest
              .fn()
              .mockResolvedValue({ ...memberWithPoints, loyalty_points: 0 }),
          },
          memberTransaction: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
          },
        };
        return callback(tx);
      });
      mockPrisma.$executeRaw.mockResolvedValue(1);
      mockPrisma.loyaltyTier.findMany.mockResolvedValue([
        createMockTier('Bronze', 0, 1),
      ]);
      mockPrisma.member.update.mockResolvedValue({
        ...memberWithPoints,
        loyalty_points: 0,
      });
      mockPrisma.product.findUnique.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(undefined);

      const result = await service.process_points({
        member_id: memberWithPoints.id,
        transaction_subtotal: 50000,
        redeem_requested: true,
        cashier_id: 'cashier-123',
      });

      expect(result.points_redeemed).toBe(1000);
      expect(result.discount_amount).toBeGreaterThan(0);
      expect(result.final_payment).toBeDefined();
    });

    // ============================================
    // ERROR CASES
    // ============================================
    it('should throw NotFoundException for non-existent member', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          member: {
            findUnique: jest.fn().mockResolvedValue(null),
          },
          memberTransaction: {
            findFirst: jest.fn(),
            create: jest.fn(),
          },
        };
        return callback(tx);
      });
      mockPrisma.$executeRaw.mockResolvedValue(1);

      await expect(
        service.process_points({
          member_id: 'non-existent',
          transaction_subtotal: 50000,
          redeem_requested: false,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for inactive member', async () => {
      const inactiveMember = createMockMember({ is_active: false });
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          member: {
            findUnique: jest.fn().mockResolvedValue(inactiveMember),
          },
          memberTransaction: {
            findFirst: jest.fn(),
            create: jest.fn(),
          },
        };
        return callback(tx);
      });
      mockPrisma.$executeRaw.mockResolvedValue(1);

      await expect(
        service.process_points({
          member_id: inactiveMember.id,
          transaction_subtotal: 50000,
          redeem_requested: false,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw error when lock acquisition fails after retries', async () => {
      // Mock lock not acquired (returns 0)
      mockPrisma.$executeRaw.mockResolvedValue(0);

      await expect(
        service.process_points({
          member_id: mockMember.id,
          transaction_subtotal: 50000,
          redeem_requested: false,
        }),
      ).rejects.toThrow('Gagal memproses points');
    });

    // ============================================
    // EDGE CASES
    // ============================================
    it('should skip earning during cooldown', async () => {
      const recentEarn = {
        ...createMockMember(),
        created_at: new Date(Date.now() - LOYALTY_COOLDOWN_MINUTES * 30 * 1000), // 1 minute ago
      };
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          member: {
            findUnique: jest.fn().mockResolvedValue(mockMember),
            update: jest.fn(),
          },
          memberTransaction: {
            findFirst: jest.fn().mockResolvedValue(recentEarn),
            create: jest.fn(),
          },
        };
        return callback(tx);
      });
      mockPrisma.$executeRaw.mockResolvedValue(1);

      const result = await service.process_points({
        member_id: mockMember.id,
        transaction_subtotal: 50000,
        redeem_requested: false,
      });

      expect(result.points_earned).toBe(0);
      expect(result.cooldown_until).toBeDefined();
    });

    it('should handle zero transaction subtotal', async () => {
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          member: {
            findUnique: jest.fn().mockResolvedValue(mockMember),
            update: jest.fn(),
          },
          memberTransaction: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
          },
        };
        return callback(tx);
      });
      mockPrisma.$executeRaw.mockResolvedValue(1);

      const result = await service.process_points({
        member_id: mockMember.id,
        transaction_subtotal: 0,
        redeem_requested: false,
      });

      expect(result.points_earned).toBe(0);
    });

    it('should evaluate tier upgrade', async () => {
      const memberNearUpgrade = createMockMember({ loyalty_points: 400 });
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const tx = {
          member: {
            findUnique: jest.fn().mockResolvedValue(memberNearUpgrade),
            update: jest.fn().mockResolvedValue({
              ...memberNearUpgrade,
              loyalty_points: 500,
              current_tier_id: 'tier-silver',
            }),
          },
          memberTransaction: {
            findFirst: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
          },
        };
        return callback(tx);
      });
      mockPrisma.$executeRaw.mockResolvedValue(1);
      mockPrisma.loyaltyTier.findMany.mockResolvedValue([
        createMockTier('Bronze', 0, 1),
        createMockTier('Silver', 500, 2),
      ]);
      mockPrisma.member.findUnique.mockResolvedValue({
        ...memberNearUpgrade,
        tier: createMockTier('Silver', 500, 2),
      });
      mockPrisma.member.update.mockResolvedValue({
        ...memberNearUpgrade,
        loyalty_points: 500,
        current_tier_id: 'tier-silver',
      });
      mockPrisma.product.findUnique.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue(undefined);

      const result = await service.process_points({
        member_id: memberNearUpgrade.id,
        transaction_subtotal: 20000, // 100 points earned
        redeem_requested: false,
      });

      // Balance returned from the transaction
      expect(result.new_balance).toBeDefined();
    });
  });

  describe('revoke_points', () => {
    // ============================================
    // HAPPY PATH
    // ============================================
    it('should revoke earn transactions and restore points', async () => {
      const earnTransaction = {
        id: 'tx-1',
        member_id: 'member-123',
        order_id: 'order-123',
        type: 'earn' as const,
        points: 50,
        balance_after: 550,
        created_at: new Date(),
      };

      mockPrisma.memberTransaction.findMany.mockResolvedValue([
        earnTransaction,
      ]);
      mockMemberRepository.createTransaction.mockResolvedValue(undefined);
      mockMemberRepository.getTransactionHistory.mockResolvedValue([
        earnTransaction,
        { points: -50 }, // Revoke transaction
      ]);
      mockMemberRepository.updatePoints.mockResolvedValue(
        createMockMember({ loyalty_points: 500 }),
      );

      await service.revoke_points('order-123');

      expect(mockMemberRepository.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          member_id: 'member-123',
          type: 'void_revoke',
        }),
      );
    });

    it('should restore redeemed points on void', async () => {
      const redeemTransaction = {
        id: 'tx-2',
        member_id: 'member-123',
        order_id: 'order-123',
        type: 'redeem' as const,
        points: -500,
        balance_after: 0,
        created_at: new Date(),
      };

      mockPrisma.memberTransaction.findMany.mockResolvedValue([
        redeemTransaction,
      ]);
      mockMemberRepository.createTransaction.mockResolvedValue(undefined);
      mockMemberRepository.getTransactionHistory.mockResolvedValue([
        redeemTransaction,
        { points: 500 }, // Restore transaction
      ]);
      mockMemberRepository.updatePoints.mockResolvedValue(
        createMockMember({ loyalty_points: 500 }),
      );

      await service.revoke_points('order-123');

      expect(mockMemberRepository.createTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'void_restore',
          points: 500,
        }),
      );
    });

    // ============================================
    // ERROR CASES
    // ============================================
    it('should return early when no transactions found', async () => {
      mockPrisma.memberTransaction.findMany.mockResolvedValue([]);

      await service.revoke_points('order-nonexistent');

      expect(mockMemberRepository.createTransaction).not.toHaveBeenCalled();
    });

    // ============================================
    // EDGE CASES
    // ============================================
    it('should handle mixed earn and redeem transactions', async () => {
      const transactions = [
        {
          id: 'tx-1',
          member_id: 'member-123',
          order_id: 'order-123',
          type: 'earn' as const,
          points: 100,
          balance_after: 600,
        },
        {
          id: 'tx-2',
          member_id: 'member-123',
          order_id: 'order-123',
          type: 'redeem' as const,
          points: -200,
          balance_after: 400,
        },
      ];

      mockPrisma.memberTransaction.findMany.mockResolvedValue(transactions);
      mockMemberRepository.createTransaction.mockResolvedValue(undefined);
      mockMemberRepository.getTransactionHistory.mockResolvedValue([
        ...transactions,
        { points: -100 },
        { points: 200 },
      ]);
      mockMemberRepository.updatePoints.mockResolvedValue(
        createMockMember({ loyalty_points: 500 }),
      );

      await service.revoke_points('order-123');

      // Should create both void_revoke and void_restore
      expect(mockMemberRepository.createTransaction).toHaveBeenCalledTimes(2);
    });
  });

  describe('get_all_members', () => {
    // ============================================
    // HAPPY PATH
    // ============================================
    it('should return paginated members', async () => {
      const members = [
        createMockMember(),
        createMockMember({ id: 'member-456' }),
      ];
      mockMemberRepository.findAll.mockResolvedValue({
        data: members,
        total: 2,
      });

      const result = await service.get_all_members({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter members by tier', async () => {
      mockMemberRepository.findAll.mockResolvedValue({ data: [], total: 0 });

      await service.get_all_members({ tier: 'Silver' });

      expect(mockMemberRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ tier: 'Silver' }),
      );
    });

    it('should search members by name', async () => {
      mockMemberRepository.findAll.mockResolvedValue({ data: [], total: 0 });

      await service.get_all_members({ search: 'John' });

      expect(mockMemberRepository.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'John' }),
      );
    });

    // ============================================
    // EDGE CASES
    // ============================================
    it('should handle no members found', async () => {
      mockMemberRepository.findAll.mockResolvedValue({ data: [], total: 0 });

      const result = await service.get_all_members();

      expect(result.data).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should use default pagination', async () => {
      mockMemberRepository.findAll.mockResolvedValue({ data: [], total: 0 });

      await service.get_all_members();

      expect(mockMemberRepository.findAll).toHaveBeenCalledWith(undefined);
    });
  });

  describe('get_member_detail', () => {
    // ============================================
    // HAPPY PATH
    // ============================================
    it('should return member with transactions and benefits', async () => {
      const member = createMockMember();
      const transactions = [
        { id: 'tx-1', points: 100, balance_after: 100 },
        { id: 'tx-2', points: 50, balance_after: 150 },
      ];

      mockMemberRepository.findById.mockResolvedValue(member);
      mockMemberRepository.getTransactionHistory.mockResolvedValue(
        transactions,
      );
      mockPrisma.loyaltyTier.findUnique.mockResolvedValue(
        createMockTier('Bronze', 0, 1),
      );
      mockPrisma.product.findUnique.mockResolvedValue(null);

      const result = await service.get_member_detail(member.id);

      expect(result.id).toBe(member.id);
      expect(result.transactions).toEqual(transactions);
      expect(result.points_value).toBeDefined();
    });

    // ============================================
    // ERROR CASES
    // ============================================
    it('should throw NotFoundException for non-existent member', async () => {
      mockMemberRepository.findById.mockResolvedValue(null);

      await expect(service.get_member_detail('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    // ============================================
    // EDGE CASES
    // ============================================
    it('should handle member with no transactions', async () => {
      const member = createMockMember();
      mockMemberRepository.findById.mockResolvedValue(member);
      mockMemberRepository.getTransactionHistory.mockResolvedValue([]);
      mockPrisma.loyaltyTier.findUnique.mockResolvedValue(
        createMockTier('Bronze', 0, 1),
      );
      mockPrisma.product.findUnique.mockResolvedValue(null);

      const result = await service.get_member_detail(member.id);

      expect(result.transactions).toHaveLength(0);
    });
  });

  describe('get_stats', () => {
    // ============================================
    // HAPPY PATH
    // ============================================
    it('should return member statistics', async () => {
      mockPrisma.member.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(10); // new this month
      mockPrisma.member.groupBy.mockResolvedValue([
        { current_tier_id: 'tier-bronze', _count: 70 },
        { current_tier_id: 'tier-silver', _count: 30 },
      ]);
      mockPrisma.loyaltyTier.findMany.mockResolvedValue([
        createMockTier('Bronze', 0, 1),
        createMockTier('Silver', 500, 2),
      ]);

      const result = await service.get_stats();

      expect(result.total_members).toBe(100);
      expect(result.new_this_month).toBe(10);
      expect(result.tier_distribution).toHaveProperty('Bronze');
      expect(result.tier_distribution).toHaveProperty('Silver');
    });

    // ============================================
    // EDGE CASES
    // ============================================
    it('should handle empty tier distribution', async () => {
      mockPrisma.member.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      mockPrisma.member.groupBy.mockResolvedValue([]);
      mockPrisma.loyaltyTier.findMany.mockResolvedValue([]);

      const result = await service.get_stats();

      expect(result.total_members).toBe(0);
      expect(Object.keys(result.tier_distribution)).toHaveLength(0);
    });

    it('should handle unknown tier IDs in distribution', async () => {
      mockPrisma.member.count
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(5);
      mockPrisma.member.groupBy.mockResolvedValue([
        { current_tier_id: 'unknown-tier', _count: 50 },
      ]);
      mockPrisma.loyaltyTier.findMany.mockResolvedValue([]);

      const result = await service.get_stats();

      // When tier not found in tierMap, defaults to 'Bronze'
      expect(result.tier_distribution['Bronze']).toBe(50);
    });
  });
});
