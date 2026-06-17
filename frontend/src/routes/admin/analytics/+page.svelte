<script lang="ts">
	import { api } from '$lib/services/api.client';
	import { onMount } from 'svelte';
	import Chart from 'chart.js/auto';
	import type { AnalyticsResponse } from '$lib/domain/models/types';

	let period = $state('daily');
	let analytics_data: AnalyticsResponse | null = $state(null);
	let is_loading = $state(true);

	let trend_canvas = $state<HTMLCanvasElement | null>(null);
	let qty_canvas = $state<HTMLCanvasElement | null>(null);
	let revenue_canvas = $state<HTMLCanvasElement | null>(null);
	let payment_canvas = $state<HTMLCanvasElement | null>(null);
	let peak_hours_canvas = $state<HTMLCanvasElement | null>(null);

	let trend_chart: any;
	let qty_chart: any;
	let rev_chart: any;
	let pay_chart: any;
	let peak_chart: any;

	async function fetch_analytics() {
		is_loading = true;
		try {
			const res = await api.request(`/admin/analytics?period=${period}`, {
				credentials: 'include'
			});
			if (res.ok) {
				const json = await res.json();
				analytics_data = json.data;
				update_charts();
			}
		} catch (e) {
			console.error('Fetch analytics error', e);
		} finally {
			is_loading = false;
		}
	}

	function update_charts() {
		if (!analytics_data || !trend_canvas) return;

		// Trend
		if (trend_chart) trend_chart.destroy();
		trend_chart = new Chart(trend_canvas, {
			type: 'line',
			data: {
				labels: analytics_data.trend.map((t) => t.label),
				datasets: [
					{
						label: 'Pendapatan Harian',
						data: analytics_data.trend.map((t) => t.value),
						borderColor: '#f43f5e',
						backgroundColor: 'rgba(244, 63, 94, 0.1)',
						fill: true
					}
				]
			}
		});

		// Top Qty
		if (qty_chart) qty_chart.destroy();
		if (qty_canvas) {
			qty_chart = new Chart(qty_canvas, {
				type: 'bar',
				data: {
					labels: analytics_data.top_products.by_qty.map((t) => t.name),
					datasets: [
						{
							label: 'Kuantitas',
							data: analytics_data.top_products.by_qty.map((t) => t.qty),
							backgroundColor: '#3b82f6'
						}
					]
				}
			});
		}

		// Top Revenue
		if (rev_chart) rev_chart.destroy();
		if (revenue_canvas) {
			rev_chart = new Chart(revenue_canvas, {
				type: 'bar',
				data: {
					labels: analytics_data.top_products.by_revenue.map((t) => t.name),
					datasets: [
						{
							label: 'Pendapatan',
							data: analytics_data.top_products.by_revenue.map((t) => t.revenue),
							backgroundColor: '#10b981'
						}
					]
				}
			});
		}

		// Payment Distribution
		if (pay_chart) pay_chart.destroy();
		if (payment_canvas) {
			pay_chart = new Chart(payment_canvas, {
				type: 'pie',
				data: {
					labels: ['Tunai', 'QRIS', 'Split'],
					datasets: [
						{
							data: [
								analytics_data.payment_distribution.values.cash,
								analytics_data.payment_distribution.values.qris,
								analytics_data.payment_distribution.values.split
							],
							backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6']
						}
					]
				}
			});
		}

		// Peak Hours
		if (peak_chart) peak_chart.destroy();
		if (peak_hours_canvas) {
			peak_chart = new Chart(peak_hours_canvas, {
				type: 'bar',
				data: {
					labels: analytics_data.peak_hours.map((t) => `${t.hour}:00`),
					datasets: [
						{
							label: 'Jumlah Transaksi',
							data: analytics_data.peak_hours.map((t) => t.count),
							backgroundColor: '#f59e0b'
						}
					]
				}
			});
		}
	}

	// Track `period` to re-run when it changes (Svelte 5 auto-tracks reactive reads)
	$effect(() => {
		void period;
		fetch_analytics();
	});
</script>

<div class="space-y-6">
	<div class="mb-6 flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-black text-slate-800 dark:text-slate-100">Analytics</h1>
			<p class="text-slate-500">Wawasan penjualan dan performa bisnis.</p>
		</div>
		<select
			bind:value={period}
			class="rounded-lg border bg-white p-2 font-bold text-slate-700 shadow-sm outline-none"
		>
			<option value="daily">Harian (30 Hari)</option>
			<option value="weekly">Mingguan (12 Minggu)</option>
			<option value="monthly">Bulanan (12 Bulan)</option>
		</select>
	</div>

	{#if is_loading && !analytics_data}
		<div class="flex h-64 items-center justify-center">
			<p class="animate-pulse text-slate-500">Memuat data analytics...</p>
		</div>
	{:else}
		<div class="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
			<div
				class="dark:bg-surface-800 border-surface-200 dark:border-surface-700 rounded-2xl border bg-white p-6 shadow-sm"
			>
				<h3 class="text-surface-800 dark:text-surface-100 mb-4 text-lg font-bold">Tren Revenue</h3>
				<div class="h-64">
					<canvas bind:this={trend_canvas}></canvas>
				</div>
			</div>
			<div
				class="dark:bg-surface-800 border-surface-200 dark:border-surface-700 rounded-2xl border bg-white p-6 shadow-sm"
			>
				<h3 class="text-surface-800 dark:text-surface-100 mb-4 text-lg font-bold">
					Peak Hours (Transaksi Per Jam)
				</h3>
				<div class="h-64">
					<canvas bind:this={peak_hours_canvas}></canvas>
				</div>
			</div>
		</div>

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
			<div
				class="dark:bg-surface-800 border-surface-200 dark:border-surface-700 rounded-2xl border bg-white p-6 shadow-sm"
			>
				<h3 class="text-surface-800 dark:text-surface-100 mb-4 text-lg font-bold">
					Top 5 (Kuantitas)
				</h3>
				<div class="h-64">
					<canvas bind:this={qty_canvas}></canvas>
				</div>
			</div>
			<div
				class="dark:bg-surface-800 border-surface-200 dark:border-surface-700 rounded-2xl border bg-white p-6 shadow-sm"
			>
				<h3 class="text-surface-800 dark:text-surface-100 mb-4 text-lg font-bold">
					Top 5 (Revenue)
				</h3>
				<div class="h-64">
					<canvas bind:this={revenue_canvas}></canvas>
				</div>
			</div>
			<div
				class="dark:bg-surface-800 border-surface-200 dark:border-surface-700 rounded-2xl border bg-white p-6 shadow-sm"
			>
				<h3 class="text-surface-800 dark:text-surface-100 mb-4 text-lg font-bold">
					Distribusi Metode Bayar
				</h3>
				<div class="flex h-64 justify-center">
					<canvas bind:this={payment_canvas}></canvas>
				</div>
			</div>
		</div>
	{/if}
</div>
