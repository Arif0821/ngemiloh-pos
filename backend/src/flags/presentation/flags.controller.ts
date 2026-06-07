import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { FlagsService } from '../application/services/flags.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { ToggleFlagDto } from './dto/flags.dto';

@Controller('flags')
export class FlagsController {
  constructor(private flagsService: FlagsService) {}

  @Get()
  async getPublicFlags() {
    // POS kasir will call this, it returns the fast cached map
    const data = await this.flagsService.getFlagsMap();
    return { success: true, data };
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin')
  async getAllFlags() {
    const data = await this.flagsService.getAllFlags();
    return { success: true, data };
  }

  @Post('toggle')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('superadmin')
  async toggleFlag(@Body() body: ToggleFlagDto, @Req() req: any) {
    const data = await this.flagsService.toggleFlag(body.name, body.is_enabled, req.user.id);
    return { success: true, data };
  }
}
