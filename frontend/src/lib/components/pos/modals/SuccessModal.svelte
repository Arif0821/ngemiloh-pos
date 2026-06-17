<script lang="ts">
	import { pos_store } from '$lib/stores/pos.store.svelte';
	import { printer_service } from '$lib/services/printer.service';
	import { goto } from '$app/navigation';
	import { toast } from '$lib/stores/toast.store.svelte';
	import type { OrderResponse } from '$lib/domain/models/types';

	// Focus trap action for modals
	function focus_trap(node: HTMLElement) {
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
			if (e.key === 'Escape') {
				const close_button = node.querySelector<HTMLElement>('[data-modal-close]');
				close_button?.click();
			}
		}

		node.addEventListener('keydown', handle_keydown);
		first_element?.focus();

		return {
			destroy() {
				node.removeEventListener('keydown', handle_keydown);
			}
		};
	}

	// Print via Bluetooth (primary)
	async function print_via_bluetooth(order: OrderResponse) {
		try {
			const receipt_text = printer_service.format_receipt(
				order,
				'NGEMILOH POS',
				'Terima Kasih Telah Berbelanja'
			);
			const success = await printer_service.connect_and_print(receipt_text);
			if (success) {
				toast.success('Struk berhasil dicetak via Bluetooth');
			} else {
				toast.warning('Bluetooth tidak tersedia. Gunakan Cetak via Browser.');
			}
		} catch {
			toast.warning('Bluetooth tidak tersedia. Gunakan Cetak via Browser.');
		}
	}

	// Print via Browser (fallback)
	function print_via_browser(order: OrderResponse) {
		sessionStorage.setItem('print_order', JSON.stringify(order));
		goto('/pos/print');
	}

	// Reset and start new order
	function handle_new_order() {
		pos_store.reset_pos();
	}
</script>

<div
	class="bg-surface-900/80 fixed inset-0 z-70 flex items-center justify-center p-4 backdrop-blur-sm"
	role="dialog"
	aria-modal="true"
	aria-labelledby="success-title"
>
	<div
		class="animate-in zoom-in-95 flex w-full max-w-sm flex-col overflow-hidden rounded-3xl border-4 border-green-500 bg-white text-center shadow-2xl"
		use:focus_trap
	>
		<!-- Header with check icon -->
		<div class="flex flex-col items-center p-8 pt-10 pb-6">
			<div
				class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600 shadow-inner"
			>
				<svg class="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"
					><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"
					></path>
				</svg>
			</div>
			<h2
				id="success-title"
				class="text-surface-800 dark:text-surface-100 mb-2 text-2xl font-black"
			>
				Transaksi Berhasil!
			</h2>
			<p class="font-medium text-slate-500">
				#{pos_store.last_order_details?.client_uuid.split('-')[0].toUpperCase()}
			</p>
		</div>

		<!-- Action buttons -->
		<div class="space-y-3 border-t border-slate-100 bg-slate-50 p-6">
			<!-- New Order Button -->
			<button
				class="bg-brand-600 hover:bg-brand-700 w-full rounded-xl py-4 font-black text-white shadow-lg"
				onclick={handle_new_order}
			>
				PESANAN BARU
			</button>

			<!-- Print via Bluetooth -->
			<button
				class="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 py-4 font-bold text-white shadow-lg hover:bg-green-700"
				onclick={() =>
					pos_store.last_order_details && print_via_bluetooth(pos_store.last_order_details)}
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
					></path></svg
				>
				PRINT BLUETOOTH
			</button>

			<!-- Print via Browser -->
			<button
				class="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-slate-400 py-4 font-bold text-slate-600 hover:bg-slate-100"
				onclick={() =>
					pos_store.last_order_details && print_via_browser(pos_store.last_order_details)}
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
					></path></svg
				>
				PRINT BROWSER
			</button>
		</div>
	</div>
</div>
