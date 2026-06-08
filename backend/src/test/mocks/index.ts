// Mock utilities for testing
import { Role } from '@prisma/client';

// Helper to create mock user
export const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  name: 'Test User',
  username: 'testuser',
  email: 'test@example.com',
  pin_hash: '$2b$12$test-hash',
  password_hash: '$2b$12$test-hash',
  role: Role.kasir,
  is_active: true,
  must_change_pin: false,
  failed_login_count: 0,
  locked_until: null,
  last_login_at: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

// Helper to create mock IP lockout
export const createMockIpLockout = (overrides = {}) => ({
  ip_address: '127.0.0.1',
  failed_count: 0,
  locked_until: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});
