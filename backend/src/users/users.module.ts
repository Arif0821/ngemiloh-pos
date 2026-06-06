import { Module } from '@nestjs/common';
import { UsersController } from './presentation/users.controller';
import { UsersService } from './application/services/users.service';
import { PrismaUserRepository } from './infrastructure/repositories/prisma-user.repository';
import { USER_REPOSITORY } from './domain/interfaces/user.repository.interface';

@Module({
  controllers: [UsersController],
  providers: [
    UsersService,
    {
      provide: USER_REPOSITORY,
      useClass: PrismaUserRepository
    }
  ]
})
export class UsersModule {}
