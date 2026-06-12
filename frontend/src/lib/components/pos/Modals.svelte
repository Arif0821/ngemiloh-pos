<script lang="ts">
	import { posStore } from '$lib/stores/pos.store.svelte';
	import { posService } from '$lib/services/pos.service';
	import { printerService } from '$lib/services/printer.service';
	import { toast } from '$lib/stores/toast.store.svelte';
	import type { OrderResponse } from '$lib/domain/models/types';

	function formatTime(seconds: number) {
		const m = Math.floor(seconds / 60)
			.toString()
			.padStart(2, '0');
		const s = (seconds % 60).toString().padStart(2, '0');
		return `${m}:${s}`;
	}

	// P1-ACCESSIBILITY: Focus trap action for modals
	function focusTrap(node: HTMLElement) {
		const focusableElements = node.querySelectorAll<HTMLElement>(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
		);
		const firstElement = focusableElements[0];
		const lastElement = focusableElements[focusableElements.length - 1];

		function handleKeydown(e: KeyboardEvent) {
			if (e.key === 'Tab') {
				if (e.shiftKey && document.activeElement === firstElement) {
					e.preventDefault();
					lastElement?.focus();
				} else if (!e.shiftKey && document.activeElement === lastElement) {
					e.preventDefault();
					firstElement?.focus();
				}
			}
			if (e.key === 'Escape') {
				const closeButton = node.querySelector<HTMLElement>('[data-modal-close]');
				closeButton?.click();
			}
		}

		node.addEventListener('keydown', handleKeydown);
		firstElement?.focus();

		return {
			destroy() {
				node.removeEventListener('keydown', handleKeydown);
			}
		};
	}

	async function printReceipt(order: OrderResponse) {
		try {
			const receiptText = printerService.formatReceipt(
				order,
				'NGEMILOH POS',
				'Terima Kasih Telah Berbelanja'
			);
			const success = await printerService.connectAndPrint(receiptText);
			if (!success) {
				toast.warning(
					'Cetak struk gagal, mungkin perangkat tidak didukung atau Anda belum memberikan izin Bluetooth. Anda masih bisa melihat struk dari riwayat pesanan.'
				);
			}
		} catch (e) {
			toast.warning('Fitur Bluetooth Web tidak tersedia di browser ini.');
		}
	}

	function confirmModifiers() {
		if (!posStore.selectedProductForModifier) return;
		for (const g of posStore.selectedProductForModifier.modifier_groups) {
			if (g.is_required && !posStore.selectedModifiers[g.id]) {
				toast.warning(`Pilihan ${g.name} wajib diisi!`);
				return;
			}
		}
		posStore.addToCart(
			posStore.selectedProductForModifier,
			Object.values(posStore.selectedModifiers)
		);
	}
</script>

{#if !posStore.hasOpenShift && !posStore.isCheckingShift}
	<div
		class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="open-shift-title"
	>
		<div
			class="dark:bg-surface-800 animate-in fade-in zoom-in w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl duration-200"
			use:focusTrap
		>
			<div
				class="border-b border-amber-100 bg-amber-50 p-6 dark:border-amber-900/30 dark:bg-amber-900/20"
			>
				<h2 id="open-shift-title" class="text-xl font-bold text-amber-800 dark:text-amber-500">
					Mulai Shift
				</h2>
				<p class="mt-1 text-sm text-amber-700/80 dark:text-amber-400/80">
					Anda belum memulai shift hari ini. Silakan masukkan uang modal laci (Kas Awal).
				</p>
			</div>
			<form
				onsubmit={(e) => {
					e.preventDefault();
					posService.handleOpenShift(posStore.openingBalance);
				}}
				class="p-6"
			>
				<div class="space-y-4">
					<div>
						<label class="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300"
							>Kas Awal (Rp)</label
						>
						<input
							type="number"
							bind:value={posStore.openingBalance}
							required
							class="dark:border-surface-600 dark:bg-surface-900 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 dark:text-slate-100"
						/>
					</div>
				</div>
				<button
					type="submit"
					class="mt-6 w-full rounded-xl bg-amber-500 py-3 font-bold text-white shadow-lg shadow-amber-500/30 hover:bg-amber-600"
				>
					Buka Laci & Mulai Shift
				</button>
			</form>
		</div>
	</div>
{/if}

{#if posStore.showCloseShiftModal}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="close-shift-title"
	>
		<div
			class="dark:bg-surface-800 animate-in fade-in zoom-in w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl duration-200"
			use:focusTrap
		>
			<div
				class="dark:border-surface-700 flex items-center justify-between border-b border-slate-100 p-6"
			>
				<h2 id="close-shift-title" class="text-xl font-bold text-slate-800 dark:text-slate-100">
					Tutup Shift
				</h2>
				<button
					type="button"
					onclick={() => (posStore.showCloseShiftModal = false)}
					data-modal-close
					class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
				>
					<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						></path></svg
					>
				</button>
			</div>
			<form
				onsubmit={(e) => {
					e.preventDefault();
					posService.handleCloseShift(posStore.closingBalance);
				}}
				class="space-y-4 p-6"
			>
				<p class="text-sm text-slate-600 dark:text-slate-400">
					Silakan hitung uang fisik di laci kasir dan masukkan nominal akhirnya untuk dicocokkan
					dengan sistem.
				</p>
				<div>
					<label class="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300"
						>Kas Akhir Laci (Fisik)</label
					>
					<input
						type="number"
						bind:value={posStore.closingBalance}
						required
						class="dark:border-surface-600 dark:bg-surface-900 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-red-500 dark:text-slate-100"
					/>
				</div>
				<div class="flex justify-end gap-3 pt-4">
					<button
						type="button"
						onclick={() => (posStore.showCloseShiftModal = false)}
						class="dark:hover:bg-surface-700 rounded-lg px-4 py-2 font-bold text-slate-600 hover:bg-slate-50 dark:text-slate-300"
						>Batal</button
					>
					<button
						type="submit"
						class="rounded-lg bg-red-600 px-6 py-2 font-bold text-white shadow-lg hover:bg-red-700"
						>Tutup Shift & Log Out</button
					>
				</div>
			</form>
		</div>
	</div>
{/if}

{#if posStore.showModifierModal && posStore.selectedProductForModifier}
	<div
		class="bg-surface-900/80 fixed inset-0 z-60 flex items-center justify-center p-4 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="modifier-title"
	>
		<div
			class="dark:bg-surface-800 animate-in zoom-in-95 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl duration-200"
			use:focusTrap
		>
			<div
				class="border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50 flex items-center justify-between border-b p-5"
			>
				<h2 id="modifier-title" class="text-xl font-bold">
					{posStore.selectedProductForModifier.name}
				</h2>
				<button
					type="button"
					class="bg-surface-200 dark:bg-surface-700 text-surface-500 hover:text-surface-700 flex h-10 w-10 items-center justify-center rounded-full"
					onclick={() => (posStore.showModifierModal = false)}
					data-modal-close
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						></path></svg
					>
				</button>
			</div>

			<div class="flex-1 space-y-6 overflow-y-auto p-5">
				{#each posStore.selectedProductForModifier.modifier_groups as group}
					<div>
						<h3 class="mb-3 flex items-center justify-between font-bold">
							<span>{group.name} {group.is_required ? '*' : ''}</span>
						</h3>
						<div class="grid grid-cols-2 gap-3">
							{#each group.options as option}
								<button
									class="rounded-xl border-2 p-3 text-left transition-all {posStore
										.selectedModifiers[group.id]?.id === option.id
										? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300'
										: 'border-surface-200 dark:border-surface-700'}"
									onclick={() => {
										if (
											posStore.selectedModifiers[group.id]?.id === option.id &&
											!group.is_required
										) {
											delete posStore.selectedModifiers[group.id];
										} else {
											posStore.selectedModifiers[group.id] = option;
										}
									}}
								>
									<div class="text-sm font-medium">{option.name}</div>
									{#if Number(option.additional_price) > 0}
										<div class="text-brand-600 dark:text-brand-400 mt-1 text-xs font-bold">
											+{posStore.formatRp(Number(option.additional_price))}
										</div>
									{/if}
								</button>
							{/each}
						</div>
					</div>
				{/each}
			</div>

			<div
				class="border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50 border-t p-5"
			>
				<div class="mb-4 flex items-center justify-between">
					<span class="text-surface-500 font-medium">Total Harga</span>
					<span class="text-brand-600 dark:text-brand-400 text-2xl font-bold">
						{posStore.formatRp(
							Number(posStore.selectedProductForModifier.base_price) + posStore.modifierTotal
						)}
					</span>
				</div>
				<button
					class="w-full rounded-xl py-4 text-lg font-bold shadow-md transition-all active:scale-95 {posStore.isAllRequiredModifiersSelected
						? 'bg-brand-600 hover:bg-brand-700 text-white'
						: 'bg-surface-300 text-surface-500 cursor-not-allowed'}"
					onclick={confirmModifiers}
					disabled={!posStore.isAllRequiredModifiersSelected}
				>
					TAMBAH PESANAN
				</button>
			</div>
		</div>
	</div>
{/if}

{#if posStore.showPaymentModal}
	<div
		class="bg-surface-900/80 fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="payment-title"
	>
		<div
			class="dark:bg-surface-800 animate-in zoom-in-95 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl duration-200"
			use:focusTrap
		>
			<div
				class="border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50 flex items-center justify-between border-b p-5"
			>
				<h2 id="payment-title" class="text-xl font-bold">Pembayaran</h2>
				<button
					type="button"
					class="bg-surface-200 dark:bg-surface-700 text-surface-500 hover:text-surface-700 flex h-10 w-10 items-center justify-center rounded-full transition-colors"
					onclick={() => (posStore.showPaymentModal = false)}
					data-modal-close
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						></path></svg
					>
				</button>
			</div>

			<div class="flex-1 overflow-y-auto p-6">
				<div class="mb-8 text-center">
					<p class="text-surface-500 mb-2 font-medium">Total Tagihan</p>
					<p class="text-brand-600 dark:text-brand-400 text-5xl font-black tracking-tight">
						{posStore.formatRp(posStore.cartTotal)}
					</p>
				</div>

				<div class="mb-6 grid grid-cols-3 gap-3">
					<button
						type="button"
						onclick={() => {
							posStore.paymentMethod = 'cash';
							posStore.cashAmount = posStore.cartTotal;
						}}
						class="rounded-xl border-2 px-4 py-3 text-sm font-bold transition-all {posStore.paymentMethod ===
						'cash'
							? 'border-brand-500 bg-brand-50 text-brand-700'
							: 'hover:border-brand-200 border-slate-200 text-slate-600'}"
					>
						Tunai
					</button>
					{#if posStore.featureFlags.QRIS_PAYMENT !== false}
						<button
							type="button"
							onclick={() => {
								posStore.paymentMethod = 'qris';
								posStore.cashAmount = 0;
							}}
							class="rounded-xl border-2 px-4 py-3 text-sm font-bold transition-all {posStore.paymentMethod ===
							'qris'
								? 'border-brand-500 bg-brand-50 text-brand-700'
								: 'hover:border-brand-200 border-slate-200 text-slate-600'}"
						>
							QRIS
						</button>
					{/if}
					{#if posStore.featureFlags.SPLIT_PAYMENT !== false}
						<button
							type="button"
							onclick={() => {
								posStore.paymentMethod = 'split';
								posStore.splitCashAmount = Math.floor(posStore.cartTotal / 2);
							}}
							class="rounded-xl border-2 px-4 py-3 text-sm font-bold transition-all {posStore.paymentMethod ===
							'split'
								? 'border-brand-500 bg-brand-50 text-brand-700'
								: 'hover:border-brand-200 border-slate-200 text-slate-600'}"
						>
							Split
						</button>
					{/if}
				</div>
				{#if posStore.isOffline}
					<div class="mb-4 text-center text-xs font-bold text-red-500">
						QRIS/SPLIT tidak tersedia saat Offline
					</div>
				{/if}

				<div class="mt-4">
					{#if posStore.paymentMethod === 'cash'}
						<div class="animate-in slide-in-from-left-4 space-y-5 duration-300">
							<div>
								<label class="text-surface-600 dark:text-surface-400 mb-2 block text-sm font-medium"
									>Nominal Diterima</label
								>
								<div class="relative">
									<span
										class="text-surface-400 absolute top-1/2 left-5 -translate-y-1/2 text-xl font-bold"
										>Rp</span
									>
									<input
										type="number"
										bind:value={posStore.cashAmount}
										class="bg-surface-50 dark:bg-surface-900 border-surface-200 dark:border-surface-700 focus:ring-brand-500/20 focus:border-brand-500 w-full rounded-2xl border-2 py-4 pr-4 pl-14 text-2xl font-bold transition-all outline-none focus:ring-4"
									/>
								</div>
							</div>
							<div class="grid grid-cols-3 gap-2">
								<button
									class="bg-surface-100 dark:bg-surface-700 text-surface-700 hover:bg-surface-200 col-span-3 rounded-xl py-3 font-bold transition-colors"
									onclick={() => (posStore.cashAmount = posStore.cartTotal)}>Uang Pas</button
								>
								{#each [10000, 20000, 50000, 100000] as preset}
									<button
										class="bg-surface-50 border-surface-200 text-surface-600 hover:border-brand-500 hover:text-brand-600 rounded-xl border py-2.5 text-sm font-medium transition-colors"
										onclick={() => (posStore.cashAmount = preset)}
										>{posStore.formatRp(preset)}</button
									>
								{/each}
							</div>
							{#if posStore.cashAmount > 0}
								<div
									class="mt-2 rounded-2xl p-5 {posStore.cashChange >= 0
										? 'border border-green-200 bg-green-50 text-green-700'
										: 'border border-red-200 bg-red-50 text-red-700'} transition-all"
								>
									<p class="mb-1 text-sm font-medium opacity-80">
										{posStore.cashChange >= 0 ? 'Kembalian:' : 'Kurang:'}
									</p>
									<p class="text-3xl font-black">
										{posStore.formatRp(Math.abs(posStore.cashChange))}
									</p>
								</div>
							{/if}
						</div>
					{:else if posStore.paymentMethod === 'qris'}
						<div class="animate-in slide-in-from-right-4 flex flex-col items-center duration-300">
							<div class="bg-surface-50 border-brand-200 w-full rounded-2xl border p-4 text-center">
								<p class="text-surface-600 mb-2 font-medium">Total Pembayaran QRIS:</p>
								<p class="text-brand-600 text-3xl font-black">
									{posStore.formatRp(posStore.cartTotal)}
								</p>
								<p class="text-brand-600 mt-4 text-sm">Tekan KONFIRMASI BAYAR untuk membuat QRIS</p>
							</div>
						</div>
					{:else if posStore.paymentMethod === 'split'}
						<div class="animate-in slide-in-from-bottom-4 space-y-4 duration-300">
							<div>
								<label class="text-surface-600 mb-1 block text-sm font-medium"
									>Uang Tunai Diterima</label
								>
								<div class="relative">
									<span
										class="text-surface-400 absolute top-1/2 left-5 -translate-y-1/2 text-xl font-bold"
										>Rp</span
									>
									<input
										type="number"
										bind:value={posStore.splitCashAmount}
										class="bg-surface-50 border-surface-200 focus:ring-brand-500/20 focus:border-brand-500 w-full rounded-2xl border-2 py-4 pr-4 pl-14 text-2xl font-bold transition-all outline-none focus:ring-4"
									/>
								</div>
							</div>
							{#if posStore.splitQrisAmount > 0}
								<div class="bg-brand-50 border-brand-200 rounded-xl border p-4">
									<p class="text-brand-700 mb-1 text-sm font-medium">Sisa Pembayaran via QRIS</p>
									<p class="text-brand-700 text-2xl font-black">
										{posStore.formatRp(posStore.splitQrisAmount)}
									</p>
								</div>
							{:else if posStore.splitCashAmount >= posStore.cartTotal && posStore.cartTotal > 0}
								<div class="rounded-xl border border-green-200 bg-green-50 p-4">
									<p class="font-bold text-green-700">Uang tunai sudah mencukupi total bayar.</p>
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>

			<div class="border-surface-200 bg-surface-50 border-t p-5">
				<button
					class="flex h-15 w-full items-center justify-center gap-2 rounded-2xl text-lg font-bold {(posStore.paymentMethod ===
						'cash' &&
						posStore.cashChange < 0) ||
					(posStore.paymentMethod === 'split' && posStore.splitCashAmount >= posStore.cartTotal) ||
					posStore.isProcessing
						? 'bg-surface-200 text-surface-400 cursor-not-allowed'
						: 'glass-button'}"
					disabled={(posStore.paymentMethod === 'cash' && posStore.cashChange < 0) ||
						(posStore.paymentMethod === 'split' &&
							posStore.splitCashAmount >= posStore.cartTotal) ||
						posStore.isProcessing}
					onclick={() =>
						posService.processPayment(
							(data) =>
								posService.startQrisWaiting(data, () => {
									if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
									posService.cancelQrisWaiting();
									posStore.lastOrderDetails = posStore.qrisOrderInfo;
									posStore.showSuccessModal = true;
									setTimeout(() => {
										if (posStore.showSuccessModal) posStore.resetPos();
									}, 3000);
								}),
							(data) => {
								posStore.lastOrderDetails = data;
								posStore.showPaymentModal = false;
								posStore.showSuccessModal = true;
								if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
								setTimeout(() => {
									if (posStore.showSuccessModal) posStore.resetPos();
								}, 3000);
							}
						)}
				>
					{#if posStore.isProcessing}
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
{/if}

{#if posStore.isWaitingQris && posStore.qrisOrderInfo}
	<div
		class="bg-surface-900/90 fixed inset-0 z-80 flex items-center justify-center p-4 backdrop-blur-md"
		role="alertdialog"
		aria-modal="true"
		aria-labelledby="qris-title"
	>
		<div
			class="animate-in zoom-in-95 flex w-full max-w-sm flex-col overflow-hidden rounded-3xl bg-white text-center shadow-2xl duration-300"
			use:focusTrap
		>
			<div class="p-6 pb-4">
				<h2 id="qris-title" class="mb-2 text-xl font-bold">Menunggu Pembayaran</h2>
				<p class="text-surface-500 font-medium">
					#{posStore.qrisOrderInfo.client_uuid.split('-')[0].toUpperCase()}
				</p>
			</div>
			<div class="bg-surface-50 border-surface-200 border-y px-6 py-4">
				<div class="border-surface-200 mb-4 inline-block rounded-2xl border bg-white p-4 shadow-sm">
					<img
						src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data={encodeURIComponent(
							posStore.qrisOrderInfo.qr_string || ''
						)}"
						alt="QRIS"
						class="h-48 w-48"
					/>
				</div>
				<p class="text-brand-600 mb-1 text-3xl font-black">
					{posStore.formatRp(posStore.qrisOrderInfo.final_price || posStore.cartTotal)}
				</p>
				<div class="animate-pulse font-mono text-xl font-bold text-red-500">
					Sisa Waktu: {formatTime(posStore.qrisCountdown)}
				</div>
			</div>
			<div class="p-6">
				<button
					class="border-surface-300 text-surface-600 hover:bg-surface-100 w-full rounded-xl border-2 py-3 font-bold"
					onclick={() => {
						posService.cancelQrisWaiting();
						posStore.resetCart();
					}}>BATALKAN TRANSAKSI</button
				>
			</div>
		</div>
	</div>
{/if}

{#if posStore.showSuccessModal && posStore.lastOrderDetails}
	<div
		class="bg-surface-900/80 fixed inset-0 z-70 flex items-center justify-center p-4 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="success-title"
	>
		<div
			class="animate-in zoom-in-95 flex w-full max-w-sm flex-col overflow-hidden rounded-3xl border-4 border-green-500 bg-white text-center shadow-2xl"
			use:focusTrap
		>
			<div class="flex flex-col items-center p-8 pt-10 pb-6">
				<div
					class="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-600 shadow-inner"
				>
					<svg class="h-10 w-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="3"
							d="M5 13l4 4L19 7"
						></path></svg
					>
				</div>
				<h2
					id="success-title"
					class="text-surface-800 dark:text-surface-100 mb-2 text-2xl font-black"
				>
					Transaksi Berhasil!
				</h2>
				<p class="font-medium text-slate-500">
					#{posStore.lastOrderDetails.client_uuid.split('-')[0].toUpperCase()}
				</p>
			</div>
			<div class="space-y-3 border-t border-slate-100 bg-slate-50 p-6">
				<button
					class="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-indigo-600 py-4 font-bold text-indigo-600 hover:bg-indigo-50"
					onclick={() => posStore.lastOrderDetails && printReceipt(posStore.lastOrderDetails)}
					>CETAK STRUK</button
				>
				<button
					class="bg-brand-600 hover:bg-brand-700 w-full rounded-xl py-4 font-black text-white shadow-lg"
					onclick={() => posStore.resetPos()}>SELESAI & ORDER BARU</button
				>
			</div>
		</div>
	</div>
{/if}

{#if posStore.showHistoryModal}
	<div
		class="bg-surface-900/80 fixed inset-0 z-70 flex items-end justify-center backdrop-blur-sm md:items-center md:p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="history-title"
	>
		<div
			class="animate-in slide-in-from-bottom-full md:zoom-in-95 pb-safe flex h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl md:h-[70vh] md:rounded-3xl"
			use:focusTrap
		>
			<div class="border-surface-200 bg-surface-50 flex items-center justify-between border-b p-5">
				<h2 id="history-title" class="text-xl font-bold">Riwayat Transaksi</h2>
				<button
					type="button"
					class="bg-surface-200 text-surface-500 flex h-10 w-10 items-center justify-center rounded-full"
					onclick={() => (posStore.showHistoryModal = false)}
					data-modal-close
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						></path></svg
					>
				</button>
			</div>
			<div class="flex-1 overflow-y-auto bg-slate-50 p-4">
				{#if posStore.historyOrders.length === 0}
					<div class="flex h-full flex-col items-center justify-center text-slate-400">
						<p>Belum ada transaksi hari ini.</p>
					</div>
				{:else}
					<div class="space-y-4">
						{#each posStore.historyOrders as order}
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
										{posStore.formatRp(order.final_price)}
									</p>
									<button
										class="mt-2 text-sm font-bold text-indigo-600 hover:underline"
										onclick={() => printReceipt(order)}>Cetak Ulang</button
									>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	</div>
{/if}
