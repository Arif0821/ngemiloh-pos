<script lang="ts">
	import { pos_store } from '$lib/stores/pos.store.svelte';
	import { pos_service } from '$lib/services/pos.service';
	import QRCode from 'qrcode';
	import { onMount } from 'svelte';

	let qr_data_url = $state('');

	async function generate_qr() {
		const qr_string = pos_store.qris_order_info?.qr_string || '';
		if (qr_string) {
			qr_data_url = await QRCode.toDataURL(qr_string, {
				width: 200,
				margin: 2,
				color: {
					dark: '#000000',
					light: '#ffffff'
				}
			});
		}
	}

	// Generate QR when order info changes
	$effect(() => {
		if (pos_store.qris_order_info?.qr_string) {
			generate_qr();
		}
	});

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

	// Format seconds to MM:SS
	function format_time(seconds: number) {
		const m = Math.floor(seconds / 60)
			.toString()
			.padStart(2, '0');
		const s = (seconds % 60).toString().padStart(2, '0');
		return `${m}:${s}`;
	}

	// Handle cancel transaction
	function handle_cancel() {
		pos_service.cancel_qris_waiting();
		pos_store.reset_cart();
	}
</script>

<div
	class="bg-surface-900/90 fixed inset-0 z-80 flex items-center justify-center p-4 backdrop-blur-md"
	role="alertdialog"
	aria-modal="true"
	aria-labelledby="qris-title"
>
	<div
		class="animate-in zoom-in-95 flex w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-white text-center shadow-2xl duration-300"
		use:focus_trap
	>
		<!-- Header -->
		<div class="p-6 pb-4">
			<h2 id="qris-title" class="mb-2 text-xl font-bold">Menunggu Pembayaran</h2>
			<p class="text-surface-500 font-medium">
				#{pos_store.qris_order_info?.client_uuid.split('-')[0].toUpperCase()}
			</p>
		</div>

		<!-- QR Code Section -->
		<div class="bg-surface-50 border-surface-200 border-y px-6 py-4">
			<div class="border-surface-200 mb-4 inline-block rounded-2xl border bg-white p-4 shadow-sm">
				{#if qr_data_url}
					<img src={qr_data_url} alt="QRIS" class="h-48 w-48" />
				{:else}
					<div
						class="bg-surface-200 flex h-48 w-48 animate-pulse items-center justify-center rounded-lg"
					>
						<span class="text-surface-500 text-sm">Memuat QR...</span>
					</div>
				{/if}
			</div>
			<p class="text-brand-600 mb-1 text-3xl font-black">
				{pos_store.format_rp(pos_store.qris_order_info?.final_price || pos_store.cart_total)}
			</p>
			<div class="animate-pulse font-mono text-xl font-bold text-red-500">
				Sisa Waktu: {format_time(pos_store.qris_countdown)}
			</div>
		</div>

		<!-- Cancel Button -->
		<div class="p-6">
			<button
				class="border-surface-300 text-surface-600 hover:bg-surface-100 w-full rounded-xl border-2 py-3 font-bold"
				onclick={handle_cancel}
				data-modal-close
			>
				BATALKAN TRANSAKSI
			</button>
		</div>
	</div>
</div>
