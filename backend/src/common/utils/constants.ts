/**
 * Shared constants for the application
 * Centralizes all magic numbers for maintainability
 */

// ═══════════════════════════════════════════════════════════════════
// TAX & REVENUE
// ═══════════════════════════════════════════════════════════════════
/** Indonesian VAT rate (PPN 11%) */
export const TAX_RATE = 0.11;

// ═══════════════════════════════════════════════════════════════════
// AUTH & SECURITY
// ═══════════════════════════════════════════════════════════════════
/** Lockout duration: 30 minutes in milliseconds */
export const LOCKOUT_DURATION_MS = 30 * 60 * 1000;
/** Failed login attempts before lockout */
export const LOCKOUT_THRESHOLD = 5;

// ═══════════════════════════════════════════════════════════════════
// PAYMENT
// ═══════════════════════════════════════════════════════════════════
/** QRIS minimum transaction amount in Rupiah */
export const MIN_QRIS_AMOUNT = 1000;

// ═══════════════════════════════════════════════════════════════════
// CASH REGISTER
// ═══════════════════════════════════════════════════════════════════
/** Default opening balance for new shifts (Rp 500,000) */
export const DEFAULT_OPENING_BALANCE = 500000;
/** Cash discrepancy tolerance in Rupiah (Rp 5,000) */
export const CASH_DISCREPANCY_THRESHOLD = 5000;
/** Daily revenue target for KPI tracking (Rp 5,000,000) */
export const DAILY_REVENUE_TARGET = 5000000;

// ═══════════════════════════════════════════════════════════════════
// AUTO-CLOSE SHIFTS
// ═══════════════════════════════════════════════════════════════════
/** Grace period before auto-closing overdue shifts (30 minutes) */
export const AUTO_CLOSE_GRACE_MS = 30 * 60 * 1000;
/** Warning window for shift auto-close (90 minutes before) */
export const AUTO_CLOSE_WARNING_MS = 90 * 60 * 1000;

// ═══════════════════════════════════════════════════════════════════
// FRAUD DETECTION
// ═══════════════════════════════════════════════════════════════════
/** Time window for void fraud detection (10 minutes) */
export const VOID_FRAUD_WINDOW_MS = 10 * 60 * 1000;
/** Number of voids within window to trigger fraud alert */
export const VOID_FRAUD_COUNT = 3;

// ═══════════════════════════════════════════════════════════════════
// PRICE VERIFICATION
// ═══════════════════════════════════════════════════════════════════
/** Default price delta threshold percentage for order verification */
export const DEFAULT_PRICE_DELTA_THRESHOLD_PCT = 10;

// ═══════════════════════════════════════════════════════════════════
// MEMBER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════
/** Maximum attempts to generate unique member code */
export const MEMBER_CODE_MAX_ATTEMPTS = 10;

// ═══════════════════════════════════════════════════════════════════
// ORDER VALIDATION
// ═══════════════════════════════════════════════════════════════════
/** Minimum length for void reason */
export const VOID_REASON_MIN_LENGTH = 10;
/** Maximum rows for CSV export */
export const MAX_EXPORT_ROWS = 50000;

// ═══════════════════════════════════════════════════════════════════
// PAGINATION
// ═══════════════════════════════════════════════════════════════════
export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;

// ═══════════════════════════════════════════════════════════════════
// DATABASE
// ═══════════════════════════════════════════════════════════════════
/** Slow query threshold in milliseconds */
export const SLOW_QUERY_THRESHOLD_MS = 1000;

// ═══════════════════════════════════════════════════════════════════
// LOYALTY SYSTEM
// ═══════════════════════════════════════════════════════════════════
/** Loyalty points earned per Rp POINTS_EARN_PER */
export const LOYALTY_POINTS_EARN_RATE = 5;
/** Amount in Rupiah that earns LOYALTY_POINTS_EARN_RATE points */
export const LOYALTY_POINTS_EARN_PER = 1000;
/** Points required for each Rp redemption unit */
export const LOYALTY_POINTS_REDEEM_RATE = 5;
/** Rupiah value per redemption unit */
export const LOYALTY_POINTS_REDEEM_PER = 1000;
/** Cooldown between point transactions (minutes) */
export const LOYALTY_COOLDOWN_MINUTES = 2;
/** Grace period for tier validity (days) */
export const LOYALTY_GRACE_DAYS = 30;
/** Member code prefix */
export const LOYALTY_CODE_PREFIX = 'MBR-';
/** Character set for member code generation */
export const LOYALTY_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
/** Length of member code (without prefix) */
export const LOYALTY_CODE_LENGTH = 6;
