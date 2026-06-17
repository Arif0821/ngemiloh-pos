import {
  Injectable,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
  BadRequestException,
  NotFoundException,
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

  private async hashPin(pin: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(pin + this.pepper, saltRounds);
  }

  private async verifyPin(pin: string, hash: string): Promise<boolean> {
    return bcrypt.compare(pin + this.pepper, hash);
  }

  validatePasswordRequirements(password: string): void {
    const minLength = 16;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[!@#$%^&*()_+\-={}:;"'<>,.?\\|/-]/.test(password);

    if (password.length < minLength) {
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
    const ipLock = await this.authRepository.findIpLockout(ipAddress);

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

      if (pinOrPassword.length < 16) {
        await this.authRepository.incrementUserFailedLogin(user.id);
        await this.authRepository.incrementIpLockout(ipAddress);
        throw new UnauthorizedException(
          'Password must be at least 16 characters',
        );
      }

      const hasUpperCase = /[A-Z]/.test(pinOrPassword);
      const hasLowerCase = /[a-z]/.test(pinOrPassword);
      const hasNumber = /[0-9]/.test(pinOrPassword);
      const hasSymbol = /[!@#$%^&*()_+\-={}:;"'<>,.?\\|/-]/.test(pinOrPassword);
      if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSymbol) {
        await this.authRepository.incrementUserFailedLogin(user.id);
        await this.authRepository.incrementIpLockout(ipAddress);
        throw new UnauthorizedException(
          'Password must contain uppercase, lowercase, number, and symbol',
        );
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

    await this.authRepository.resetUserFailedLogin(user.id);
    await this.authRepository.resetIpLockout(ipAddress);

    const payload = { sub: user.id, role: user.role as string };
    const jti = crypto.randomUUID();
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET ?? '',
      expiresIn: '20h',
      jwtid: jti,
    });

    const csrfToken = crypto.randomBytes(32).toString('hex');

    return {
      accessToken,
      csrfToken,
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
  ) {
    const ipLock = await this.authRepository.findIpLockout(ipAddress);
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

    if (password.length < 16) {
      await this.authRepository.incrementUserFailedLogin(user.id);
      await this.authRepository.incrementIpLockout(ipAddress);
      throw new UnauthorizedException(
        'Password must be at least 16 characters',
      );
    }
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[!@#$%^&*()_+\-={}:;"'<>,.?\\|/-]/.test(password);
    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSymbol) {
      await this.authRepository.incrementUserFailedLogin(user.id);
      await this.authRepository.incrementIpLockout(ipAddress);
      throw new UnauthorizedException(
        'Password must contain uppercase, lowercase, number, and symbol',
      );
    }

    const isValid = await bcrypt.compare(password, user.password_hash || '');
    if (!isValid) {
      // FIX: Only increment once, not twice
      const updatedUser = await this.authRepository.incrementUserFailedLogin(
        user.id,
      );
      const updatedIp = await this.authRepository.incrementIpLockout(ipAddress);
      if (updatedUser.failed_login_count >= LOCKOUT_THRESHOLD) {
        await this.authRepository.lockUser(
          user.id,
          new Date(Date.now() + LOCKOUT_DURATION_MS),
        );
      }
      if (updatedIp.failed_count >= LOCKOUT_THRESHOLD) {
        await this.authRepository.lockIpAddress(
          ipAddress,
          new Date(Date.now() + LOCKOUT_DURATION_MS),
        );
      }
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.authRepository.resetUserFailedLogin(user.id);
    await this.authRepository.resetIpLockout(ipAddress);
    return { userId: user.id, email: user.email, name: user.name };
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
    }

    // FIX H10: Audit log OTP request
    this.logger.log(`OTP requested for admin: ${user.email}`);

    // FIX H9: Use 6-digit OTP instead of 8-digit (standard practice, reduces brute-force space)
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const otpHash = await bcrypt.hash(otpCode, 10);

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

  async verifyOtp(email: string, otpCode: string, ipAddress: string) {
    if (!email) throw new BadRequestException('Email is required');

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

    const isValid = await bcrypt.compare(otpCode, otpData.code_hash);
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
    await this.authRepository.resetIpLockout(ipAddress);

    const payload = { sub: user.id, role: user.role as string };
    const jti = crypto.randomUUID();
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET ?? '',
      expiresIn: '12h',
      jwtid: jti,
    });
    const csrfToken = crypto.randomBytes(32).toString('hex');

    return {
      accessToken,
      csrfToken,
      user: { id: user.id, name: user.name, role: user.role },
    };
  }

  async logout(token: string) {
    if (!token) return;
    try {
      const payload = this.jwtService.verify<{
        sub: string;
        jti?: string;
        exp?: number;
      }>(token, {
        secret: process.env.JWT_ACCESS_SECRET ?? '',
      });

      const expiresAt = new Date((payload.exp ?? 0) * 1000);

      // Store the JWT's jti claim as the revocation key so validate()
      // can efficiently look it up by jti instead of re-hashing the token.
      const jti =
        payload.jti ?? crypto.createHash('sha256').update(token).digest('hex');
      await this.authRepository.revokeToken(jti, payload.sub, expiresAt);
    } catch {
      // Ignore invalid token during logout
    }
  }

  async changePin(userId: string, currentPin: string, newPin: string) {
    const user = await this.authRepository.findUserById(userId);
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== 'kasir')
      throw new BadRequestException('Only kasir can change PIN');

    if (!user.pin_hash) throw new BadRequestException('PIN not set');
    const isValid = await this.verifyPin(currentPin, user.pin_hash);
    if (!isValid) throw new UnauthorizedException('Current PIN incorrect');

    const newPinHash = await this.hashPin(newPin);

    await this.authRepository.updateUserPin(userId, newPinHash);

    const payload = { sub: user.id, role: user.role as string };
    const jti = crypto.randomUUID();
    const accessToken = this.jwtService.sign(payload, {
      secret: process.env.JWT_ACCESS_SECRET ?? '',
      expiresIn: '20h',
      jwtid: jti,
    });

    return {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        must_change_pin: false,
      },
    };
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
