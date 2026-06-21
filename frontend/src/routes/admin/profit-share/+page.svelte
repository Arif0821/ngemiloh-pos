<script lang="ts">
	import { api } from '$lib/services/api.client';
	import { format_rp } from '$lib/utils/format';
	import type { ProfitShareData, BomCoverageStats } from '$lib/domain/models/types';

	let month = $state(new Date().getMonth() + 1);
	let year = $state(new Date().getFullYear());
	let profit_share_data: ProfitShareData | null = $state(null);
	let bom_coverage: BomCoverageStats | null = $state(null);
	let is_loading = $state(false);

	async function fetch_profit_share() {
		is_loading = true;
		try {
			const [profitRes, bomRes] = await Promise.all([
				api.request(`/admin/finance/profit-share?month=${month}&year=${year}`, {
					credentials: 'include'
				}),
				api.request('/admin/inventory/bom-coverage', { credentials: 'include' })
			]);
			if (profitRes.ok) {
				const json = await profitRes.json();
				profit_share_data = json.data;
			}
			if (bomRes.ok) {
				const json = await bomRes.json();
				bom_coverage = json.data;
			}
		} catch (e) {
			console.error(e);
		} finally {
			is_loading = false;
		}
	}

	function export_csv() {
		if (!profit_share_data) return;
		const header = 'Komponen,Nominal,Persentase Terhadap Revenue\n';
		const rev = Number(profit_share_data.revenue);
		const get_pct = (val: number) => (rev > 0 ? ((val / rev) * 100).toFixed(2) + '%' : '0%');

		let csv = header;
		csv += `Total Revenue,${profit_share_data.revenue},100%\n`;
		csv += `Total HPP (Bahan),${profit_share_data.total_hpp},${get_pct(Number(profit_share_data.total_hpp))}\n`;
		csv += `Total OPEX,${profit_share_data.total_opex},${get_pct(Number(profit_share_data.total_opex))}\n`;
		csv += `Total Depresiasi,${profit_share_data.total_depreciation},${get_pct(Number(profit_share_data.total_depreciation))}\n`;
		csv += `Laba Bersih,${profit_share_data.net_profit},${get_pct(Number(profit_share_data.net_profit))}\n`;
		csv += `Bagian Owner (60%),${profit_share_data.owner_share},${get_pct(Number(profit_share_data.owner_share))}\n`;
		csv += `Bagian Kasir (40%),${profit_share_data.cashier_share},${get_pct(Number(profit_share_data.cashier_share))}\n`;

		const blob = new Blob([csv], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `ProfitShare_${year}_${month}.csv`;
		a.click();
		URL.revokeObjectURL(url);
	}

	$effect(() => {
		fetch_profit_share();
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
				class="rounded-lg border border-slate-300 bg-white p-2 font-bold text-slate-700 shadow-sm"
			>
				{#each Array(12) as _, i}
					<option value={i + 1}>Bulan {i + 1}</option>
				{/each}
			</select>
			<input
				type="number"
				bind:value={year}
				class="w-24 rounded-lg border border-slate-300 bg-white p-2 font-bold text-slate-700 shadow-sm"
			/>
			<button
				onclick={export_csv}
				class="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 font-bold text-white shadow-sm hover:bg-emerald-700"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 16v1a3 3 0 013 3h9a3 3 0 013 3v1m0 8v8h5a1 1 0 001-1h3.586a1 1 0 00-.293-.707l-4.414-4.414a1 1 0 00-1.414 0L12 20.414a1 1 0 001.414 0l3.414-3.414a1 1 0 000-1.414L14 16a1 1 0 00-1.414 1.414l2 2a1 1 0 00.707.293l8 8a1 1 0 001-1.414l-4-4a1 1 0 00-1.414 0l-4.414 4.414a1 1 0 01.414 0H7a1 1 0 001-1v-3.414L3.414 13a1 1 0 010-1.414l10-10a1 1 0 011.414 0l4 4"
					/>
				</svg>
				Export CSV
			</button>
		</div>
	</div>

	{#if bom_coverage && bom_coverage.products_missing_bom > 0}
		<div class="rounded-lg border-l-4 border-red-500 bg-red-50 p-4">
			<div class="flex items-start gap-3">
				<svg class="h-5 w-5 shrink-0 text-red-400" viewBox="0 0 20 20" fill="currentColor">
					<path
						fill-rule="evenodd"
						d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM10 9a1 1 0 100-2 1 1 0 000 2zm-1-5a1 1 0 011-1h1a1 1 0 110 2H10a1 1 0 01-1-1z"
						clip-rule="evenodd"
					/>
				</svg>
				<div class="flex-1">
					<h3 class="text-sm font-bold text-red-800">HPP = Rp 0 - BOM Belum Disetting!</h3>
					<p class="mt-1 text-sm text-red-700">
						{bom_coverage.products_with_bom} dari {bom_coverage.total_products} produk ({bom_coverage.coverage_percentage}%)
						sudah ada resep BOM.
						<b>{bom_coverage.products_missing_bom} produk belum memiliki BOM.</b>
					</p>
					<a
						href="/admin/inventory"
						class="mt-2 inline-block rounded bg-red-600 px-3 py-1 text-xs font-bold text-white hover:bg-red-700"
					>
						Setup BOM Sekarang
					</a>
				</div>
			</div>
		</div>
	{:else if profit_share_data && Number(profit_share_data.total_hpp) === 0}
		<div class="rounded-lg border-l-4 border-amber-500 bg-amber-50 p-4">
			<div class="flex items-start gap-3">
				<svg class="h-5 w-5 shrink-0 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
					<path
						fill-rule="evenodd"
						d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM10 9a1 1 0 100-2 1 1 0 000 2zm-1-5a1 1 0 011-1h1a1 1 0 110 2H10a1 1 0 01-1-1z"
						clip-rule="evenodd"
					/>
				</svg>
				<div>
					<h3 class="text-sm font-bold text-amber-800">HPP = Rp 0</h3>
					<p class="mt-1 text-sm text-amber-700">
						Nilai HPP (Bahan) mungkin belum akurat. Pastikan semua produk memiliki resep BOM.
					</p>
				</div>
			</div>
		</div>
	{:else}
		<div class="rounded-lg border-l-4 border-emerald-500 bg-emerald-50 p-4">
			<div class="flex items-start gap-3">
				<svg class="h-5 w-5 shrink-0 text-emerald-400" viewBox="0 0 20 20" fill="currentColor">
					<path
						fill-rule="evenodd"
						d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
						clip-rule="evenodd"
					/>
				</svg>
				<div>
					<h3 class="text-sm font-bold text-emerald-800">
						BOM Coverage: {bom_coverage?.coverage_percentage || 0}%
					</h3>
					<p class="mt-1 text-sm text-emerald-700">
						{bom_coverage?.products_with_bom || 0} dari {bom_coverage?.total_products || 0} produk sudah
						memiliki resep BOM.
					</p>
				</div>
			</div>
		</div>
	{/if}

	{#if is_loading && !profit_share_data}
		<p class="animate-pulse py-10 text-center text-slate-500">Menghitung kalkulasi bagi hasil...</p>
	{:else if profit_share_data}
		{@const rev = Number(profit_share_data.revenue)}
		{@const get_pct = (val: number) => (rev > 0 ? ((val / rev) * 100).toFixed(2) + '%' : '0%')}
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
						<td class="px-6 py-4 text-right font-bold text-emerald-600">
							{format_rp(profit_share_data.revenue)}
						</td>
						<td class="px-6 py-4 text-center font-bold text-emerald-600">100%</td>
					</tr>
					<tr class="hover:bg-slate-50">
						<td class="px-6 py-4 text-slate-700">(-) Total HPP (Estimasi)</td>
						<td class="px-6 py-4 text-right text-red-500">
							- {format_rp(Number(profit_share_data.total_hpp))}
						</td>
						<td class="px-6 py-4 text-center">{get_pct(Number(profit_share_data.total_hpp))}</td>
					</tr>
					<tr class="hover:bg-slate-50">
						<td class="px-6 py-4 text-slate-700">(-) Total OPEX</td>
						<td class="px-6 py-4 text-right text-red-500">
							- {format_rp(Number(profit_share_data.total_opex))}
						</td>
						<td class="px-6 py-4 text-center">{get_pct(Number(profit_share_data.total_opex))}</td>
					</tr>
					<tr class="hover:bg-slate-50">
						<td class="px-6 py-4 text-slate-700">(-) Total Depresiasi Aset</td>
						<td class="px-6 py-4 text-right text-red-500">
							- {format_rp(Number(profit_share_data.total_depreciation))}
						</td>
						<td class="px-6 py-4 text-center"
							>{get_pct(Number(profit_share_data.total_depreciation))}</td
						>
					</tr>
					<tr class="border-y-2 border-slate-300 bg-slate-100">
						<td class="px-6 py-4 text-lg font-black text-slate-900">LABA BERSIH</td>
						<td class="px-6 py-4 text-right text-lg font-black text-emerald-600">
							{format_rp(Number(profit_share_data.net_profit))}
						</td>
						<td class="px-6 py-4 text-center font-bold"
							>{get_pct(Number(profit_share_data.net_profit))}</td
						>
					</tr>
					<tr>
						<td class="border-l-4 border-blue-500 px-6 py-4 pl-12 font-bold text-blue-700"
							>Bagian Owner (60%)</td
						>
						<td class="px-6 py-4 text-right font-bold text-blue-600">
							{format_rp(Number(profit_share_data.owner_share))}
						</td>
						<td class="px-6 py-4 text-center font-bold text-blue-600"
							>{get_pct(Number(profit_share_data.owner_share))}</td
						>
					</tr>
					<tr>
						<td class="border-l-4 border-purple-500 px-6 py-4 pl-12 font-bold text-purple-700"
							>Bagian Kasir (40%)</td
						>
						<td class="px-6 py-4 text-right font-bold text-purple-600">
							{format_rp(Number(profit_share_data.cashier_share))}
						</td>
						<td class="px-6 py-4 text-center font-bold text-purple-600"
							>{get_pct(Number(profit_share_data.cashier_share))}</td
						>
					</tr>
				</tbody>
			</table>
		</div>
	{/if}
</div>
