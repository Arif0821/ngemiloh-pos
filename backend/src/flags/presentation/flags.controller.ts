import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { FlagsService } from '../application/services/flags.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ToggleFlagDto } from './dto/flags.dto';
import type { AuthenticatedRequest } from '../../types/express';

@Controller('flags')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
export class FlagsController {
  constructor(private flagsService: FlagsService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 req/min
  async getPublicFlags() {
    const data = await this.flagsService.getFlagsMap();
    return { success: true, data };
  }

  @Get('admin')
  @Roles('superadmin')
  async getAllFlags() {
    const data = await this.flagsService.getAllFlags();
    return { success: true, data };
  }

  @Post('toggle')
  @Roles('superadmin')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  async toggleFlag(
    @Body() body: ToggleFlagDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.flagsService.toggleFlag(
      body.name,
      body.is_enabled,
      req.user.id,
    );
    return { success: true, data };
  }
}
