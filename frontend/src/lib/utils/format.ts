// ============================================
// SHARED CONSTANTS
// Using snake_case naming convention
// ============================================

export const QRIS_COUNTDOWN_SECONDS = 900; // 15 minutes
export const FLAG_REFRESH_INTERVAL_MS = 60000; // 1 minute
export const DEFAULT_OPENING_BALANCE = 500000; // Rp 500,000
export const MIN_QRIS_PAYMENT = 1000; // Rp 1,000

// FIX F-05: Business constants moved from hardcoded values
export const DAILY_REVENUE_TARGET = 5000000; // Rp 5.000.000 daily target
export const KPI_REFRESH_INTERVAL_MS = 60000; // Refresh KPI every 1 minute

// FIX F-09: Magic numbers extracted to constants
export const QRIS_POLLING_INTERVAL_MS = 5000; // Poll Midtrans every 5 seconds
export const HEALTH_CHECK_INTERVAL_MS = 30000; // Health check every 30 seconds
export const API_REQUEST_TIMEOUT_MS = 30000; // API request timeout 30 seconds
export const CASH_PRESET_AMOUNTS = [10000, 20000, 50000, 100000] as const;

/**
 * Format number to Indonesian Rupiah (snake_case function name)
 */
export function format_rp(amount: number | null | undefined): string {
	return new Intl.NumberFormat('id-ID', {
		style: 'currency',
		currency: 'IDR',
		minimumFractionDigits: 0,
		maximumFractionDigits: 0
	}).format(amount ?? 0);
}

/**
 * Format number to Indonesian Rupiah with decimals
 */
export function format_rp_decimal(amount: number | null | undefined): string {
	return new Intl.NumberFormat('id-ID', {
		style: 'currency',
		currency: 'IDR'
	}).format(amount ?? 0);
}

/**
 * Format date to Indonesian locale string
 */
export function format_date_id(date: Date | string | number): string {
	const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
	return d.toLocaleString('id-ID', {
		day: '2-digit',
		month: 'short',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});
}

/**
 * Format time only (HH:MM:SS)
 */
export function format_time_id(date: Date | string | number): string {
	const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
	return d.toLocaleString('id-ID', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit'
	});
}

/**
 * Format date for receipt (DD/MM/YYYY HH:MM:SS)
 */
export function format_receipt_date(date: Date | string | number): string {
	const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
	const day = d.getDate().toString().padStart(2, '0');
	const month = (d.getMonth() + 1).toString().padStart(2, '0');
	const year = d.getFullYear();
	const time = format_time_id(d);
	return `${day}/${month}/${year} ${time}`;
}
