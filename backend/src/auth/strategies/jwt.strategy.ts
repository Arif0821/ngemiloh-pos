import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret = process.env.JWT_ACCESS_SECRET;
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('FATAL: JWT_ACCESS_SECRET environment variable is required');
      }
      // SECURITY: Only allow fallback in development
      console.warn('WARNING: JWT_ACCESS_SECRET not set - using insecure fallback (development only)');
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
      secretOrKey: secret || 'dev-secret-insecure-fallback',
    });
  }

  async validate(payload: any) {
    if (!payload) {
      throw new UnauthorizedException();
    }
    return { id: payload.sub, role: payload.role };
  }
}
