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

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      useFactory: () => ({
        secret: process.env.JWT_ACCESS_SECRET,
        signOptions: { expiresIn: '8h' },
      }),
    }),
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