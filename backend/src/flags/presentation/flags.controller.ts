import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { FlagsService } from '../application/services/flags.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ToggleFlagDto } from './dto/flags.dto';
import type { AuthenticatedRequest } from '../../types/express';

@ApiTags('Feature Flags')
@Controller('flags')
@UseGuards(JwtAuthGuard, ThrottlerGuard)
export class FlagsController {
  constructor(private flagsService: FlagsService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'Get public feature flags' })
  @ApiResponse({ status: 200, description: 'Feature flags retrieved' })
  async getPublicFlags() {
    const data = await this.flagsService.getFlagsMap();
    return { success: true, data };
  }

  @Get('admin')
  @Roles('superadmin')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get all feature flags (admin)' })
  @ApiResponse({ status: 200, description: 'All feature flags retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  async getAllFlags() {
    const data = await this.flagsService.getAllFlags();
    return { success: true, data };
  }

  @Post('toggle')
  @Roles('superadmin')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Toggle feature flag' })
  @ApiResponse({ status: 200, description: 'Flag toggled' })
  @ApiResponse({ status: 400, description: 'Invalid flag name' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
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
