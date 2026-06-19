import {
  Controller,
  Get,
  Patch,
  Body,
  UseGuards,
  Req,
  Param,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { Roles } from './auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { Request } from 'express';
import { Response } from 'express';
import { SkipThrottle } from '@nestjs/throttler';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: string };
}

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @SkipThrottle()
  @Get('health')
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
  async getStoreInfo() {
    const data = await this.appService.getStoreInfo();
    return { success: true, data };
  }

  @Get('api/v1/admin/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.superadmin)
  async getSettings() {
    const data = await this.appService.getSettings();
    return { success: true, data };
  }

  @Patch('api/v1/admin/settings')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.superadmin)
  async updateSettings(
    @Body() body: Record<string, string>,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.appService.updateSettings(body, req.user.id);
    return { success: true, data };
  }

  @Get('api/v1/admin/feature-flags')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.superadmin)
  async getFeatureFlags() {
    const data = await this.appService.getFeatureFlags();
    return { success: true, data };
  }

  @Patch('api/v1/admin/feature-flags/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.superadmin)
  async toggleFeatureFlag(
    @Param('id') id: string,
    @Body('is_enabled') isEnabled: boolean,
    @Req() req: AuthenticatedRequest,
  ) {
    const data = await this.appService.toggleFeatureFlag(
      id,
      isEnabled,
      req.user.id,
    );
    return { success: true, data };
  }

  @Get('api/v1/admin/audit-logs')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.superadmin)
  async getAuditLogs() {
    const data = await this.appService.getAuditLogs();
    return { success: true, data };
  }
}
