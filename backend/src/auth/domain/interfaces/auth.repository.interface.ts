import { User, IpLockout, RevokedToken, AuditLog } from '@prisma/client';

export const AUTH_REPOSITORY = Symbol('AUTH_REPOSITORY');

export interface AuthRepositoryInterface {
  findIpLockout(ipAddress: string): Promise<IpLockout | null>;
  incrementIpLockout(ipAddress: string): Promise<IpLockout>;
  lockIpAddress(ipAddress: string, lockedUntil: Date): Promise<IpLockout>;
  resetIpLockout(ipAddress: string): Promise<IpLockout>;

  findUserByUsernameOrEmail(identifier: string): Promise<User | null>;
  findUserByUsername(username: string): Promise<User | null>;
  findUserById(id: string): Promise<User | null>;

  incrementUserFailedLogin(userId: string): Promise<User>;
  lockUser(userId: string, lockedUntil: Date): Promise<User>;
  resetUserFailedLogin(userId: string): Promise<User>;

  createAuditLog(actorId: string, action: string, entityType: string, entityId: string, newValue: any): Promise<AuditLog>;

  findRevokedToken(token: string): Promise<RevokedToken | null>;
  revokeToken(token: string, userId: string, expiresAt: Date): Promise<RevokedToken>;
}
