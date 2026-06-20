<script lang="ts">
	import { pos_store } from '$lib/stores/pos.store.svelte';
	import { pos_service } from '$lib/services/pos.service';
	import { CASH_PRESET_AMOUNTS } from '$lib/utils/format';

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

	// Split payment validation
	function is_split_valid(): boolean {
		return pos_store.split_cash_amount > 0 && pos_store.split_cash_amount < pos_store.cart_total;
	}

	// Set payment method
	function set_payment_method(method: 'cash' | 'qris' | 'split') {
		pos_store.payment_method = method;
		if (method === 'cash') {
			pos_store.cash_amount = pos_store.cart_total;
		} else if (method === 'qris') {
			pos_store.cash_amount = 0;
		} else if (method === 'split') {
			pos_store.split_cash_amount = Math.floor(pos_store.cart_total / 2);
		}
	}

	// Handle payment confirmation
	async function handle_confirm_payment() {
		await pos_service.process_payment(
			// QRIS/Split callback
			(data) =>
				pos_service.start_qris_waiting(data, () => {
					if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
					pos_service.cancel_qris_waiting();
					pos_store.last_order_details = pos_store.qris_order_info;
					pos_store.show_success_modal = true;
					setTimeout(() => {
						if (pos_store.show_success_modal) pos_store.reset_pos();
					}, 3000);
				}),
			// Cash callback
			(data) => {
				pos_store.last_order_details = data;
				pos_store.show_payment_modal = false;
				pos_store.show_success_modal = true;
				if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
				setTimeout(() => {
					if (pos_store.show_success_modal) pos_store.reset_pos();
				}, 3000);
			}
		);
	}

	// Check if confirm button should be disabled
	let is_disabled = $derived(
		(pos_store.payment_method === 'cash' &&
			(pos_store.cash_change < 0 || pos_store.cash_amount <= 0)) ||
			(pos_store.payment_method === 'split' && !is_split_valid()) ||
			pos_store.is_processing
	);

	function handle_close() {
		pos_store.show_payment_modal = false;
	}
</script>

<div
	class="bg-surface-900/80 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
	role="dialog"
	aria-modal="true"
	aria-labelledby="payment-title"
>
	<div
		class="dark:bg-surface-800 animate-in zoom-in-95 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl duration-200"
		use:focus_trap
	>
		<!-- Header -->
		<div
			class="border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50 flex items-center justify-between border-b p-5"
		>
			<h2 id="payment-title" class="text-xl font-bold">Pembayaran</h2>
			<button
				type="button"
				class="bg-surface-200 dark:bg-surface-700 text-surface-500 hover:text-surface-700 flex h-10 w-10 items-center justify-center rounded-full transition-colors"
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

		<!-- Body -->
		<div class="flex-1 overflow-y-auto p-6">
			<!-- Total Amount -->
			<div class="mb-8 text-center">
				<p class="text-surface-500 mb-2 font-medium">Total Tagihan</p>
				<p class="text-brand-600 dark:text-brand-400 text-5xl font-black tracking-tight">
					{pos_store.format_rp(pos_store.cart_total)}
				</p>
			</div>

			<!-- Payment Method Buttons -->
			<div class="mb-6 grid grid-cols-3 gap-3">
				<button
					type="button"
					onclick={() => set_payment_method('cash')}
					class="rounded-xl border-2 px-4 py-3 text-sm font-bold transition-all {pos_store.payment_method ===
					'cash'
						? 'border-brand-500 bg-brand-50 text-brand-700'
						: 'hover:border-brand-200 border-slate-200 text-slate-600'}"
				>
					Tunai
				</button>
				{#if pos_store.feature_flags.QRIS_PAYMENT !== false}
					<button
						type="button"
						onclick={() => set_payment_method('qris')}
						class="rounded-xl border-2 px-4 py-3 text-sm font-bold transition-all {pos_store.payment_method ===
						'qris'
							? 'border-brand-500 bg-brand-50 text-brand-700'
							: 'hover:border-brand-200 border-slate-200 text-slate-600'}"
					>
						QRIS
					</button>
				{/if}
				{#if pos_store.feature_flags.SPLIT_PAYMENT !== false}
					<button
						type="button"
						onclick={() => set_payment_method('split')}
						class="rounded-xl border-2 px-4 py-3 text-sm font-bold transition-all {pos_store.payment_method ===
						'split'
							? 'border-brand-500 bg-brand-50 text-brand-700'
							: 'hover:border-brand-200 border-slate-200 text-slate-600'}"
					>
						Split
					</button>
				{/if}
			</div>

			<!-- Offline Warning -->
			{#if pos_store.is_offline}
				<div class="mb-4 text-center text-xs font-bold text-red-500">
					QRIS/SPLIT tidak tersedia saat Offline
				</div>
			{/if}

			<!-- Payment Input Forms -->
			<div class="mt-4">
				{#if pos_store.payment_method === 'cash'}
					<!-- Cash Payment Form -->
					<div class="animate-in slide-in-from-left-4 space-y-5 duration-300">
						<div>
							<label
								for="cash-amount"
								class="text-surface-600 dark:text-surface-400 mb-2 block text-sm font-medium"
								>Nominal Diterima</label
							>
							<div class="relative">
								<span
									class="text-surface-400 absolute top-1/2 left-5 -translate-y-1/2 text-xl font-bold"
									>Rp</span
								>
								<input
									id="cash-amount"
									type="number"
									bind:value={pos_store.cash_amount}
									class="bg-surface-50 dark:bg-surface-900 border-surface-200 dark:border-surface-700 focus:ring-brand-500/20 focus:border-brand-500 w-full rounded-2xl border-2 py-4 pr-4 pl-14 text-2xl font-bold transition-all outline-none focus:ring-4"
								/>
							</div>
						</div>
						<!-- Quick Amount Buttons -->
						<div class="grid grid-cols-3 gap-2">
							<button
								class="bg-surface-100 dark:bg-surface-700 text-surface-700 hover:bg-surface-200 col-span-3 rounded-xl py-3 font-bold transition-colors"
								onclick={() => (pos_store.cash_amount = pos_store.cart_total)}>Uang Pas</button
							>
							{#each CASH_PRESET_AMOUNTS as preset}
								<button
									class="bg-surface-50 border-surface-200 text-surface-600 hover:border-brand-500 hover:text-brand-600 rounded-xl border py-2.5 text-sm font-medium transition-colors"
									onclick={() => (pos_store.cash_amount = preset)}
									>{pos_store.format_rp(preset)}</button
								>
							{/each}
						</div>
						<!-- Change Display -->
						{#if pos_store.cash_amount > 0}
							<div
								class="mt-2 rounded-2xl p-5 {pos_store.cash_change >= 0
									? 'border border-green-200 bg-green-50 text-green-700'
									: 'border border-red-200 bg-red-50 text-red-700'} transition-all"
							>
								<p class="mb-1 text-sm font-medium opacity-80">
									{pos_store.cash_change >= 0 ? 'Kembalian:' : 'Kurang:'}
								</p>
								<p class="text-3xl font-black">
									{pos_store.format_rp(Math.abs(pos_store.cash_change))}
								</p>
							</div>
						{/if}
					</div>
				{:else if pos_store.payment_method === 'qris'}
					<!-- QRIS Payment Form -->
					<div class="animate-in slide-in-from-right-4 flex flex-col items-center duration-300">
						<div class="bg-surface-50 border-brand-200 w-full rounded-2xl border p-4 text-center">
							<p class="text-surface-600 mb-2 font-medium">Total Pembayaran QRIS:</p>
							<p class="text-brand-600 text-3xl font-black">
								{pos_store.format_rp(pos_store.cart_total)}
							</p>
							<p class="text-brand-600 mt-4 text-sm">Tekan KONFIRMASI BAYAR untuk membuat QRIS</p>
						</div>
					</div>
				{:else if pos_store.payment_method === 'split'}
					<!-- Split Payment Form -->
					<div class="animate-in slide-in-from-bottom-4 space-y-4 duration-300">
						<div>
							<label for="split-cash-amount" class="text-surface-600 mb-1 block text-sm font-medium"
								>Uang Tunai Diterima</label
							>
							<div class="relative">
								<span
									class="text-surface-400 absolute top-1/2 left-5 -translate-y-1/2 text-xl font-bold"
									>Rp</span
								>
								<input
									id="split-cash-amount"
									type="number"
									bind:value={pos_store.split_cash_amount}
									class="bg-surface-50 border-surface-200 focus:ring-brand-500/20 focus:border-brand-500 w-full rounded-2xl border-2 py-4 pr-4 pl-14 text-2xl font-bold transition-all outline-none focus:ring-4"
								/>
							</div>
						</div>
						{#if pos_store.split_qris_amount > 0}
							<div class="bg-brand-50 border-brand-200 rounded-xl border p-4">
								<p class="text-brand-700 mb-1 text-sm font-medium">Sisa Pembayaran via QRIS</p>
								<p class="text-brand-700 text-2xl font-black">
									{pos_store.format_rp(pos_store.split_qris_amount)}
								</p>
							</div>
						{:else if pos_store.split_cash_amount >= pos_store.cart_total && pos_store.cart_total > 0}
							<div class="rounded-xl border border-green-200 bg-green-50 p-4">
								<p class="font-bold text-green-700">Uang tunai sudah mencukupi total bayar.</p>
								<p class="mt-1 text-xs text-green-600">
									Gunakan metode <b>Tunai</b> untuk pembayaran penuh.
								</p>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<!-- Footer with Confirm Button -->
		<div class="border-surface-200 bg-surface-50 border-t p-5">
			<button
				class="flex h-15 w-full items-center justify-center gap-2 rounded-2xl text-lg font-bold {is_disabled
					? 'bg-surface-200 text-surface-400 cursor-not-allowed'
					: 'glass-button'}"
				disabled={is_disabled}
				onclick={handle_confirm_payment}
			>
				{#if pos_store.is_processing}
					<svg class="h-6 w-6 animate-spin" fill="none" viewBox="0 0 24 24"
						><circle
							class="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="4"
						></circle><path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path></svg
					>
					MEMPROSES...
				{:else}
					<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M5 13l4 4L19 7"
						></path></svg
					>
					KONFIRMASI BAYAR
				{/if}
			</button>
		</div>
	</div>
</div>
