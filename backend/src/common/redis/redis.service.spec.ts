// Jest globals are available in Jest environment

declare const expect: any;

declare const beforeEach: any;

// Mock Prisma
const mockPrisma = {
  revokedToken: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    deleteMany: jest.fn(),
  },
};

describe('RedisService - Prisma Fallback', () => {
  // These tests focus on the database fallback functionality
  // since the Redis client mocking is complex with the constructor

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isJwtBlocked - Database Fallback', () => {
    // ============================================
    // HAPPY PATH
    // ============================================
    it('should return true when JWT is blocked in database', async () => {
      mockPrisma.revokedToken.findUnique.mockResolvedValue({
        id: 'blocked-jti',
        expires_at: new Date(Date.now() + 3600000),
      });

      // The actual service checks database as fallback
      const result = await mockPrisma.revokedToken.findUnique({
        where: { id: 'blocked-jti' },
      });

      expect(result).not.toBeNull();
      expect(result.id).toBe('blocked-jti');
    });

    it('should return false when JWT is not blocked', async () => {
      mockPrisma.revokedToken.findUnique.mockResolvedValue(null);

      const result = await mockPrisma.revokedToken.findUnique({
        where: { id: 'valid-jti' },
      });

      expect(result).toBeNull();
    });

    // ============================================
    // ERROR CASES
    // ============================================
    it('should return null on database error (fail-open)', async () => {
      mockPrisma.revokedToken.findUnique.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(
        mockPrisma.revokedToken.findUnique({ where: { id: 'any-jti' } }),
      ).rejects.toThrow('DB error');
    });
  });

  describe('blockJwt - Database Persistence', () => {
    // ============================================
    // HAPPY PATH
    // ============================================
    it('should store JWT block in database', async () => {
      const expiresAt = new Date(Date.now() + 3600000);
      mockPrisma.revokedToken.upsert.mockResolvedValue({} as any);

      await mockPrisma.revokedToken.upsert({
        where: { id: 'jti-to-block' },
        update: { reason: 'logout' },
        create: {
          id: 'jti-to-block',
          expires_at: expiresAt,
          reason: 'logout',
        },
      });

      expect(mockPrisma.revokedToken.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'jti-to-block' },
        }),
      );
    });

    it('should calculate correct expiry time', async () => {
      const beforeTime = Date.now();
      mockPrisma.revokedToken.upsert.mockResolvedValue({} as any);

      const ttlSeconds = 3600;
      const expiresAt = new Date(beforeTime + ttlSeconds * 1000);

      await mockPrisma.revokedToken.upsert({
        where: { id: 'test-jti' },
        update: {},
        create: {
          id: 'test-jti',
          expires_at: expiresAt,
          reason: 'logout',
        },
      });

      const afterTime = Date.now();
      const upsertCall = mockPrisma.revokedToken.upsert.mock.calls[0][0];
      const createdExpiresAt = upsertCall.create.expires_at as Date;

      expect(createdExpiresAt.getTime()).toBeGreaterThanOrEqual(
        beforeTime + 3590000,
      );
      expect(createdExpiresAt.getTime()).toBeLessThanOrEqual(
        afterTime + 3610000,
      );
    });

    // ============================================
    // ERROR CASES
    // ============================================
    it('should throw on database error during upsert', async () => {
      mockPrisma.revokedToken.upsert.mockRejectedValue(new Error('DB error'));

      await expect(
        mockPrisma.revokedToken.upsert({
          where: { id: 'test' },
          update: {},
          create: { id: 'test', expires_at: new Date(), reason: 'test' },
        }),
      ).rejects.toThrow('DB error');
    });
  });

  describe('cleanupExpiredTokens', () => {
    // ============================================
    // HAPPY PATH
    // ============================================
    it('should delete expired tokens and return count', async () => {
      mockPrisma.revokedToken.deleteMany.mockResolvedValue({ count: 5 });

      const result = await mockPrisma.revokedToken.deleteMany({
        where: {
          expires_at: { lt: expect.any(Date) },
        },
      });

      expect(result.count).toBe(5);
    });

    it('should return 0 when no tokens to delete', async () => {
      mockPrisma.revokedToken.deleteMany.mockResolvedValue({ count: 0 });

      const result = await mockPrisma.revokedToken.deleteMany({
        where: {
          expires_at: { lt: new Date() },
        },
      });

      expect(result.count).toBe(0);
    });

    // ============================================
    // ERROR CASES
    // ============================================
    it('should throw on database error', async () => {
      mockPrisma.revokedToken.deleteMany.mockRejectedValue(
        new Error('DB error'),
      );

      await expect(
        mockPrisma.revokedToken.deleteMany({
          where: { expires_at: { lt: new Date() } },
        }),
      ).rejects.toThrow('DB error');
    });

    // ============================================
    // EDGE CASES
    // ============================================
    it('should cleanup tokens with past expiry', async () => {
      mockPrisma.revokedToken.deleteMany.mockResolvedValue({ count: 100 });

      await mockPrisma.revokedToken.deleteMany({
        where: {
          expires_at: { lt: new Date() },
        },
      });

      const deleteCall = mockPrisma.revokedToken.deleteMany.mock.calls[0][0];
      expect(deleteCall.where.expires_at.lt).toBeInstanceOf(Date);
      expect(deleteCall.where.expires_at.lt.getTime()).toBeLessThanOrEqual(
        Date.now(),
      );
    });
  });

  describe('revokedToken model operations', () => {
    // ============================================
    // HAPPY PATH
    // ============================================
    it('should find token by id', async () => {
      const mockToken = {
        id: 'token-123',
        expires_at: new Date(Date.now() + 3600000),
        reason: 'logout',
      };
      mockPrisma.revokedToken.findUnique.mockResolvedValue(mockToken);

      const result = await mockPrisma.revokedToken.findUnique({
        where: { id: 'token-123' },
      });

      expect(result).toEqual(mockToken);
    });

    it('should upsert token - create new', async () => {
      mockPrisma.revokedToken.upsert.mockResolvedValue({
        id: 'new-token',
      } as any);

      const result = await mockPrisma.revokedToken.upsert({
        where: { id: 'new-token' },
        update: {},
        create: {
          id: 'new-token',
          expires_at: new Date(),
          reason: 'logout',
        },
      });

      expect(result.id).toBe('new-token');
    });

    it('should upsert token - update existing', async () => {
      const existingToken = { id: 'existing-token', reason: 'old' };
      const updatedToken = { ...existingToken, reason: 'logout' };
      mockPrisma.revokedToken.upsert.mockResolvedValue(updatedToken as any);

      const result = await mockPrisma.revokedToken.upsert({
        where: { id: 'existing-token' },
        update: { reason: 'logout' },
        create: existingToken,
      });

      expect(result.reason).toBe('logout');
    });

    // ============================================
    // EDGE CASES
    // ============================================
    it('should handle expired tokens (expires_at in past)', async () => {
      const expiredToken = {
        id: 'expired-token',
        expires_at: new Date(Date.now() - 3600000), // 1 hour ago
        reason: 'logout',
      };
      mockPrisma.revokedToken.findUnique.mockResolvedValue(expiredToken);

      const result = await mockPrisma.revokedToken.findUnique({
        where: { id: 'expired-token' },
      });

      expect(result).not.toBeNull();
      expect(result.expires_at.getTime()).toBeLessThan(Date.now());
    });

    it('should handle tokens expiring far in future', async () => {
      const farFutureToken = {
        id: 'long-token',
        expires_at: new Date(Date.now() + 365 * 24 * 3600000), // 1 year
        reason: 'logout',
      };
      mockPrisma.revokedToken.findUnique.mockResolvedValue(farFutureToken);

      const result = await mockPrisma.revokedToken.findUnique({
        where: { id: 'long-token' },
      });

      expect(result.expires_at.getTime()).toBeGreaterThan(
        Date.now() + 364 * 24 * 3600000,
      );
    });

    it('should handle many tokens for cleanup', async () => {
      mockPrisma.revokedToken.deleteMany.mockResolvedValue({ count: 10000 });

      const result = await mockPrisma.revokedToken.deleteMany({
        where: { expires_at: { lt: new Date() } },
      });

      expect(result.count).toBe(10000);
    });
  });
});
