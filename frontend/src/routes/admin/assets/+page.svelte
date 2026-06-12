<script lang="ts">
  import { api } from '$lib/services/api.client';
  import { onMount } from 'svelte';
  
  import type { Asset } from '$lib/domain/models/types';
  let assets: Asset[] = $state([]);
  let isLoading = $state(true);
  
  let showModal = $state(false);
  let isEditing = $state(false);
  
  let formId = $state('');
  let formName = $state('');
  let formValue = $state('');
  let formLifespan = $state('');
  let formPurchaseDate = $state('');
  let formIsActive = $state(true);

  async function fetchAssets() {
    isLoading = true;
    try {
      const hostname = window.location.hostname;
      const res = await api.request(`/api/v1/admin/finance/assets`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        assets = data.data;
      }
    } catch (e) {
      console.error(e);
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    fetchAssets();
  });

  function openCreateModal() {
    isEditing = false;
    formId = '';
    formName = '';
    formValue = '';
    formLifespan = '';
    formPurchaseDate = new Date().toISOString().split('T')[0];
    formIsActive = true;
    showModal = true;
  }

  function openEditModal(asset: Asset) {
    isEditing = true;
    formId = asset.id;
    formName = asset.name;
    formValue = String(asset.value ?? '');
    formLifespan = String(asset.lifespan_months ?? '');
    formPurchaseDate = new Date(asset.purchase_date).toISOString().split('T')[0];
    formIsActive = asset.is_active;
    showModal = true;
  }

  async function saveAsset(e: Event) {
    e.preventDefault();
    try {
      const hostname = window.location.hostname;
      const url = isEditing ? `/api/v1/admin/finance/assets/${formId}` : `/api/v1/admin/finance/assets`;
      const method = isEditing ? 'PATCH' : 'POST';
      
      const payload = {
        name: formName,
        value: Number(formValue),
        lifespan_months: Number(formLifespan),
        purchase_date: formPurchaseDate,
        is_active: formIsActive
      };

      const res = await api.request(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        showModal = false;
        fetchAssets();
      } else {
        const err = await res.json();
        alert('Gagal menyimpan aset: ' + (err.message || ''));
      }
    } catch (e) {
      alert('Error pada server');
    }
  }

  function formatRp(amount: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  }
</script>

<svelte:head>
  <title>Kelola Aset - Ngemiloh Admin</title>
</svelte:head>

<div class="h-full overflow-y-auto p-8">
  <div class="max-w-7xl mx-auto space-y-8">
    <header class="flex justify-between items-end">
      <div>
        <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Manajemen Aset & Depresiasi</h1>
        <p class="mt-2 text-slate-500">Pencatatan aset perusahaan dan perhitungan penyusutan (depresiasi) bulanan otomatis.</p>
      </div>
      <button onclick={openCreateModal} class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
        Tambah Aset Baru
      </button>
    </header>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
        <p class="text-slate-500 text-sm font-medium mb-1">Total Nilai Aset Aktif</p>
        <p class="text-3xl font-black text-slate-800">
          {formatRp(assets.filter(a => a.is_active).reduce((sum, a) => sum + Number(a.value), 0))}
        </p>
      </div>
      <div class="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
        <p class="text-slate-500 text-sm font-medium mb-1">Total Depresiasi Bulanan</p>
        <p class="text-3xl font-black text-red-500">
          - {formatRp(assets.filter(a => a.is_active).reduce((sum, a) => sum + Number(a.monthly_depreciation), 0))}
        </p>
        <p class="text-xs text-slate-400 mt-2">Otomatis memotong laba bersih tiap bulan.</p>
      </div>
      <div class="bg-indigo-50 p-6 rounded-2xl border border-indigo-100 flex items-center">
        <div>
          <h4 class="font-bold text-indigo-900">Aturan PRD (BR-K11)</h4>
          <p class="text-sm text-indigo-700 mt-1">Booth bernilai Rp 0 (gratis dari Ngemiloh Pusat). Metode garis lurus: Nilai Aset ÷ Umur Pakai (Bulan).</p>
        </div>
      </div>
    </div>

    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      {#if isLoading}
        <div class="flex justify-center p-12">
          <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-slate-50">
              <tr>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Nama Aset</th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Tgl Beli</th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Nilai Aset</th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Umur (Bulan)</th>
                <th class="px-6 py-4 text-left text-xs font-semibold uppercase text-red-600">Depresiasi/Bulan</th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th class="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 bg-white">
              {#if assets.length === 0}
                <tr>
                  <td colspan="7" class="px-6 py-8 text-center text-slate-500">Belum ada aset terdaftar.</td>
                </tr>
              {:else}
                {#each assets as asset}
                  <tr class="hover:bg-slate-50 transition-colors {asset.is_active ? '' : 'opacity-60 bg-slate-50'}">
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="font-bold text-slate-900">{asset.name}</div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {new Date(asset.purchase_date).toLocaleDateString('id-ID')}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap font-bold text-slate-700">
                      {formatRp(Number(asset.value))}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {asset.lifespan_months} bln
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap font-bold text-red-600">
                      {formatRp(Number(asset.monthly_depreciation))}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      {#if asset.is_active}
                        <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">Aktif</span>
                      {:else}
                        <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700">Nonaktif</span>
                      {/if}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onclick={() => openEditModal(asset)} class="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1.5 rounded-lg font-semibold">Edit</button>
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

<!-- Modal Form Aset -->
{#if showModal}
<div class="fixed inset-0 bg-slate-900/75 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
    <div class="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
      <h3 class="text-xl font-bold text-slate-800">{isEditing ? 'Edit Aset' : 'Tambah Aset Baru'}</h3>
      <button onclick={() => showModal = false} class="text-slate-400 hover:text-slate-600">X</button>
    </div>
    
    <form onsubmit={saveAsset} class="p-6 space-y-4">
      <div>
        <label class="block text-sm font-bold text-slate-700 mb-1">Nama Aset <span class="text-red-500">*</span></label>
        <input type="text" bind:value={formName} required class="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="Cth: Mesin Kasir / Booth">
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-bold text-slate-700 mb-1">Nilai Aset (Rp) <span class="text-red-500">*</span></label>
          <input type="number" min="0" bind:value={formValue} required class="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm font-bold" placeholder="0">
        </div>
        <div>
          <label class="block text-sm font-bold text-slate-700 mb-1">Umur Pakai (Bulan) <span class="text-red-500">*</span></label>
          <input type="number" min="1" bind:value={formLifespan} required class="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm font-bold" placeholder="12">
        </div>
      </div>
      
      <div>
        <label class="block text-sm font-bold text-slate-700 mb-1">Tanggal Beli <span class="text-red-500">*</span></label>
        <input type="date" bind:value={formPurchaseDate} required class="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm">
      </div>
      
      {#if isEditing}
      <div class="pt-2">
        <label class="flex items-center gap-3 cursor-pointer p-3 border border-slate-200 rounded-xl {formIsActive ? 'bg-green-50 border-green-200' : 'bg-slate-50'}">
          <input type="checkbox" bind:checked={formIsActive} class="w-5 h-5 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500">
          <span class="font-semibold text-slate-700">Aset Masih Aktif Didepresiasi</span>
        </label>
      </div>
      {/if}
      
      <div class="pt-4 border-t border-slate-100 flex gap-3">
        <button type="button" onclick={() => showModal = false} class="flex-1 px-4 py-3 bg-white border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-bold text-sm">Batal</button>
        <button type="submit" class="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold shadow-md text-sm">Simpan Aset</button>
      </div>
    </form>
  </div>
</div>
{/if}
