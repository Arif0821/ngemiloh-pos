import { Controller, Get, Patch, Body, UseGuards, Req, Param } from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { Roles } from './auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
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
  async updateSettings(@Body() body: Record<string, string>, @Req() req: any) {
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
  async toggleFeatureFlag(@Param('id') id: string, @Body('is_enabled') isEnabled: boolean, @Req() req: any) {
    const data = await this.appService.toggleFeatureFlag(id, isEnabled, req.user.id);
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
