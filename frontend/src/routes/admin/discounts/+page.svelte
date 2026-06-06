<script lang="ts">
  import { onMount } from 'svelte';
  
  let discounts = $state<any[]>([]);
  let isLoading = $state(true);
  
  let showModal = $state(false);
  
  let dName = $state('');
  let dType = $state<'percentage' | 'fixed_amount'>('percentage');
  let dValue = $state('');
  let dValidFrom = $state('');
  let dIsActive = $state(true);
  let dApplicableDays = $state<number[]>([1,2,3,4,5,6,7]);

  const daysOfWeek = [
    { value: 1, label: 'Senin' }, { value: 2, label: 'Selasa' },
    { value: 3, label: 'Rabu' }, { value: 4, label: 'Kamis' },
    { value: 5, label: 'Jumat' }, { value: 6, label: 'Sabtu' },
    { value: 7, label: 'Minggu' }
  ];

  function toggleDay(dayValue: number) {
    if (dApplicableDays.includes(dayValue)) {
      dApplicableDays = dApplicableDays.filter(d => d !== dayValue);
    } else {
      dApplicableDays = [...dApplicableDays, dayValue];
    }
  }

  async function fetchDiscounts() {
    isLoading = true;
    try {
      const hostname = window.location.hostname;
      const res = await fetch(`http://${hostname}:3000/api/v1/admin/discounts`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        discounts = data.data;
      }
    } catch (e) {
      console.error(e);
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    fetchDiscounts();
  });

  async function saveDiscount(e: Event) {
    e.preventDefault();
    try {
      const hostname = window.location.hostname;
      const res = await fetch(`http://${hostname}:3000/api/v1/admin/discounts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: dName,
          type: dType,
          value: Number(dValue),
          scope: 'all_products',
          valid_from: new Date(dValidFrom).toISOString(),
          is_active: dIsActive,
          applicable_days: dApplicableDays
        })
      });

      if (res.ok) {
        showModal = false;
        dName = '';
        dValue = '';
        dValidFrom = '';
        fetchDiscounts();
      } else {
        alert('Gagal membuat diskon');
      }
    } catch (e) {
      alert('Error pada server');
    }
  }

  async function toggleStatus(discount: any) {
    try {
      const hostname = window.location.hostname;
      const res = await fetch(`http://${hostname}:3000/api/v1/admin/discounts/${discount.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !discount.is_active })
      });
      if (res.ok) {
        fetchDiscounts();
      }
    } catch (e) {
      alert('Gagal mengubah status');
    }
  }

  function formatRp(amount: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  }
</script>

<svelte:head>
  <title>Diskon Promo - Ngemiloh Admin</title>
</svelte:head>

<div class="h-full overflow-y-auto p-8">
  <div class="max-w-6xl mx-auto space-y-8">
    <header class="flex justify-between items-end">
      <div>
        <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Manajemen Diskon</h1>
        <p class="mt-2 text-slate-500">Buat dan kelola potongan harga (persentase atau nominal tunai).</p>
      </div>
      <button onclick={() => showModal = true} class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
        Buat Diskon
      </button>
    </header>

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
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Nama Promo</th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Potongan</th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Masa Berlaku</th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th class="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 bg-white">
              {#if discounts.length === 0}
                <tr>
                  <td colspan="5" class="px-6 py-8 text-center text-slate-500">Belum ada promo diskon yang dibuat.</td>
                </tr>
              {:else}
                {#each discounts as d}
                  <tr class="hover:bg-slate-50 transition-colors {d.is_active ? '' : 'opacity-60 bg-slate-50'}">
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="font-bold text-slate-900 text-base flex items-center gap-2">
                        <svg class="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"></path></svg>
                        {d.name}
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <div class="font-black text-red-600 text-lg">
                        {d.type === 'percentage' ? `${d.value}%` : formatRp(Number(d.value))}
                      </div>
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      Mulai: {new Date(d.valid_from).toLocaleDateString('id-ID')}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      {#if d.is_active}
                        <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">Sedang Aktif</span>
                      {:else}
                        <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-200 text-slate-700">Nonaktif</span>
                      {/if}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onclick={() => toggleStatus(d)} class="text-indigo-600 hover:text-indigo-900 font-semibold">{d.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
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

<!-- Modal Form Diskon -->
{#if showModal}
<div class="fixed inset-0 bg-slate-900/75 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
    <div class="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
      <h3 class="text-xl font-bold text-slate-800">Buat Promo Diskon</h3>
      <button onclick={() => showModal = false} class="text-slate-400 hover:text-slate-600">X</button>
    </div>
    
    <form onsubmit={saveDiscount} class="p-6 space-y-5">
      <div>
        <label class="block text-sm font-bold text-slate-700 mb-1">Nama Promo <span class="text-red-500">*</span></label>
        <input type="text" bind:value={dName} required class="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500" placeholder="Cth: Diskon Hari Jumat">
      </div>
      
      <div class="grid grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-bold text-slate-700 mb-1">Tipe Diskon <span class="text-red-500">*</span></label>
          <select bind:value={dType} class="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 font-medium">
            <option value="percentage">Persentase (%)</option>
            <option value="fixed_amount">Nominal Tunai (Rp)</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-bold text-slate-700 mb-1">Nilai Potongan <span class="text-red-500">*</span></label>
          <input type="number" bind:value={dValue} required min="1" class="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 font-bold" placeholder="0">
        </div>
      </div>
      
      <div>
        <label class="block text-sm font-bold text-slate-700 mb-1">Tanggal Mulai Berlaku <span class="text-red-500">*</span></label>
        <input type="date" bind:value={dValidFrom} required class="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500">
      </div>
      
      <div>
        <label class="block text-sm font-bold text-slate-700 mb-2">Hari Berlaku <span class="text-red-500">*</span></label>
        <div class="flex flex-wrap gap-2">
          {#each daysOfWeek as day}
            <button 
              type="button" 
              onclick={() => toggleDay(day.value)}
              class="px-3 py-1.5 rounded-full text-sm font-bold border transition-colors
                {dApplicableDays.includes(day.value) ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-500 border-slate-300 hover:border-indigo-400'}"
            >
              {day.label}
            </button>
          {/each}
        </div>
        {#if dApplicableDays.length === 0}
          <p class="text-xs text-red-500 mt-1">Pilih minimal 1 hari</p>
        {/if}
      </div>
      
      <div class="pt-4 border-t border-slate-100 flex gap-3">
        <button type="button" onclick={() => showModal = false} class="flex-1 px-4 py-3 bg-white border border-slate-300 text-slate-700 rounded-xl hover:bg-slate-50 font-bold">Batal</button>
        <button type="submit" class="flex-1 px-4 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold shadow-md">Simpan Promo</button>
      </div>
    </form>
  </div>
</div>
{/if}
