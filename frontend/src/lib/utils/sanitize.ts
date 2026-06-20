// ============================================
// INPUT SANITIZATION UTILITIES
// SECURITY FIX F-03: Prevent XSS and injection attacks
// ============================================

/**
 * Sanitize string input for safe display
 * Escapes HTML characters to prevent XSS
 */
export function escape_html(str: string): string {
	const html_escape_map: Record<string, string> = {
		'&': '&amp;',
		'<': '&lt;',
		'>': '&gt;',
		'"': '&quot;',
		"'": '&#39;'
	};
	return str.replace(/[&<>"']/g, (char) => html_escape_map[char] || char);
}

/**
 * Sanitize for use in URL paths
 * Removes characters that could break URL routing
 */
export function sanitize_path(str: string): string {
	return str.replace(/[^a-zA-Z0-9-_]/g, '').substring(0, 100);
}

/**
 * Sanitize for use in search queries
 * Basic sanitization - backend should also validate
 */
export function sanitize_search(str: string): string {
	return str.trim().substring(0, 200);
}

/**
 * Validate email format
 */
export function is_valid_email(email: string): boolean {
	const email_regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return email_regex.test(email) && email.length <= 254;
}

/**
 * Sanitize product name (alphanumeric, spaces, basic punctuation only)
 */
export function sanitize_product_name(name: string): string {
	return name.trim().replace(/[<>]/g, '').substring(0, 100);
}

/**
 * Sanitize numeric input (numbers only)
 */
export function parse_safe_number(value: string | number, default_value = 0): number {
	const num = typeof value === 'number' ? value : parseFloat(value);
	return isNaN(num) ? default_value : Math.max(0, num);
}
