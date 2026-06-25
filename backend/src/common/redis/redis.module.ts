import { Module, Global } from '@nestjs/common';
import { RedisService } from './redis.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Global()
@Module({
  imports: [PrismaModule], // Required for database fallback on JWT blocklist
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule {}
