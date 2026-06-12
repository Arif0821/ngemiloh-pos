<script lang="ts">
	import { api } from '$lib/services/api.client';
	let month = $state(new Date().getMonth() + 1);
	let year = $state(new Date().getFullYear());
	import type { ProfitShareData } from '$lib/domain/models/types';
	let profitShareData: ProfitShareData | null = $state(null);
	let isLoading = $state(false);

	function formatRp(amount: number) {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			minimumFractionDigits: 0
		}).format(amount);
	}

	async function fetchProfitShare() {
		isLoading = true;
		try {
			const res = await api.request(
				`/api/v1/admin/finance/profit-share?month=${month}&year=${year}`,
				{ credentials: 'include' }
			);
			if (res.ok) {
				const json = await res.json();
				profitShareData = json.data;
			}
		} catch (e) {
			console.error(e);
		} finally {
			isLoading = false;
		}
	}

	function exportCSV() {
		if (!profitShareData) return;
		const header = 'Komponen,Nominal,Persentase Terhadap Revenue\n';
		const rev = Number(profitShareData.revenue);
		const getPct = (val: number) => (rev > 0 ? ((val / rev) * 100).toFixed(2) + '%' : '0%');

		let csv = header;
		csv += `Total Revenue,${profitShareData.revenue},100%\n`;
		csv += `Total HPP (Bahan),${profitShareData.totalHpp},${getPct(profitShareData.totalHpp)}\n`;
		csv += `Total OPEX,${profitShareData.totalOpex},${getPct(profitShareData.totalOpex)}\n`;
		csv += `Total Depresiasi,${profitShareData.totalDepreciation},${getPct(profitShareData.totalDepreciation)}\n`;
		csv += `Laba Bersih,${profitShareData.netProfit},${getPct(profitShareData.netProfit)}\n`;
		csv += `Bagian Owner (60%),${profitShareData.ownerShare},${getPct(profitShareData.ownerShare)}\n`;
		csv += `Bagian Kasir (40%),${profitShareData.cashierShare},${getPct(profitShareData.cashierShare)}\n`;

		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `ProfitShare_${year}_${month}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	$effect(() => {
		fetchProfitShare();
	});
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-black text-slate-800 dark:text-slate-100">Bagi Hasil</h1>
			<p class="text-slate-500">Laporan net profit & profit sharing.</p>
		</div>
		<div class="flex gap-2">
			<select
				bind:value={month}
				class="rounded-lg border bg-white p-2 font-bold text-slate-700 shadow-sm"
			>
				{#each Array(12) as _, i}
					<option value={i + 1}>Bulan {i + 1}</option>
				{/each}
			</select>
			<input
				type="number"
				bind:value={year}
				class="w-24 rounded-lg border bg-white p-2 font-bold text-slate-700 shadow-sm"
			/>
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

	<div class="rounded-r-lg border-l-4 border-amber-500 bg-amber-50 p-4">
		<div class="flex items-start">
			<div class="flex-shrink-0">
				<svg class="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
					<path
						fill-rule="evenodd"
						d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
						clip-rule="evenodd"
					/>
				</svg>
			</div>
			<div class="ml-3">
				<h3 class="text-sm font-bold text-amber-800">Disclaimer (Fase 1)</h3>
				<div class="mt-1 text-sm text-amber-700">
					<p>
						Nilai HPP (Bahan Baku) mungkin masih Rp 0 atau belum akurat dikarenakan modul BOM (Bill
						of Materials) baru akan direalisasikan penuh pada peluncuran Fase 2.
					</p>
				</div>
			</div>
		</div>
	</div>

	{#if isLoading && !profitShareData}
		<p class="animate-pulse py-10 text-center text-slate-500">Menghitung kalkulasi bagi hasil...</p>
	{:else if profitShareData}
		{@const rev = Number(profitShareData.revenue)}
		{@const getPct = (val: number) => (rev > 0 ? ((val / rev) * 100).toFixed(2) + '%' : '0%')}
		<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			<table class="w-full text-left text-sm text-slate-600">
				<thead class="border-b border-slate-200 bg-slate-50 font-bold text-slate-700">
					<tr>
						<th class="px-6 py-4">Komponen Biaya</th>
						<th class="px-6 py-4 text-right">Nominal</th>
						<th class="px-6 py-4 text-center">% vs Revenue</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-200">
					<tr class="hover:bg-slate-50">
						<td class="px-6 py-4 font-bold text-slate-800">Total Revenue</td>
						<td class="px-6 py-4 text-right font-bold text-emerald-600"
							>{formatRp(profitShareData.revenue)}</td
						>
						<td class="px-6 py-4 text-center font-bold text-emerald-600">100%</td>
					</tr>
					<tr class="hover:bg-slate-50">
						<td class="px-6 py-4 text-slate-700">(-) Total HPP (Estimasi)</td>
						<td class="px-6 py-4 text-right text-red-500">- {formatRp(profitShareData.totalHpp)}</td
						>
						<td class="px-6 py-4 text-center">{getPct(profitShareData.totalHpp)}</td>
					</tr>
					<tr class="hover:bg-slate-50">
						<td class="px-6 py-4 text-slate-700">(-) Total OPEX</td>
						<td class="px-6 py-4 text-right text-red-500"
							>- {formatRp(profitShareData.totalOpex)}</td
						>
						<td class="px-6 py-4 text-center">{getPct(profitShareData.totalOpex)}</td>
					</tr>
					<tr class="hover:bg-slate-50">
						<td class="px-6 py-4 text-slate-700">(-) Total Depresiasi Aset</td>
						<td class="px-6 py-4 text-right text-red-500"
							>- {formatRp(profitShareData.totalDepreciation)}</td
						>
						<td class="px-6 py-4 text-center">{getPct(profitShareData.totalDepreciation)}</td>
					</tr>
					<tr class="border-y-2 border-slate-300 bg-slate-100">
						<td class="px-6 py-4 text-lg font-black text-slate-900">LABA BERSIH</td>
						<td class="px-6 py-4 text-right text-lg font-black text-emerald-600"
							>{formatRp(profitShareData.netProfit)}</td
						>
						<td class="px-6 py-4 text-center font-bold">{getPct(profitShareData.netProfit)}</td>
					</tr>
					<tr>
						<td class="border-l-4 border-blue-500 px-6 py-4 pl-12 font-bold text-blue-700"
							>→ Bagian Owner (60%)</td
						>
						<td class="px-6 py-4 text-right font-bold text-blue-600"
							>{formatRp(profitShareData.ownerShare)}</td
						>
						<td class="px-6 py-4 text-center font-bold text-blue-600"
							>{getPct(profitShareData.ownerShare)}</td
						>
					</tr>
					<tr>
						<td class="border-l-4 border-purple-500 px-6 py-4 pl-12 font-bold text-purple-700"
							>→ Bagian Kasir (40%)</td
						>
						<td class="px-6 py-4 text-right font-bold text-purple-600"
							>{formatRp(profitShareData.cashierShare)}</td
						>
						<td class="px-6 py-4 text-center font-bold text-purple-600"
							>{getPct(profitShareData.cashierShare)}</td
						>
					</tr>
				</tbody>
			</table>
		</div>
	{/if}
</div>
