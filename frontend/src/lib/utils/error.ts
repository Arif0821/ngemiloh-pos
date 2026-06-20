// ============================================
// ERROR HANDLING UTILITIES
// FIX F-10: Standardize error handling across frontend
// ============================================

import { toast } from '$lib/stores/toast.store.svelte';

/**
 * Standardize API error extraction
 */
export async function extract_error_message(res: Response): Promise<string> {
	const content_type = res.headers.get('content-type');
	if (content_type?.includes('application/json')) {
		const data = await res.json();
		return data.message || data.error || 'Terjadi kesalahan';
	}
	return `Error ${res.status}: ${res.statusText}`;
}

/**
 * Handle API errors with toast notifications
 */
export async function handle_api_error(
	res: Response,
	fallback_msg = 'Terjadi kesalahan'
): Promise<void> {
	const message = await extract_error_message(res);
	toast.error(`${fallback_msg}: ${message}`);
}

/**
 * Wrapper for async functions with standardized error handling
 */
export function with_error_handling<T extends (...args: any[]) => Promise<any>>(
	fn: T,
	fallback_msg = 'Terjadi kesalahan'
): (...args: Parameters<T>) => Promise<void> {
	return async (...args: Parameters<T>) => {
		try {
			await fn(...args);
		} catch (error) {
			console.error(fallback_msg, error);
			toast.error(fallback_msg);
		}
	};
}

/**
 * Handle promise rejection with toast
 */
export function catch_with_toast(
	promise: Promise<any>,
	fallback_msg = 'Terjadi kesalahan'
): Promise<any> {
	return promise.catch((error) => {
		console.error(fallback_msg, error);
		toast.error(fallback_msg);
		throw error;
	});
}
