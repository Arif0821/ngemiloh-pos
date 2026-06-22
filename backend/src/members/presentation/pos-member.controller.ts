import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { MemberService } from '../application/services/member.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { LookupMemberQueryDto } from '../application/dto/lookup-member.dto';
import { ProcessMemberPointsDto } from '../application/dto/process-points.dto';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';

@ApiTags('POS - Members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@Controller('pos/member')
export class PosMemberController {
  constructor(private readonly memberService: MemberService) {}

  @Get('lookup')
  @Throttle({ default: { limit: 60, ttl: 60000 } }) // 60 per minute
  @ApiOperation({ summary: 'Lookup member for POS' })
  @ApiResponse({ status: 200, description: 'Member found' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async lookup(@Query() query: LookupMemberQueryDto) {
    const member = await this.memberService.lookup(query);
    return { success: true, data: member };
  }

  @Post('process')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 per minute
  @ApiOperation({ summary: 'Process member points (earn + optional redeem)' })
  @ApiResponse({ status: 200, description: 'Points processed' })
  async processPoints(@Body() dto: ProcessMemberPointsDto, @Req() req: any) {
    const result = await this.memberService.process_points({
      ...dto,
      cashier_id: req.user?.id,
    });
    return { success: true, data: result };
  }
}
