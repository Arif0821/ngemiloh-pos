import { Injectable, UnauthorizedException, HttpException, HttpStatus, Logger, Inject, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { EmailService } from '../../../email/email.service';
import { Role, User } from '@prisma/client';
import { AUTH_REPOSITORY, type AuthRepositoryInterface } from '../../domain/interfaces/auth.repository.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(AUTH_REPOSITORY) private authRepository: AuthRepositoryInterface,
    private jwtService: JwtService,
    private emailService: EmailService
  ) {}

  private async hashPin(pin: string): Promise<string> {
    const saltRounds = 12;
    const pepper = process.env.PIN_PEPPER_SECRET || 'DEFAULT_PEPPER_SUPER_SECRET';
    return bcrypt.hash(pin + pepper, saltRounds);
  }

  private async verifyPin(pin: string, hash: string): Promise<boolean> {
    const pepper = process.env.PIN_PEPPER_SECRET || 'DEFAULT_PEPPER_SUPER_SECRET';
    return bcrypt.compare(pin + pepper, hash);
  }

  // PRD AUTH-02: Superadmin password requirements
  // Wajib: min 16 karakter (angka + huruf kapital + simbol)
  private validatePasswordRequirements(password: string): void {
    const minLength = 16;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSymbol = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

    if (password.length < minLength) {
      throw new BadRequestException(
        `Password must be at least ${minLength} characters. Current: ${password.length} characters.`
      );
    }
    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSymbol) {
      throw new BadRequestException(
        'Password must contain uppercase, lowercase, number, and symbol'
      );
    }
  }

  async login(usernameOrEmail: string, pinOrPassword: string, ipAddress: string = 'unknown') {
    // AUTH-04: Check IP Lockout first
    const ipLock = await this.authRepository.findIpLockout(ipAddress);

    if (ipLock && ipLock.locked_until && ipLock.locked_until > new Date()) {
      throw new HttpException('Too Many Requests. IP is temporarily locked.', HttpStatus.TOO_MANY_REQUESTS);
    }
    // Check user by username (kasir) or email (superadmin)
    const user = await this.authRepository.findUserByUsernameOrEmail(usernameOrEmail);

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.is_active) {
      throw new UnauthorizedException('Account is inactive');
    }

    // Account level lockout check
    if (user.locked_until && user.locked_until > new Date()) {
      throw new HttpException('Account temporarily locked. Try again later.', HttpStatus.TOO_MANY_REQUESTS);
    }

    let isValid = false;
    if (user.role === Role.kasir) {
      if (!user.pin_hash) throw new UnauthorizedException('Invalid credentials');
      isValid = await this.verifyPin(pinOrPassword, user.pin_hash);
    } else if (user.role === Role.superadmin) {
      if (!user.password_hash) throw new UnauthorizedException('Invalid credentials');
      // PRD AUTH-02: Validasi password requirements sebelum verify
      this.validatePasswordRequirements(pinOrPassword);
      isValid = await bcrypt.compare(pinOrPassword, user.password_hash);
    }

    if (!isValid) {
      // Increment Account Failures
      const updatedUser = await this.authRepository.incrementUserFailedLogin(user.id);

      if (updatedUser.failed_login_count >= 5) {
        await this.authRepository.lockUser(user.id, new Date(Date.now() + 30 * 60 * 1000));

        // NOTIF-01: Send alert
        await this.emailService.sendAlert(
          'Akun Terkunci - Gagal Login',
          `Akun kasir dengan username <strong>${user.username}</strong> telah dikunci karena 5 kali percobaan login gagal berturut-turut. Akun akan terbuka kembali dalam 30 menit.`
        );
      }

      // Increment IP Failures
      const updatedIp = await this.authRepository.incrementIpLockout(ipAddress);

      if (updatedIp.failed_count >= 5) {
        await this.authRepository.lockIpAddress(ipAddress, new Date(Date.now() + 30 * 60 * 1000));
        throw new HttpException('Too Many Requests. IP is temporarily locked.', HttpStatus.TOO_MANY_REQUESTS);
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
    try {
      const payload = this.jwtService.verify(token, {
        secret: process.env.JWT_REFRESH_SECRET,
      });

      // AUTH-07: Check if token is revoked
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      const isRevoked = await this.authRepository.findRevokedToken(tokenHash);
      if (isRevoked) {
        throw new UnauthorizedException('Token revoked');
      }

      const user = await this.authRepository.findUserById(payload.sub);
      if (!user || !user.is_active) {
        throw new UnauthorizedException('Invalid or inactive user');
      }

      const newPayload = { sub: user.id, role: user.role };
      const newAccessToken = this.jwtService.sign(newPayload, {
        secret: process.env.JWT_ACCESS_SECRET,
        expiresIn: process.env.JWT_ACCESS_EXPIRES as any,
      });

      return {
        accessToken: newAccessToken
      };
    } catch (e) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async logout(refreshToken: string) {
    if (!refreshToken) return;
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: process.env.JWT_REFRESH_SECRET,
      });
      
      const expiresAt = new Date(payload.exp * 1000);
      
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await this.authRepository.revokeToken(tokenHash, payload.sub, expiresAt);
    } catch (e) {
      // Ignore invalid token during logout
    }
  }
}
