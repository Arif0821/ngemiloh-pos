import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AUTH_REPOSITORY } from '../../domain/interfaces/auth.repository.interface';
import { EmailService } from '../../../email/email.service';
import { createMockUser, createMockIpLockout } from '../../../test/mocks';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Mock bcrypt
jest.mock('bcrypt', () => ({
  compare: jest.fn().mockResolvedValue(true),
  hash: jest.fn().mockResolvedValue('$2b$12$mocked-hash'),
}));

describe('AuthService', () => {
  let service: AuthService;
  let mockAuthRepository: any;
  let mockJwtService: any;
  let mockEmailService: any;

  beforeEach(async () => {
    // Reset bcrypt mock before each test
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

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
      findRevokedToken: jest.fn(),
      revokeToken: jest.fn(),
      findUserByUsername: jest.fn(),
      createAuditLog: jest.fn(),
    };

    mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn(),
    };

    mockEmailService = {
      sendAlert: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AUTH_REPOSITORY, useValue: mockAuthRepository },
        { provide: JwtService, useValue: mockJwtService },
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    const mockIpAddress = '127.0.0.1';

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
      mockAuthRepository.resetIpLockout.mockResolvedValue(createMockIpLockout());

      // Act: Perform login
      const result = await service.login('testuser', '123456', mockIpAddress);

      // Assert: Verify successful login response
      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('csrfToken');
      expect(result.user).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        role: mockUser.role,
        must_change_pin: mockUser.must_change_pin,
      });

      // Verify repository calls
      expect(mockAuthRepository.findIpLockout).toHaveBeenCalledWith(mockIpAddress);
      expect(mockAuthRepository.findUserByUsernameOrEmail).toHaveBeenCalledWith('testuser');
      expect(mockAuthRepository.resetUserFailedLogin).toHaveBeenCalledWith(mockUser.id);
      expect(mockAuthRepository.resetIpLockout).toHaveBeenCalledWith(mockIpAddress);
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
      mockAuthRepository.resetIpLockout.mockResolvedValue(createMockIpLockout());

      // Act: Perform login with VALID password (≥16 chars)
      const result = await service.login('admin@example.com', validSuperadminPassword, mockIpAddress);

      // Assert: Verify successful login
      expect(result).toHaveProperty('accessToken');
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
        service.login('admin@example.com', 'weak', mockIpAddress)
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
        service.login('admin@example.com', 'Password1234567890', mockIpAddress)
      ).rejects.toThrow('Password must contain uppercase, lowercase, number, and symbol');
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
      mockAuthRepository.incrementIpLockout.mockResolvedValue(createMockIpLockout({ failed_count: 1 }));

      // Act& Assert: Login should fail with UnauthorizedException
      await expect(service.login('testuser', 'wrong-pin', mockIpAddress)).rejects.toThrow(
        UnauthorizedException
      );
 await expect(service.login('testuser', 'wrong-pin', mockIpAddress)).rejects.toThrow(
        'Invalid credentials'
      );
    });

    it('should fail login when user does not exist', async () => {
      // Arrange: No user found
      mockAuthRepository.findIpLockout.mockResolvedValue(null);
      mockAuthRepository.findUserByUsernameOrEmail.mockResolvedValue(null);

      // Act& Assert: Should throw UnauthorizedException
      await expect(service.login('nonexistent', '123456', mockIpAddress)).rejects.toThrow(
        UnauthorizedException
      );
      await expect(service.login('nonexistent', '123456', mockIpAddress)).rejects.toThrow(
        'Invalid credentials'
      );
    });

    it('should fail login with inactive user', async () => {
      // Arrange: User exists but is inactive
      const mockUser = createMockUser({
        is_active: false,
      });

      mockAuthRepository.findIpLockout.mockResolvedValue(null);
      mockAuthRepository.findUserByUsernameOrEmail.mockResolvedValue(mockUser);

      // Act & Assert: Should throw UnauthorizedException with account inactive message
      await expect(service.login('testuser', '123456', mockIpAddress)).rejects.toThrow(
        UnauthorizedException
      );
      await expect(service.login('testuser', '123456', mockIpAddress)).rejects.toThrow(
        'Account is inactive'
      );
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
      await expect(service.login('testuser', '123456', mockIpAddress)).rejects.toThrow(HttpException);
      await expect(service.login('testuser', '123456', mockIpAddress)).rejects.toMatchObject({
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
      mockAuthRepository.incrementIpLockout.mockResolvedValue(createMockIpLockout({ failed_count: 5 }));
      mockAuthRepository.lockIpAddress.mockResolvedValue(createMockIpLockout({
        locked_until: new Date(Date.now() + 30 * 60 * 1000),
      }));

      // Act& Assert: Should throw HttpException indicating IP is locked
      await expect(service.login('testuser', 'wrong-pin', mockIpAddress)).rejects.toThrow(HttpException);
      await expect(service.login('testuser', 'wrong-pin', mockIpAddress)).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });

      // Verify lockIpAddress was called
      expect(mockAuthRepository.lockIpAddress).toHaveBeenCalled();
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
      mockAuthRepository.incrementIpLockout.mockResolvedValue(createMockIpLockout({ failed_count: 1 }));

      // Act: Perform5th failed login attempt
      await expect(service.login('testuser', 'wrong-pin', mockIpAddress)).rejects.toThrow(
        UnauthorizedException
      );

      // Assert: lockUser should have been called
      expect(mockAuthRepository.lockUser).toHaveBeenCalled();
      // Assert: Email alert should have been sent
      expect(mockEmailService.sendAlert).toHaveBeenCalledWith(
        'Akun Terkunci - Gagal Login',
        expect.stringContaining(mockUser.username)
      );
    });

    it('should block login when IP is already locked', async () => {
      // Arrange: IP is already locked
      const lockedUntil = new Date(Date.now() + 30 * 60 * 1000);
      const mockIpLockout = createMockIpLockout({ locked_until: lockedUntil });

      mockAuthRepository.findIpLockout.mockResolvedValue(mockIpLockout);

      // Act & Assert: Should throw HttpException immediately without checking user
      await expect(service.login('testuser', '123456', mockIpAddress)).rejects.toThrow(HttpException);
      await expect(service.login('testuser', '123456', mockIpAddress)).rejects.toMatchObject({
        status: HttpStatus.TOO_MANY_REQUESTS,
      });

      // Verify findUserByUsernameOrEmail was NOT called
      expect(mockAuthRepository.findUserByUsernameOrEmail).not.toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    const validToken = 'valid-refresh-token';
    const tokenPayload = { sub: 'user-123', role: Role.kasir, exp: Math.floor(Date.now() / 1000) + 3600 };

    it('should successfully refresh token with valid token', async () => {
      // Arrange: Valid token that is not revoked
      const mockUser = createMockUser();

      mockJwtService.verify.mockReturnValue(tokenPayload);
      mockAuthRepository.findRevokedToken.mockResolvedValue(null);
      mockAuthRepository.findUserById.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('new-access-token');

      // Act: Refresh token
      const result = await service.refreshToken(validToken);

      // Assert: Should return new access token
      expect(result).toHaveProperty('accessToken');
      expect(result.accessToken).toBe('new-access-token');

      // Verify repository calls
      expect(mockAuthRepository.findRevokedToken).toHaveBeenCalled();
      expect(mockAuthRepository.findUserById).toHaveBeenCalledWith(tokenPayload.sub);
    });

    it('should fail refresh with invalid token', async () => {
      // Arrange: Invalid token throws during verify
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert: Should throw UnauthorizedException
      await expect(service.refreshToken('invalid-token')).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshToken('invalid-token')).rejects.toThrow('Invalid token');
    });

    it('should fail refresh with revoked token', async () => {
      // Arrange: Token is valid but has been revoked
      mockJwtService.verify.mockReturnValue(tokenPayload);
      mockAuthRepository.findRevokedToken.mockResolvedValue({ token_hash: 'some-hash' });

      // Act & Assert: Should throw UnauthorizedException with token revoked message
      await expect(service.refreshToken(validToken)).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshToken(validToken)).rejects.toThrow('Token revoked');
    });

    it('should fail refresh when user is not found', async () => {
      // Arrange: Token is valid but user no longer exists
      mockJwtService.verify.mockReturnValue(tokenPayload);
      mockAuthRepository.findRevokedToken.mockResolvedValue(null);
      mockAuthRepository.findUserById.mockResolvedValue(null);

      // Act & Assert: Should throw UnauthorizedException
      await expect(service.refreshToken(validToken)).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshToken(validToken)).rejects.toThrow('Invalid or inactive user');
    });

    it('should fail refresh when user is inactive', async () => {
      // Arrange: Token is valid but user is inactive
      const inactiveUser = createMockUser({ is_active: false });

      mockJwtService.verify.mockReturnValue(tokenPayload);
      mockAuthRepository.findRevokedToken.mockResolvedValue(null);
      mockAuthRepository.findUserById.mockResolvedValue(inactiveUser);

      // Act & Assert: Should throw UnauthorizedException
      await expect(service.refreshToken(validToken)).rejects.toThrow(UnauthorizedException);
      await expect(service.refreshToken(validToken)).rejects.toThrow('Invalid or inactive user');
    });
  });

  describe('logout', () => {
    const validRefreshToken = 'valid-refresh-token';
    const tokenPayload = { sub: 'user-123', role: Role.kasir, exp: Math.floor(Date.now() / 1000) + 3600 };

    it('should successfully logout with valid refresh token', async () => {
      // Arrange: Valid refresh token
      mockJwtService.verify.mockReturnValue(tokenPayload);
      mockAuthRepository.revokeToken.mockResolvedValue({
        token_hash: 'some-hash',
        user_id: tokenPayload.sub,
        expires_at: new Date(tokenPayload.exp * 1000),
      });

      // Act: Perform logout
      await service.logout(validRefreshToken);

      // Assert: Token should be revoked
      expect(mockAuthRepository.revokeToken).toHaveBeenCalled();
    });

    it('should handle logout with empty refresh token gracefully', async () => {
      // Act& Assert: Should not throw, just return
      await expect(service.logout('')).resolves.not.toThrow();
      await expect(service.logout(null as any)).resolves.not.toThrow();
      await expect(service.logout(undefined as any)).resolves.not.toThrow();

      // Verify no repository calls were made
      expect(mockAuthRepository.revokeToken).not.toHaveBeenCalled();
    });

    it('should handle logout with invalid refresh token gracefully', async () => {
      // Arrange: Invalid token throws during verify
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      // Act & Assert: Should not throw, just ignore invalid token
      await expect(service.logout('invalid-token')).resolves.not.toThrow();
      expect(mockAuthRepository.revokeToken).not.toHaveBeenCalled();
    });

    it('should revoke token with correct hash and expiration', async () => {
      // Arrange: Valid refresh token
      mockJwtService.verify.mockReturnValue(tokenPayload);
      mockAuthRepository.revokeToken.mockResolvedValue({} as any);

      // Act: Perform logout
      await service.logout(validRefreshToken);

      // Assert: Verify revokeToken was called with correct parameters
      expect(mockAuthRepository.revokeToken).toHaveBeenCalledWith(
        expect.any(String), // token hash
        tokenPayload.sub,   // user id
        expect.any(Date)    // expires at
      );
    });
  });
});
