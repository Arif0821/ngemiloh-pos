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
import { AuthService } from '../application/services/auth.service';
import type { Response, Request } from 'express';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { LoginDto } from '../dto/login.dto';
import { VerifyOtpDto } from '../dto/verify-otp.dto';
import { ResendOtpDto } from '../dto/resend-otp.dto';
import { ChangePinDto } from '../dto/change-pin.dto';
import type { AuthenticatedRequest } from '../../types/express';

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
  ) {}

  private getClientIp(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (Array.isArray(forwardedFor)) return forwardedFor[0];
    if (typeof forwardedFor === 'string')
      return forwardedFor.split(',')[0].trim();
    return req.socket.remoteAddress || 'unknown';
  }

  private setAuthCookies(
    response: Response,
    accessToken: string,
    csrfToken?: string,
    maxAgeMs: number = 12 * 60 * 60 * 1000, // default 12h for admin
  ) {
    const secure = process.env.NODE_ENV === 'production';
    response.cookie('access_token', accessToken, {
      httpOnly: true,
      secure,
      sameSite: 'strict',
      maxAge: maxAgeMs,
    });
    if (csrfToken) {
      response.cookie('csrf_token', csrfToken, {
        httpOnly: false,
        secure,
        sameSite: 'strict',
        maxAge: maxAgeMs,
      });
    }
  }

  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ login: { limit: 5, ttl: 600000 } })
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
      );
      this.setAuthCookies(
        response,
        result.accessToken,
        result.csrfToken,
        20 * 60 * 60 * 1000, // 20 hours for kasir
      );
      return { success: true, data: result.user };
    }

    // Admin: validate credentials first, then send OTP (AUTH-02/03)
    const result = await this.authService.validateAdminCredentials(
      loginIdentifier,
      loginSecret,
      this.getClientIp(req),
    );

    // Generate and send OTP via email — sendOtp handles hashing, Redis storage, and email delivery
    await this.authService.sendOtp(loginIdentifier);

    return {
      success: true,
      require_otp: true,
      message: 'Kode OTP telah dikirim ke email',
    };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const accessToken = req.cookies['access_token'];
    if (accessToken) {
      await this.authService.logout(accessToken);
    }

    response.clearCookie('access_token');
    response.clearCookie('csrf_token');
    return { success: true, message: 'Logged out successfully' };
  }

  // PATCH /api/v1/auth/change-pin — Kasir ganti PIN sendiri (AUTH-13)
  @UseGuards(JwtAuthGuard)
  @Patch('change-pin')
  @HttpCode(HttpStatus.OK)
  async changePin(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePinDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const userId = req.user?.id;
    if (!userId) throw new BadRequestException('User not authenticated');

    const result = await this.authService.changePin(userId, dto.current_pin, dto.new_pin);

    // Re-issue tokens with updated must_change_pin flag
    response.cookie('access_token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 20 * 60 * 60 * 1000, // 20 hours
    });

    return { success: true, data: result.user };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
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

  // POST /api/v1/auth/resend-otp — Kirim ulang OTP (AUTH-04)
  @UseGuards(ThrottlerGuard)
  @Post('resend-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 600000 } }) // 3 req / 10 menit per IP
  async resendOtp(@Body() dto: ResendOtpDto) {
    await this.authService.sendOtp(dto.email);
    return { success: true, message: 'Kode OTP baru telah dikirim ke email' };
  }

  // POST /api/v1/auth/verify-otp — Verifikasi OTP dan issue token (AUTH-03)
  @UseGuards(ThrottlerGuard)
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 600000 } }) // 5 req / 10 menit per IP
  async verifyOtp(
    @Req() req: Request,
    @Body() dto: VerifyOtpDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.verifyOtp(dto.email, dto.otp, this.getClientIp(req));

    this.setAuthCookies(response, result.accessToken, result.csrfToken);
    return { success: true, data: result.user };
  }
}
