import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import {
  USER_REPOSITORY,
  IUserRepository,
} from '../../domain/interfaces/user.repository.interface';
import { Role, User } from '@prisma/client';

const mockUserRepository = () => ({
  findCashiers: jest.fn(),
  findByUsername: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  findCustomers: jest.fn(),
  createCustomer: jest.fn(),
  updateCustomerLoyalty: jest.fn(),
});

describe('UsersService', () => {
  let service: UsersService;
  let mockUserRepo: jest.Mocked<IUserRepository>;

  const mockPepper = 'test-pepper-secret';

  beforeEach(async () => {
    // Set environment variable for PIN pepper
    process.env.PIN_PEPPER_SECRET = mockPepper;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: USER_REPOSITORY,
          useFactory: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    mockUserRepo = module.get(USER_REPOSITORY);
  });

  afterEach(() => {
    delete process.env.PIN_PEPPER_SECRET;
    jest.clearAllMocks();
  });

  describe('findAllCashiers', () => {
    it('should return all cashiers from repository', async () => {
      const mockCashiers = [
        {
          id: '1',
          name: 'Kasir A',
          username: 'kasira',
          is_active: true,
          failed_login_count: 0,
          locked_until: null,
          last_login_at: null,
          created_at: new Date(),
        },
      ];
      mockUserRepo.findCashiers.mockResolvedValue(mockCashiers);

      const result = await service.findAllCashiers();

      expect(result).toEqual(mockCashiers);
      expect(mockUserRepo.findCashiers).toHaveBeenCalledTimes(1);
    });
  });

  describe('createCashier', () => {
    const createCashierDto = {
      name: 'John Doe',
      username: 'johndoe',
      pin: '123456',
      cashier_letter: 'A',
    };

    it('should create a new cashier successfully', async () => {
      const mockUser: User = {
        id: 'user-uuid-1',
        name: 'John Doe',
        username: 'johndoe',
        email: null,
        pin_hash: 'hashed-pin',
        password_hash: null,
        role: Role.kasir,
        is_active: true,
        must_change_pin: false,
        failed_login_count: 0,
        locked_until: null,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      mockUserRepo.findByUsername.mockResolvedValue(null);
      mockUserRepo.create.mockResolvedValue(mockUser);

      const result = await service.createCashier(createCashierDto);

      expect(result).toEqual({
        id: mockUser.id,
        username: mockUser.username,
        name: mockUser.name,
      });
      expect(mockUserRepo.findByUsername).toHaveBeenCalledWith('johndoe');
      expect(mockUserRepo.create).toHaveBeenCalledWith({
        name: 'John Doe',
        username: 'johndoe',
        pin_hash: expect.any(String),
      });
    });

    it('should convert username to lowercase', async () => {
      const dtoWithUppercase = { ...createCashierDto, username: 'JOHNDOE' };
      mockUserRepo.findByUsername.mockResolvedValue(null);
      mockUserRepo.create.mockResolvedValue({
        id: 'user-uuid-1',
        name: 'John Doe',
        username: 'johndoe',
        email: null,
        pin_hash: 'hashed',
        password_hash: null,
        role: Role.kasir,
        is_active: true,
        must_change_pin: false,
        failed_login_count: 0,
        locked_until: null,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await service.createCashier(dtoWithUppercase);

      expect(mockUserRepo.findByUsername).toHaveBeenCalledWith('johndoe');
    });

    it('should throw BadRequestException if username already exists', async () => {
      mockUserRepo.findByUsername.mockResolvedValue({
        id: 'existing-user',
        name: 'Existing',
        username: 'johndoe',
        email: null,
        pin_hash: 'hash',
        password_hash: null,
        role: Role.kasir,
        is_active: true,
        must_change_pin: false,
        failed_login_count: 0,
        locked_until: null,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      await expect(service.createCashier(createCashierDto)).rejects.toThrow(
        BadRequestException,
      );
      await expect(
        service.createCashier(createCashierDto),
      ).rejects.toThrow('Username already taken');
    });

    it('should hash PIN with pepper before storing', async () => {
      const plainPin = '123456';
      const dto = { ...createCashierDto, pin: plainPin };

      mockUserRepo.findByUsername.mockResolvedValue(null);
      mockUserRepo.create.mockImplementation(async (data: any) => ({
        id: 'user-uuid-1',
        name: data.name,
        username: data.username,
        email: null,
        pin_hash: data.pin_hash,
        password_hash: null,
        role: Role.kasir,
        is_active: true,
        must_change_pin: false,
        failed_login_count: 0,
        locked_until: null,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      }));

      await service.createCashier(dto);

      const createCall = mockUserRepo.create.mock.calls[0][0];
      const storedHash = createCall.pin_hash;

      // Verify the hash contains pepper and was hashed with bcrypt
      const isValidHash = await bcrypt.compare(
        plainPin + mockPepper,
        storedHash,
      );
      expect(isValidHash).toBe(true);
    });
  });

  describe('resetCashierPin', () => {
    const cashierId = 'cashier-uuid-123';
    const newPin = '654321';

    const mockCashierUser: User = {
      id: cashierId,
      name: 'Kasir B',
      username: 'kasirb',
      email: null,
      pin_hash: 'old-hash',
      password_hash: null,
      role: Role.kasir,
      is_active: true,
      must_change_pin: false,
      failed_login_count: 3,
      locked_until: new Date(),
      last_login_at: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should reset PIN for existing cashier', async () => {
      mockUserRepo.findById.mockResolvedValue(mockCashierUser);
      mockUserRepo.update.mockResolvedValue({
        ...mockCashierUser,
        pin_hash: 'new-hash',
        failed_login_count: 0,
        locked_until: null,
        must_change_pin: true,
      });

      const result = await service.resetCashierPin(cashierId, newPin);

      expect(result).toEqual({ success: true });
      expect(mockUserRepo.update).toHaveBeenCalledWith(cashierId, {
        pin_hash: expect.any(String),
        failed_login_count: 0,
        locked_until: null,
        must_change_pin: true,
      });
    });

    it('should hash new PIN with pepper', async () => {
      mockUserRepo.findById.mockResolvedValue(mockCashierUser);
      mockUserRepo.update.mockImplementation(async (id: string, data: any) => ({
        ...mockCashierUser,
        ...data,
      }));

      await service.resetCashierPin(cashierId, newPin);

      const updateCall = mockUserRepo.update.mock.calls[0][1];
      const newHash = updateCall.pin_hash;

      const isValidHash = await bcrypt.compare(newPin + mockPepper, newHash);
      expect(isValidHash).toBe(true);
    });

    it('should throw NotFoundException if cashier not found', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(
        service.resetCashierPin(cashierId, newPin),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.resetCashierPin(cashierId, newPin),
      ).rejects.toThrow('Cashier not found');
    });

    it('should throw NotFoundException if user is not a cashier', async () => {
      const adminUser = {
        ...mockCashierUser,
        role: Role.admin,
      };
      mockUserRepo.findById.mockResolvedValue(adminUser);

      await expect(
        service.resetCashierPin(cashierId, newPin),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.resetCashierPin(cashierId, newPin),
      ).rejects.toThrow('Cashier not found');
    });

    it('should clear failed login count and locked_until', async () => {
      const lockedCashier = {
        ...mockCashierUser,
        failed_login_count: 5,
        locked_until: new Date(Date.now() + 60000),
      };
      mockUserRepo.findById.mockResolvedValue(lockedCashier);
      mockUserRepo.update.mockResolvedValue({
        ...lockedCashier,
        failed_login_count: 0,
        locked_until: null,
      });

      await service.resetCashierPin(cashierId, newPin);

      const updateCall = mockUserRepo.update.mock.calls[0][1];
      expect(updateCall.failed_login_count).toBe(0);
      expect(updateCall.locked_until).toBeNull();
    });

    it('should set must_change_pin to true', async () => {
      mockUserRepo.findById.mockResolvedValue(mockCashierUser);
      mockUserRepo.update.mockResolvedValue({
        ...mockCashierUser,
        must_change_pin: true,
      });

      await service.resetCashierPin(cashierId, newPin);

      const updateCall = mockUserRepo.update.mock.calls[0][1];
      expect(updateCall.must_change_pin).toBe(true);
    });
  });

  describe('toggleCashierStatus (deactivateUser)', () => {
    const cashierId = 'cashier-uuid-456';

    it('should deactivate cashier when isActive is false', async () => {
      mockUserRepo.update.mockResolvedValue({
        id: cashierId,
        name: 'Kasir C',
        username: 'kasirc',
        email: null,
        pin_hash: 'hash',
        password_hash: null,
        role: Role.kasir,
        is_active: false,
        must_change_pin: false,
        failed_login_count: 0,
        locked_until: null,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await service.toggleCashierStatus(cashierId, false);

      expect(result).toEqual({ success: true });
      expect(mockUserRepo.update).toHaveBeenCalledWith(cashierId, {
        is_active: false,
      });
    });

    it('should activate cashier when isActive is true', async () => {
      mockUserRepo.update.mockResolvedValue({
        id: cashierId,
        name: 'Kasir C',
        username: 'kasirc',
        email: null,
        pin_hash: 'hash',
        password_hash: null,
        role: Role.kasir,
        is_active: true,
        must_change_pin: false,
        failed_login_count: 0,
        locked_until: null,
        last_login_at: null,
        created_at: new Date(),
        updated_at: new Date(),
      });

      const result = await service.toggleCashierStatus(cashierId, true);

      expect(result).toEqual({ success: true });
      expect(mockUserRepo.update).toHaveBeenCalledWith(cashierId, {
        is_active: true,
      });
    });
  });

  describe('error handling', () => {
    it('should throw error if PIN_PEPPER_SECRET is not set', async () => {
      delete process.env.PIN_PEPPER_SECRET;

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          UsersService,
          {
            provide: USER_REPOSITORY,
            useFactory: mockUserRepository,
          },
        ],
      }).compile();

      const serviceWithoutPepper = module.get<UsersService>(UsersService);

      await expect(
        serviceWithoutPepper.createCashier({
          name: 'Test',
          username: 'test',
          pin: '123456',
          cashier_letter: 'T',
        }),
      ).rejects.toThrow(
        'FATAL: PIN_PEPPER_SECRET environment variable is required',
      );
    });
  });

  describe('customer methods', () => {
    it('should return all customers', async () => {
      const mockCustomers = [
        { id: '1', name: 'Customer 1', phone: '081234567890', loyalty_points: 100, created_at: new Date(), updated_at: new Date() },
      ];
      mockUserRepo.findCustomers.mockResolvedValue(mockCustomers);

      const result = await service.findAllCustomers();

      expect(result).toEqual(mockCustomers);
      expect(mockUserRepo.findCustomers).toHaveBeenCalledTimes(1);
    });

    it('should create a customer', async () => {
      const customerData = {
        name: 'New Customer',
        phone: '081234567891',
      };
      const mockCustomer = {
        id: 'cust-1',
        ...customerData,
        loyalty_points: 0,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockUserRepo.createCustomer.mockResolvedValue(mockCustomer);

      const result = await service.createCustomer(customerData);

      expect(result).toEqual(mockCustomer);
      expect(mockUserRepo.createCustomer).toHaveBeenCalledWith(customerData);
    });

    it('should add loyalty points to customer', async () => {
      const customerId = 'cust-1';
      const points = 50;
      const mockUpdatedCustomer = {
        id: customerId,
        name: 'Customer',
        phone: '081234567890',
        loyalty_points: 150,
        created_at: new Date(),
        updated_at: new Date(),
      };
      mockUserRepo.updateCustomerLoyalty.mockResolvedValue(mockUpdatedCustomer);

      const result = await service.addLoyaltyPoints(customerId, points);

      expect(result).toEqual(mockUpdatedCustomer);
      expect(mockUserRepo.updateCustomerLoyalty).toHaveBeenCalledWith(
        customerId,
        points,
      );
    });
  });
});
