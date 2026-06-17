<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { api } from '$lib/services/api.client';
	import type { OrderResponse } from '$lib/domain/models/types';
	import { format_rp } from '$lib/utils/format';

	let order = $state<OrderResponse | null>(null);
	let store_info = $state({ store_name: 'Ngemiloh', store_whatsapp: '' });
	let receipt_type = $state<'pelanggan' | 'dapur'>('pelanggan');
	let paper_size = $state<'58mm' | '80mm'>('80mm');

	onMount(async () => {
		const stored = sessionStorage.getItem('print_order');
		if (!stored) {
			goto('/pos');
			return;
		}
		try {
			order = JSON.parse(stored);
		} catch {
			goto('/pos');
		}

		// Ambil info toko untuk struk
		try {
			const res = await api.get('/store-info');
			if (res.ok) {
				const json = await res.json();
				if (json.success && json.data) {
					store_info = json.data;
				}
			}
		} catch {
			// fallback: pakai default
		}
	});

	function format_date(dateStr?: string) {
		if (!dateStr)
			return new Date().toLocaleString('id-ID', {
				day: '2-digit',
				month: 'short',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit'
			});
		return new Date(dateStr).toLocaleString('id-ID', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function handlePrint() {
		window.print();
	}

	function handleClose() {
		sessionStorage.removeItem('print_order');
		goto('/pos');
	}

	function get_short_id(uuid: string) {
		return uuid.split('-')[0].toUpperCase();
	}

	function getChange(payment: OrderResponse) {
		const cash = Number(payment.cash_amount || 0);
		const final = Number(payment.final_price || 0);
		return cash - final;
	}
</script>

<svelte:head>
	<title>Cetak Struk - Ngemiloh POS</title>
</svelte:head>

<!-- Controls (hidden when printing) -->
<div
	class="no-print fixed top-4 right-4 z-50 flex flex-col gap-2 rounded-xl border bg-white p-3 shadow-xl"
>
	<div class="flex flex-col gap-1 text-xs font-bold text-slate-500">
		<span>JENIS STRUK</span>
		<div class="flex gap-1">
			<button
				class="rounded px-3 py-1.5 text-xs font-bold transition-colors {receipt_type === 'pelanggan'
					? 'bg-indigo-600 text-white'
					: 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
				onclick={() => (receipt_type = 'pelanggan')}
			>
				PELANGGAN
			</button>
			<button
				class="rounded px-3 py-1.5 text-xs font-bold transition-colors {receipt_type === 'dapur'
					? 'bg-indigo-600 text-white'
					: 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
				onclick={() => (receipt_type = 'dapur')}
			>
				DAPUR
			</button>
		</div>
	</div>
	<div class="flex flex-col gap-1 text-xs font-bold text-slate-500">
		<span>UKURAN KERTAS</span>
		<div class="flex gap-1">
			<button
				class="rounded px-3 py-1.5 text-xs font-bold transition-colors {paper_size === '58mm'
					? 'bg-indigo-600 text-white'
					: 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
				onclick={() => (paper_size = '58mm')}
			>
				58mm
			</button>
			<button
				class="rounded px-3 py-1.5 text-xs font-bold transition-colors {paper_size === '80mm'
					? 'bg-indigo-600 text-white'
					: 'bg-slate-100 text-slate-600 hover:bg-slate-200'}"
				onclick={() => (paper_size = '80mm')}
			>
				80mm
			</button>
		</div>
	</div>
	<button
		class="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-green-700"
		onclick={handlePrint}
	>
		PRINT / CETAK
	</button>
	<button
		class="rounded-xl bg-slate-200 px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-300"
		onclick={handleClose}
	>
		KEMBALI
	</button>
</div>

<!-- Printable receipt -->
<div class="flex min-h-screen items-start justify-center bg-slate-100 p-4 pt-20">
	{#if order}
		<div
			id="printable-receipt"
			class="receipt bg-white {paper_size === '58mm'
				? 'w-[58mm]'
				: 'w-[80mm]'} px-1 py-3 text-center font-mono text-[9px] leading-tight whitespace-pre-wrap"
		>
			<!-- ========== STRUK PELANGGAN ========== -->
			{#if receipt_type === 'pelanggan'}
				<div class="mb-1 border-b border-dashed border-slate-400 pb-1">
					<div class="text-[11px] font-bold uppercase">{store_info.store_name || 'Ngemiloh'}</div>
					<div class="text-[8px] text-slate-500">Toko Snack & Camilan</div>
					<div class="text-[8px] text-slate-500">Terima Kasih</div>
				</div>

				<!-- Info transaksi -->
				<div class="mb-1 border-b border-dashed border-slate-400 pb-1 text-[8px] text-slate-700">
					<div>ID: #{get_short_id(order.client_uuid)}</div>
					<div>Tanggal: {format_date(order.client_created_at || order.created_at)}</div>
					{#if order.cashier}
						<div>Kasir: {order.cashier.name}</div>
					{/if}
				</div>

				<!-- Item -->
				<div class="mb-1 border-b border-dashed border-slate-400 pb-1 text-left">
					{#if order.items}
						{#each order.items as item}
							<div class="flex justify-between">
								<span class="text-[9px]"
									>{item.product_name_snapshot || 'Produk'} x{item.quantity}</span
								>
								<span class="text-[9px]">{format_rp(item.subtotal)}</span>
							</div>
							{#if item.modifiers && item.modifiers.length > 0}
								{#each item.modifiers as mod}
									<div class="flex justify-between pl-2 text-[8px] text-slate-500">
										<span>{mod.option_name_snapshot || mod.name}</span>
										{#if mod.additional_price_at_time}
											<span>+{format_rp(mod.additional_price_at_time)}</span>
										{/if}
									</div>
								{/each}
							{/if}
						{/each}
					{/if}
				</div>

				<!-- Rincian harga -->
				<div class="mb-1 border-b border-dashed border-slate-400 pb-1 text-left text-[9px]">
					{#if order.subtotal}
						<div class="flex justify-between">
							<span>Subtotal</span>
							<span>{format_rp(order.subtotal)}</span>
						</div>
					{:else}
						<div class="flex justify-between">
							<span>Subtotal</span>
							<span
								>{format_rp(Number(order.total_amount) + Number(order.discount_total || 0))}</span
							>
						</div>
					{/if}
					{#if order.discount_total}
						<div class="flex justify-between text-green-600">
							<span>Diskon</span>
							<span>-{format_rp(order.discount_total)}</span>
						</div>
					{/if}
					<div class="flex justify-between text-[10px] font-bold">
						<span>TOTAL</span>
						<span>{format_rp(order.final_price)}</span>
					</div>
				</div>

				<!-- Pembayaran -->
				<div
					class="mb-1 border-b border-dashed border-slate-400 pb-1 text-left text-[8px] text-slate-700"
				>
					<div class="flex justify-between">
						<span>Metode</span>
						<span class="uppercase">{order.payment_method || 'cash'}</span>
					</div>
					{#if order.payment_method !== 'qris' && order.cash_amount}
						<div class="flex justify-between">
							<span>Bayar</span>
							<span>{format_rp(order.cash_amount)}</span>
						</div>
						<div class="flex justify-between">
							<span>Kembalian</span>
							<span>{format_rp(getChange(order))}</span>
						</div>
					{/if}
					{#if order.payment_status}
						<div class="flex justify-between">
							<span>Status</span>
							<span class="uppercase">{order.payment_status}</span>
						</div>
					{/if}
				</div>

				<!-- Footer -->
				<div class="text-[8px] text-slate-500">
					<div>========================</div>
					<div>Terima Kasih</div>
					<div>Atas Kunjungan Anda</div>
					{#if store_info.store_whatsapp}
						<div class="mt-1">WA: {store_info.store_whatsapp}</div>
					{/if}
					<div>========================</div>
				</div>

				<!-- ========== STRUK DAPUR ========== -->
			{:else}
				<div class="mb-1 border-b border-dashed border-slate-400 pb-1">
					<div class="text-[11px] font-black uppercase">=== ORDER DAPUR ===</div>
					<div class="text-[8px] text-slate-500">
						{format_date(order.client_created_at || order.created_at)}
					</div>
				</div>

				<!-- ID Box -->
				<div class="my-2 rounded border-2 border-dashed border-slate-400 p-1">
					<div class="text-[8px] text-slate-500">ORDER</div>
					<div class="text-[13px] font-black">#{get_short_id(order.client_uuid)}</div>
				</div>

				<!-- Item (tanpa harga) -->
				<div class="mb-1 border-b border-dashed border-slate-400 pb-1 text-left">
					{#if order.items}
						{#each order.items as item}
							<div class="flex items-center gap-1">
								<span class="text-[11px] font-black">x{item.quantity}</span>
								<span class="text-[10px] font-bold">{item.product_name_snapshot || 'Produk'}</span>
							</div>
							{#if item.modifiers && item.modifiers.length > 0}
								{#each item.modifiers as mod}
									<div class="pl-4 text-[9px] text-slate-600">
										- {mod.option_name_snapshot || mod.name}
									</div>
								{/each}
							{/if}
						{/each}
					{/if}
				</div>

				<!-- Footer -->
				<div class="text-[9px] font-bold text-slate-600">
					<div>===== AKHIR PESANAN =====</div>
				</div>
			{/if}
		</div>
	{:else}
		<div class="rounded-xl bg-white p-8 text-center shadow">
			<p class="text-slate-500">Memuat data struk...</p>
		</div>
	{/if}
</div>

<style>
	@media print {
		.no-print {
			display: none !important;
		}

		#printable-receipt {
			background: white !important;
			box-shadow: none !important;
			margin: 0 !important;
			padding: 0 !important;
			min-height: unset !important;
		}
	}

	:global(:root) {
		--receipt-width: 80mm;
	}

	/* 58mm constraints */
	:global(.receipt.w-\[58mm\]) {
		max-width: 58mm !important;
		font-size: 8px !important;
	}

	/* 80mm constraints */
	:global(.receipt.w-\[80mm\]) {
		max-width: 80mm !important;
		font-size: 9px !important;
	}
</style>
