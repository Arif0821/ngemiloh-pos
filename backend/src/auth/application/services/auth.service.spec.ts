import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import {
  UnauthorizedException,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { AUTH_REPOSITORY } from '../../domain/interfaces/auth.repository.interface';
import { EmailService } from '../../../email/email.service';
import { RedisService } from '../../../common/redis/redis.service';
import { createMockUser, createMockIpLockout } from '../../../test/mocks';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Store reference to the real crypto module
const realCrypto = jest.requireActual('crypto');

// Mock bcrypt globally
jest.mock('bcrypt', () => ({
  compare: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockResolvedValue('$2b$12$mocked-hash'),
}));

// Crypto mock state - use object reference so closures capture the reference
const cryptoState = {
  shouldTimingSafeEqualFail: false,
};

// Helper to compute SHA-256 hash using real crypto
const sha256 = (data: string): string => {
  return realCrypto.createHash('sha256').update(data).digest('hex');
};

// Mock crypto - default behavior with proper hash computation
jest.mock('crypto', () => ({
  createHash: jest.fn((_algorithm: string) => ({
    update: jest.fn(function (this: { _data: string }, data: string) {
      this._data = data;
      return this;
    }),
    digest: jest.fn(function (this: { _data: string }, _encoding: string) {
      const data = this._data || '';
      return sha256(data);
    }),
  })),
  randomBytes: jest.fn(() => Buffer.from('mocked-random-bytes')),
  randomUUID: jest.fn(() => 'mock-uuid'),
  randomInt: jest.fn(() => 123456),
  timingSafeEqual: jest.fn((a: Buffer, b: Buffer) => {
    if (a.length !== b.length) return false;
    if (cryptoState.shouldTimingSafeEqualFail) return false;
    return a.equals(b);
  }),
}));

// Helper functions to control crypto mock behavior
const setTimingSafeEqualToFail = () => {
  cryptoState.shouldTimingSafeEqualFail = true;
};

const setTimingSafeEqualToDefault = () => {
  cryptoState.shouldTimingSafeEqualFail = false;
};

describe('AuthService', () => {
  let service: AuthService;
  let mockAuthRepository: any;
  let mockJwtService: any;
  let mockEmailService: any;
  let mockRedisService: any;

  beforeEach(async () => {
    // Set required environment variable for AuthService
    process.env.PIN_PEPPER_SECRET = 'test-pepper-secret-for-testing';

    // Create mock implementations for all repository methods
    mockAuthRepository = {
      findIpLockout: jest.fn(),
      findUserByUsernameOrEmail: jest.fn(),
      findUserById: jest.fn(),
      incrementUserFailedLogin: jest.fn(),
      lockUser: jest.fn(),
      incrementIpLockout: jest.fn(),
      lockIpAddress: jest.fn(),
      resetUserFailedLogin: jest.fn(),
      resetIpLockout: jest.fn(),
      findUserByUsername: jest.fn(),
      createAuditLog: jest.fn(),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn(),
    };

    mockEmailService = {
      sendAlert: jest.fn().mockResolvedValue(undefined),
      sendOtp: jest.fn().mockResolvedValue(undefined),
    };

    mockRedisService = {
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AUTH_REPOSITORY, useValue: mockAuthRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    delete process.env.PIN_PEPPER_SECRET;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    const mockIpAddress = '127.0.0.1';
    const mockUserAgent = 'Mozilla/5.0 Test Browser';

    it('should successfully login with valid kasir credentials (PIN)', async () => {
      // Arrange: Setup mock user with valid PIN hash
      const mockUser = createMockUser({
        id: 'user-123',
        username: 'testuser',
        role: Role.kasir,
        pin_hash: '$2b$12$LQv3c3c3c3c3c3c3c3c3c3',
      });

      // Mock no IP lockout exists
      mockAuthRepository.findIpLockout.mockResolvedValue(null);
      // Mock user found
      mockAuthRepository.findUserByUsernameOrEmail.mockResolvedValue(mockUser);
      // Mock reset methods return successfully
      mockAuthRepository.resetUserFailedLogin.mockResolvedValue(mockUser);
      mockAuthRepository.resetIpLockout.mockResolvedValue(
        createMockIpLockout(),
      );

      // Act: Perform login
      const result = await service.login(
        'testuser',
        '12345678',
        mockIpAddress,
        mockUserAgent,
      );

      // Assert: Verify successful login response
      expect(result).toHaveProperty('csrfToken');
      expect(result.user).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        role: mockUser.role,
        must_change_pin: mockUser.must_change_pin,
      });

      // Verify repository calls - expect hashed IP+UA key, not raw IP
      expect(mockAuthRepository.findIpLockout).toHaveBeenCalled();
      expect(mockAuthRepository.findUserByUsernameOrEmail).toHaveBeenCalledWith(
        'testuser',
      );
      expect(mockAuthRepository.resetUserFailedLogin).toHaveBeenCalledWith(
        mockUser.id,
      );
      expect(mockAuthRepository.resetIpLockout).toHaveBeenCalled();
    });

    it('should successfully login with valid superadmin credentials (password ≥16 chars)', async () => {
      // Arrange: Setup mock superadmin user with valid password
      // PRD AUTH-02: password ≥16 chars with uppercase, lowercase, number, symbol
      const validSuperadminPassword = 'ValidP@ssw0rd123!';
      const mockUser = createMockUser({
        id: 'admin-123',
        username: 'admin',
        email: 'admin@example.com',
        role: Role.superadmin,
        password_hash: '$2b$12$LQv3c3c3c3c3c3c3c3c3c3',
      });

      mockAuthRepository.findIpLockout.mockResolvedValue(null);
      mockAuthRepository.findUserByUsernameOrEmail.mockResolvedValue(mockUser);
      mockAuthRepository.resetUserFailedLogin.mockResolvedValue(mockUser);
      mockAuthRepository.resetIpLockout.mockResolvedValue(
        createMockIpLockout(),
      );

      // Act: Perform login with VALID password (≥16 chars)
      const result = await service.login(
        'admin@example.com',
        validSuperadminPassword,
        mockIpAddress,
        mockUserAgent,
      );

      // Assert: Verify successful login
      expect(result).toHaveProperty('csrfToken');
      expect(result.user.role).toBe(Role.superadmin);
    });

    it('should fail login with weak superadmin password (<16 chars)', async () => {
      const mockUser = createMockUser({
        id: 'admin-123',
        role: Role.superadmin,
        password_hash: '$2b$12$LQv3c3c3c3c3c3c3c3c3c3',
      });

      mockAuthRepository.findIpLockout.mockResolvedValue(null);
      mockAuthRepository.findUserByUsernameOrEmail.mockResolvedValue(mockUser);

      // Act & Assert: Password < 16 chars should fail
      await expect(
        service.login(
          'admin@example.com',
          'weak',
          mockIpAddress,
          mockUserAgent,
        ),
      ).rejects.toThrow('Password must be at least 16 characters');
    });

    it('should fail login with superadmin password missing requirements', async () => {
      const mockUser = createMockUser({
        id: 'admin-123',
        role: Role.superadmin,
        password_hash: '$2b$12$LQv3c3c3c3c3c3c3c3c3c3',
      });

      mockAuthRepository.findIpLockout.mockResolvedValue(null);
      mockAuthRepository.findUserByUsernameOrEmail.mockResolvedValue(mockUser);

      // Act & Assert: Password without symbol should fail
      await expect(
        service.login(
          'admin@example.com',
          'Password1234567890',
          mockIpAddress,
          mockUserAgent,
        ),
      ).rejects.toThrow(
        'Password must contain at least one special character (!@#$%^&*)',
      );
    });

    it('should fail login with invalid credentials', async () => {
      // Arrange: Mock user exists but with invalid PIN
      const mockUser = createMockUser({
        role: Role.kasir,
        pin_hash: '$2b$12$LQv3c3c3c3c3c3c3c3c3c3',
      });

      mockAuthRepository.findIpLockout.mockResolvedValue(null);
      mockAuthRepository.findUserByUsernameOrEmail.mockResolvedValue(mockUser);
      // Mock bcrypt to return false for invalid PIN
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      // Mock failed login increment
      mockAuthRepository.incrementUserFailedLogin.mockResolvedValue({
        ...mockUser,
        failed_login_count: 1,
      });
      mockAuthRepository.incrementIpLockout.mockResolvedValue(
        createMockIpLockout({ failed_count: 1 }),
      );

      // Act& Assert: Login should fail with UnauthorizedException
      await expect(
        service.login('testuser', 'wrong-pin', mockIpAddress, mockUserAgent),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should fail login when user does not exist', async () => {
      // Arrange: No user found
      mockAuthRepository.findIpLockout.mockResolvedValue(null);
      mockAuthRepository.findUserByUsernameOrEmail.mockResolvedValue(null);

      // Act& Assert: Should throw UnauthorizedException
      await expect(
        service.login('nonexistent', '12345678', mockIpAddress, mockUserAgent),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should fail login with inactive user', async () => {
      // Arrange: User exists but is inactive
      const mockUser = createMockUser({
        is_active: false,
      });

      mockAuthRepository.findIpLockout.mockResolvedValue(null);
      mockAuthRepository.findUserByUsernameOrEmail.mockResolvedValue(mockUser);

      // Act & Assert: Should throw UnauthorizedException with account inactive message
      await expect(
        service.login('testuser', '12345678', mockIpAddress, mockUserAgent),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should fail login with locked account (user.locked_until in future)', async () => {
      // Arrange: User exists but is locked
      const lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
      const mockUser = createMockUser({
        locked_until: lockedUntil,
      });

      mockAuthRepository.findIpLockout.mockResolvedValue(null);
      mockAuthRepository.findUserByUsernameOrEmail.mockResolvedValue(mockUser);

      // Act & Assert: Should throw HttpException with TOO_MANY_REQUESTS
      await expect(
        service.login('testuser', '12345678', mockIpAddress, mockUserAgent),
      ).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });
    });

    it('should trigger IP lockout after 5 failed attempts', async () => {
      // Arrange:4 previous failed attempts, this will be the 5th
      const mockUser = createMockUser({
        role: Role.kasir,
        pin_hash: '$2b$12$LQv3c3c3c3c3c3c3c3c3c3',
      });

      mockAuthRepository.findIpLockout.mockResolvedValue(null);
      mockAuthRepository.findUserByUsernameOrEmail.mockResolvedValue(mockUser);
      // Mock bcrypt to return false for invalid PIN
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      // After5th failed attempt, return failed_count >= 5
      mockAuthRepository.incrementUserFailedLogin.mockResolvedValue({
        ...mockUser,
        failed_login_count: 5,
      });
      mockAuthRepository.incrementIpLockout.mockResolvedValue(
        createMockIpLockout({ failed_count: 5 }),
      );
      mockAuthRepository.lockIpAddress.mockResolvedValue(
        createMockIpLockout({
          locked_until: new Date(Date.now() + 30 * 60 * 1000),
        }),
      );

      // Act& Assert: Should throw HttpException indicating IP is locked
      await expect(
        service.login('testuser', 'wrong-pin', mockIpAddress, mockUserAgent),
      ).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });

      // Verify lockIpAddress was called
      expect(mockAuthRepository.lockIpAddress).toHaveBeenCalled();
      expect(mockAuthRepository.incrementIpLockout).toHaveBeenCalled();
    });

    it('should trigger account lockout after 5 failed attempts and send alert email', async () => {
      // Arrange: 4 previous failed attempts, this will be the 5th
      const mockUser = createMockUser({
        role: Role.kasir,
        pin_hash: '$2b$12$LQv3c3c3c3c3c3c3c3c3c3',
      });

      mockAuthRepository.findIpLockout.mockResolvedValue(null);
      mockAuthRepository.findUserByUsernameOrEmail.mockResolvedValue(mockUser);
      // Mock bcrypt to return false for invalid PIN
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      // After 5th failed attempt
      mockAuthRepository.incrementUserFailedLogin.mockResolvedValue({
        ...mockUser,
        failed_login_count: 5,
      });
      mockAuthRepository.lockUser.mockResolvedValue({
        ...mockUser,
        locked_until: new Date(Date.now() + 30 * 60 * 1000),
      });
      mockAuthRepository.incrementIpLockout.mockResolvedValue(
        createMockIpLockout({ failed_count: 1 }),
      );

      // Act: Perform5th failed login attempt
      await expect(
        service.login('testuser', 'wrong-pin', mockIpAddress, mockUserAgent),
      ).rejects.toThrow(UnauthorizedException);

      // Assert: lockUser should have been called
      expect(mockAuthRepository.lockUser).toHaveBeenCalled();
      // Assert: Email alert should have been sent
      expect(mockEmailService.sendAlert).toHaveBeenCalledWith(
        'Akun Terkunci - Gagal Login',
        expect.stringContaining(mockUser.username),
      );
    });

    it('should block login when IP is already locked', async () => {
      // Arrange: IP is already locked
      const lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      const mockIpLockout = createMockIpLockout({ locked_until: lockedUntil });

      mockAuthRepository.findIpLockout.mockResolvedValue(mockIpLockout);

      // Act & Assert: Should throw HttpException immediately without checking user
      await expect(
        service.login('testuser', '12345678', mockIpAddress, mockUserAgent),
      ).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });

      // Verify findUserByUsernameOrEmail was NOT called
      expect(
        mockAuthRepository.findUserByUsernameOrEmail,
      ).not.toHaveBeenCalled();
    });
  });

  describe('validateAdminCredentials', () => {
    const mockIpAddress = '192.168.1.1';
    const mockUserAgent = 'Mozilla/5.0 Test Browser';

    it('should successfully validate admin with valid credentials', async () => {
      // Reset and configure bcrypt mock for this test
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      const mockUser = createMockUser({
        id: 'admin-456',
        username: 'admin',
        email: 'admin@ngemiloh.com',
        role: Role.superadmin,
        password_hash: '$2b$12$valid-hash',
        is_active: true,
      });

      mockAuthRepository.findIpLockout.mockResolvedValue(null);
      mockAuthRepository.findUserByUsernameOrEmail.mockResolvedValue(mockUser);
      mockAuthRepository.resetUserFailedLogin.mockResolvedValue(mockUser);
      mockAuthRepository.resetIpLockout.mockResolvedValue(
        createMockIpLockout(),
      );
      mockAuthRepository.incrementUserFailedLogin.mockResolvedValue({
        ...mockUser,
        failed_login_count: 0,
      });
      mockAuthRepository.incrementIpLockout.mockResolvedValue({
        ...createMockIpLockout(),
        failed_count: 0,
      });

      const validPassword = 'ValidP@ssw0rd123!';
      const result = await service.validateAdminCredentials(
        'admin@ngemiloh.com',
        validPassword,
        mockIpAddress,
        mockUserAgent,
      );

      expect(result).toHaveProperty('csrfToken');
      expect(result).toHaveProperty('userId', mockUser.id);
      expect(result).toHaveProperty('email', mockUser.email);
      expect(result).toHaveProperty('name', mockUser.name);
    });

    it('should fail validation when IP is locked', async () => {
      const lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      mockAuthRepository.findIpLockout.mockResolvedValue(
        createMockIpLockout({ locked_until: lockedUntil }),
      );

      await expect(
        service.validateAdminCredentials(
          'admin@ngemiloh.com',
          'ValidP@ssw0rd123!',
          mockIpAddress,
          mockUserAgent,
        ),
      ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    });

    it('should fail validation when admin not found', async () => {
      mockAuthRepository.findIpLockout.mockResolvedValue(null);
      mockAuthRepository.findUserByUsernameOrEmail.mockResolvedValue(null);

      await expect(
        service.validateAdminCredentials(
          'notadmin@example.com',
          'ValidP@ssw0rd123!',
          mockIpAddress,
          mockUserAgent,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should fail validation when password is too short', async () => {
      const mockUser = createMockUser({
        role: Role.superadmin,
        password_hash: '$2b$12$valid-hash',
      });

      mockAuthRepository.findIpLockout.mockResolvedValue(null);
      mockAuthRepository.findUserByUsernameOrEmail.mockResolvedValue(mockUser);

      await expect(
        service.validateAdminCredentials(
          'admin@ngemiloh.com',
          'short',
          mockIpAddress,
          mockUserAgent,
        ),
      ).rejects.toThrow('Password must be at least 16 characters');
    });

    it('should fail validation when password lacks requirements', async () => {
      const mockUser = createMockUser({
        role: Role.superadmin,
        password_hash: '$2b$12$valid-hash',
      });

      mockAuthRepository.findIpLockout.mockResolvedValue(null);
      mockAuthRepository.findUserByUsernameOrEmail.mockResolvedValue(mockUser);

      await expect(
        service.validateAdminCredentials(
          'admin@ngemiloh.com',
          'alllowercase123456',
          mockIpAddress,
          mockUserAgent,
        ),
      ).rejects.toThrow('Password must contain at least one uppercase letter');
    });

    it('should fail validation with incorrect password and trigger lockout', async () => {
      const mockUser = createMockUser({
        role: Role.superadmin,
        password_hash: '$2b$12$valid-hash',
      });

      mockAuthRepository.findIpLockout.mockResolvedValue(null);
      mockAuthRepository.findUserByUsernameOrEmail.mockResolvedValue(mockUser);
      // bcrypt compare fails - password format is valid but hash doesn't match
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);
      mockAuthRepository.incrementUserFailedLogin.mockResolvedValue({
        ...mockUser,
        failed_login_count: 5,
      });
      mockAuthRepository.incrementIpLockout.mockResolvedValue(
        createMockIpLockout({ failed_count: 5 }),
      );
      mockAuthRepository.lockUser.mockResolvedValue(mockUser);
      mockAuthRepository.lockIpAddress.mockResolvedValue(
        createMockIpLockout({
          locked_until: new Date(Date.now() + 30 * 60 * 1000),
        }),
      );

      // Service throws UnauthorizedException (401) for invalid password even when triggering lockout
      // The lockout is enforced on next login attempt, not immediately
      await expect(
        service.validateAdminCredentials(
          'admin@ngemiloh.com',
          'ValidP@ssw0rd123!',
          mockIpAddress,
          mockUserAgent,
        ),
      ).rejects.toMatchObject({ status: HttpStatus.UNAUTHORIZED });

      // Verify lockout methods were called
      expect(mockAuthRepository.lockUser).toHaveBeenCalled();
      expect(mockAuthRepository.lockIpAddress).toHaveBeenCalled();
    });

    it('should fail validation when admin account is locked', async () => {
      const mockUser = createMockUser({
        role: Role.superadmin,
        locked_until: new Date(Date.now() + 30 * 60 * 1000),
      });

      mockAuthRepository.findIpLockout.mockResolvedValue(null);
      mockAuthRepository.findUserByUsernameOrEmail.mockResolvedValue(mockUser);

      await expect(
        service.validateAdminCredentials(
          'admin@ngemiloh.com',
          'ValidP@ssw0rd123!',
          mockIpAddress,
          mockUserAgent,
        ),
      ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
    });

    it('should fail validation when admin account is inactive', async () => {
      const mockUser = createMockUser({
        role: Role.superadmin,
        is_active: false,
      });

      mockAuthRepository.findIpLockout.mockResolvedValue(null);
      mockAuthRepository.findUserByUsernameOrEmail.mockResolvedValue(mockUser);

      await expect(
        service.validateAdminCredentials(
          'admin@ngemiloh.com',
          'ValidP@ssw0rd123!',
          mockIpAddress,
          mockUserAgent,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('sendOtp - OTP Rate Limiting', () => {
    const mockAdminEmail = 'admin@ngemiloh.com';

    it('should send OTP successfully when no rate limit', async () => {
      const mockUser = createMockUser({
        id: 'admin-789',
        role: Role.superadmin,
        email: mockAdminEmail,
      });

      mockRedisService.get.mockResolvedValue(null); // No rate limit
      mockRedisService.set.mockResolvedValue('OK');
      mockAuthRepository.findUserByUsernameOrEmail.mockResolvedValue(mockUser);

      await service.sendOtp(mockAdminEmail);

      expect(mockEmailService.sendOtp).toHaveBeenCalledWith(
        mockAdminEmail,
        expect.stringMatching(/^\d{6}$/), // 6-digit OTP
      );
      expect(mockRedisService.set).toHaveBeenCalledTimes(3); // otp:admin, otp:email, otp:ratelimit
    });

    it('should reject OTP request during rate limit cooldown', async () => {
      const mockUser = createMockUser({
        role: Role.superadmin,
        email: mockAdminEmail,
      });

      mockAuthRepository.findUserByUsernameOrEmail.mockResolvedValue(mockUser);
      // Set last request to 30 seconds ago (within 60s cooldown)
      // remaining = (60000 - 30000) / 1000 = 30 seconds
      mockRedisService.get.mockResolvedValue((Date.now() - 30000).toString());

      await expect(service.sendOtp(mockAdminEmail)).rejects.toMatchObject({
        status: 400,
        message: 'Please wait 30 seconds before requesting another OTP.',
      });

      expect(mockEmailService.sendOtp).not.toHaveBeenCalled();
    });

    it('should allow OTP request after rate limit cooldown expires', async () => {
      const mockUser = createMockUser({
        id: 'admin-789',
        role: Role.superadmin,
        email: mockAdminEmail,
      });

      mockAuthRepository.findUserByUsernameOrEmail.mockResolvedValue(mockUser);
      // Set last request to 61 seconds ago (past 60s cooldown)
      mockRedisService.get.mockResolvedValue((Date.now() - 61000).toString());
      mockRedisService.set.mockResolvedValue('OK');

      await expect(service.sendOtp(mockAdminEmail)).resolves.not.toThrow();
      expect(mockEmailService.sendOtp).toHaveBeenCalled();
    });

    it('should reject OTP request for non-admin email', async () => {
      mockAuthRepository.findUserByUsernameOrEmail.mockResolvedValue(null);

      await expect(service.sendOtp('notadmin@example.com')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should reject OTP request for kasir role', async () => {
      const mockKasirUser = createMockUser({
        role: Role.kasir,
        email: mockAdminEmail,
      });

      mockAuthRepository.findUserByUsernameOrEmail.mockResolvedValue(
        mockKasirUser,
      );

      await expect(service.sendOtp(mockAdminEmail)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('verifyOtp - OTP Verification', () => {
    const mockAdminEmail = 'admin@ngemiloh.com';
    const mockUserId = 'admin-789';
    const mockIpAddress = '192.168.1.100';
    const mockUserAgent = 'Mozilla/5.0 Test Browser';
    const validOtp = '123456';
    // SHA256 hash of '123456' for mocking
    const validOtpHash =
      '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92';

    beforeEach(() => {
      // Reset crypto state to default (valid OTP)
      setTimingSafeEqualToDefault();
    });

    it('should verify OTP successfully', async () => {
      const mockUser = createMockUser({
        id: mockUserId,
        role: Role.superadmin,
        email: mockAdminEmail,
        name: 'Admin User',
      });

      // Setup redis mock with correct sequence
      mockRedisService.get.mockImplementation((key: string) => {
        if (key === `otp:email:${mockAdminEmail.toLowerCase()}`) {
          return Promise.resolve(mockUserId);
        }
        if (key === `otp:lockout:${mockAdminEmail.toLowerCase()}`) {
          return Promise.resolve(null);
        }
        if (key === `otp:admin:${mockUserId}`) {
          return Promise.resolve(
            JSON.stringify({ code_hash: validOtpHash, attempts: 0 }),
          );
        }
        return Promise.resolve(null);
      });
      mockRedisService.del.mockResolvedValue(1);

      mockAuthRepository.findUserById.mockResolvedValue(mockUser);
      mockAuthRepository.resetUserFailedLogin.mockResolvedValue(mockUser);
      mockAuthRepository.resetIpLockout.mockResolvedValue(
        createMockIpLockout(),
      );

      const result = await service.verifyOtp(
        mockAdminEmail,
        validOtp,
        mockIpAddress,
        mockUserAgent,
      );

      expect(result).toHaveProperty('csrfToken');
      expect(result.user).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        role: mockUser.role,
      });

      // Verify OTP keys were deleted
      expect(mockRedisService.del).toHaveBeenCalledWith(
        `otp:admin:${mockUserId}`,
      );
      expect(mockRedisService.del).toHaveBeenCalledWith(
        `otp:email:${mockAdminEmail.toLowerCase()}`,
      );
    });

    it('should reject verification when email is empty', async () => {
      await expect(
        service.verifyOtp('', validOtp, mockIpAddress, mockUserAgent),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.verifyOtp('', validOtp, mockIpAddress, mockUserAgent),
      ).rejects.toThrow('Email is required');
    });

    it('should reject verification when no pending OTP exists', async () => {
      mockRedisService.get.mockResolvedValue(null);

      await expect(
        service.verifyOtp(
          mockAdminEmail,
          validOtp,
          mockIpAddress,
          mockUserAgent,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.verifyOtp(
          mockAdminEmail,
          validOtp,
          mockIpAddress,
          mockUserAgent,
        ),
      ).rejects.toThrow('No pending OTP');
    });

    it('should reject verification when OTP is expired', async () => {
      mockRedisService.get.mockImplementation((key: string) => {
        if (key === `otp:email:${mockAdminEmail.toLowerCase()}`) {
          return Promise.resolve(mockUserId);
        }
        if (key === `otp:lockout:${mockAdminEmail.toLowerCase()}`) {
          return Promise.resolve(null);
        }
        if (key === `otp:admin:${mockUserId}`) {
          return Promise.resolve(null); // OTP expired
        }
        return Promise.resolve(null);
      });

      await expect(
        service.verifyOtp(
          mockAdminEmail,
          validOtp,
          mockIpAddress,
          mockUserAgent,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.verifyOtp(
          mockAdminEmail,
          validOtp,
          mockIpAddress,
          mockUserAgent,
        ),
      ).rejects.toThrow('OTP expired');
    });

    it('should reject verification with incorrect OTP code', async () => {
      // Mock timingSafeEqual to return false for wrong OTP
      setTimingSafeEqualToFail();

      mockRedisService.get.mockImplementation((key: string) => {
        if (key === `otp:email:${mockAdminEmail.toLowerCase()}`) {
          return Promise.resolve(mockUserId);
        }
        if (key === `otp:lockout:${mockAdminEmail.toLowerCase()}`) {
          return Promise.resolve(null);
        }
        if (key === `otp:admin:${mockUserId}`) {
          return Promise.resolve(
            JSON.stringify({ code_hash: validOtpHash, attempts: 0 }),
          );
        }
        return Promise.resolve(null);
      });
      mockRedisService.set.mockResolvedValue('OK');

      await expect(
        service.verifyOtp(
          mockAdminEmail,
          'wrong',
          mockIpAddress,
          mockUserAgent,
        ),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.verifyOtp(
          mockAdminEmail,
          'wrong',
          mockIpAddress,
          mockUserAgent,
        ),
      ).rejects.toThrow('Invalid OTP code');
    });

    it('should trigger OTP lockout after 3 failed attempts', async () => {
      // Mock timingSafeEqual to return false for wrong OTP
      setTimingSafeEqualToFail();

      mockRedisService.get.mockImplementation((key: string) => {
        if (key === `otp:email:${mockAdminEmail.toLowerCase()}`) {
          return Promise.resolve(mockUserId);
        }
        if (key === `otp:lockout:${mockAdminEmail.toLowerCase()}`) {
          return Promise.resolve(null);
        }
        if (key === `otp:admin:${mockUserId}`) {
          return Promise.resolve(
            JSON.stringify({ code_hash: '$2b$10$hash', attempts: 2 }),
          ); // Already 2 failed
        }
        return Promise.resolve(null);
      });
      mockRedisService.set.mockResolvedValue('OK');
      mockRedisService.del.mockResolvedValue(1);

      await expect(
        service.verifyOtp(
          mockAdminEmail,
          'wrong',
          mockIpAddress,
          mockUserAgent,
        ),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.verifyOtp(
          mockAdminEmail,
          'wrong',
          mockIpAddress,
          mockUserAgent,
        ),
      ).rejects.toThrow('Too many failed attempts');

      // Verify lockout was set
      expect(mockRedisService.set).toHaveBeenCalledWith(
        expect.stringContaining('otp:lockout:'),
        expect.any(String),
        300,
      );
      // Verify OTP data was deleted on lockout
      expect(mockRedisService.del).toHaveBeenCalledWith(
        `otp:admin:${mockUserId}`,
      );
      expect(mockRedisService.del).toHaveBeenCalledWith(
        `otp:email:${mockAdminEmail.toLowerCase()}`,
      );
    });

    it('should reject verification when OTP lockout is active', async () => {
      const lockoutExpiry = Date.now() + 300000; // 5 minutes from now

      mockRedisService.get.mockImplementation((key: string) => {
        if (key === `otp:email:${mockAdminEmail.toLowerCase()}`) {
          return Promise.resolve(mockUserId);
        }
        if (key === `otp:lockout:${mockAdminEmail.toLowerCase()}`) {
          return Promise.resolve(lockoutExpiry.toString()); // Active lockout
        }
        if (key === `otp:admin:${mockUserId}`) {
          return Promise.resolve(
            JSON.stringify({ code_hash: validOtpHash, attempts: 0 }),
          );
        }
        return Promise.resolve(null);
      });

      await expect(
        service.verifyOtp(
          mockAdminEmail,
          validOtp,
          mockIpAddress,
          mockUserAgent,
        ),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.verifyOtp(
          mockAdminEmail,
          validOtp,
          mockIpAddress,
          mockUserAgent,
        ),
      ).rejects.toThrow('Too many failed attempts');
      await expect(
        service.verifyOtp(
          mockAdminEmail,
          validOtp,
          mockIpAddress,
          mockUserAgent,
        ),
      ).rejects.toThrow('Please try again in');
    });

    it('should reject verification when user not found after OTP', async () => {
      mockRedisService.get.mockImplementation((key: string) => {
        if (key === `otp:email:${mockAdminEmail.toLowerCase()}`) {
          return Promise.resolve(mockUserId);
        }
        if (key === `otp:lockout:${mockAdminEmail.toLowerCase()}`) {
          return Promise.resolve(null);
        }
        if (key === `otp:admin:${mockUserId}`) {
          return Promise.resolve(
            JSON.stringify({ code_hash: validOtpHash, attempts: 0 }),
          );
        }
        return Promise.resolve(null);
      });
      mockRedisService.del.mockResolvedValue(1);

      mockAuthRepository.findUserById.mockResolvedValue(null);

      await expect(
        service.verifyOtp(
          mockAdminEmail,
          validOtp,
          mockIpAddress,
          mockUserAgent,
        ),
      ).rejects.toThrow(UnauthorizedException);
      await expect(
        service.verifyOtp(
          mockAdminEmail,
          validOtp,
          mockIpAddress,
          mockUserAgent,
        ),
      ).rejects.toThrow('User not found');
    });

    it('should reset failed login and IP lockout on successful verification', async () => {
      const mockUser = createMockUser({
        id: mockUserId,
        role: Role.superadmin,
        email: mockAdminEmail,
        name: 'Admin User',
      });

      mockRedisService.get.mockImplementation((key: string) => {
        if (key === `otp:email:${mockAdminEmail.toLowerCase()}`) {
          return Promise.resolve(mockUserId);
        }
        if (key === `otp:lockout:${mockAdminEmail.toLowerCase()}`) {
          return Promise.resolve(null);
        }
        if (key === `otp:admin:${mockUserId}`) {
          return Promise.resolve(
            JSON.stringify({ code_hash: validOtpHash, attempts: 0 }),
          );
        }
        return Promise.resolve(null);
      });
      mockRedisService.del.mockResolvedValue(1);

      mockAuthRepository.findUserById.mockResolvedValue(mockUser);
      mockAuthRepository.resetUserFailedLogin.mockResolvedValue(mockUser);
      mockAuthRepository.resetIpLockout.mockResolvedValue(
        createMockIpLockout(),
      );

      await service.verifyOtp(
        mockAdminEmail,
        validOtp,
        mockIpAddress,
        mockUserAgent,
      );

      expect(mockAuthRepository.resetUserFailedLogin).toHaveBeenCalledWith(
        mockUserId,
      );
      expect(mockAuthRepository.resetIpLockout).toHaveBeenCalled();
    });
  });
});
