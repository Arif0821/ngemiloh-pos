import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EmailService } from '../../../email/email.service';
import { RedisService } from '../../../common/redis/redis.service';
import { Role } from '@prisma/client';
import {
  AUTH_REPOSITORY,
  type AuthRepositoryInterface,
} from '../../domain/interfaces/auth.repository.interface';
import {
  LOCKOUT_DURATION_MS,
  LOCKOUT_THRESHOLD,
} from '../../../common/utils/constants';
import { escapeHtml } from '../../../common/utils/html';
import { set_cookie } from '../../../common/utils/cookie';
import type { Response } from 'express';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly pepper: string;

  constructor(
    @Inject(AUTH_REPOSITORY) private authRepository: AuthRepositoryInterface,
    private jwtService: JwtService,
    private emailService: EmailService,
    private redisService: RedisService,
  ) {
    const configuredPepper = process.env.PIN_PEPPER_SECRET;
    if (!configuredPepper) {
      throw new Error(
        'FATAL: PIN_PEPPER_SECRET environment variable is required',
      );
    }
    this.pepper = configuredPepper;
  }

  /**
   * Generate a hash key from IP address and User-Agent for rate limiting.
   * This combines both to prevent bypass via IP switching while keeping
   * the storage key non-sensitive (hash instead of raw data).
   */
  private get_ip_lockout_key(ipAddress: string, userAgent?: string): string {
    const normalized_ip = ipAddress.trim().toLowerCase();
    const normalized_ua = (userAgent || 'unknown').trim().toLowerCase();
    return crypto
      .createHash('sha256')
      .update(`${normalized_ip}:${normalized_ua}`)
      .digest('hex');
  }

  private async hashPin(pin: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(pin + this.pepper, saltRounds);
  }

  private async verifyPin(pin: string, hash: string): Promise<boolean> {
    return bcrypt.compare(pin + this.pepper, hash);
  }

  private verifyOtpHash(otpCode: string, storedHash: string): boolean {
    const inputHash = crypto.createHash('sha256').update(otpCode).digest('hex');
    // Use timing-safe comparison to prevent timing attacks
    if (inputHash.length !== storedHash.length) {
      return false;
    }
    return crypto.timingSafeEqual(
      Buffer.from(inputHash),
      Buffer.from(storedHash),
    );
  }

  private getPasswordStrengthError(password: string): string | null {
    if (password.length < 16) return 'Password must be at least 16 characters';
    if (!/[A-Z]/.test(password))
      return 'Password must contain at least one uppercase letter';
    if (!/[a-z]/.test(password))
      return 'Password must contain at least one lowercase letter';
    if (!/[0-9]/.test(password))
      return 'Password must contain at least one number';
    if (!/[!@#$%^&*]/.test(password))
      return 'Password must contain at least one special character (!@#$%^&*)';
    return null;
  }

  async login(
    usernameOrEmail: string,
    pinOrPassword: string,
    ipAddress: string = 'unknown',
    userAgent?: string,
    res?: Response,
  ) {
    const ipLockHash = this.get_ip_lockout_key(ipAddress, userAgent);
    const ipLock = await this.authRepository.findIpLockout(ipLockHash);

    if (ipLock && ipLock.locked_until && ipLock.locked_until > new Date()) {
      throw new HttpException(
        'Too Many Requests. IP is temporarily locked.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    const user =
      await this.authRepository.findUserByUsernameOrEmail(usernameOrEmail);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Account is inactive');
    }

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

      const strengthError = this.getPasswordStrengthError(pinOrPassword);
      if (strengthError) {
        await this.authRepository.incrementUserFailedLogin(user.id);
        await this.authRepository.incrementIpLockout(ipLockHash);
        throw new UnauthorizedException(strengthError);
      }

      isValid = await bcrypt.compare(pinOrPassword, user.password_hash);
    }

    if (!isValid) {
      const updatedUser = await this.authRepository.incrementUserFailedLogin(
        user.id,
      );

      if (updatedUser.failed_login_count >= LOCKOUT_THRESHOLD) {
        await this.authRepository.lockUser(
          user.id,
          new Date(Date.now() + LOCKOUT_DURATION_MS),
        );

        const safeUsername = escapeHtml(user.username);
        this.emailService
          .sendAlert(
            'Akun Terkunci - Gagal Login',
            `Akun kasir dengan username <strong>${safeUsername}</strong> telah dikunci karena 5 kali percobaan login gagal berturut-turut. Akun akan terbuka kembali dalam 30 menit.`,
          )
          .catch((err: unknown) =>
            this.logger.error(
              'Failed to send lockout alert email',
              (err as Error).message,
            ),
          );
      }

      const updatedIp =
        await this.authRepository.incrementIpLockout(ipLockHash);

      if (updatedIp.failed_count >= LOCKOUT_THRESHOLD) {
        await this.authRepository.lockIpAddress(
          ipLockHash,
          new Date(Date.now() + LOCKOUT_DURATION_MS),
        );
        throw new HttpException(
          'Too Many Requests. IP is temporarily locked.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }

      throw new UnauthorizedException('Invalid credentials');
    }

    await this.authRepository.resetUserFailedLogin(user.id);
    await this.authRepository.resetIpLockout(ipLockHash);

    // JWT Token Reduction: Kasir 365d -> 8h (silent refresh handles long sessions)
    const payload = { sub: user.id, role: user.role as string };
    const jti = crypto.randomUUID();
    const expiresIn = '8h';
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET ?? '',
      expiresIn,
      jwtid: jti,
    });

    const csrfToken = crypto.randomBytes(32).toString('hex');

    if (res) {
      // 8 hours in milliseconds
      const eightHoursMs = 8 * 60 * 60 * 1000;
      set_cookie(res, 'access_token', accessToken, {
        maxAge: eightHoursMs,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });
      // CSRF token matches JWT expiry (8 hours)
      set_cookie(res, 'csrf_token', csrfToken, {
        maxAge: eightHoursMs,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });
    }

    return {
      csrfToken, // Kept for backward compatibility, but frontend should use cookie
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        must_change_pin: user.must_change_pin,
      },
    };
  }

  async validateAdminCredentials(
    email: string,
    password: string,
    ipAddress: string,
    userAgent?: string,
    res?: Response,
  ) {
    const ipLockHash = this.get_ip_lockout_key(ipAddress, userAgent);
    const ipLock = await this.authRepository.findIpLockout(ipLockHash);
    if (ipLock && ipLock.locked_until && ipLock.locked_until > new Date()) {
      throw new HttpException(
        'IP is temporarily locked.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const user = await this.authRepository.findUserByUsernameOrEmail(
      email.toLowerCase(),
    );
    if (!user || user.role !== 'superadmin') {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!user.is_active) throw new UnauthorizedException('Account is inactive');
    if (user.locked_until && user.locked_until > new Date()) {
      throw new HttpException(
        'Account temporarily locked.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const strengthError = this.getPasswordStrengthError(password);
    if (strengthError) {
      await this.authRepository.incrementUserFailedLogin(user.id);
      await this.authRepository.incrementIpLockout(ipLockHash);
      throw new UnauthorizedException(strengthError);
    }

    const isValid = await bcrypt.compare(password, user.password_hash || '');
    if (!isValid) {
      // FIX: Only increment once, not twice
      const updatedUser = await this.authRepository.incrementUserFailedLogin(
        user.id,
      );
      const updatedIp =
        await this.authRepository.incrementIpLockout(ipLockHash);
      if (updatedUser.failed_login_count >= LOCKOUT_THRESHOLD) {
        await this.authRepository.lockUser(
          user.id,
          new Date(Date.now() + LOCKOUT_DURATION_MS),
        );
      }
      if (updatedIp.failed_count >= LOCKOUT_THRESHOLD) {
        await this.authRepository.lockIpAddress(
          ipLockHash,
          new Date(Date.now() + LOCKOUT_DURATION_MS),
        );
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.authRepository.resetUserFailedLogin(user.id);
    await this.authRepository.resetIpLockout(ipLockHash);

    const payload = { sub: user.id, role: user.role as string };
    const jti = crypto.randomUUID();
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET ?? '',
      expiresIn: '12h',
      jwtid: jti,
    });

    const csrfToken = crypto.randomBytes(32).toString('hex');

    if (res) {
      set_cookie(res, 'admin_token', accessToken, {
        maxAge: 43200, // 12 hours
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });
      // SECURITY FIX F-01: Set CSRF token as httpOnly cookie (not accessible to JavaScript)
      set_cookie(res, 'csrf_token', csrfToken, {
        maxAge: 43200, // 12 hours
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });
    }

    return {
      csrfToken, // Kept for backward compatibility, but frontend should use cookie
      userId: user.id,
      email: user.email,
      name: user.name,
    };
  }

  // FIX H8/H9/H10: Add rate limiting, audit logging, and improved OTP security
  private readonly OTP_REQUEST_COOLDOWN_MS = 60000; // 1 minute between OTP requests
  private readonly OTP_MAX_ATTEMPTS = 3; // Max failed verifications before lockout
  private readonly OTP_LOCKOUT_MS = 300000; // 5 minute lockout after max attempts

  async sendOtp(email: string): Promise<void> {
    const user = await this.authRepository.findUserByUsernameOrEmail(
      email.toLowerCase(),
    );
    if (!user || user.role !== 'superadmin')
      throw new UnauthorizedException('Admin not found');

    // FIX H8: Check for rate limiting on OTP requests
    // SECURITY: Fail-secure - if Redis is unavailable, DENY the request (prevent brute force)
    const rateLimitKey = `otp:ratelimit:${email.toLowerCase()}`;
    const lastRequest = await this.redisService.get(rateLimitKey);
    if (lastRequest) {
      const elapsed = Date.now() - parseInt(lastRequest, 10);
      if (elapsed < this.OTP_REQUEST_COOLDOWN_MS) {
        const remaining = Math.ceil(
          (this.OTP_REQUEST_COOLDOWN_MS - elapsed) / 1000,
        );
        throw new BadRequestException(
          `Please wait ${remaining} seconds before requesting another OTP.`,
        );
      }
    } else if (!this.redisService.isAvailable()) {
      // Redis unavailable - fail-secure by denying the request
      this.logger.warn(
        `OTP request denied due to Redis unavailability: ${email}`,
      );
      throw new ServiceUnavailableException(
        'Authentication service temporarily unavailable. Please try again later.',
      );
    }

    // FIX H10: Audit log OTP request (use user ID, not email - PII protection)
    this.logger.log(`OTP requested for user: ${user.id}`);

    // FIX H9: Use 6-digit OTP instead of 8-digit (standard practice, reduces brute-force space)
    const otpCode = crypto.randomInt(100000, 999999).toString();
    // FIX H11: Use SHA256 for OTP hashing (OTP is rate-limited, no need for slow bcrypt)
    const otpHash = crypto.createHash('sha256').update(otpCode).digest('hex');

    await this.redisService.set(
      `otp:admin:${user.id}`,
      JSON.stringify({ code_hash: otpHash, attempts: 0 }),
      600,
    );
    await this.redisService.set(
      `otp:email:${email.toLowerCase()}`,
      user.id,
      600,
    );
    // Set rate limit for OTP requests
    await this.redisService.set(rateLimitKey, Date.now().toString(), 60);

    // Call EmailService.sendOtp (different method name to avoid confusion)
    await this.emailService.sendOtp(user.email || email, otpCode);
  }

  async verifyOtp(
    email: string,
    otpCode: string,
    ipAddress: string,
    userAgent?: string,
    res?: Response,
  ) {
    if (!email) throw new BadRequestException('Email is required');

    const ipLockHash = this.get_ip_lockout_key(ipAddress, userAgent);

    const userId = await this.redisService.get(
      `otp:email:${email.toLowerCase()}`,
    );
    if (!userId)
      throw new BadRequestException('No pending OTP. Please login again.');

    // FIX H9: Check for OTP lockout
    const lockoutKey = `otp:lockout:${email.toLowerCase()}`;
    const lockoutUntil = await this.redisService.get(lockoutKey);
    if (lockoutUntil) {
      const remaining = Math.ceil(
        (parseInt(lockoutUntil, 10) - Date.now()) / 1000,
      );
      if (remaining > 0) {
        throw new UnauthorizedException(
          `Too many failed attempts. Please try again in ${remaining} seconds.`,
        );
      }
    }

    const otpDataStr = await this.redisService.get(`otp:admin:${userId}`);
    if (!otpDataStr)
      throw new BadRequestException('OTP expired. Please request a new one.');

    let otpData: { code_hash: string; attempts: number };
    try {
      otpData = JSON.parse(otpDataStr);
    } catch {
      throw new BadRequestException('Invalid OTP session');
    }

    const isValid = this.verifyOtpHash(otpCode, otpData.code_hash);
    if (!isValid) {
      otpData.attempts += 1;

      // FIX H9: Lockout after max failed attempts
      if (otpData.attempts >= this.OTP_MAX_ATTEMPTS) {
        const lockoutExpiry = Date.now() + this.OTP_LOCKOUT_MS;
        await this.redisService.set(lockoutKey, lockoutExpiry.toString(), 300);
        await this.redisService.del(`otp:admin:${userId}`);
        await this.redisService.del(`otp:email:${email.toLowerCase()}`);
        this.logger.warn(`OTP lockout triggered for: ${email}`);
        throw new UnauthorizedException(
          'Too many failed attempts. Please request a new OTP.',
        );
      }

      await this.redisService.set(
        `otp:admin:${userId}`,
        JSON.stringify(otpData),
        600,
      );

      // FIX H10: Audit log failed OTP attempt
      this.logger.warn(
        `Failed OTP attempt ${otpData.attempts}/${this.OTP_MAX_ATTEMPTS} for: ${email}`,
      );

      throw new UnauthorizedException(
        `Invalid OTP code. ${this.OTP_MAX_ATTEMPTS - otpData.attempts} attempts remaining.`,
      );
    }

    await this.redisService.del(`otp:admin:${userId}`);
    await this.redisService.del(`otp:email:${email.toLowerCase()}`);
    await this.redisService.del(lockoutKey);

    // FIX H10: Audit log successful OTP verification
    this.logger.log(`OTP verified successfully for admin: ${email}`);

    const user = await this.authRepository.findUserById(userId);
    if (!user) throw new UnauthorizedException('User not found');

    await this.authRepository.resetUserFailedLogin(userId);
    await this.authRepository.resetIpLockout(ipLockHash);

    const payload = { sub: user.id, role: user.role as string };
    const jti = crypto.randomUUID();
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET ?? '',
      expiresIn: '12h',
      jwtid: jti,
    });
    const csrfToken = crypto.randomBytes(32).toString('hex');

    if (res) {
      set_cookie(res, 'admin_token', accessToken, {
        maxAge: 43200, // 12 hours
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });
      // SECURITY FIX F-01: Set CSRF token as httpOnly cookie (not accessible to JavaScript)
      set_cookie(res, 'csrf_token', csrfToken, {
        maxAge: 43200, // 12 hours
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });
    }

    return {
      csrfToken, // Kept for backward compatibility, but frontend should use cookie
      user: { id: user.id, name: user.name, role: user.role },
    };
  }

  async changePin(
    userId: string,
    currentPin: string,
    newPin: string,
    res?: Response,
  ) {
    const user = await this.authRepository.findUserById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== 'kasir')
      throw new BadRequestException('Only kasir can change PIN');

    if (!user.pin_hash) throw new BadRequestException('PIN not set');
    const isValid = await this.verifyPin(currentPin, user.pin_hash);
    if (!isValid) throw new UnauthorizedException('Current PIN incorrect');

    const newPinHash = await this.hashPin(newPin);

    await this.authRepository.updateUserPin(userId, newPinHash);

    // JWT Token Reduction: Kasir 365d -> 8h
    const payload = { sub: user.id, role: user.role as string };
    const jti = crypto.randomUUID();
    const expiresIn = '8h';
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET ?? '',
      expiresIn,
      jwtid: jti,
    });

    const csrfToken = crypto.randomBytes(32).toString('hex');

    if (res) {
      // 8 hours in milliseconds
      const eightHoursMs = 8 * 60 * 60 * 1000;
      set_cookie(res, 'access_token', accessToken, {
        maxAge: eightHoursMs,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });
      // CSRF token matches JWT expiry (8 hours)
      set_cookie(res, 'csrf_token', csrfToken, {
        maxAge: eightHoursMs,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
      });
    }

    return {
      csrfToken, // Kept for backward compatibility, but frontend should use cookie
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        must_change_pin: false,
      },
    };
  }

  async revokeToken(token: string): Promise<void> {
    // FIX #10: Implement JWT blocklist for token revocation
    try {
      // Decode the token to get jti and exp (without verifying signature for blocklist lookup)
      const decoded = this.jwtService.decode(token);

      if (!decoded || !decoded.jti || !decoded.exp) {
        this.logger.warn('Invalid token provided for revocation');
        return;
      }

      // Calculate TTL: remaining lifetime of the token
      const now = Math.floor(Date.now() / 1000);
      const ttl = decoded.exp - now;

      if (ttl <= 0) {
        // Token already expired, no need to blocklist
        this.logger.debug('Token already expired, skipping blocklist');
        return;
      }

      // Add JTI to Redis blocklist with TTL matching remaining token lifetime
      await this.redisService.blockJwt(String(decoded.jti), ttl);
      this.logger.log(`Token revoked: jti=${decoded.jti}`);
    } catch (error) {
      this.logger.error('Failed to revoke token', (error as Error).message);
      throw new UnauthorizedException('Failed to revoke token');
    }
  }

  async getUserById(userId: string) {
    const user = await this.authRepository.findUserById(userId);
    if (!user) {
      return null;
    }
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { pin_hash, password_hash, ...safeUser } = user;
    return safeUser;
  }
}
