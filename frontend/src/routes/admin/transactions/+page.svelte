<script lang="ts">
	import { api } from '$lib/services/api.client';
	import { toast } from '$lib/stores/toast.store.svelte';
	import { onMount } from 'svelte';
	import { format_rp } from '$lib/utils/format';
	import type { OrderResponse } from '$lib/domain/models/types';

	let orders = $state<OrderResponse[]>([]);
	let is_loading = $state(true);

	let selected_order = $state<OrderResponse | null>(null);
	let show_detail_modal = $state(false);
	let show_void_modal = $state(false);
	let void_reason = $state('');

	let filter_date = $state(new Date().toISOString().split('T')[0]);
	let filter_status = $state('');
	let filter_method = $state('');

	let current_page = $state(1);
	let total_items = $state(0);
	let total_pages = $derived(Math.ceil(total_items / 50));

	async function fetch_orders() {
		is_loading = true;
		try {
			const hostname = window.location.hostname;
			// Note: Ideally the backend has filters query params. For MVP we'll fetch all and filter in client if needed, or better, pass query params.
			// Let's assume the Orders controller has basic fetch with query params.
			let url = `/orders?date=${filter_date}&page=${current_page}`;
			if (filter_status) url += `&status=${filter_status}`;
			if (filter_method) url += `&method=${filter_method}`;

			const res = await api.request(url, { credentials: 'include' });
			if (res.ok) {
				const data = await res.json();
				if (Array.isArray(data.data)) {
					orders = data.data;
					total_items = data.total || data.data.length;
				} else {
					orders = [];
					total_items = 0;
				}
			}
		} catch (e) {
			console.error(e);
		} finally {
			is_loading = false;
		}
	}

	onMount(() => {
		fetch_orders();
	});

	async function handle_void(e: Event) {
		e.preventDefault();
		if (void_reason.length < 10) {
			toast.warning('Alasan void minimal 10 karakter');
			return;
		}
		if (!selected_order) return;

		try {
			const res = await api.request(`/admin/transactions/${selected_order.id}/void`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ reason: void_reason })
			});
			if (res.ok) {
				show_void_modal = false;
				show_detail_modal = false;
				toast.success('Transaksi berhasil dibatalkan (void)');
				fetch_orders();
			} else {
				toast.error('Gagal void transaksi');
			}
		} catch (e) {
			toast.error('Gagal void transaksi. Cek koneksi Anda.');
		}
	}

	async function flag_transaction(status: string) {
		if (!selected_order) return;
		try {
			const res = await api.request(`/admin/transactions/${selected_order.id}/flag`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ status })
			});

			if (res.ok) {
				toast.success('Transaksi berhasil ditandai');
				show_detail_modal = false;
				fetch_orders();
			} else {
				toast.error('Gagal menandai transaksi');
			}
		} catch (e) {
			toast.error('Gagal menandai transaksi. Cek koneksi Anda.');
		}
	}
</script>

<svelte:head>
	<title>Transaksi - Ngemiloh Admin</title>
</svelte:head>

<div class="h-full overflow-y-auto p-8">
	<div class="mx-auto max-w-7xl space-y-8">
		<header class="flex items-end justify-between">
			<div>
				<h1 class="text-3xl font-bold tracking-tight text-slate-900">Riwayat Transaksi</h1>
				<p class="mt-2 text-slate-500">Pantau seluruh transaksi, detail pembayaran, dan void.</p>
			</div>
			<div class="flex gap-4">
				<input
					type="date"
					bind:value={filter_date}
					onchange={fetch_orders}
					class="rounded-lg border border-slate-300 bg-white px-4 py-2 shadow-sm"
				/>
				<select
					bind:value={filter_status}
					onchange={fetch_orders}
					class="rounded-lg border border-slate-300 bg-white px-4 py-2 shadow-sm"
				>
					<option value="">Semua Status</option>
					<option value="completed">Selesai</option>
					<option value="voided">Void / Dibatalkan</option>
					<option value="pending_sync">Pending Sync</option>
				</select>
				<select
					bind:value={filter_method}
					onchange={fetch_orders}
					class="rounded-lg border border-slate-300 bg-white px-4 py-2 shadow-sm"
				>
					<option value="">Semua Metode</option>
					<option value="cash">Tunai</option>
					<option value="qris">QRIS</option>
					<option value="split">Split Payment</option>
				</select>
			</div>
		</header>

		<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			{#if is_loading}
				<div class="flex justify-center p-12">
					<div
						class="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-indigo-500"
					></div>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-slate-200">
						<thead class="bg-slate-50">
							<tr>
								<th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase"
									>Waktu</th
								>
								<th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase"
									>Kasir</th
								>
								<th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase"
									>Metode</th
								>
								<th class="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase"
									>Total (Rp)</th
								>
								<th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase"
									>Status</th
								>
								<th class="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase"
									>Aksi</th
								>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-200 bg-white">
							{#if orders.length === 0}
								<tr>
									<td colspan="6" class="px-6 py-8 text-center text-slate-500"
										>Tidak ada transaksi yang ditemukan.</td
									>
								</tr>
							{:else}
								{#each orders as order}
									<tr
										class="transition-colors hover:bg-slate-50 {order.status === 'voided'
											? 'bg-red-50/50 opacity-75'
											: ''}"
									>
										<td class="px-6 py-4 text-sm whitespace-nowrap text-slate-600">
											{new Date(
												order.client_created_at ?? order.created_at ?? Date.now()
											).toLocaleString('id-ID')}
										</td>
										<td class="px-6 py-4 text-sm font-medium whitespace-nowrap text-slate-900">
											{order.cashier?.name || 'Kasir'}
										</td>
										<td class="px-6 py-4 whitespace-nowrap">
											{#if order.payment_method === 'cash'}
												<span
													class="rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800"
													>TUNAI</span
												>
											{:else if order.payment_method === 'qris'}
												<span
													class="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800"
													>QRIS</span
												>
											{:else}
												<span
													class="rounded-full bg-purple-100 px-2.5 py-1 text-xs font-bold text-purple-800"
													>SPLIT</span
												>
											{/if}
										</td>
										<td
											class="px-6 py-4 text-right text-sm font-bold whitespace-nowrap text-slate-900"
										>
											{format_rp(Number(order.total_amount))}
										</td>
										<td class="px-6 py-4 whitespace-nowrap">
											{#if order.status === 'completed'}
												<span class="flex items-center text-xs font-medium text-emerald-600"
													><span class="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500"
													></span>Selesai</span
												>
											{:else if order.status === 'voided'}
												<span class="flex items-center text-xs font-medium text-red-600"
													><span class="mr-1.5 h-1.5 w-1.5 rounded-full bg-red-500"
													></span>Voided</span
												>
											{:else}
												<span class="flex items-center text-xs font-medium text-yellow-600"
													><span class="mr-1.5 h-1.5 w-1.5 rounded-full bg-yellow-500"
													></span>Pending</span
												>
											{/if}
										</td>
										<td class="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
											<button
												onclick={() => {
													selected_order = order;
													show_detail_modal = true;
												}}
												class="rounded-lg bg-indigo-50 px-3 py-1 font-bold text-indigo-600 hover:text-indigo-900"
											>
												Detail
											</button>
										</td>
									</tr>
								{/each}
							{/if}
						</tbody>
					</table>
				</div>

				<!-- Pagination Controls -->
				<div
					class="flex items-center justify-between border-t border-slate-200 bg-slate-50 p-4 text-sm"
				>
					<p class="text-slate-600">Total: <strong>{total_items}</strong> transaksi</p>
					<div class="flex gap-2">
						<button
							disabled={current_page === 1}
							onclick={() => {
								current_page--;
								fetch_orders();
							}}
							class="rounded border border-slate-300 bg-white px-3 py-1 hover:bg-slate-100 disabled:opacity-50"
						>
							Prev
						</button>
						<span class="px-3 py-1 font-medium text-slate-700"
							>Halaman {current_page} dari {total_pages || 1}</span
						>
						<button
							disabled={current_page >= total_pages}
							onclick={() => {
								current_page++;
								fetch_orders();
							}}
							class="rounded border border-slate-300 bg-white px-3 py-1 hover:bg-slate-100 disabled:opacity-50"
						>
							Next
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>

<!-- Modal Detail Transaksi -->
{#if show_detail_modal && selected_order}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4">
		<div
			class="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
		>
			<div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-6">
				<h3 class="text-xl font-bold text-slate-800">
					Detail Transaksi <span class="ml-2 text-sm font-normal text-slate-500"
						>#{selected_order.id.split('-')[0]}</span
					>
				</h3>
				<button
					onclick={() => (show_detail_modal = false)}
					class="text-slate-400 hover:text-slate-600">X</button
				>
			</div>

			<div class="flex-1 overflow-y-auto bg-white p-6">
				<div class="mb-8 grid grid-cols-2 gap-4">
					<div>
						<p class="mb-1 text-xs tracking-wider text-slate-500 uppercase">Kasir</p>
						<p class="font-bold text-slate-900">{selected_order.cashier?.name || 'Kasir'}</p>
					</div>
					<div>
						<p class="mb-1 text-xs tracking-wider text-slate-500 uppercase">Waktu</p>
						<p class="font-bold text-slate-900">
							{new Date(
								selected_order.client_created_at ?? selected_order.created_at ?? Date.now()
							).toLocaleString('id-ID')}
						</p>
					</div>
					<div>
						<p class="mb-1 text-xs tracking-wider text-slate-500 uppercase">Metode Pembayaran</p>
						<p class="font-bold text-slate-900 uppercase">{selected_order.payment_method}</p>
					</div>
					<div>
						<p class="mb-1 text-xs tracking-wider text-slate-500 uppercase">Status</p>
						<p
							class="font-bold {selected_order.status === 'completed'
								? 'text-emerald-600'
								: 'text-red-600'} uppercase"
						>
							{selected_order.status}
						</p>
					</div>
				</div>

				{#if selected_order.status === 'voided'}
					<div class="mb-8 rounded-xl border border-red-200 bg-red-50 p-4">
						<p class="mb-1 text-xs font-bold text-red-600 uppercase">Alasan Void:</p>
						<p class="text-red-800">{selected_order.void_reason || 'Tidak ada alasan'}</p>
						<p class="mt-2 text-xs text-red-500">
							Dibatalkan oleh: {selected_order.voider || 'Superadmin'}
						</p>
					</div>
				{/if}

				{#if selected_order.payment_method === 'qris'}
					<div
						class="mb-8 flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50 p-4"
					>
						<div class="flex-1">
							<p class="mb-1 text-xs font-bold text-blue-600 uppercase">Status Verifikasi QRIS:</p>
							<p class="font-bold text-blue-900">
								{selected_order.verification_status || 'Belum Dicek'}
							</p>
							<p class="mt-2 text-xs text-blue-700">
								Pastikan mutasi masuk ke rekening sejumlah <strong
									>{format_rp(
										Number(selected_order.qris_amount || selected_order.total_amount)
									)}</strong
								>
								dengan referensi pesanan
								<strong>{selected_order.client_uuid || selected_order.id}</strong>.
							</p>
						</div>
						{#if selected_order.status !== 'voided'}
							<div class="flex gap-2">
								<button
									onclick={() => flag_transaction('Perlu Cek')}
									class="rounded border border-yellow-300 bg-yellow-100 px-3 py-1 text-sm font-bold text-yellow-700 hover:bg-yellow-200"
									>Tandai Perlu Cek</button
								>
								<button
									onclick={() => flag_transaction('Valid')}
									class="rounded border border-emerald-300 bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700 hover:bg-emerald-200"
									>Tandai Valid</button
								>
							</div>
						{/if}
					</div>
				{/if}

				<div class="mb-6 overflow-hidden rounded-xl border border-slate-200">
					<table class="min-w-full divide-y divide-slate-200">
						<thead class="bg-slate-50">
							<tr>
								<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase"
									>Item</th
								>
								<th class="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase"
									>Qty</th
								>
								<th class="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase"
									>Subtotal</th
								>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-200 bg-white">
							{#if selected_order.items}
								{#each selected_order.items as item}
									<tr>
										<td class="px-4 py-3">
											<p class="font-bold text-slate-800">{item.product_name_snapshot}</p>
											{#if item.modifiers && item.modifiers.length > 0}
												<ul class="mt-1 space-y-0.5 text-xs text-slate-500">
													{#each item.modifiers as mod}
														<li>
															+ {mod.option_name_snapshot} ({format_rp(
																Number(mod.additional_price_at_time)
															)})
														</li>
													{/each}
												</ul>
											{/if}
										</td>
										<td class="px-4 py-3 text-center font-bold text-slate-700">{item.quantity}</td>
										<td class="px-4 py-3 text-right font-bold text-slate-900"
											>{format_rp(Number(item.subtotal))}</td
										>
									</tr>
								{/each}
							{:else}
								<tr
									><td colspan="3" class="px-4 py-3 text-center text-sm text-slate-500"
										>Tidak ada detail item</td
									></tr
								>
							{/if}
						</tbody>
					</table>
				</div>

				<div class="flex justify-end">
					<div class="w-64 space-y-2">
						{#if Number(selected_order.discount_total) > 0}
							<div class="flex justify-between text-sm font-medium text-red-500">
								<span>Diskon</span>
								<span>- {format_rp(Number(selected_order.discount_total))}</span>
							</div>
						{/if}
						<div
							class="flex items-center justify-between border-t border-slate-200 pt-2 text-lg font-black text-slate-900"
						>
							<span>Total Akhir</span>
							<span>{format_rp(Number(selected_order.total_amount))}</span>
						</div>
					</div>
				</div>
			</div>

			<div class="flex items-center justify-between border-t border-slate-200 bg-slate-50 p-4">
				<button
					onclick={() => (show_detail_modal = false)}
					class="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-white"
					>Tutup</button
				>
				{#if selected_order.status === 'completed'}
					<button
						onclick={() => (show_void_modal = true)}
						class="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-bold text-white shadow-sm hover:bg-red-700"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
							></path></svg
						>
						Void Transaksi
					</button>
				{/if}
			</div>
		</div>
	</div>
{/if}

<!-- Modal Void Transaksi -->
{#if show_void_modal}
	<div class="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/75 p-4">
		<div
			class="w-full max-w-sm overflow-hidden rounded-2xl border-2 border-red-500 bg-white shadow-xl"
		>
			<div class="border-b border-red-100 bg-red-50 p-6">
				<h3 class="flex items-center gap-2 text-lg font-bold text-red-800">
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
						></path></svg
					>
					Peringatan Void
				</h3>
			</div>
			<form onsubmit={handle_void} class="space-y-4 p-6">
				<p class="mb-4 text-sm text-slate-600">
					Membatalkan (Void) transaksi ini tidak dapat diurungkan. Stok tidak otomatis kembali dan
					data laporan akan berubah.
				</p>
				{#if selected_order && (selected_order.payment_method === 'qris' || selected_order.payment_method === 'split')}
					<div class="rounded-lg border border-red-200 bg-red-50 p-3">
						<p class="text-sm font-bold text-red-700">Instruksi Void Non-Tunai:</p>
						<p class="text-sm text-red-600">
							Kembalikan dana ke pelanggan secara manual tunai dari kas.
						</p>
					</div>
				{/if}
				<div>
					<label for="void-reason" class="mb-1 block text-sm font-bold text-slate-700"
						>Alasan Void <span class="text-red-500">*</span></label
					>
					<textarea
						id="void-reason"
						bind:value={void_reason}
						required
						minlength="10"
						rows="3"
						class="w-full rounded-lg border-slate-300 p-3 focus:border-red-500 focus:ring-red-500"
						placeholder="Minimal 10 karakter..."
					></textarea>
				</div>
				<div class="flex gap-3 pt-2">
					<button
						type="button"
						onclick={() => (show_void_modal = false)}
						class="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2.5 font-medium text-slate-700 hover:bg-slate-50"
						>Batal</button
					>
					<button
						type="submit"
						class="flex-1 rounded-lg bg-red-600 px-4 py-2.5 font-bold text-white shadow-sm hover:bg-red-700"
						>VOID Sekarang</button
					>
				</div>
			</form>
		</div>
	</div>
{/if}
