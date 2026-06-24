import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { RedisService } from '../../common/redis/redis.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly redisService: RedisService) {
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

  async validate(payload: { sub: string; role: string; jti?: string }) {
    if (!payload) {
      throw new UnauthorizedException();
    }

    // FIX #10: Check if token is in blocklist (logged out/revoked)
    if (payload.jti) {
      const isBlocked = await this.redisService.isJwtBlocked(payload.jti);
      if (isBlocked) {
        throw new UnauthorizedException('Token has been revoked');
      }
    }

    return { id: payload.sub, role: payload.role };
  }
}
