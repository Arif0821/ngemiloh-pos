import { Controller, Post, Body, Res, HttpCode, HttpStatus, Get, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { AuthService } from '../application/services/auth.service';
import type { Response, Request } from 'express';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { LoginDto } from '../dto/login.dto';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  private getClientIp(req: Request): string {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (Array.isArray(forwardedFor)) return forwardedFor[0];
    if (typeof forwardedFor === 'string') return forwardedFor.split(',')[0].trim();
    return req.socket.remoteAddress || 'unknown';
  }

  private setAuthCookies(response: Response, accessToken: string, refreshToken: string, csrfToken?: string) {
    const secure = process.env.NODE_ENV === 'production';
    response.cookie('access_token', accessToken, { httpOnly: true, secure, sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000 });
    response.cookie('refresh_token', refreshToken, { httpOnly: true, secure, sameSite: 'strict', maxAge: 7 * 24 * 60 * 60 * 1000 });
    if (csrfToken) {
      response.cookie('csrf_token', csrfToken, { httpOnly: false, secure, sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000 });
    }
  }

  @UseGuards(ThrottlerGuard)
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ login: { limit: 5, ttl: 600000 } })
  async login(@Req() req: Request, @Body() body: LoginDto, @Res({ passthrough: true }) response: Response) {
    const { username, email, pin, password } = body;
    const loginIdentifier = username || email;
    const loginSecret = pin || password;
    if (!loginIdentifier || !loginSecret) throw new BadRequestException('Credentials missing');

    const result = await this.authService.login(loginIdentifier, loginSecret, this.getClientIp(req));
    this.setAuthCookies(response, result.accessToken, result.refreshToken, result.csrfToken);
    return { success: true, data: result.user };
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = req.cookies['refresh_token'];
    if (!refreshToken) throw new BadRequestException('Refresh token missing');

    const result = await this.authService.refreshToken(refreshToken);
    response.cookie('access_token', result.accessToken, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000 });
    return { success: true, message: 'Token refreshed' };
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = req.cookies['refresh_token'];
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    
    response.clearCookie('access_token');
    response.clearCookie('refresh_token');
    response.clearCookie('csrf_token');
    return { success: true, message: 'Logged out successfully' };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: Request) {
    const userId = (req as any).user?.id;
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
}
