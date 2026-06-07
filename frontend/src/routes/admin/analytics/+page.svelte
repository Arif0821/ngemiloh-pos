<script lang="ts">
  import { api } from '$lib/services/api.client';
  import { onMount } from 'svelte';
  import Chart from 'chart.js/auto';

  let period = $state('daily');
  let analyticsData: any = null;
  let isLoading = $state(true);

  let trendCanvas: HTMLCanvasElement;
  let qtyCanvas: HTMLCanvasElement;
  let revenueCanvas: HTMLCanvasElement;
  let paymentCanvas: HTMLCanvasElement;
  let peakHoursCanvas: HTMLCanvasElement;

  let trendChart: any;
  let qtyChart: any;
  let revChart: any;
  let payChart: any;
  let peakChart: any;

  async function fetchAnalytics() {
    isLoading = true;
    try {
      const res = await api.request(`/api/v1/admin/finance/analytics?period=${period}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        analyticsData = json.data;
        updateCharts();
      }
    } catch (e) {
      console.error('Fetch analytics error', e);
    } finally {
      isLoading = false;
    }
  }

  function updateCharts() {
    if (!analyticsData || !trendCanvas) return;

    // Trend
    if (trendChart) trendChart.destroy();
    trendChart = new Chart(trendCanvas, {
      type: 'line',
      data: {
        labels: analyticsData.trend.map((t: any) => t.label),
        datasets: [{
          label: 'Revenue (Rp)',
          data: analyticsData.trend.map((t: any) => t.value),
          borderColor: '#f43f5e',
          backgroundColor: 'rgba(244, 63, 94, 0.1)',
          fill: true
        }]
      }
    });

    // Top Qty
    if (qtyChart) qtyChart.destroy();
    qtyChart = new Chart(qtyCanvas, {
      type: 'bar',
      data: {
        labels: analyticsData.topProducts.byQty.map((t: any) => t.name),
        datasets: [{
          label: 'Terjual (Qty)',
          data: analyticsData.topProducts.byQty.map((t: any) => t.qty),
          backgroundColor: '#3b82f6'
        }]
      }
    });

    // Top Rev
    if (revChart) revChart.destroy();
    revChart = new Chart(revenueCanvas, {
      type: 'bar',
      data: {
        labels: analyticsData.topProducts.byRevenue.map((t: any) => t.name),
        datasets: [{
          label: 'Revenue (Rp)',
          data: analyticsData.topProducts.byRevenue.map((t: any) => t.revenue),
          backgroundColor: '#10b981'
        }]
      }
    });

    // Payment
    if (payChart) payChart.destroy();
    payChart = new Chart(paymentCanvas, {
      type: 'pie',
      data: {
        labels: ['Tunai', 'QRIS', 'Split'],
        datasets: [{
          data: [analyticsData.paymentDistribution.values.cash, analyticsData.paymentDistribution.values.qris, analyticsData.paymentDistribution.values.split],
          backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6']
        }]
      }
    });

    // Peak hours
    if (peakChart) peakChart.destroy();
    peakChart = new Chart(peakHoursCanvas, {
      type: 'bar',
      data: {
        labels: analyticsData.peakHours.map((t: any) => `${t.hour}:00`),
        datasets: [{
          label: 'Jumlah Transaksi',
          data: analyticsData.peakHours.map((t: any) => t.count),
          backgroundColor: '#f59e0b'
        }]
      }
    });
  }

  $effect(() => {
    fetchAnalytics();
  });
</script>

<div class="space-y-6">
  <div class="flex justify-between items-center mb-6">
    <div>
      <h1 class="text-2xl font-black text-slate-800 dark:text-slate-100">Analytics</h1>
      <p class="text-slate-500">Wawasan penjualan dan performa bisnis.</p>
    </div>
    <select bind:value={period} class="p-2 border rounded-lg bg-white shadow-sm outline-none font-bold text-slate-700">
      <option value="daily">Harian (30 Hari)</option>
      <option value="weekly">Mingguan (12 Minggu)</option>
      <option value="monthly">Bulanan (12 Bulan)</option>
    </select>
  </div>

  {#if isLoading && !analyticsData}
    <div class="flex justify-center items-center h-64">
      <p class="text-slate-500 animate-pulse">Loading analytics data...</p>
    </div>
  {:else}
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
      <div class="bg-white dark:bg-surface-800 p-6 rounded-2xl shadow-sm border border-surface-200 dark:border-surface-700">
        <h3 class="font-bold text-lg mb-4 text-surface-800 dark:text-surface-100">Tren Revenue</h3>
        <div class="h-64"><canvas bind:this={trendCanvas}></canvas></div>
      </div>
      <div class="bg-white dark:bg-surface-800 p-6 rounded-2xl shadow-sm border border-surface-200 dark:border-surface-700">
        <h3 class="font-bold text-lg mb-4 text-surface-800 dark:text-surface-100">Peak Hours (Transaksi Per Jam)</h3>
        <div class="h-64"><canvas bind:this={peakHoursCanvas}></canvas></div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div class="bg-white dark:bg-surface-800 p-6 rounded-2xl shadow-sm border border-surface-200 dark:border-surface-700">
        <h3 class="font-bold text-lg mb-4 text-surface-800 dark:text-surface-100">Top 5 (Kuantitas)</h3>
        <div class="h-64"><canvas bind:this={qtyCanvas}></canvas></div>
      </div>
      <div class="bg-white dark:bg-surface-800 p-6 rounded-2xl shadow-sm border border-surface-200 dark:border-surface-700">
        <h3 class="font-bold text-lg mb-4 text-surface-800 dark:text-surface-100">Top 5 (Revenue)</h3>
        <div class="h-64"><canvas bind:this={revenueCanvas}></canvas></div>
      </div>
      <div class="bg-white dark:bg-surface-800 p-6 rounded-2xl shadow-sm border border-surface-200 dark:border-surface-700">
        <h3 class="font-bold text-lg mb-4 text-surface-800 dark:text-surface-100">Distribusi Metode Bayar</h3>
        <div class="h-64 flex justify-center"><canvas bind:this={paymentCanvas}></canvas></div>
      </div>
    </div>
  {/if}
</div>
