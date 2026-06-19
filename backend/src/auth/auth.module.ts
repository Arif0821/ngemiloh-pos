import { Module } from '@nestjs/common';
import { AuthService } from './application/services/auth.service';
import { AuthController } from './presentation/auth.controller';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaAuthRepository } from './infrastructure/repositories/prisma-auth.repository';
import { AUTH_REPOSITORY } from './domain/interfaces/auth.repository.interface';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { RedisModule } from '../common/redis/redis.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_ACCESS_SECRET;
        if (!secret) {
          throw new Error(
            'FATAL: JWT_ACCESS_SECRET environment variable is required',
          );
        }
        return {
          secret,
          signOptions: { expiresIn: '8h' },
        };
      },
    }),
    RedisModule, // For OTP caching (Global)
  ],
  providers: [
    {
      provide: AUTH_REPOSITORY,
      useClass: PrismaAuthRepository,
    },
    AuthService,
    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
