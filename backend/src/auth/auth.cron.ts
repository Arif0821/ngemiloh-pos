import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthCronService {
  private readonly logger = new Logger(AuthCronService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Run daily at 3 AM to cleanup expired tokens
  @Cron('0 3 * * *', { timeZone: 'Asia/Jakarta' })
  async cleanupExpiredTokens() {
    this.logger.log('Running expired token cleanup...');

    try {
      const result = await this.prisma.revokedToken.deleteMany({
        where: {
          expires_at: { lt: new Date() }
        }
      });

      if (result.count > 0) {
        this.logger.log(`Cleaned up ${result.count} expired tokens`);
      } else {
        this.logger.debug('No expired tokens to clean up');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to cleanup expired tokens: ${errorMessage}`);
    }
  }
}