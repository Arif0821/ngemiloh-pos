/**
 * Shared constants for the application
 */

// Auth lockout durations (in milliseconds)
export const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
export const LOCKOUT_THRESHOLD = 5; // Failed attempts before lockout

// QRIS payment limits
export const MIN_QRIS_AMOUNT = 1000; // Rp 1,000 minimum

// Cash register defaults
export const DEFAULT_OPENING_BALANCE = 500000; // Rp 500,000
export const CASH_DISCREPANCY_THRESHOLD = 5000; // Rp 5,000 tolerance

// Revenue targets
export const DAILY_REVENUE_TARGET = 5000000; // Rp 5,000,000

// Pagination defaults
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
