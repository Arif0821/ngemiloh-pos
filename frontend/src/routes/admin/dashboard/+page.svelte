<script lang="ts">
	import { api } from '$lib/services/api.client';
	import { format_rp } from '$lib/utils/format';
	import { onMount } from 'svelte';
	import Chart from 'chart.js/auto';
	import type { Chart as ChartType } from 'chart.js';

	let revenue_canvas: HTMLCanvasElement;
	let top_products_canvas: HTMLCanvasElement;

	let kpi = $state({
		revenue: 0,
		hpp: 0,
		laba: 0,
		target_progress: 0,
		transactions: 0,
		avg: 0,
		payment_distribution: { cash: 0, qris: 0, split: 0 }
	});

	let refresh_timer: ReturnType<typeof setInterval>;
	let payment_chart: ChartType | null = null;
	let revenue_chart: ChartType | null = null;
	let top_products_chart: ChartType | null = null;

	async function fetch_kpi() {
		try {
			const res = await api.request(`/admin/finance/kpi`, { credentials: 'include' });
			if (res.ok) {
				const json = await res.json();
				kpi = json.data;
				if (payment_chart) {
					payment_chart.data.datasets[0].data = [
						kpi.payment_distribution.cash,
						kpi.payment_distribution.qris,
						kpi.payment_distribution.split
					];
					payment_chart.update();
				}
			}
		} catch (e) {
			console.error('Failed to fetch KPI', e);
		}
	}

	async function fetch_chart_data() {
		try {
			const res = await api.request(`/admin/finance/analytics?period=daily`, {
				credentials: 'include'
			});
			if (res.ok) {
				const json = await res.json();
				const data = json.data;

				// Revenue trend chart (7 days)
				if (revenue_chart) revenue_chart.destroy();
				revenue_chart = new Chart(revenue_canvas, {
					type: 'line',
					data: {
						labels: data.trend.map((t: any) => t.label),
						datasets: [
							{
								label: 'Pendapatan (Rp)',
								data: data.trend.map((t: any) => t.value),
								borderColor: '#f43f5e',
								backgroundColor: 'rgba(244, 63, 94, 0.1)',
								tension: 0.4,
								fill: true
							},
							{
								label: 'Laba Bersih (Rp)',
								data: data.trend.map((t: any) => t.net),
								borderColor: '#10b981',
								backgroundColor: 'rgba(16, 185, 129, 0.1)',
								tension: 0.4,
								fill: true
							}
						]
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						plugins: {
							legend: { display: false }
						}
					}
				});

				// Top products chart
				if (top_products_chart) top_products_chart.destroy();
				top_products_chart = new Chart(top_products_canvas, {
					type: 'bar',
					data: {
						labels: data.top_products.by_qty.map((t: any) => t.name),
						datasets: [
							{
								label: 'Terjual (porsi)',
								data: data.top_products.by_qty.map((t: any) => t.qty),
								backgroundColor: '#f43f5e',
								borderRadius: 4
							}
						]
					},
					options: {
						responsive: true,
						maintainAspectRatio: false,
						plugins: {
							legend: { display: false }
						}
					}
				});
			}
		} catch (e) {
			console.error('Failed to fetch chart data', e);
		}
	}

	onMount(() => {
		fetch_kpi();
		fetch_chart_data();
		refresh_timer = setInterval(() => {
			fetch_kpi();
		}, 60000);

		// Payment distribution chart (initialized with zeros, updated by fetch_kpi)
		payment_chart = new Chart(document.getElementById('paymentCanvas') as HTMLCanvasElement, {
			type: 'doughnut',
			data: {
				labels: ['Tunai', 'QRIS', 'Split'],
				datasets: [
					{
						data: [0, 0, 0],
						backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6']
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false
			}
		});

		return () => {
			clearInterval(refresh_timer);
			if (revenue_chart) revenue_chart.destroy();
			if (top_products_chart) top_products_chart.destroy();
			if (payment_chart) payment_chart.destroy();
		};
	});
</script>

<div class="space-y-6">
	<!-- KPI Cards -->
	<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
		<div
			class="dark:bg-surface-800 border-surface-200 dark:border-surface-700 rounded-2xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
		>
			<div class="mb-2 flex items-center gap-4">
				<div
					class="bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex h-12 w-12 items-center justify-center rounded-xl"
				>
					<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
						></path></svg
					>
				</div>
				<p class="text-surface-500 dark:text-surface-400 font-medium">Pendapatan Hari Ini</p>
			</div>
			<h3 class="text-surface-900 dark:text-surface-50 text-3xl font-black">
				{format_rp(kpi.revenue)}
			</h3>

			<div class="mt-4">
				<div class="mb-1 flex justify-between text-xs">
					<span class="text-surface-500 font-bold">Progress Target ({format_rp(5000000)})</span>
					<span class="text-brand-600 font-bold">{kpi.target_progress}%</span>
				</div>
				<div class="bg-surface-200 h-2 w-full rounded-full">
					<div class="bg-brand-500 h-2 rounded-full" style="width: {kpi.target_progress}%"></div>
				</div>
			</div>
		</div>

		<div
			class="dark:bg-surface-800 border-surface-200 dark:border-surface-700 rounded-2xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
		>
			<div class="mb-2 flex items-center gap-4">
				<div
					class="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
				>
					<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
						></path></svg
					>
				</div>
				<p class="text-surface-500 dark:text-surface-400 font-medium">Jumlah Transaksi</p>
			</div>
			<h3 class="text-surface-900 dark:text-surface-50 text-3xl font-black">{kpi.transactions}</h3>
			<p class="mt-2 flex items-center gap-1 text-sm font-medium text-green-600">
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M5 10l7-7m0 0l7 7m-7-7v18"
					></path></svg
				>
				Avg {format_rp(kpi.avg)}/transaksi
			</p>
		</div>

		<div
			class="dark:bg-surface-800 border-surface-200 dark:border-surface-700 rounded-2xl border bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
		>
			<div class="mb-2 flex items-center gap-4">
				<div
					class="flex h-12 w-12 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
				>
					<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
						></path></svg
					>
				</div>
				<p class="text-surface-500 dark:text-surface-400 font-medium">Est. HPP & Laba</p>
			</div>
			<div class="mt-2 flex items-end justify-between">
				<div>
					<p class="text-surface-500 mb-1 text-xs">Est. HPP (Bahan)</p>
					<h3 class="text-xl font-bold text-red-500">{format_rp(kpi.hpp)}</h3>
				</div>
				<div class="text-right">
					<p class="text-surface-500 mb-1 text-xs">Laba Bersih Harian</p>
					<h3 class="text-xl font-bold text-green-500">{format_rp(kpi.laba)}</h3>
				</div>
			</div>
		</div>
	</div>

	<!-- Charts -->
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<div
			class="dark:bg-surface-800 border-surface-200 dark:border-surface-700 rounded-2xl border bg-white p-6 shadow-sm"
		>
			<h3 class="text-surface-800 dark:text-surface-100 mb-6 text-lg font-bold">
				Tren Pendapatan 7 Hari
			</h3>
			<div class="h-64 w-full">
				<canvas bind:this={revenue_canvas}></canvas>
			</div>
		</div>

		<div
			class="dark:bg-surface-800 border-surface-200 dark:border-surface-700 rounded-2xl border bg-white p-6 shadow-sm"
		>
			<h3 class="text-surface-800 dark:text-surface-100 mb-6 text-lg font-bold">Top 5 Produk</h3>
			<div class="h-64 w-full">
				<canvas bind:this={top_products_canvas}></canvas>
			</div>
		</div>

		<div
			class="dark:bg-surface-800 border-surface-200 dark:border-surface-700 rounded-2xl border bg-white p-6 shadow-sm"
		>
			<h3 class="text-surface-800 dark:text-surface-100 mb-6 text-lg font-bold">
				Distribusi Pembayaran
			</h3>
			<div class="h-64 w-full">
				<canvas id="paymentCanvas"></canvas>
			</div>
		</div>
	</div>
</div>
