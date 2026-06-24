import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Req,
  Res,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { Roles } from './auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { Request, Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: string };
}

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @SkipThrottle()
  @Get('health')
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  @ApiResponse({ status: 503, description: 'Service is unhealthy' })
  async healthCheck(@Res() res: Response) {
    const health = await this.appService.healthCheck();
    const statusCode =
      health.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
    return res.status(statusCode).json(health);
  }

  // Internal health endpoint for Docker healthcheck - bypasses rate limiting
  @SkipThrottle()
  @Get('_health')
  async internalHealth(@Res() res: Response) {
    return res
      .status(200)
      .json({ ok: true, timestamp: new Date().toISOString() });
  }

  // Public: info toko untuk struk (nama, alamat, WA) — tidak perlu auth
  @SkipThrottle()
  @Get('api/v1/store-info')
  @ApiOperation({ summary: 'Get store info for receipts' })
  @ApiResponse({ status: 200, description: 'Store info retrieved' })
  async getStoreInfo() {
    const data = await this.appService.getStoreInfo();
    return { success: true, data };
  }

  @Get('api/v1/admin/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.superadmin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get application settings' })
  @ApiResponse({ status: 200, description: 'Settings retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  async getSettings() {
    const data = await this.appService.getSettings();
    return { success: true, data };
  }

  @Patch('api/v1/admin/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.superadmin)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update application settings' })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - superadmin only' })
  async updateSettings(
    @Body() body: Record<string, string>,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.appService.updateSettings(body, req.user.id);
    return { success: true, data };
  }
}
