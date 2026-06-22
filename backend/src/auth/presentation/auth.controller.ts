import {
  Controller,
  Post,
  Body,
  Res,
  HttpCode,
  HttpStatus,
  Get,
  Patch,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { AuthService } from '../application/services/auth.service';
import type { Response, Request } from 'express';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { LoginDto } from '../dto/login.dto';
import { VerifyOtpDto } from '../dto/verify-otp.dto';
import { ResendOtpDto } from '../dto/resend-otp.dto';
import { ChangePinDto } from '../dto/change-pin.dto';
import type { AuthenticatedRequest } from '../../types/express';

@ApiTags('Auth')
@ApiBearerAuth()
@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private getClientIp(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (Array.isArray(forwardedFor)) return forwardedFor[0];
    if (typeof forwardedFor === 'string')
      return forwardedFor.split(',')[0].trim();
    return req.socket.remoteAddress || 'unknown';
  }

  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ login: { limit: 5, ttl: 600000 } })
  @ApiOperation({
    summary: 'Login kasir dengan PIN',
    description: 'Autentikasi kasir dengan username dan PIN 6 digit',
  })
  @ApiResponse({
    status: 200,
    description: 'Login berhasil, JWT token di-set sebagai cookie',
  })
  @ApiResponse({ status: 401, description: 'PIN atau username salah' })
  @ApiResponse({ status: 429, description: 'Terlalu banyak percobaan login' })
  async login(
    @Req() req: Request,
    @Body() body: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { username, email, pin, password } = body;
    const loginIdentifier = username || email;
    const loginSecret = pin || password;
    if (!loginIdentifier || !loginSecret)
      throw new BadRequestException('Credentials missing');

    // Check if this is a kasir login (has username + pin)
    if (username && pin) {
      // Kasir: direct login (AUTH-01)
      const result = await this.authService.login(
        loginIdentifier,
        loginSecret,
        this.getClientIp(req),
        response,
      );
      return { success: true, data: result.user };
    }

    // Admin: validate credentials first, then proceed
    // validateAdminCredentials throws if invalid
    await this.authService.validateAdminCredentials(
      loginIdentifier,
      loginSecret,
      this.getClientIp(req),
      response,
    );

    // Skip OTP in development mode for easier testing
    if (process.env.NODE_ENV === 'development') {
      const result = await this.authService.login(
        loginIdentifier,
        loginSecret,
        this.getClientIp(req),
        response,
      );
      return { success: true, data: result.user };
    }

    // Generate and send OTP via email
    await this.authService.sendOtp(loginIdentifier);

    return {
      success: true,
      require_otp: true,
      message: 'Kode OTP telah dikirim ke email',
    };
  }

  @UseGuards(JwtAuthGuard)
  @Patch('change-pin')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change own PIN (kasir)' })
  @ApiResponse({ status: 200, description: 'PIN changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid PIN data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async changePin(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePinDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('User not authenticated');

    const result = await this.authService.changePin(
      userId,
      dto.current_pin,
      dto.new_pin,
      response,
    );

    return { success: true, data: result.user };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMe(@Req() req: AuthenticatedRequest) {
    const userId = req.user?.id;
    if (!userId) {
      return { success: false, message: 'User not authenticated' };
    }
    const user = await this.authService.getUserById(userId);
    if (!user) {
      return { success: false, message: 'User not found' };
    }
    return {
      success: true,
      data: user,
    };
  }

  @UseGuards(ThrottlerGuard)
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 600000 } })
  @ApiOperation({ summary: 'Resend OTP to email' })
  @ApiResponse({ status: 200, description: 'New OTP sent' })
  @ApiResponse({ status: 400, description: 'Invalid email' })
  @ApiResponse({ status: 429, description: 'Too many requests' })
  async resendOtp(@Body() dto: ResendOtpDto) {
    await this.authService.sendOtp(dto.email);
    return { success: true, message: 'Kode OTP baru telah dikirim ke email' };
  }

  @UseGuards(ThrottlerGuard)
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 600000 } })
  @ApiOperation({ summary: 'Verify OTP and issue JWT token (admin login)' })
  @ApiResponse({ status: 200, description: 'OTP verified, JWT issued' })
  @ApiResponse({ status: 401, description: 'Invalid or expired OTP' })
  @ApiResponse({ status: 429, description: 'Too many attempts' })
  async verifyOtp(
    @Req() req: Request,
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.verifyOtp(
      dto.email,
      dto.otp,
      this.getClientIp(req),
      response,
    );

    return { success: true, data: result.user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout and clear session cookies' })
  @ApiResponse({ status: 200, description: 'Logged out successfully' })
  async logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('access_token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });
    response.clearCookie('csrf_token', { path: '/' });
    return { success: true, message: 'Logged out' };
  }
}
