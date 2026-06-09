/**
 * Date utility functions for common date manipulations
 */

/**
 * Get start of day (00:00:00) in local timezone
 */
export function startOfDay(date: Date = new Date()): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get end of day (23:59:59.999) in local timezone
 */
export function endOfDay(date: Date = new Date()): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Get start of month
 */
export function startOfMonth(year: number, month: number): Date {
  return new Date(year, month - 1, 1, 0, 0, 0, 0);
}

/**
 * Get end of month
 */
export function endOfMonth(year: number, month: number): Date {
  return new Date(year, month, 0, 23, 59, 59, 999);
}

/**
 * Parse date string safely, returning null for invalid dates
 */
export function parseDate(dateStr?: string): Date | null {
  if (!dateStr) return null;
  const date = new Date(dateStr);
  return isNaN(date.getTime()) ? null : date;
}
