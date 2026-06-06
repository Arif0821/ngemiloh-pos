<script lang="ts">
  import { onMount } from 'svelte';
  
  let cashiers = $state<any[]>([]);
  let isLoading = $state(true);
  
  let showAddModal = $state(false);
  let newName = $state('');
  let newUsername = $state('');
  let newPin = $state('');
  
  let showResetModal = $state(false);
  let selectedCashier = $state<any>(null);
  let resetPin = $state('');

  async function fetchCashiers() {
    isLoading = true;
    try {
      const hostname = window.location.hostname;
      const res = await fetch(`http://${hostname}:3000/api/v1/admin/users/cashiers`, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        cashiers = data.data;
      }
    } catch (e) {
      console.error(e);
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    fetchCashiers();
  });

  async function handleAddCashier(e: Event) {
    e.preventDefault();
    if (newPin.length !== 4) return alert('PIN harus 4 digit angka');
    
    try {
      const hostname = window.location.hostname;
      const res = await fetch(`http://${hostname}:3000/api/v1/admin/users/cashiers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newName,
          username: newUsername,
          pin: newPin
        })
      });
      if (res.ok) {
        showAddModal = false;
        newName = '';
        newUsername = '';
        newPin = '';
        fetchCashiers();
      } else {
        const err = await res.json();
        alert(err.message || 'Gagal membuat kasir');
      }
    } catch (e) {
      alert('Terjadi kesalahan server');
    }
  }

  async function handleResetPin(e: Event) {
    e.preventDefault();
    if (resetPin.length !== 4) return alert('PIN harus 4 digit angka');
    
    try {
      const hostname = window.location.hostname;
      const res = await fetch(`http://${hostname}:3000/api/v1/admin/users/cashiers/${selectedCashier.id}/reset-pin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ pin: resetPin })
      });
      if (res.ok) {
        showResetModal = false;
        resetPin = '';
        alert('PIN berhasil direset');
        fetchCashiers();
      }
    } catch (e) {
      alert('Gagal reset PIN');
    }
  }

  async function toggleStatus(cashier: any) {
    const confirmMsg = cashier.is_active ? 'Nonaktifkan kasir ini?' : 'Aktifkan kasir ini?';
    if (!confirm(confirmMsg)) return;

    try {
      const hostname = window.location.hostname;
      const res = await fetch(`http://${hostname}:3000/api/v1/admin/users/cashiers/${cashier.id}/toggle-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ is_active: !cashier.is_active })
      });
      if (res.ok) {
        fetchCashiers();
      }
    } catch (e) {
      alert('Gagal mengubah status');
    }
  }
</script>

<svelte:head>
  <title>Manajemen Kasir - Ngemiloh Admin</title>
</svelte:head>

<div class="h-full overflow-y-auto p-8">
  <div class="max-w-6xl mx-auto space-y-8">
    <header class="flex justify-between items-end">
      <div>
        <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Manajemen Karyawan (Kasir)</h1>
        <p class="mt-2 text-slate-500">Kelola akun kasir untuk login ke mesin POS.</p>
      </div>
      <button onclick={() => showAddModal = true} class="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2.5 rounded-lg font-medium transition-colors shadow-sm flex items-center gap-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
        Tambah Kasir
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
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Nama / Username</th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Login Terakhir</th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Gagal Login</th>
                <th class="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 bg-white">
              {#if cashiers.length === 0}
                <tr>
                  <td colspan="5" class="px-6 py-8 text-center text-slate-500">Belum ada data kasir. Silakan tambahkan.</td>
                </tr>
                {:else}
                  {#each cashiers as cashier}
                    <tr class="hover:bg-slate-50 transition-colors {cashier.is_active ? '' : 'bg-slate-50 opacity-75'}">
                      <td class="px-6 py-4 whitespace-nowrap">
                        <div class="font-bold text-slate-900">{cashier.name}</div>
                        <div class="text-sm text-slate-500">@{cashier.username}</div>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        {#if cashier.is_active}
                          <span class="px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">Aktif</span>
                        {:else}
                          <span class="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-200 text-slate-800">Nonaktif</span>
                        {/if}
                        
                        {#if cashier.locked_until && new Date(cashier.locked_until) > new Date()}
                          <span class="ml-2 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">Terkunci (Rate Limit)</span>
                        {/if}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {cashier.last_login_at ? new Date(cashier.last_login_at).toLocaleString('id-ID') : 'Belum pernah login'}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {cashier.failed_login_count}x
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button onclick={() => toggleStatus(cashier)} class="text-slate-600 hover:text-slate-900 mx-2">{cashier.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button>
                        <button onclick={() => { selectedCashier = cashier; showResetModal = true; }} class="text-indigo-600 hover:text-indigo-900 mx-2 font-bold">Reset PIN</button>
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

<!-- Modal Tambah Kasir -->
{#if showAddModal}
<div class="fixed inset-0 bg-slate-900/75 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
    <div class="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
      <h3 class="text-lg font-bold text-slate-800">Tambah Kasir Baru</h3>
      <button onclick={() => showAddModal = false} class="text-slate-400 hover:text-slate-600">X</button>
    </div>
    <form onsubmit={handleAddCashier} class="p-6 space-y-4">
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Nama Lengkap</label>
        <input type="text" bind:value={newName} required class="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500">
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Username (untuk login)</label>
        <input type="text" bind:value={newUsername} required class="w-full border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 lowercase">
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">PIN Akses (4 Digit Angka)</label>
        <input type="text" pattern="[0-9]{4}" maxlength="4" bind:value={newPin} required class="w-full text-center tracking-[1em] text-2xl font-bold border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500">
        <p class="text-xs text-slate-500 mt-1">Kasir akan login dengan 4 digit PIN ini.</p>
      </div>
      <div class="pt-4 flex gap-3">
        <button type="button" onclick={() => showAddModal = false} class="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">Batal</button>
        <button type="submit" class="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm">Simpan</button>
      </div>
    </form>
  </div>
</div>
{/if}

<!-- Modal Reset PIN -->
{#if showResetModal}
<div class="fixed inset-0 bg-slate-900/75 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
    <div class="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
      <h3 class="text-lg font-bold text-slate-800">Reset PIN: {selectedCashier?.name}</h3>
      <button onclick={() => showResetModal = false} class="text-slate-400 hover:text-slate-600">X</button>
    </div>
    <form onsubmit={handleResetPin} class="p-6 space-y-4">
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">PIN Baru (4 Digit Angka)</label>
        <input type="text" pattern="[0-9]{4}" maxlength="4" bind:value={resetPin} required class="w-full text-center tracking-[1em] text-2xl font-bold border-slate-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500">
      </div>
      <div class="pt-4 flex gap-3">
        <button type="button" onclick={() => showResetModal = false} class="flex-1 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">Batal</button>
        <button type="submit" class="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium shadow-sm">Reset</button>
      </div>
    </form>
  </div>
</div>
{/if}
