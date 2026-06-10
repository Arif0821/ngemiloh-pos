<script lang="ts">
  import { api } from '$lib/services/api.client';
  import { onMount } from 'svelte';
  import type { OrderResponse } from '$lib/domain/models/types';
  
  let orders = $state<OrderResponse[]>([]);
  let isLoading = $state(true);
  
  let selectedOrder = $state<OrderResponse | null>(null);
  let showDetailModal = $state(false);
  let showVoidModal = $state(false);
  let voidReason = $state('');
  
  let filterDate = $state(new Date().toISOString().split('T')[0]);
  let filterStatus = $state('');
  let filterMethod = $state('');
  
  let currentPage = $state(1);
  let totalItems = $state(0);
  let totalPages = $derived(Math.ceil(totalItems / 50));

  async function fetchOrders() {
    isLoading = true;
    try {
      const hostname = window.location.hostname;
      // Note: Ideally the backend has filters query params. For MVP we'll fetch all and filter in client if needed, or better, pass query params.
      // Let's assume the Orders controller has basic fetch with query params.
      let url = `/api/v1/orders?date=${filterDate}&page=${currentPage}`;
      if (filterStatus) url += `&status=${filterStatus}`;
      if (filterMethod) url += `&method=${filterMethod}`;
      
      const res = await api.request(url, { credentials: 'include' });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.data)) {
          orders = data.data;
          totalItems = data.total || data.data.length;
        } else {
          orders = [];
          totalItems = 0;
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    fetchOrders();
  });

  async function handleVoid(e: Event) {
    e.preventDefault();
    if (voidReason.length < 10) return alert('Alasan void minimal 10 karakter');
    
    try {
      const hostname = window.location.hostname;
      const res = await api.request(`/api/v1/admin/transactions/${selectedOrder.id}/void`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ reason: voidReason })
      });
      if (res.ok) {
        showVoidModal = false;
        showDetailModal = false;
        fetchOrders();
      } else {
        alert('Gagal void transaksi');
      }
    } catch (e) {
      alert('Error pada server');
    }
  }

  async function flagTransaction(status: string) {
    try {
      const hostname = window.location.hostname;
      const res = await api.request(`/api/v1/admin/transactions/${selectedOrder.id}/flag`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status })
      });

      if (res.ok) {
        showDetailModal = false;
        fetchOrders();
      } else {
        alert('Gagal menandai transaksi');
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
  <title>Transaksi - Ngemiloh Admin</title>
</svelte:head>

<div class="h-full overflow-y-auto p-8">
  <div class="max-w-7xl mx-auto space-y-8">
    <header class="flex justify-between items-end">
      <div>
        <h1 class="text-3xl font-bold text-slate-900 tracking-tight">Riwayat Transaksi</h1>
        <p class="mt-2 text-slate-500">Pantau seluruh transaksi, detail pembayaran, dan void.</p>
      </div>
      <div class="flex gap-4">
        <input type="date" bind:value={filterDate} onchange={fetchOrders} class="px-4 py-2 border border-slate-300 rounded-lg bg-white shadow-sm">
        <select bind:value={filterStatus} onchange={fetchOrders} class="px-4 py-2 border border-slate-300 rounded-lg bg-white shadow-sm">
          <option value="">Semua Status</option>
          <option value="completed">Selesai</option>
          <option value="voided">Void / Dibatalkan</option>
          <option value="pending_sync">Pending Sync</option>
        </select>
        <select bind:value={filterMethod} onchange={fetchOrders} class="px-4 py-2 border border-slate-300 rounded-lg bg-white shadow-sm">
          <option value="">Semua Metode</option>
          <option value="cash">Tunai</option>
          <option value="qris">QRIS</option>
          <option value="split">Split Payment</option>
        </select>
      </div>
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
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Waktu</th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Kasir</th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Metode</th>
                <th class="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">Total (Rp)</th>
                <th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                <th class="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-200 bg-white">
              {#if orders.length === 0}
                <tr>
                  <td colspan="6" class="px-6 py-8 text-center text-slate-500">Tidak ada transaksi yang ditemukan.</td>
                </tr>
              {:else}
                {#each orders as order}
                  <tr class="hover:bg-slate-50 transition-colors {order.status === 'voided' ? 'bg-red-50/50 opacity-75' : ''}">
                    <td class="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                      {new Date(order.client_created_at ?? order.created_at ?? Date.now()).toLocaleString('id-ID')}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      {order.cashier?.name || 'Kasir'}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      {#if order.payment_method === 'cash'}
                        <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800">TUNAI</span>
                      {:else if order.payment_method === 'qris'}
                        <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">QRIS</span>
                      {:else}
                        <span class="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800">SPLIT</span>
                      {/if}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-bold text-slate-900">
                      {formatRp(Number(order.total_amount))}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap">
                      {#if order.status === 'completed'}
                        <span class="text-xs font-medium text-emerald-600 flex items-center"><span class="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5"></span>Selesai</span>
                      {:else if order.status === 'voided'}
                        <span class="text-xs font-medium text-red-600 flex items-center"><span class="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5"></span>Voided</span>
                      {:else}
                        <span class="text-xs font-medium text-yellow-600 flex items-center"><span class="w-1.5 h-1.5 bg-yellow-500 rounded-full mr-1.5"></span>Pending</span>
                      {/if}
                    </td>
                    <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button 
                        onclick={() => { selectedOrder = order; showDetailModal = true; }} 
                        class="text-indigo-600 hover:text-indigo-900 font-bold bg-indigo-50 px-3 py-1 rounded-lg"
                      >
                        Detail
                      </button>
                    </td>
                  </tr>
                {/each}
              {/if}
            </tbody>
          </table>
        </div>
        
        <!-- Pagination Controls -->
        <div class="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center text-sm">
          <p class="text-slate-600">Total: <strong>{totalItems}</strong> transaksi</p>
          <div class="flex gap-2">
            <button 
              disabled={currentPage === 1}
              onclick={() => { currentPage--; fetchOrders(); }}
              class="px-3 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50"
            >
              Prev
            </button>
            <span class="px-3 py-1 font-medium text-slate-700">Halaman {currentPage} dari {totalPages || 1}</span>
            <button 
              disabled={currentPage >= totalPages}
              onclick={() => { currentPage++; fetchOrders(); }}
              class="px-3 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<!-- Modal Detail Transaksi -->
{#if showDetailModal && selectedOrder}
<div class="fixed inset-0 bg-slate-900/75 z-50 flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
    <div class="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
      <h3 class="text-xl font-bold text-slate-800">Detail Transaksi <span class="text-slate-500 text-sm ml-2 font-normal">#{selectedOrder.id.split('-')[0]}</span></h3>
      <button onclick={() => showDetailModal = false} class="text-slate-400 hover:text-slate-600">X</button>
    </div>
    
    <div class="p-6 overflow-y-auto flex-1 bg-white">
      <div class="grid grid-cols-2 gap-4 mb-8">
        <div>
          <p class="text-xs text-slate-500 uppercase tracking-wider mb-1">Kasir</p>
          <p class="font-bold text-slate-900">{selectedOrder.cashier?.name || 'Kasir'}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500 uppercase tracking-wider mb-1">Waktu</p>
          <p class="font-bold text-slate-900">{new Date(selectedOrder.client_created_at ?? selectedOrder.created_at ?? Date.now()).toLocaleString('id-ID')}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500 uppercase tracking-wider mb-1">Metode Pembayaran</p>
          <p class="font-bold text-slate-900 uppercase">{selectedOrder.payment_method}</p>
        </div>
        <div>
          <p class="text-xs text-slate-500 uppercase tracking-wider mb-1">Status</p>
          <p class="font-bold {selectedOrder.status === 'completed' ? 'text-emerald-600' : 'text-red-600'} uppercase">{selectedOrder.status}</p>
        </div>
      </div>
      
      {#if selectedOrder.status === 'voided'}
        <div class="mb-8 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p class="text-xs text-red-600 uppercase font-bold mb-1">Alasan Void:</p>
          <p class="text-red-800">{selectedOrder.void_reason || 'Tidak ada alasan'}</p>
          <p class="text-xs text-red-500 mt-2">Dibatalkan oleh: {selectedOrder.voider?.name || 'Superadmin'}</p>
        </div>
      {/if}

      {#if selectedOrder.payment_method === 'qris'}
        <div class="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-xl flex justify-between items-center">
          <div class="flex-1">
            <p class="text-xs text-blue-600 uppercase font-bold mb-1">Status Verifikasi QRIS:</p>
            <p class="text-blue-900 font-bold">{selectedOrder.verification_status || 'Belum Dicek'}</p>
            <p class="text-xs text-blue-700 mt-2">Pastikan mutasi masuk ke rekening sejumlah <strong>{formatRp(Number(selectedOrder.qris_amount || selectedOrder.total_amount))}</strong> dengan referensi pesanan <strong>{selectedOrder.client_uuid || selectedOrder.id}</strong>.</p>
          </div>
          {#if selectedOrder.status !== 'voided'}
            <div class="flex gap-2">
              <button onclick={() => flagTransaction('Perlu Cek')} class="px-3 py-1 bg-yellow-100 text-yellow-700 border border-yellow-300 rounded text-sm font-bold hover:bg-yellow-200">Tandai Perlu Cek</button>
              <button onclick={() => flagTransaction('Valid')} class="px-3 py-1 bg-emerald-100 text-emerald-700 border border-emerald-300 rounded text-sm font-bold hover:bg-emerald-200">Tandai Valid</button>
            </div>
          {/if}
        </div>
      {/if}

      <div class="border border-slate-200 rounded-xl overflow-hidden mb-6">
        <table class="min-w-full divide-y divide-slate-200">
          <thead class="bg-slate-50">
            <tr>
              <th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Item</th>
              <th class="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase">Qty</th>
              <th class="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase">Subtotal</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-200 bg-white">
            {#if selectedOrder.items}
              {#each selectedOrder.items as item}
                <tr>
                  <td class="px-4 py-3">
                    <p class="font-bold text-slate-800">{item.product_name_snapshot}</p>
                    {#if item.modifiers && item.modifiers.length > 0}
                      <ul class="mt-1 text-xs text-slate-500 space-y-0.5">
                        {#each item.modifiers as mod}
                          <li>+ {mod.option_name_snapshot} ({formatRp(Number(mod.additional_price_at_time))})</li>
                        {/each}
                      </ul>
                    {/if}
                  </td>
                  <td class="px-4 py-3 text-center font-bold text-slate-700">{item.quantity}</td>
                  <td class="px-4 py-3 text-right font-bold text-slate-900">{formatRp(Number(item.subtotal))}</td>
                </tr>
              {/each}
            {:else}
              <tr><td colspan="3" class="px-4 py-3 text-center text-slate-500 text-sm">Tidak ada detail item</td></tr>
            {/if}
          </tbody>
        </table>
      </div>

      <div class="flex justify-end">
        <div class="w-64 space-y-2">
          {#if Number(selectedOrder.discount_total) > 0}
            <div class="flex justify-between text-sm text-red-500 font-medium">
              <span>Diskon</span>
              <span>- {formatRp(Number(selectedOrder.discount_total))}</span>
            </div>
          {/if}
          <div class="flex justify-between items-center text-lg font-black text-slate-900 pt-2 border-t border-slate-200">
            <span>Total Akhir</span>
            <span>{formatRp(Number(selectedOrder.total_amount))}</span>
          </div>
        </div>
      </div>
    </div>
    
    <div class="p-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center">
      <button onclick={() => showDetailModal = false} class="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-white font-medium">Tutup</button>
      {#if selectedOrder.status === 'completed'}
        <button onclick={() => showVoidModal = true} class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold shadow-sm flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          Void Transaksi
        </button>
      {/if}
    </div>
  </div>
</div>
{/if}

<!-- Modal Void Transaksi -->
{#if showVoidModal}
<div class="fixed inset-0 bg-slate-900/75 z-[60] flex items-center justify-center p-4">
  <div class="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden border-2 border-red-500">
    <div class="p-6 bg-red-50 border-b border-red-100">
      <h3 class="text-lg font-bold text-red-800 flex items-center gap-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        Peringatan Void
      </h3>
    </div>
    <form onsubmit={handleVoid} class="p-6 space-y-4">
      <p class="text-sm text-slate-600 mb-4">Membatalkan (Void) transaksi ini tidak dapat diurungkan. Stok tidak otomatis kembali dan data laporan akan berubah.</p>
      {#if selectedOrder && (selectedOrder.payment_method === 'qris' || selectedOrder.payment_method === 'split')}
        <div class="bg-red-50 p-3 rounded-lg border border-red-200">
          <p class="text-red-700 font-bold text-sm">Instruksi Void Non-Tunai:</p>
          <p class="text-red-600 text-sm">Kembalikan dana ke pelanggan secara manual tunai dari kas.</p>
        </div>
      {/if}
      <div>
        <label class="block text-sm font-bold text-slate-700 mb-1">Alasan Void <span class="text-red-500">*</span></label>
        <textarea bind:value={voidReason} required minlength="10" rows="3" class="w-full border-slate-300 rounded-lg focus:ring-red-500 focus:border-red-500 p-3" placeholder="Minimal 10 karakter..."></textarea>
      </div>
      <div class="pt-2 flex gap-3">
        <button type="button" onclick={() => showVoidModal = false} class="flex-1 px-4 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 font-medium">Batal</button>
        <button type="submit" class="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold shadow-sm">VOID Sekarang</button>
      </div>
    </form>
  </div>
</div>
{/if}
