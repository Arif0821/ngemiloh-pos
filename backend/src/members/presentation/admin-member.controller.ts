import {
  Controller,
  Get,
  Param,
  Query,
  Patch,
  Body,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MemberService } from '../application/services/member.service';
import { LoyaltyService } from '../application/services/loyalty.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';

@ApiTags('Admin - Members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard, ThrottlerGuard)
@Controller('admin/members')
@Roles(Role.superadmin)
export class AdminMemberController {
  constructor(
    private readonly memberService: MemberService,
    private readonly loyaltyService: LoyaltyService,
  ) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'List all members' })
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('tier') tier?: string,
    @Query('search') search?: string,
  ) {
    const pageNum = Math.max(1, parseInt(page || '1') || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit || '20') || 20));
    const searchStr = search?.slice(0, 100);

    const result = await this.memberService.get_all_members({
      page: pageNum,
      limit: limitNum,
      tier,
      search: searchStr,
    });
    return { success: true, data: result };
  }

  @Get('stats')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Get member statistics' })
  async stats() {
    const stats = await this.memberService.get_stats();
    return { success: true, data: stats };
  }

  @Get(':id')
  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @ApiOperation({ summary: 'Get member detail' })
  @ApiResponse({ status: 200, description: 'Member detail' })
  async detail(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string) {
    const member = await this.memberService.get_member_detail(id);
    return { success: true, data: member };
  }

  @Patch(':id/tier')
  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @ApiOperation({ summary: 'Manually adjust member tier (upgrade/downgrade)' })
  @ApiResponse({ status: 200, description: 'Tier updated' })
  @ApiResponse({ status: 400, description: 'Invalid tier' })
  async adjustTier(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: { tier: string },
  ) {
    const result = await this.loyaltyService.admin_adjust_tier(id, body.tier);
    return { success: true, data: result };
  }
}
