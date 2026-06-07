<script lang="ts">
  import { onMount } from 'svelte';

  let shiftData: any = $state(null);
  let error: string = $state('');

  onMount(async () => {
    try {
      const res = await fetch(`/api/v1/orders/shift`, {
        credentials: 'include'
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          shiftData = json.data;
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

  function formatRp(amount: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  }
</script>

<div class="min-h-screen bg-surface-100 p-8 flex flex-col items-center">
  <div class="bg-white rounded-3xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col">
    <div class="p-8 border-b border-surface-200 bg-surface-50">
      <div class="flex justify-between items-center">
        <h1 class="text-2xl font-bold text-surface-900">Laporan Kasir Hari Ini</h1>
        <a href="/pos" class="px-4 py-2 bg-brand-500 text-white rounded-full font-medium hover:bg-brand-600 transition-colors">Kembali ke POS</a>
      </div>
    </div>
    
    <div class="p-8">
      {#if error}
        <p class="text-red-500">{error}</p>
      {:else if !shiftData}
        <p class="text-surface-500 animate-pulse">Memuat laporan...</p>
      {:else}
        <div class="grid grid-cols-2 gap-6 mb-8">
          <div class="bg-surface-50 border border-surface-200 p-6 rounded-2xl">
            <p class="text-surface-500 font-medium mb-1">Total Pesanan</p>
            <p class="text-3xl font-black text-brand-600">{shiftData.total_orders}</p>
          </div>
          <div class="bg-surface-50 border border-surface-200 p-6 rounded-2xl">
            <p class="text-surface-500 font-medium mb-1">Pendapatan Kotor</p>
            <p class="text-3xl font-black text-brand-600">{formatRp(shiftData.grand_total)}</p>
          </div>
        </div>

        <h3 class="text-lg font-bold mb-4">Rincian Pembayaran</h3>
        <div class="space-y-4">
          <div class="flex justify-between items-center p-4 bg-white border border-surface-200 rounded-xl shadow-sm">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-green-100 text-green-600 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              </div>
              <span class="font-bold text-surface-800">Tunai (Cash)</span>
            </div>
            <span class="text-xl font-bold">{formatRp(shiftData.total_cash)}</span>
          </div>
          
          <div class="flex justify-between items-center p-4 bg-white border border-surface-200 rounded-xl shadow-sm">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm14 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"></path></svg>
              </div>
              <span class="font-bold text-surface-800">QRIS Midtrans</span>
            </div>
            <span class="text-xl font-bold">{formatRp(shiftData.total_qris)}</span>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
