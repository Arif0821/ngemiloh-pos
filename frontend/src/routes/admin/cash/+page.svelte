<script lang="ts">
	import { api } from '$lib/services/api.client';
	import { onMount } from 'svelte';

	import type { ShiftInfo } from '$lib/domain/models/types';
	let shifts: ShiftInfo[] = $state([]);
	let isLoading = $state(false);

	function formatRp(amount: number) {
		if (amount == null) return '-';
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			minimumFractionDigits: 0
		}).format(amount);
	}

	function formatDate(iso: string | undefined) {
		if (!iso) return '-';
		return new Date(iso).toLocaleString('id-ID');
	}

	async function fetchShifts() {
		isLoading = true;
		try {
			const res = await api.request(`/api/v1/admin/cash/shifts`, { credentials: 'include' });
			if (res.ok) {
				const json = await res.json();
				shifts = json.data;
			}
		} catch (e) {
			console.error(e);
		} finally {
			isLoading = false;
		}
	}

	function exportCSV() {
		if (!shifts || shifts.length === 0) return;
		const header =
			'Shift Date,Kasir,Mulai Shift,Tutup Shift,Kas Awal,Penjualan Tunai Sistem,Kas Akhir Fisik,Selisih (Discrepancy),Status\n';

		let csv = header;
		for (const s of shifts) {
			const date = new Date(s.shift_date).toLocaleDateString('id-ID');
			const name = s.cashier?.name || 'Unknown';
			const start = formatDate(s.shift_start);
			const end = formatDate(s.shift_end);
			const op = s.opening_balance;
			const sys = s.system_cash_total || 0;
			const cl = s.closing_balance || 0;
			const disc = s.discrepancy || 0;
			const stat = s.status;
			csv += `${date},${name},${start},${end},${op},${sys},${cl},${disc},${stat}\n`;
		}

		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `CashRegister_Report.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	onMount(() => {
		fetchShifts();
	});
</script>

<div class="space-y-6 p-6">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-black text-slate-800 dark:text-slate-100">Cash Register & Shift</h1>
			<p class="text-slate-500">Laporan pertanggungjawaban laci kas harian per kasir.</p>
		</div>
		<div class="flex gap-2">
			<button
				onclick={exportCSV}
				class="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white shadow hover:bg-emerald-700"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
					></path></svg
				>
				Export CSV
			</button>
		</div>
	</div>

	<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
		<div class="overflow-x-auto">
			<table class="w-full text-left text-sm text-slate-600">
				<thead class="border-b border-slate-200 bg-slate-50 font-bold text-slate-700">
					<tr>
						<th class="px-4 py-4">Tanggal Shift</th>
						<th class="px-4 py-4">Nama Kasir</th>
						<th class="px-4 py-4">Waktu Buka / Tutup</th>
						<th class="px-4 py-4 text-right">Kas Awal</th>
						<th class="px-4 py-4 text-right">Penjualan Tunai</th>
						<th class="px-4 py-4 text-right">Kas Akhir Laci</th>
						<th class="px-4 py-4 text-right">Selisih</th>
						<th class="px-4 py-4 text-center">Status</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-200">
					{#if isLoading}
						<tr><td colspan="8" class="py-10 text-center text-slate-500">Loading...</td></tr>
					{:else if shifts.length === 0}
						<tr
							><td colspan="8" class="py-10 text-center text-slate-500">Belum ada riwayat shift.</td
							></tr
						>
					{:else}
						{#each shifts as shift}
							<tr class="hover:bg-slate-50">
								<td class="px-4 py-3">{new Date(shift.shift_date).toLocaleDateString('id-ID')}</td>
								<td class="px-4 py-3 font-bold text-slate-800">{shift.cashier?.name}</td>
								<td class="px-4 py-3 text-xs">
									<div class="text-green-600">Buka: {formatDate(shift.shift_start)}</div>
									<div class="text-red-600">Tutup: {formatDate(shift.shift_end)}</div>
								</td>
								<td class="px-4 py-3 text-right">{formatRp(Number(shift.opening_balance))}</td>
								<td class="px-4 py-3 text-right"
									>{shift.system_cash_total
										? formatRp(Number(shift.system_cash_total) - Number(shift.opening_balance))
										: '-'}</td
								>
								<td class="px-4 py-3 text-right font-bold text-slate-800"
									>{formatRp(Number(shift.closing_balance))}</td
								>
								<td
									class="px-4 py-3 text-right font-bold {Number(shift.discrepancy) < 0
										? 'text-red-600'
										: 'text-slate-600'}"
								>
									{formatRp(Number(shift.discrepancy))}
								</td>
								<td class="px-4 py-3 text-center">
									{#if shift.status === 'open'}
										<span
											class="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-700 uppercase"
											>Open</span
										>
									{:else}
										<span
											class="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-700 uppercase"
											>Closed</span
										>
									{/if}
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>
	</div>
</div>
