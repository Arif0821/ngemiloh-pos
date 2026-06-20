// ============================================
// ACCESSIBILITY UTILITIES
// FIX F-12: Focus trap and keyboard navigation
// ============================================

/**
 * Focus trap action for modals (Svelte action)
 * Traps keyboard focus within an element
 */
export function focus_trap(node: HTMLElement) {
	const focusable_elements = node.querySelectorAll<HTMLElement>(
		'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
	);
	const first_element = focusable_elements[0];
	const last_element = focusable_elements[focusable_elements.length - 1];

	function handle_keydown(e: KeyboardEvent) {
		if (e.key === 'Tab') {
			if (e.shiftKey && document.activeElement === first_element) {
				e.preventDefault();
				last_element?.focus();
			} else if (!e.shiftKey && document.activeElement === last_element) {
				e.preventDefault();
				first_element?.focus();
			}
		}

		// Close on Escape
		if (e.key === 'Escape') {
			node.dispatchEvent(new CustomEvent('escape'));
		}
	}

	node.addEventListener('keydown', handle_keydown);

	return {
		destroy() {
			node.removeEventListener('keydown', handle_keydown);
		}
	};
}

/**
 * Trap focus within a node programmatically
 */
export function trap_focus(node: HTMLElement): () => void {
	const focusable = node.querySelectorAll<HTMLElement>(
		'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
	);
	const first = focusable[0];
	const last = focusable[focusable.length - 1];

	first?.focus();

	function handler(e: KeyboardEvent) {
		if (e.key !== 'Tab') return;

		if (e.shiftKey) {
			if (document.activeElement === first) {
				e.preventDefault();
				last?.focus();
			}
		} else {
			if (document.activeElement === last) {
				e.preventDefault();
				first?.focus();
			}
		}
	}

	node.addEventListener('keydown', handler);
	return () => node.removeEventListener('keydown', handler);
}
