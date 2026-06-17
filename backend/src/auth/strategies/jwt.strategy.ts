import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Inject } from '@nestjs/common';
import { Request } from 'express';
import {
  AUTH_REPOSITORY,
  type AuthRepositoryInterface,
} from '../domain/interfaces/auth.repository.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(AUTH_REPOSITORY)
    private authRepository: AuthRepositoryInterface,
  ) {
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

    // SECURITY: Check if token has been revoked (logout / security revoke)
    // Tokens include a jti claim added at issuance; if it appears in the
    // revoked_tokens table the token is considered invalid.
    if (payload.jti) {
      const revoked = await this.authRepository.findRevokedToken(payload.jti);
      if (revoked) {
        throw new UnauthorizedException('Token has been revoked');
      }
    }

    return { id: payload.sub, role: payload.role };
  }
}
