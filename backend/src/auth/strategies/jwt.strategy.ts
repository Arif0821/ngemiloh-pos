import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { Request } from 'express';

// Module-level logger with string literal to avoid class reference before declaration
const logger = new Logger('JwtStrategy');

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const secret = process.env.JWT_ACCESS_SECRET;
    // SECURITY FIX S-01: Throw error immediately if secret is missing
    // No fallback allowed - security depends on this being set
    if (!secret) {
      throw new Error(
        'FATAL: JWT_ACCESS_SECRET environment variable is required',
      );
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
      secretOrKey: secret,
    });
  }

  async validate(payload: { sub: string; role: string }) {
    if (!payload) {
      throw new UnauthorizedException();
    }
    return { id: payload.sub, role: payload.role };
  }
}
