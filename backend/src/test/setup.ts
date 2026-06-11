// Jest setup file
// Note: 'jest' is available globally in Jest environment

// Set test environment
process.env.JWT_ACCESS_SECRET = 'test-secret';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
process.env.JWT_ACCESS_EXPIRES = '1h';
process.env.JWT_REFRESH_EXPIRES = '7d';
process.env.PIN_PEPPER_SECRET = 'test-pepper';

// Increase timeout for async tests
jest.setTimeout(10000);
