import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { MemberService } from '../application/services/member.service';
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
  constructor(private readonly memberService: MemberService) {}

  @Get()
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @ApiOperation({ summary: 'List all members' })
  async list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('tier') tier?: string,
    @Query('search') search?: string,
  ) {
    const result = await this.memberService.get_all_members({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      tier,
      search,
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
  @ApiOperation({ summary: 'Get member detail' })
  @ApiResponse({ status: 200, description: 'Member detail' })
  async detail(@Param('id') id: string) {
    const member = await this.memberService.get_member_detail(id);
    return { success: true, data: member };
  }
}
