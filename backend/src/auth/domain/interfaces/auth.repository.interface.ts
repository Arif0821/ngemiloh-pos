import { User, IpLockout, AuditLog, Prisma } from '@prisma/client';

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

export interface AuthRepositoryInterface {
  findIpLockout(ipHash: string): Promise<IpLockout | null>;
  incrementIpLockout(ipHash: string): Promise<IpLockout>;
  lockIpAddress(ipHash: string, lockedUntil: Date): Promise<IpLockout>;
  resetIpLockout(ipHash: string): Promise<IpLockout>;

  findUserByUsernameOrEmail(identifier: string): Promise<User | null>;
  findUserByUsername(username: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;

  incrementUserFailedLogin(userId: string): Promise<User>;
  lockUser(userId: string, lockedUntil: Date): Promise<User>;
  resetUserFailedLogin(userId: string): Promise<User>;

  createAuditLog(
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    newValue: Prisma.InputJsonValue,
  ): Promise<AuditLog>;

  updateUserPin(userId: string, pinHash: string): Promise<void>;

  // FIX #7: JWT Blocklist Fallback - Database methods for revoked tokens
  isTokenRevoked(jti: string): Promise<boolean>;
  revokeToken(jti: string, expiresAt: Date, reason?: string): Promise<void>;
  cleanupExpiredTokens(): Promise<number>;
}
