import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { MemberService } from './application/services/member.service';
import { LoyaltyService } from './application/services/loyalty.service';
import { MemberController } from './presentation/member.controller';
import { PosMemberController } from './presentation/pos-member.controller';
import { AdminMemberController } from './presentation/admin-member.controller';
import { PrismaMemberRepository } from './infrastructure/repositories/prisma-member.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../common/redis/redis.module';
import { MemberRateLimiterMiddleware } from './middleware/member-rate-limiter.middleware';

@Module({
  imports: [PrismaModule, RedisModule],
  providers: [
    MemberService,
    LoyaltyService,
    MemberRateLimiterMiddleware,
    {
      provide: 'MEMBER_REPOSITORY',
      useClass: PrismaMemberRepository,
    },
  ],
  controllers: [MemberController, PosMemberController, AdminMemberController],
  exports: [MemberService],
})
export class MembersModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MemberRateLimiterMiddleware).forRoutes(MemberController);
  }
}
