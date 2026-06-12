<script lang="ts">
  import { api } from '$lib/services/api.client';
  import { formatRp } from '$lib/utils/format';
  import { onMount } from 'svelte';
  import Chart from 'chart.js/auto';
  import type { Chart as ChartType } from 'chart.js';

  let revenueCanvas: HTMLCanvasElement;
  let topProductsCanvas: HTMLCanvasElement;

  let kpi = $state({
    revenue: 0,
    hpp: 0,
    laba: 0,
    targetProgress: 0,
    transactions: 0,
    avg: 0,
    paymentDistribution: { cash: 0, qris: 0, split: 0 }
  });

  let refreshTimer: ReturnType<typeof setInterval>;

  let paymentChart: ChartType | null = null;

  async function fetchKpi() {
    try {
      const res = await api.request(`/api/v1/admin/finance/kpi`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        kpi = json.data;
        if (paymentChart) {
          paymentChart.data.datasets[0].data = [kpi.paymentDistribution.cash, kpi.paymentDistribution.qris, kpi.paymentDistribution.split];
          paymentChart.update();
        }
      }
    } catch (e) {
      console.error('Failed to fetch KPI', e);
    }
  }

  onMount(() => {
    fetchKpi();
    refreshTimer = setInterval(fetchKpi, 60000); // 60s auto-refresh

    // Revenue Chart
    new Chart(revenueCanvas, {
      type: 'line',
      data: {
        labels: ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'],
        datasets: [
          {
            label: 'Pendapatan (Rp)',
            data: [3200000, 3100000, 4000000, 3800000, 4500000, 6000000, 5800000],
            borderColor: '#f43f5e',
            backgroundColor: 'rgba(244, 63, 94, 0.1)',
            tension: 0.4,
            fill: true
          },
          {
            label: 'Laba Bersih (Rp)',
            data: [1500000, 1400000, 1900000, 1800000, 2200000, 3100000, 2900000],
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

    // Top Products Chart
    new Chart(topProductsCanvas, {
      type: 'bar',
      data: {
        labels: ['Macaroni', 'Mie Lidi', 'Basreng', 'Mie Kremes', 'Usus Goreng'],
        datasets: [{
          label: 'Terjual (porsi)',
          data: [150, 120, 90, 85, 60],
          backgroundColor: '#f43f5e',
          borderRadius: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        }
      }
    });

    // Payment Distribution Chart
    paymentChart = new Chart(document.getElementById('paymentCanvas') as HTMLCanvasElement, {
      type: 'doughnut',
      data: {
        labels: ['Tunai', 'QRIS', 'Split'],
        datasets: [{
          data: [0, 0, 0], // Will be updated by fetchKpi
          backgroundColor: ['#10b981', '#3b82f6', '#8b5cf6']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
      }
    });

    return () => clearInterval(refreshTimer);
  });
</script>

<div class="space-y-6">
  <!-- KPI Cards -->
  <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
    <div class="bg-white dark:bg-surface-800 p-6 rounded-2xl shadow-sm border border-surface-200 dark:border-surface-700 hover:shadow-md transition-shadow">
      <div class="flex items-center gap-4 mb-2">
        <div class="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-900/30 text-brand-600 dark:text-brand-400 flex items-center justify-center">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
        </div>
        <p class="text-surface-500 dark:text-surface-400 font-medium">Pendapatan Hari Ini</p>
      </div>
      <h3 class="text-3xl font-black text-surface-900 dark:text-surface-50">{formatRp(kpi.revenue)}</h3>
      
      <div class="mt-4">
        <div class="flex justify-between text-xs mb-1">
          <span class="font-bold text-surface-500">Progress Target (5Jt)</span>
          <span class="font-bold text-brand-600">{kpi.targetProgress}%</span>
        </div>
        <div class="w-full bg-surface-200 rounded-full h-2">
          <div class="bg-brand-500 h-2 rounded-full" style="width: {kpi.targetProgress}%"></div>
        </div>
      </div>
    </div>

    <div class="bg-white dark:bg-surface-800 p-6 rounded-2xl shadow-sm border border-surface-200 dark:border-surface-700 hover:shadow-md transition-shadow">
      <div class="flex items-center gap-4 mb-2">
        <div class="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
        </div>
        <p class="text-surface-500 dark:text-surface-400 font-medium">Jumlah Transaksi</p>
      </div>
      <h3 class="text-3xl font-black text-surface-900 dark:text-surface-50">{kpi.transactions}</h3>
      <p class="text-sm text-green-600 mt-2 flex items-center gap-1 font-medium">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18"></path></svg>
        +5.2% dari kemarin
      </p>
    </div>

    <div class="bg-white dark:bg-surface-800 p-6 rounded-2xl shadow-sm border border-surface-200 dark:border-surface-700 hover:shadow-md transition-shadow">
      <div class="flex items-center gap-4 mb-2">
        <div class="w-12 h-12 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
        </div>
        <p class="text-surface-500 dark:text-surface-400 font-medium">Est. HPP & Laba</p>
      </div>
      <div class="flex justify-between items-end mt-2">
        <div>
          <p class="text-xs text-surface-500 mb-1">Est. HPP (Bahan)</p>
          <h3 class="text-xl font-bold text-red-500">{formatRp(kpi.hpp)}</h3>
        </div>
        <div class="text-right">
          <p class="text-xs text-surface-500 mb-1">Laba Bersih Harian</p>
          <h3 class="text-xl font-bold text-green-500">{formatRp(kpi.laba)}</h3>
        </div>
      </div>
    </div>
  </div>

  <!-- Charts -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <div class="bg-white dark:bg-surface-800 p-6 rounded-2xl shadow-sm border border-surface-200 dark:border-surface-700">
      <h3 class="font-bold text-lg mb-6 text-surface-800 dark:text-surface-100">Tren Pendapatan 7 Hari</h3>
      <div class="h-64 w-full">
        <canvas bind:this={revenueCanvas}></canvas>
      </div>
    </div>

    <div class="bg-white dark:bg-surface-800 p-6 rounded-2xl shadow-sm border border-surface-200 dark:border-surface-700">
      <h3 class="font-bold text-lg mb-6 text-surface-800 dark:text-surface-100">Top 5 Produk</h3>
      <div class="h-64 w-full">
        <canvas bind:this={topProductsCanvas}></canvas>
      </div>
    </div>

    <div class="bg-white dark:bg-surface-800 p-6 rounded-2xl shadow-sm border border-surface-200 dark:border-surface-700">
      <h3 class="font-bold text-lg mb-6 text-surface-800 dark:text-surface-100">Distribusi Pembayaran</h3>
      <div class="h-64 w-full">
        <canvas id="paymentCanvas"></canvas>
      </div>
    </div>
  </div>
</div>
