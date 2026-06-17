<script lang="ts">
	import { api } from '$lib/services/api.client';
	import { format_rp } from '$lib/utils/format';
	import { onMount } from 'svelte';

	let shift_data: any = $state(null);
	let error: string = $state('');

	onMount(async () => {
		try {
			// Endpoint sesuai PRD v5.0 - laporan shift
			const res = await api.request(`/cash/shift-summary`, {
				credentials: 'include'
			});
			if (res.ok) {
				const json = await res.json();
				if (json.success) {
					shift_data = json.data;
				} else {
					error = json.message || 'Gagal mengambil data shift.';
				}
			} else if (res.status === 401) {
				window.location.href = '/login';
			}
		} catch (e) {
			error = 'Gagal terhubung ke server.';
		}
	});
</script>

<div class="bg-surface-100 flex min-h-screen flex-col items-center p-8">
	<div class="flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-xl">
		<div class="border-surface-200 bg-surface-50 border-b p-8">
			<div class="flex items-center justify-between">
				<h1 class="text-surface-900 text-2xl font-bold">Laporan Kasir Hari Ini</h1>
				<a
					href="/pos"
					class="bg-brand-500 hover:bg-brand-600 rounded-full px-4 py-2 font-medium text-white transition-colors"
					>Kembali ke POS</a
				>
			</div>
		</div>

		<div class="p-8">
			{#if error}
				<p class="text-red-500">{error}</p>
			{:else if !shift_data}
				<p class="text-surface-500 animate-pulse">Memuat laporan...</p>
			{:else}
				<div class="mb-8 grid grid-cols-2 gap-6">
					<div class="bg-surface-50 border-surface-200 rounded-2xl border p-6">
						<p class="text-surface-500 mb-1 font-medium">Total Pesanan</p>
						<p class="text-brand-600 text-3xl font-black">{shift_data.total_orders}</p>
					</div>
					<div class="bg-surface-50 border-surface-200 rounded-2xl border p-6">
						<p class="text-surface-500 mb-1 font-medium">Pendapatan Kotor</p>
						<p class="text-brand-600 text-3xl font-black">{format_rp(shift_data.grand_total)}</p>
					</div>
				</div>

				<h3 class="mb-4 text-lg font-bold">Rincian Pembayaran</h3>
				<div class="space-y-4">
					<div
						class="border-surface-200 flex items-center justify-between rounded-xl border bg-white p-4 shadow-sm"
					>
						<div class="flex items-center gap-3">
							<div
								class="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 text-green-600"
							>
								<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"
									><path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
									></path></svg
								>
							</div>
							<span class="text-surface-800 font-bold">Tunai (Cash)</span>
						</div>
						<span class="text-xl font-bold">{format_rp(shift_data.total_cash)}</span>
					</div>

					<div
						class="border-surface-200 flex items-center justify-between rounded-xl border bg-white p-4 shadow-sm"
					>
						<div class="flex items-center gap-3">
							<div
								class="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600"
							>
								<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"
									><path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
									></path></svg
								>
							</div>
							<span class="text-surface-800 font-bold">QRIS Midtrans</span>
						</div>
						<span class="text-xl font-bold">{format_rp(shift_data.total_qris)}</span>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
