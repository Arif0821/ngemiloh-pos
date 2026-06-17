<script lang="ts">
	import { pos_store } from '$lib/stores/pos.store.svelte';
	import { goto } from '$app/navigation';
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

	// Print receipt via browser
	function print_receipt(order: OrderResponse) {
		sessionStorage.setItem('print_order', JSON.stringify(order));
		goto('/pos/print');
	}

	function handle_close() {
		pos_store.show_history_modal = false;
	}
</script>

<div
	class="bg-surface-900/80 fixed inset-0 z-70 flex items-end justify-center backdrop-blur-sm md:items-center md:p-4"
	role="dialog"
	aria-modal="true"
	aria-labelledby="history-title"
>
	<div
		class="animate-in slide-in-from-bottom-full md:zoom-in-95 pb-safe flex h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl md:h-[70vh] md:rounded-3xl"
		use:focus_trap
	>
		<!-- Header -->
		<div class="border-surface-200 bg-surface-50 flex items-center justify-between border-b p-5">
			<h2 id="history-title" class="text-xl font-bold">Riwayat Transaksi</h2>
			<button
				type="button"
				class="bg-surface-200 text-surface-500 flex h-10 w-10 items-center justify-center rounded-full"
				onclick={handle_close}
				data-modal-close
				aria-label="Tutup modal"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					></path>
				</svg>
			</button>
		</div>

		<!-- Transaction List -->
		<div class="flex-1 overflow-y-auto bg-slate-50 p-4">
			{#if pos_store.history_orders.length === 0}
				<div class="flex h-full flex-col items-center justify-center text-slate-400">
					<p>Belum ada transaksi hari ini.</p>
				</div>
			{:else}
				<div class="space-y-4">
					{#each pos_store.history_orders as order}
						<div class="flex justify-between rounded-2xl border border-slate-200 bg-white p-4">
							<div>
								<div class="mb-1 flex items-center gap-2">
									<span class="font-bold text-slate-800"
										>#{order.client_uuid.split('-')[0].toUpperCase()}</span
									>
									<span
										class="rounded bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700 uppercase"
										>{order.payment_status || 'PENDING'}</span
									>
								</div>
								<p class="mb-2 text-sm text-slate-500">
									{new Date(order.created_at ?? Date.now()).toLocaleString('id-ID')} • {(
										order.payment_method ?? 'cash'
									).toUpperCase()}
								</p>
							</div>
							<div class="text-right">
								<p class="text-brand-600 text-lg font-black">
									{pos_store.format_rp(order.final_price)}
								</p>
								<button
									class="mt-2 text-sm font-bold text-indigo-600 hover:underline"
									onclick={() => print_receipt(order)}
								>
									Cetak Ulang
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
