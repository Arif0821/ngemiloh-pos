<script lang="ts">
	import { pos_store } from '$lib/stores/pos.store.svelte';

	function vibrate() {
		if (navigator.vibrate) navigator.vibrate(50);
	}
</script>

<div
	class="dark:bg-surface-800/90 border-surface-200 dark:border-surface-700 fixed bottom-0 z-20 flex h-[70vh] w-full flex-col rounded-t-3xl border-l bg-white/90 shadow-xl backdrop-blur-md transition-transform duration-300 md:relative md:h-full md:w-96 md:rounded-none"
>
	<div
		class="border-surface-200 dark:border-surface-700 bg-surface-50/50 dark:bg-surface-900/50 flex items-center justify-between rounded-t-3xl border-b p-4 md:rounded-none"
	>
		<h2 class="flex items-center gap-2 text-lg font-bold">
			<svg class="text-brand-500 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
				><path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
				></path></svg
			>
			Keranjang ({pos_store.cart.reduce((sum, i) => sum + i.quantity, 0)})
		</h2>
		{#if pos_store.cart.length > 0}
			<button
				class="text-brand-500 hover:text-brand-600 p-2 text-sm font-medium"
				onclick={() => {
					vibrate();
					pos_store.cart = [];
				}}>Kosongkan</button
			>
		{/if}
	</div>

	<div class="flex-1 overflow-y-auto p-4">
		{#if pos_store.cart.length === 0}
			<div class="text-surface-400 flex h-full flex-col items-center justify-center">
				<svg class="mb-4 h-16 w-16 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
					></path></svg
				>
				<p>Belum ada pesanan</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each pos_store.cart as item}
					<div
						class="bg-surface-50 dark:bg-surface-900/50 border-surface-100 dark:border-surface-700/50 flex items-center gap-3 rounded-2xl border p-3"
					>
						<div class="flex-1">
							<h4 class="text-surface-800 dark:text-surface-100 text-sm leading-tight font-medium">
								{item.name}
							</h4>
							{#if item.selected_modifiers.length > 0}
								<p class="text-surface-500 mt-0.5 text-xs">
									+ {item.selected_modifiers.map((m) => m.name).join(', ')}
								</p>
							{/if}
							<p class="text-brand-600 dark:text-brand-400 mt-1 text-sm font-bold">
								{pos_store.format_rp(
									(item.base_price +
										item.selected_modifiers.reduce(
											(s: number, m) => s + Number(m.additional_price),
											0
										)) *
										item.quantity
								)}
							</p>
						</div>
						<div
							class="dark:bg-surface-800 border-surface-200 dark:border-surface-700 flex items-center gap-1 rounded-xl border bg-white p-1 shadow-sm"
						>
							<button
								class="text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/30 flex h-11 w-11 items-center justify-center rounded-lg transition-all active:scale-95"
								onclick={() => {
									vibrate();
									pos_store.update_quantity(item.cart_item_id, -1);
								}}
							>
								{#if item.quantity === 1}
									<svg
										class="h-5 w-5 text-red-500"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
										><path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M6 18L18 6M6 6l12 12"
										></path></svg
									>
								{:else}
									<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
										><path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M20 12H4"
										></path></svg
									>
								{/if}
							</button>
							<span class="w-8 text-center font-bold">{item.quantity}</span>
							<button
								class="text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/30 flex h-11 w-11 items-center justify-center rounded-lg transition-all active:scale-95"
								onclick={() => {
									vibrate();
									pos_store.update_quantity(item.cart_item_id, 1);
								}}
								aria-label="Tambah jumlah item"
							>
								<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
									><path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 4v16m8-8H4"
									></path></svg
								>
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<div
		class="bg-surface-50/80 dark:bg-surface-900/80 border-surface-200 dark:border-surface-700 pb-safe border-t p-4 backdrop-blur"
	>
		<!-- Discount dropdown removed - using auto-apply context-aware discount -->

		{#if pos_store.discount_total > 0}
			<div class="mb-2 flex items-center justify-between px-2 font-medium text-red-500">
				<span>Diskon Promo</span>
				<span>- {pos_store.format_rp(pos_store.discount_total)}</span>
			</div>
		{/if}
		<div class="mb-4 flex items-center justify-between px-2">
			<span class="text-surface-500 font-medium">Total Bayar</span>
			<span class="text-brand-600 dark:text-brand-400 text-3xl font-black"
				>{pos_store.format_rp(pos_store.cart_total)}</span
			>
		</div>
		<button
			class="h-60 w-full rounded-2xl text-lg font-bold {pos_store.cart.length > 0
				? 'glass-button'
				: 'bg-surface-200 text-surface-400 cursor-not-allowed'}"
			disabled={pos_store.cart.length === 0}
			onclick={() => (pos_store.show_payment_modal = true)}
		>
			BAYAR SEKARANG
		</button>
	</div>
</div>

<style>
	.pb-safe {
		padding-bottom: env(safe-area-inset-bottom, 1rem);
	}
</style>
