/**
 * Escape HTML special characters to prevent XSS attacks
 * Used in email content and any user-generated content displayed in HTML
 */
export function escapeHtml(text: string | null | undefined): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Escape HTML for email content - also converts newlines to <br>
 * Use this version when content will be displayed in HTML emails
 */
export function escapeHtmlForEmail(text: string | null | undefined): string {
  return escapeHtml(text).replace(/\n/g, '<br>');
}