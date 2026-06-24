import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { AuthRepositoryInterface } from '../../domain/interfaces/auth.repository.interface';
import { User, IpLockout, AuditLog, Prisma } from '@prisma/client';

@Injectable()
export class PrismaAuthRepository implements AuthRepositoryInterface {
  constructor(private readonly prisma: PrismaService) {}

  async findIpLockout(ipHash: string): Promise<IpLockout | null> {
    return this.prisma.ipLockout.findUnique({
      where: { ip_hash: ipHash },
    });
  }

  async incrementIpLockout(ipHash: string): Promise<IpLockout> {
    // Use atomic upsert operation
    return this.prisma.ipLockout.upsert({
      where: { ip_hash: ipHash },
      update: { failed_count: { increment: 1 } },
      create: { ip_hash: ipHash, failed_count: 1 },
    });
  }

  async lockIpAddress(ipHash: string, lockedUntil: Date): Promise<IpLockout> {
    return this.prisma.ipLockout.update({
      where: { ip_hash: ipHash },
      data: { locked_until: lockedUntil },
    });
  }

  async resetIpLockout(ipHash: string): Promise<IpLockout> {
    return this.prisma.ipLockout.upsert({
      where: { ip_hash: ipHash },
      update: { failed_count: 0, locked_until: null },
      create: { ip_hash: ipHash, failed_count: 0 },
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

  async updateUserPin(userId: string, pinHash: string): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { pin_hash: pinHash, must_change_pin: false },
    });
  }
}
