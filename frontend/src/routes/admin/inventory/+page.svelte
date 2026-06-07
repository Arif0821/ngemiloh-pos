<script lang="ts">
  import { api } from '$lib/services/api.client';
  import { onMount } from 'svelte';
  
  import type { RawMaterial } from '$lib/domain/models/types';
  let materials: RawMaterial[] = $state([]);
  let isLoading = $state(true);
  
  let isOpnameMode = $state(false);
  let opnameData: Record<string, number> = $state({});
  let isSubmitting = $state(false);

  async function fetchInventory() {
    isLoading = true;
    try {
      const hostname = window.location.hostname;
      const res = await api.request(`/api/v1/admin/inventory`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        materials = json.data;
        // Initialize opnameData with current system stock
        materials.forEach(m => {
          if (opnameData[m.id] === undefined) {
            opnameData[m.id] = Number(m.stock);
          }
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    fetchInventory();
  });

  async function submitOpname() {
    if (!confirm('Apakah Anda yakin ingin menyimpan hasil stok opname ini? Stok sistem akan diperbarui secara permanen sesuai fisik.')) return;
    
    isSubmitting = true;
    try {
      const hostname = window.location.hostname;
      const payload = {
        items: materials.map(m => ({
          id: m.id,
          physical_stock: opnameData[m.id]
        }))
      };
      
      const res = await api.request(`/api/v1/admin/inventory/opname`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        alert('Stok opname berhasil disimpan!');
        isOpnameMode = false;
        fetchInventory();
      } else {
        alert('Gagal menyimpan opname.');
      }
    } catch (e) {
      alert('Terjadi kesalahan jaringan.');
    } finally {
      isSubmitting = false;
    }
  }

  function toggleOpnameMode() {
    isOpnameMode = !isOpnameMode;
    if (isOpnameMode) {
      materials.forEach(m => {
        opnameData[m.id] = Number(m.stock); // Reset to system stock when entering mode
      });
    }
  }
</script>

<svelte:head>
  <title>Inventory - Ngemiloh Admin</title>
</svelte:head>

<div class="h-full overflow-y-auto p-8">
  <div class="max-w-7xl mx-auto space-y-8">
    <header class="flex justify-between items-end">
      <div>
        <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Manajemen Inventory</h1>
        <p class="mt-2 text-slate-500">Pantau ketersediaan bahan baku dan lakukan stok opname mingguan.</p>
      </div>
      <div>
        {#if !isOpnameMode}
          <button onclick={toggleOpnameMode} class="px-6 py-2.5 bg-brand-600 text-white font-bold rounded-xl shadow-sm hover:bg-brand-700 transition-colors flex items-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"></path></svg>
            Lakukan Stok Opname
          </button>
        {:else}
          <div class="flex gap-3">
            <button onclick={toggleOpnameMode} class="px-4 py-2 border border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-white transition-colors" disabled={isSubmitting}>
              Batal
            </button>
            <button onclick={submitOpname} class="px-6 py-2 bg-emerald-600 text-white font-bold rounded-xl shadow-sm hover:bg-emerald-700 transition-colors flex items-center gap-2" disabled={isSubmitting}>
              {#if isSubmitting}
                <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Menyimpan...
              {:else}
                Simpan Hasil Opname
              {/if}
            </button>
          </div>
        {/if}
      </div>
    </header>

    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {#if isLoading}
        <div class="flex justify-center p-12">
          <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-brand-500"></div>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-slate-50">
              <tr>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Bahan Baku</th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Unit</th>
                <th class="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">Stok Sistem</th>
                {#if isOpnameMode}
                  <th class="px-6 py-4 text-right text-xs font-bold text-brand-600 uppercase">Stok Fisik</th>
                  <th class="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">Selisih</th>
                {/if}
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 bg-white">
              {#if materials.length === 0}
                <tr>
                  <td colspan="6" class="px-6 py-8 text-center text-slate-500">Belum ada bahan baku.</td>
                </tr>
              {:else}
                {#each materials as item}
                  <tr class="hover:bg-slate-50 {Number(item.stock) <= Number(item.min_stock) ? 'bg-red-50/30' : ''}">
                    <td class="px-6 py-4 whitespace-nowrap font-bold text-slate-900">{item.name}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-slate-600">{item.unit}</td>
                    <td class="px-6 py-4 whitespace-nowrap text-right font-medium text-slate-700">{Number(item.stock)}</td>
                    
                    {#if isOpnameMode}
                      {@const diff = opnameData[item.id] - Number(item.stock)}
                      <td class="px-6 py-3 whitespace-nowrap text-right">
                        <input 
                          type="number" 
                          bind:value={opnameData[item.id]} 
                          class="w-24 px-2 py-1 border-2 border-brand-300 rounded focus:ring-brand-500 focus:border-brand-500 text-right font-bold"
                          min="0"
                        />
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-right font-bold">
                        {#if diff > 0}
                          <span class="text-emerald-600">+{diff}</span>
                        {:else if diff < 0}
                          <span class="text-red-600">{diff}</span>
                        {:else}
                          <span class="text-slate-400">0</span>
                        {/if}
                      </td>
                    {/if}
                    
                    <td class="px-6 py-4 whitespace-nowrap text-sm">
                      {#if !item.is_active}
                        <span class="text-slate-500 font-medium">Nonaktif</span>
                      {:else if Number(item.stock) <= Number(item.min_stock)}
                        <span class="text-red-600 font-bold flex items-center gap-1">
                          <span class="w-2 h-2 rounded-full bg-red-600"></span> Stok Menipis
                        </span>
                      {:else}
                        <span class="text-emerald-600 font-medium">Aman</span>
                      {/if}
                    </td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
      {/if}
    </div>
  </div>
</div>
