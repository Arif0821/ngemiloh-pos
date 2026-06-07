<script lang="ts">
  let startDate = $state(new Date(new Date().setDate(1)).toISOString().split('T')[0]); // First day of month
  let endDate = $state(new Date().toISOString().split('T')[0]);
  let isExporting = $state(false);

  async function handleExport() {
    isExporting = true;
    try {
      // Call real backend endpoint
      const hostname = window.location.hostname;
      window.open(`/api/v1/admin/reports/export?startDate=${startDate}&endDate=${endDate}`, '_blank');
      
      // Simulating a short delay so the loading state shows
      await new Promise(r => setTimeout(r, 1000));
    } catch (e) {
      alert('Gagal membuat laporan');
    } finally {
      isExporting = false;
    }
  }
</script>

<svelte:head>
  <title>Export Laporan | Ngemiloh Admin</title>
</svelte:head>

<div class="max-w-3xl mx-auto">
  <div class="mb-8">
    <h1 class="text-2xl font-bold text-slate-900">Export Laporan Data</h1>
    <p class="text-slate-500 mt-1">Unduh seluruh riwayat transaksi dan operasional ke format Excel / CSV.</p>
  </div>

  <div class="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-2" for="startDate">Dari Tanggal</label>
        <input type="date" id="startDate" bind:value={startDate} class="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500" />
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-2" for="endDate">Sampai Tanggal</label>
        <input type="date" id="endDate" bind:value={endDate} class="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-indigo-500 focus:border-indigo-500" />
      </div>
    </div>

    <div class="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-8 text-sm text-blue-800 flex gap-3">
      <svg class="w-5 h-5 flex-shrink-0 mt-0.5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
      <div>
        <p class="font-medium mb-1">Informasi Export CSV</p>
        <p class="text-blue-700 opacity-90">File CSV akan berisi rincian: ID Transaksi, Kasir, Tanggal, Base Price, Diskon, Tambahan Modifier, Metode Bayar, dan Status. (Batas maksimal 5 export per jam sesuai PRD).</p>
      </div>
    </div>

    <div class="flex justify-end">
      <button 
        onclick={handleExport}
        disabled={isExporting} 
        class="inline-flex items-center justify-center px-6 py-3 border border-transparent rounded-xl shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 transition-colors w-full md:w-auto"
      >
        {#if isExporting}
          <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          Memproses File...
        {:else}
          <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
          Export Transaksi (CSV)
        {/if}
      </button>
    </div>
  </div>
</div>
