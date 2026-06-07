<script lang="ts">
  import { onMount } from 'svelte';
  
  let settings: Record<string, string> = $state({});
  let featureFlags: any[] = $state([]);
  let isLoading = $state(true);
  
  let isSavingSettings = $state(false);

  // Settings Forms
  let storeName = $state('');
  let halalNumber = $state('');
  let storeAddress = $state('');
  let receiptFooter = $state('');

  async function fetchData() {
    isLoading = true;
    try {
      const hostname = window.location.hostname;
      
      // Fetch settings
      const resSettings = await fetch(`/api/v1/admin/settings`, { credentials: 'include' });
      if (resSettings.ok) {
        const json = await resSettings.json();
        // convert array [{key, value}] to object {key: value}
        const st: any = {};
        json.data.forEach((s: any) => {
          st[s.key] = s.value;
        });
        settings = st;
        
        storeName = st['STORE_NAME'] || 'Ngemiloh F&B';
        halalNumber = st['HALAL_NUMBER'] || '';
        storeAddress = st['STORE_ADDRESS'] || '';
        receiptFooter = st['RECEIPT_FOOTER'] || 'Terima kasih atas kunjungannya!';
      }

      // Fetch flags
      const resFlags = await fetch(`/api/v1/admin/feature-flags`, { credentials: 'include' });
      if (resFlags.ok) {
        const json = await resFlags.json();
        featureFlags = json.data;
      }
      
    } catch (e) {
      console.error(e);
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    fetchData();
  });

  async function saveSettings(e: Event) {
    e.preventDefault();
    if (isSavingSettings) return;
    isSavingSettings = true;
    try {
      const hostname = window.location.hostname;
      const payload = {
        'STORE_NAME': storeName,
        'HALAL_NUMBER': halalNumber,
        'STORE_ADDRESS': storeAddress,
        'RECEIPT_FOOTER': receiptFooter
      };
      
      const res = await fetch(`/api/v1/admin/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        alert('Pengaturan berhasil disimpan!');
      } else {
        alert('Gagal menyimpan pengaturan');
      }
    } catch (e) {
      alert('Error pada server');
    } finally {
      isSavingSettings = false;
    }
  }

  async function toggleFlag(id: string, currentStatus: boolean) {
    try {
      const hostname = window.location.hostname;
      const res = await fetch(`/api/v1/admin/feature-flags/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_enabled: !currentStatus })
      });
      
      if (res.ok) {
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  }
</script>

<svelte:head>
  <title>Settings - Ngemiloh Admin</title>
</svelte:head>

<div class="h-full overflow-y-auto p-8">
  <div class="max-w-4xl mx-auto space-y-8">
    <header>
      <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Pengaturan & Konfigurasi Sistem</h1>
      <p class="mt-2 text-slate-500">Kelola informasi bisnis Ngemiloh dan kontrol fitur secara dinamis.</p>
    </header>

    {#if isLoading}
      <div class="flex justify-center p-12 bg-white rounded-2xl shadow-sm border border-slate-200">
        <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    {:else}
      <!-- Section 1: Business Settings -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="p-6 bg-slate-50 border-b border-slate-200">
          <h2 class="text-xl font-bold text-slate-800">Profil Bisnis & Struk</h2>
        </div>
        <form onsubmit={saveSettings} class="p-6 space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label class="block text-sm font-bold text-slate-700 mb-1">Nama Toko</label>
              <input type="text" bind:value={storeName} required class="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm">
            </div>
            <div>
              <label class="block text-sm font-bold text-slate-700 mb-1">Sertifikat Halal MUI</label>
              <input type="text" bind:value={halalNumber} class="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm" placeholder="ID123456789">
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm font-bold text-slate-700 mb-1">Alamat Outlet</label>
              <textarea bind:value={storeAddress} rows="2" class="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm"></textarea>
            </div>
            <div class="md:col-span-2">
              <label class="block text-sm font-bold text-slate-700 mb-1">Pesan Penutup (Footer) Struk</label>
              <input type="text" bind:value={receiptFooter} class="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 text-sm">
            </div>
          </div>
          <div class="flex justify-end pt-4 border-t border-slate-100">
            <button type="submit" disabled={isSavingSettings} class="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-6 py-2.5 rounded-lg font-bold shadow-sm transition-colors">
              {isSavingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}
            </button>
          </div>
        </form>
      </div>

      <!-- Section 2: Feature Flags -->
      <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div class="p-6 bg-slate-50 border-b border-slate-200">
          <h2 class="text-xl font-bold text-slate-800">Feature Flags (Toggle Fitur)</h2>
          <p class="text-sm text-slate-500 mt-1">Nyalakan/matikan fitur aplikasi secara instan tanpa perlu redeploy ke server.</p>
        </div>
        <div class="p-0">
          {#if featureFlags.length === 0}
            <div class="p-8 text-center text-slate-500 italic">Belum ada Feature Flag yang terdaftar di database.</div>
          {:else}
            <div class="divide-y divide-slate-100">
              {#each featureFlags as flag}
                <div class="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <h3 class="font-bold text-slate-800 font-mono text-sm mb-1">{flag.name}</h3>
                    <p class="text-sm text-slate-500">{flag.description || 'Tidak ada deskripsi'}</p>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" class="sr-only peer" checked={flag.is_enabled} onchange={() => toggleFlag(flag.id, flag.is_enabled)}>
                    <div class="w-14 h-7 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500"></div>
                  </label>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>
