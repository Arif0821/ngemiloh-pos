// Shared constants for frontend
export const QRIS_COUNTDOWN_SECONDS = 900; // 15 minutes
export const FLAG_REFRESH_INTERVAL_MS = 60000; // 1 minute
export const DEFAULT_OPENING_BALANCE = 500000; // Rp 500,000
export const MIN_QRIS_PAYMENT = 1000; // Rp 1,000

/**
 * Format number to Indonesian Rupiah
 */
export function formatRp(amount: number | null | undefined): string {
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
export function formatRpDecimal(amount: number | null | undefined): string {
	return new Intl.NumberFormat('id-ID', {
		style: 'currency',
		currency: 'IDR'
	}).format(amount ?? 0);
}
