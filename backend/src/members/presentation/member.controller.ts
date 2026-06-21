import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { MemberService } from '../application/services/member.service';
import { RegisterMemberDto } from '../application/dto/register-member.dto';
import { LookupMemberQueryDto } from '../application/dto/lookup-member.dto';

@ApiTags('Members')
@Controller('member')
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
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
  @ApiOperation({ summary: 'Lookup member by phone/code/QR' })
  @ApiResponse({ status: 200, description: 'Member found' })
  @ApiResponse({ status: 404, description: 'Member not found' })
  async lookup(@Query() query: LookupMemberQueryDto) {
    const member = await this.memberService.lookup(query);
    return { success: true, data: member };
  }
}
