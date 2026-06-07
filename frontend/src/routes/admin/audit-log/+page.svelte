<script lang="ts">
  import { api } from '$lib/services/api.client';
  import { onMount } from 'svelte';
  
  let auditLogs: any[] = $state([]);
  let isLoading = $state(true);

  async function fetchLogs() {
    isLoading = true;
    try {
      const hostname = window.location.hostname;
      const res = await api.request(`/api/v1/admin/audit-logs`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        auditLogs = json.data;
      }
    } catch (e) {
      console.error(e);
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    fetchLogs();
  });
</script>

<svelte:head>
  <title>Audit Log - Ngemiloh Admin</title>
</svelte:head>

<div class="h-full overflow-y-auto p-8">
  <div class="max-w-7xl mx-auto space-y-8">
    <header>
      <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Audit Log (Aktivitas Sistem)</h1>
      <p class="mt-2 text-slate-500">Pencatatan riwayat semua aktivitas sensitif (VOID, Login Gagal, Perubahan Harga, dsb). Read-only untuk alasan keamanan.</p>
    </header>

    <div class="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div class="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
        <h2 class="font-bold text-slate-700">100 Aktivitas Terakhir</h2>
        <button onclick={fetchLogs} class="text-indigo-600 hover:text-indigo-800 text-sm font-semibold flex items-center gap-1">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
          Refresh
        </button>
      </div>
      
      {#if isLoading}
        <div class="flex justify-center p-12">
          <div class="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-500"></div>
        </div>
      {:else}
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-200">
            <thead class="bg-slate-50">
              <tr>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase w-48">Waktu (WIB)</th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Pelaku (Aktor)</th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Aksi (Action)</th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Detail / Entitas</th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Alamat IP</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 bg-white text-sm">
              {#if auditLogs.length === 0}
                <tr>
                  <td colspan="5" class="px-6 py-8 text-center text-slate-500">Belum ada catatan audit log.</td>
                </tr>
              {:else}
                {#each auditLogs as log}
                  <tr class="hover:bg-slate-50">
                    <td class="px-6 py-4 whitespace-nowrap text-slate-600 font-mono text-xs">
                      {new Date(log.created_at).toLocaleString('id-ID')}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      {#if log.actor}
                        <span class="font-bold text-slate-800">{log.actor.name}</span>
                        <br/>
                        <span class="text-xs uppercase px-2 py-0.5 rounded-full {log.actor.role === 'superadmin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-700'}">{log.actor.role}</span>
                      {:else}
                        <span class="text-slate-400 italic">System / Unknown</span>
                      {/if}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      <span class="font-bold {log.action.includes('VOID') || log.action.includes('FAILED') || log.action.includes('DELETE') ? 'text-red-600' : 'text-slate-700'}">
                        {log.action}
                      </span>
                    </td>
                    <td class="px-6 py-4">
                      <div class="text-slate-700">
                        {#if log.entity_type}
                          <span class="font-semibold text-indigo-600">[{log.entity_type}]</span> 
                        {/if}
                        {log.entity_id || ''}
                      </div>
                      {#if log.new_value || log.old_value}
                        <div class="mt-1 font-mono text-[11px] bg-slate-100 p-2 rounded overflow-x-auto max-w-sm text-slate-500">
                          {#if log.old_value} <span class="text-red-500">- {JSON.stringify(log.old_value)}</span> <br/> {/if}
                          {#if log.new_value} <span class="text-green-600">+ {JSON.stringify(log.new_value)}</span> {/if}
                        </div>
                      {/if}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-slate-500 font-mono text-xs">
                      {log.ip_address || '-'}
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
