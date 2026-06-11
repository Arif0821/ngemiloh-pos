import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EmailService } from '../../../email/email.service';
import { Role, User } from '@prisma/client';
import {
  AUTH_REPOSITORY,
  type AuthRepositoryInterface,
} from '../../domain/interfaces/auth.repository.interface';
import {
  LOCKOUT_DURATION_MS,
  LOCKOUT_THRESHOLD,
} from '../../../common/utils/constants';
import { escapeHtml } from '../../../common/utils/html';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly pepper: string;

  constructor(
    @Inject(AUTH_REPOSITORY) private authRepository: AuthRepositoryInterface,
    private jwtService: JwtService,
    private emailService: EmailService,
  ) {
    // SECURITY FIX S-01: Throw error immediately if pepper is missing
    // No fallback allowed - security depends on this being set
    const configuredPepper = process.env.PIN_PEPPER_SECRET;
    if (!configuredPepper) {
      throw new Error(
        'FATAL: PIN_PEPPER_SECRET environment variable is required',
      );
    }
    this.pepper = configuredPepper;
  }

  private async hashPin(pin: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(pin + this.pepper, saltRounds);
  }

  private async verifyPin(pin: string, hash: string): Promise<boolean> {
    return bcrypt.compare(pin + this.pepper, hash);
  }

  // PRD AUTH-02: Validate password format - should be called at SET/CHANGE time only
  // Not called during login to prevent brute force bypass
  validatePasswordRequirements(password: string): void {
    const minLength = 16;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    if (password.length < minLength) {
      // SECURITY: Don't leak password length in error message
      throw new BadRequestException('Password must be at least 16 characters');
    }
    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSymbol) {
      throw new BadRequestException(
        'Password must contain uppercase, lowercase, number, and symbol',
      );
    }
  }

  async login(
    usernameOrEmail: string,
    pinOrPassword: string,
    ipAddress: string = 'unknown',
  ) {
    // AUTH-04: Check IP Lockout first
    const ipLock = await this.authRepository.findIpLockout(ipAddress);

    if (ipLock && ipLock.locked_until && ipLock.locked_until > new Date()) {
      throw new HttpException(
        'Too Many Requests. IP is temporarily locked.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    // Check user by username (kasir) or email (superadmin)
    const user =
      await this.authRepository.findUserByUsernameOrEmail(usernameOrEmail);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Account is inactive');
    }

    // Account level lockout check
    if (user.locked_until && user.locked_until > new Date()) {
      throw new HttpException(
        'Account temporarily locked. Try again later.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    let isValid = false;

    if (user.role === Role.kasir) {
      if (!user.pin_hash)
        throw new UnauthorizedException('Invalid credentials');
      isValid = await this.verifyPin(pinOrPassword, user.pin_hash);
    } else if (user.role === Role.superadmin) {
      if (!user.password_hash)
        throw new UnauthorizedException('Invalid credentials');

      // Validate password format BEFORE bcrypt compare for clear error messages
      if (pinOrPassword.length < 16) {
        // Increment brute force counter for weak password attempts
        await this.authRepository.incrementUserFailedLogin(user.id);
        await this.authRepository.incrementIpLockout(ipAddress);
        throw new UnauthorizedException(
          'Password must be at least 16 characters',
        );
      }

      const hasUpperCase = /[A-Z]/.test(pinOrPassword);
      const hasLowerCase = /[a-z]/.test(pinOrPassword);
      const hasNumber = /[0-9]/.test(pinOrPassword);
      const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
        pinOrPassword,
      );
      if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSymbol) {
        // Increment brute force counter for invalid format
        await this.authRepository.incrementUserFailedLogin(user.id);
        await this.authRepository.incrementIpLockout(ipAddress);
        throw new UnauthorizedException(
          'Password must contain uppercase, lowercase, number, and symbol',
        );
      }

      isValid = await bcrypt.compare(pinOrPassword, user.password_hash);
    }

    if (!isValid) {
      // Increment Account Failures
      const updatedUser = await this.authRepository.incrementUserFailedLogin(
        user.id,
      );

      if (updatedUser.failed_login_count >= LOCKOUT_THRESHOLD) {
        await this.authRepository.lockUser(
          user.id,
          new Date(Date.now() + LOCKOUT_DURATION_MS),
        );

        // NOTIF-01: Send alert (non-critical, don't fail login on email error)
        // SECURITY: Escape username to prevent HTML injection in email
        const safeUsername = escapeHtml(user.username);
        this.emailService
          .sendAlert(
            'Akun Terkunci - Gagal Login',
            `Akun kasir dengan username <strong>${safeUsername}</strong> telah dikunci karena 5 kali percobaan login gagal berturut-turut. Akun akan terbuka kembali dalam 30 menit.`,
          )
          .catch((err) =>
            this.logger.error(
              'Failed to send lockout alert email',
              err.message,
            ),
          );
      }

      // Increment IP Failures
      const updatedIp = await this.authRepository.incrementIpLockout(ipAddress);

      if (updatedIp.failed_count >= LOCKOUT_THRESHOLD) {
        await this.authRepository.lockIpAddress(
          ipAddress,
          new Date(Date.now() + LOCKOUT_DURATION_MS),
        );
        throw new HttpException(
          'Too Many Requests. IP is temporarily locked.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed logins on success
    await this.authRepository.resetUserFailedLogin(user.id);
    await this.authRepository.resetIpLockout(ipAddress);

    // Generate tokens
    const payload = { sub: user.id, role: user.role };
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_EXPIRES as any,
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRES as any,
    });

    const csrfToken = crypto.randomBytes(32).toString('hex');

    return {
      accessToken,
      refreshToken,
      csrfToken,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        must_change_pin: user.must_change_pin,
      },
    };
  }

  async refreshToken(token: string) {
    let payload: any;
    try {
      payload = this.jwtService.verify(token, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
    } catch (e) {
      throw new UnauthorizedException('Invalid token');
    }

    // P0-SECURITY: Check if token is revoked
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const isRevoked = await this.authRepository.findRevokedToken(tokenHash);
    if (isRevoked) {
      throw new UnauthorizedException('Token revoked');
    }

    const user = await this.authRepository.findUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Invalid or inactive user');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Invalid or inactive user');
    }

    // P0-SECURITY: Revoke old refresh token (token rotation)
    const expiresAt = new Date(payload.exp * 1000);
    await this.authRepository.revokeToken(tokenHash, user.id, expiresAt);

    const newPayload = { sub: user.id, role: user.role };
    const newAccessToken = this.jwtService.sign(newPayload, {
      secret: process.env.JWT_ACCESS_SECRET,
      expiresIn: process.env.JWT_ACCESS_EXPIRES as any,
    });

    // P0-SECURITY: Issue new refresh token (rotation)
    const newRefreshToken = this.jwtService.sign(newPayload, {
      secret: process.env.JWT_REFRESH_SECRET,
      expiresIn: process.env.JWT_REFRESH_EXPIRES as any,
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(refreshToken: string) {
    if (!refreshToken) return;
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      const expiresAt = new Date(payload.exp * 1000);

      const tokenHash = crypto
        .createHash('sha256')
        .update(refreshToken)
        .digest('hex');
      await this.authRepository.revokeToken(tokenHash, payload.sub, expiresAt);
    } catch (e) {
      // Ignore invalid token during logout
    }
  }

  async getUserById(userId: string) {
    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      return null;
    }
    // Return safe user data (exclude sensitive fields)
    const { pin_hash, password_hash, ...safeUser } = user;
    return safeUser;
  }
}
