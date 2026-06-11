import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthRepositoryInterface } from '../../domain/interfaces/auth.repository.interface';
import {
  User,
  IpLockout,
  RevokedToken,
  AuditLog,
  Prisma,
} from '@prisma/client';

@Injectable()
export class PrismaAuthRepository implements AuthRepositoryInterface {
  constructor(private readonly prisma: PrismaService) {}

  async findIpLockout(ipAddress: string): Promise<IpLockout | null> {
    return this.prisma.ipLockout.findUnique({
      where: { ip_address: ipAddress },
    });
  }

  async incrementIpLockout(ipAddress: string): Promise<IpLockout> {
    return this.prisma.ipLockout.upsert({
      where: { ip_address: ipAddress },
      update: { failed_count: { increment: 1 } },
      create: { ip_address: ipAddress, failed_count: 1 },
    });
  }

  async lockIpAddress(
    ipAddress: string,
    lockedUntil: Date,
  ): Promise<IpLockout> {
    return this.prisma.ipLockout.update({
      where: { ip_address: ipAddress },
      data: { locked_until: lockedUntil },
    });
  }

  async resetIpLockout(ipAddress: string): Promise<IpLockout> {
    return this.prisma.ipLockout.upsert({
      where: { ip_address: ipAddress },
      update: { failed_count: 0, locked_until: null },
      create: { ip_address: ipAddress, failed_count: 0 },
    });
  }

  async findUserByUsernameOrEmail(identifier: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        OR: [
          { username: identifier.toLowerCase() },
          { email: identifier.toLowerCase() },
        ],
      },
    });
  }

  async findUserByUsername(username: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { username } });
  }

  async findUserById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async incrementUserFailedLogin(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { failed_login_count: { increment: 1 } },
    });
  }

  async lockUser(userId: string, lockedUntil: Date): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { locked_until: lockedUntil },
    });
  }

  async resetUserFailedLogin(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        failed_login_count: 0,
        locked_until: null,
        last_login_at: new Date(),
      },
    });
  }

  async createAuditLog(
    actorId: string,
    action: string,
    entityType: string,
    entityId: string,
    newValue: Prisma.InputJsonValue,
  ): Promise<AuditLog> {
    return this.prisma.auditLog.create({
      data: {
        actor_id: actorId,
        action,
        entity_type: entityType,
        entity_id: entityId,
        new_value: newValue,
      },
    });
  }

  async findRevokedToken(token: string): Promise<RevokedToken | null> {
    return this.prisma.revokedToken.findUnique({ where: { jti: token } });
  }

  async revokeToken(
    token: string,
    userId: string,
    expiresAt: Date,
  ): Promise<RevokedToken> {
    return this.prisma.revokedToken.upsert({
      where: { jti: token },
      update: {},
      create: {
        jti: token,
        user_id: userId,
        expires_at: expiresAt,
      },
    });
  }
}
