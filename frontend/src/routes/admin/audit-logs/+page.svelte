<script lang="ts">
  import { api } from '$lib/services/api.client';
  import { onMount } from 'svelte';

  import type { AuditLog } from '$lib/domain/models/types';
  let logs: AuditLog[] = $state([]);
  let total: number = $state(0);
  let isLoading = $state(false);

  // Filters
  let filterAction = $state('');
  let filterDateFrom = $state('');
  let filterDateTo = $state('');
  let currentPage = $state(1);

  const ACTIONS = [
    'USER_LOGIN',
    'PRODUCT_PRICE_UPDATE',
    'DISCOUNT_CREATE',
    'DISCOUNT_UPDATE',
    'QRIS_PAYMENT_SUCCESS',
    'ORDER_VOID',
    'CASH_REGISTER_CLOSE',
    'PROFIT_SHARE_PAID'
  ];

  async function fetchLogs() {
    isLoading = true;
    try {
      const params = new URLSearchParams({ page: currentPage.toString() });
      if (filterAction) params.append('action', filterAction);
      if (filterDateFrom) params.append('date_from', filterDateFrom);
      if (filterDateTo) params.append('date_to', filterDateTo);

      const res = await api.request(`/api/v1/admin/audit-logs?${params.toString()}`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        logs = json.logs;
        total = json.total;
      }
    } catch (e) {
      console.error(e);
    } finally {
      isLoading = false;
    }
  }

  function applyFilters() {
    currentPage = 1;
    fetchLogs();
  }

  function formatDate(iso: string) {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('id-ID', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  function formatJson(data: unknown) {
    if (!data) return '-';
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return '-';
    }
  }

  onMount(() => {
    fetchLogs();
  });
</script>

<div class="space-y-6 p-6">
  <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
    <div>
      <h1 class="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
        <svg class="w-6 h-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
        Audit Log System
      </h1>
      <p class="text-slate-500">Rekam jejak aktivitas sensitif secara Immutable.</p>
    </div>
  </div>

  <!-- Filters -->
  <div class="bg-white dark:bg-surface-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-surface-700 flex flex-wrap gap-4 items-end">
    <div>
      <label class="block text-xs font-bold text-slate-500 mb-1">Aksi / Event Type</label>
      <select bind:value={filterAction} class="w-48 p-2 border border-slate-200 dark:border-surface-600 rounded-lg bg-slate-50 dark:bg-surface-900 text-sm outline-none focus:border-brand-500">
        <option value="">Semua Aksi</option>
        {#each ACTIONS as action}
          <option value={action}>{action}</option>
        {/each}
      </select>
    </div>
    <div>
      <label class="block text-xs font-bold text-slate-500 mb-1">Mulai Tanggal</label>
      <input type="date" bind:value={filterDateFrom} class="w-40 p-2 border border-slate-200 dark:border-surface-600 rounded-lg bg-slate-50 dark:bg-surface-900 text-sm outline-none focus:border-brand-500" />
    </div>
    <div>
      <label class="block text-xs font-bold text-slate-500 mb-1">Sampai Tanggal</label>
      <input type="date" bind:value={filterDateTo} class="w-40 p-2 border border-slate-200 dark:border-surface-600 rounded-lg bg-slate-50 dark:bg-surface-900 text-sm outline-none focus:border-brand-500" />
    </div>
    <button onclick={applyFilters} class="px-4 py-2 bg-slate-800 text-white text-sm font-bold rounded-lg hover:bg-slate-900 shadow transition-colors">
      Filter Data
    </button>
  </div>

  <!-- Table -->
  <div class="bg-white dark:bg-surface-800 rounded-xl shadow-sm border border-slate-200 dark:border-surface-700 overflow-hidden">
    <div class="overflow-x-auto">
      <table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
        <thead class="bg-slate-50 dark:bg-surface-700/50 text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-surface-600">
          <tr>
            <th class="px-4 py-3">Waktu (WIB)</th>
            <th class="px-4 py-3">Aktor (Pengguna)</th>
            <th class="px-4 py-3">Action Type</th>
            <th class="px-4 py-3">Entity Info</th>
            <th class="px-4 py-3 max-w-xs">Old Value</th>
            <th class="px-4 py-3 max-w-xs">New Value</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-surface-700">
          {#if isLoading}
            <tr><td colspan="6" class="text-center py-10 text-slate-500 animate-pulse">Memuat log audit...</td></tr>
          {:else if logs.length === 0}
            <tr><td colspan="6" class="text-center py-10 text-slate-500">Tidak ada log yang sesuai kriteria.</td></tr>
          {:else}
            {#each logs as log}
              <tr class="hover:bg-slate-50 dark:hover:bg-surface-700/30 font-mono text-xs">
                <td class="px-4 py-3 whitespace-nowrap">{formatDate(log.created_at)}</td>
                <td class="px-4 py-3 font-sans">
                  {#if log.actor}
                    <span class="font-bold text-slate-800 dark:text-slate-200">{log.actor.username}</span>
                    <span class="text-[10px] uppercase bg-slate-100 dark:bg-surface-600 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 ml-1">{log.actor.role}</span>
                  {:else}
                    <span class="italic text-slate-400">System</span>
                  {/if}
                </td>
                <td class="px-4 py-3">
                  <span class="font-bold {log.action.includes('VOID') || log.action.includes('FAILED') ? 'text-red-600 dark:text-red-400' : 'text-blue-600 dark:text-blue-400'}">
                    {log.action}
                  </span>
                </td>
                <td class="px-4 py-3 text-slate-500">
                  {log.entity_type} <br/> <span class="text-[10px] text-slate-400 truncate w-32 block" title={log.entity_id}>{log.entity_id || '-'}</span>
                </td>
                <td class="px-4 py-3 max-w-xs">
                  {#if log.old_value}
                    <pre class="bg-slate-50 dark:bg-surface-900 p-2 rounded border border-slate-100 dark:border-surface-600 overflow-x-auto max-h-32 text-[10px]">{formatJson(log.old_value)}</pre>
                  {:else}
                    -
                  {/if}
                </td>
                <td class="px-4 py-3 max-w-xs">
                  {#if log.new_value}
                    <pre class="bg-slate-50 dark:bg-surface-900 p-2 rounded border border-slate-100 dark:border-surface-600 overflow-x-auto max-h-32 text-[10px]">{formatJson(log.new_value)}</pre>
                  {:else}
                    -
                  {/if}
                </td>
              </tr>
            {/each}
          {/if}
        </tbody>
      </table>
    </div>
    
    <div class="p-4 border-t border-slate-200 dark:border-surface-700 flex justify-between items-center text-sm">
      <span class="text-slate-500">Total: <strong class="text-slate-800 dark:text-slate-200">{total}</strong> records</span>
      <div class="flex gap-2">
        <button 
          disabled={currentPage === 1}
          onclick={() => { currentPage--; fetchLogs(); }}
          class="px-3 py-1.5 border border-slate-200 dark:border-surface-600 rounded disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-surface-700"
        >Prev</button>
        <span class="px-3 py-1.5 font-bold">Page {currentPage}</span>
        <button 
          disabled={logs.length < 50}
          onclick={() => { currentPage++; fetchLogs(); }}
          class="px-3 py-1.5 border border-slate-200 dark:border-surface-600 rounded disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-surface-700"
        >Next</button>
      </div>
    </div>
  </div>
</div>
