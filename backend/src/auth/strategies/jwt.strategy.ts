import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor() {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: JWT_ACCESS_SECRET environment variable is required');
      }
      // SECURITY: Only allow fallback in development - but log warning
      this.logger.warn('JWT_ACCESS_SECRET not set - using insecure fallback (development only)');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          let token = null;
          if (request && request.cookies) {
            token = request.cookies['access_token'];
          }
          return token;
        },
      ]),
      ignoreExpiration: false,
      // CRITICAL: No fallback secret - let it fail if not configured
      // main.ts validates env vars at startup, so this should never be reached in production
      secretOrKey: secret || 'dev-only-insecure-fallback-do-not-use-in-production',
    });
  }

  async validate(payload: any) {
    if (!payload) {
      throw new UnauthorizedException();
    }
    return { id: payload.sub, role: payload.role };
  }
}
