import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { MemberService } from '../application/services/member.service';
import { RegisterMemberDto } from '../application/dto/register-member.dto';
import { LookupMemberQueryDto } from '../application/dto/lookup-member.dto';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';

@ApiTags('Members')
@UseGuards(ThrottlerGuard)
@Controller('member')
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 per minute per IP
  @ApiOperation({ summary: 'Register new member' })
  @ApiBody({ type: RegisterMemberDto })
  @ApiResponse({ status: 201, description: 'Registration successful' })
  @ApiResponse({ status: 409, description: 'Phone already registered' })
  async register(@Body() dto: RegisterMemberDto) {
    const member = await this.memberService.register(dto);
    return {
      success: true,
      data: member,
      message: 'Pendaftaran berhasil! Selamat datang di NGEMILOH Members.',
    };
  }

  @Get('lookup')
  @Throttle({ default: { limit: 30, ttl: 60000 } }) // 30 per minute per IP
  @ApiOperation({ summary: 'Lookup member by phone/code/QR' })
  @ApiResponse({ status: 200, description: 'Member found' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async lookup(@Query() query: LookupMemberQueryDto) {
    const member = await this.memberService.lookup(query);
    return { success: true, data: member };
  }
}
