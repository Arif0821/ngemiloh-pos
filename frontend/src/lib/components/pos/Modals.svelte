<script lang="ts">
  import { posStore } from '$lib/stores/pos.store.svelte';
  import { posService } from '$lib/services/pos.service';
  import { printerService } from '$lib/services/printer.service';
  import { toast } from '$lib/stores/toast.store.svelte';
  import type { OrderResponse } from '$lib/domain/models/types';

  function formatTime(seconds: number) {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  // P1-ACCESSIBILITY: Focus trap action for modals
  function focusTrap(node: HTMLElement) {
    const focusableElements = node.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    function handleKeydown(e: KeyboardEvent) {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
      if (e.key === 'Escape') {
        const closeButton = node.querySelector<HTMLElement>('[data-modal-close]');
        closeButton?.click();
      }
    }

    node.addEventListener('keydown', handleKeydown);
    firstElement?.focus();

    return {
      destroy() {
        node.removeEventListener('keydown', handleKeydown);
      }
    };
  }

  async function printReceipt(order: OrderResponse) {
    try {
      const receiptText = printerService.formatReceipt(order, 'NGEMILOH POS', 'Terima Kasih Telah Berbelanja');
      const success = await printerService.connectAndPrint(receiptText);
      if (!success) {
        toast.warning('Cetak struk gagal, mungkin perangkat tidak didukung atau Anda belum memberikan izin Bluetooth. Anda masih bisa melihat struk dari riwayat pesanan.');
      }
    } catch (e) {
      toast.warning('Fitur Bluetooth Web tidak tersedia di browser ini.');
    }
  }

  function confirmModifiers() {
    if (!posStore.selectedProductForModifier) return;
    for (const g of posStore.selectedProductForModifier.modifier_groups) {
      if (g.is_required && !posStore.selectedModifiers[g.id]) {
        toast.warning(`Pilihan ${g.name} wajib diisi!`);
        return;
      }
    }
    posStore.addToCart(posStore.selectedProductForModifier, Object.values(posStore.selectedModifiers));
  }
</script>

{#if !posStore.hasOpenShift && !posStore.isCheckingShift}
  <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="open-shift-title">
    <div class="bg-white dark:bg-surface-800 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200" use:focusTrap>
      <div class="p-6 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/30">
        <h2 id="open-shift-title" class="text-xl font-bold text-amber-800 dark:text-amber-500">Mulai Shift</h2>
        <p class="text-sm text-amber-700/80 dark:text-amber-400/80 mt-1">Anda belum memulai shift hari ini. Silakan masukkan uang modal laci (Kas Awal).</p>
      </div>
      <form onsubmit={(e) => { e.preventDefault(); posService.handleOpenShift(posStore.openingBalance); }} class="p-6">
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Kas Awal (Rp)</label>
            <input type="number" bind:value={posStore.openingBalance} required class="w-full p-3 border border-slate-200 dark:border-surface-600 rounded-xl bg-slate-50 dark:bg-surface-900 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-amber-500 outline-none" />
          </div>
        </div>
        <button type="submit" class="mt-6 w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl shadow-lg shadow-amber-500/30">
          Buka Laci & Mulai Shift
        </button>
      </form>
    </div>
  </div>
{/if}

{#if posStore.showCloseShiftModal}
  <div class="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="close-shift-title">
    <div class="bg-white dark:bg-surface-800 w-full max-w-md rounded-2xl shadow-xl overflow-hidden animate-in fade-in zoom-in duration-200" use:focusTrap>
      <div class="p-6 border-b border-slate-100 dark:border-surface-700 flex justify-between items-center">
        <h2 id="close-shift-title" class="text-xl font-bold text-slate-800 dark:text-slate-100">Tutup Shift</h2>
        <button type="button" onclick={() => posStore.showCloseShiftModal = false} data-modal-close class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
      <form onsubmit={(e) => { e.preventDefault(); posService.handleCloseShift(posStore.closingBalance); }} class="p-6 space-y-4">
        <p class="text-sm text-slate-600 dark:text-slate-400">Silakan hitung uang fisik di laci kasir dan masukkan nominal akhirnya untuk dicocokkan dengan sistem.</p>
        <div>
          <label class="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Kas Akhir Laci (Fisik)</label>
          <input type="number" bind:value={posStore.closingBalance} required class="w-full p-3 border border-slate-200 dark:border-surface-600 rounded-xl bg-slate-50 dark:bg-surface-900 text-slate-800 dark:text-slate-100 font-bold focus:ring-2 focus:ring-red-500 outline-none" />
        </div>
        <div class="pt-4 flex gap-3 justify-end">
          <button type="button" onclick={() => posStore.showCloseShiftModal = false} class="px-4 py-2 text-slate-600 dark:text-slate-300 font-bold hover:bg-slate-50 dark:hover:bg-surface-700 rounded-lg">Batal</button>
          <button type="submit" class="px-6 py-2 bg-red-600 text-white font-bold rounded-lg shadow-lg hover:bg-red-700">Tutup Shift & Log Out</button>
        </div>
      </form>
    </div>
  </div>
{/if}

{#if posStore.showModifierModal && posStore.selectedProductForModifier}
  <div class="fixed inset-0 bg-surface-900/80 backdrop-blur-sm flex items-center justify-center z-60 p-4" role="dialog" aria-modal="true" aria-labelledby="modifier-title">
    <div class="bg-white dark:bg-surface-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200" use:focusTrap>
      <div class="p-5 border-b border-surface-200 dark:border-surface-700 flex justify-between items-center bg-surface-50 dark:bg-surface-900/50">
        <h2 id="modifier-title" class="text-xl font-bold">{posStore.selectedProductForModifier.name}</h2>
        <button type="button" class="w-10 h-10 flex items-center justify-center rounded-full bg-surface-200 dark:bg-surface-700 text-surface-500 hover:text-surface-700" onclick={() => posStore.showModifierModal = false} data-modal-close>
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
      
      <div class="p-5 overflow-y-auto flex-1 space-y-6">
        {#each posStore.selectedProductForModifier.modifier_groups as group}
          <div>
            <h3 class="font-bold mb-3 flex items-center justify-between">
              <span>{group.name} {group.is_required ? '*' : ''}</span>
            </h3>
            <div class="grid grid-cols-2 gap-3">
              {#each group.options as option}
                <button 
                  class="p-3 rounded-xl border-2 text-left transition-all {posStore.selectedModifiers[group.id]?.id === option.id ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 text-brand-700 dark:text-brand-300' : 'border-surface-200 dark:border-surface-700'}"
                  onclick={() => {
                    if (posStore.selectedModifiers[group.id]?.id === option.id && !group.is_required) {
                      delete posStore.selectedModifiers[group.id];
                    } else {
                      posStore.selectedModifiers[group.id] = option;
                    }
                  }}
                >
                  <div class="font-medium text-sm">{option.name}</div>
                  {#if Number(option.additional_price) > 0}
                    <div class="text-xs font-bold text-brand-600 dark:text-brand-400 mt-1">+{posStore.formatRp(Number(option.additional_price))}</div>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
      
      <div class="p-5 border-t border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50">
        <div class="flex justify-between items-center mb-4">
          <span class="font-medium text-surface-500">Total Harga</span>
          <span class="text-2xl font-bold text-brand-600 dark:text-brand-400">
            {posStore.formatRp(Number(posStore.selectedProductForModifier.base_price) + posStore.modifierTotal)}
          </span>
        </div>
        <button 
          class="w-full py-4 text-lg font-bold rounded-xl shadow-md active:scale-95 transition-all {posStore.isAllRequiredModifiersSelected ? 'bg-brand-600 hover:bg-brand-700 text-white' : 'bg-surface-300 text-surface-500 cursor-not-allowed'}"
          onclick={confirmModifiers}
          disabled={!posStore.isAllRequiredModifiersSelected}
        >
          TAMBAH PESANAN
        </button>
      </div>
    </div>
  </div>
{/if}

{#if posStore.showPaymentModal}
  <div class="fixed inset-0 bg-surface-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" role="dialog" aria-modal="true" aria-labelledby="payment-title">
    <div class="bg-white dark:bg-surface-800 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200" use:focusTrap>
      <div class="p-5 border-b border-surface-200 dark:border-surface-700 flex justify-between items-center bg-surface-50 dark:bg-surface-900/50">
        <h2 id="payment-title" class="text-xl font-bold">Pembayaran</h2>
        <button type="button" class="w-10 h-10 flex items-center justify-center rounded-full bg-surface-200 dark:bg-surface-700 text-surface-500 hover:text-surface-700 transition-colors" onclick={() => posStore.showPaymentModal = false} data-modal-close>
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
      
      <div class="p-6 flex-1 overflow-y-auto">
        <div class="text-center mb-8">
          <p class="text-surface-500 mb-2 font-medium">Total Tagihan</p>
          <p class="text-5xl font-black text-brand-600 dark:text-brand-400 tracking-tight">{posStore.formatRp(posStore.cartTotal)}</p>
        </div>

        <div class="grid grid-cols-3 gap-3 mb-6">
          <button 
            type="button"
            onclick={() => { posStore.paymentMethod = 'cash'; posStore.cashAmount = posStore.cartTotal; }}
            class="py-3 px-4 rounded-xl border-2 font-bold text-sm transition-all {posStore.paymentMethod === 'cash' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-brand-200'}"
          >
            Tunai
          </button>
          {#if posStore.featureFlags.QRIS_PAYMENT !== false}
            <button 
              type="button"
              onclick={() => { posStore.paymentMethod = 'qris'; posStore.cashAmount = 0; }}
              class="py-3 px-4 rounded-xl border-2 font-bold text-sm transition-all {posStore.paymentMethod === 'qris' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-brand-200'}"
            >
              QRIS
            </button>
          {/if}
          {#if posStore.featureFlags.SPLIT_PAYMENT !== false}
            <button 
              type="button"
              onclick={() => { posStore.paymentMethod = 'split'; posStore.splitCashAmount = Math.floor(posStore.cartTotal/2); }}
              class="py-3 px-4 rounded-xl border-2 font-bold text-sm transition-all {posStore.paymentMethod === 'split' ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-slate-200 text-slate-600 hover:border-brand-200'}"
            >
              Split
            </button>
          {/if}
        </div>
        {#if posStore.isOffline}
          <div class="text-center text-xs text-red-500 font-bold mb-4">QRIS/SPLIT tidak tersedia saat Offline</div>
        {/if}

        <div class="mt-4">
        {#if posStore.paymentMethod === 'cash'}
          <div class="space-y-5 animate-in slide-in-from-left-4 duration-300">
            <div>
              <label class="block text-sm font-medium text-surface-600 dark:text-surface-400 mb-2">Nominal Diterima</label>
              <div class="relative">
                <span class="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-surface-400 text-xl">Rp</span>
                <input type="number" bind:value={posStore.cashAmount} class="w-full pl-14 pr-4 py-4 bg-surface-50 dark:bg-surface-900 border-2 border-surface-200 dark:border-surface-700 rounded-2xl text-2xl font-bold focus:ring-4 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" />
              </div>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <button class="col-span-3 py-3 bg-surface-100 dark:bg-surface-700 rounded-xl font-bold text-surface-700 hover:bg-surface-200 transition-colors" onclick={() => posStore.cashAmount = posStore.cartTotal}>Uang Pas</button>
              {#each [10000, 20000, 50000, 100000] as preset}
                <button class="py-2.5 bg-surface-50 border border-surface-200 rounded-xl font-medium text-sm text-surface-600 hover:border-brand-500 hover:text-brand-600 transition-colors" onclick={() => posStore.cashAmount = preset}>{posStore.formatRp(preset)}</button>
              {/each}
            </div>
            {#if posStore.cashAmount > 0}
              <div class="mt-2 p-5 rounded-2xl {posStore.cashChange >= 0 ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'} transition-all">
                <p class="text-sm font-medium mb-1 opacity-80">{posStore.cashChange >= 0 ? 'Kembalian:' : 'Kurang:'}</p>
                <p class="text-3xl font-black">{posStore.formatRp(Math.abs(posStore.cashChange))}</p>
              </div>
            {/if}
          </div>
        {:else if posStore.paymentMethod === 'qris'}
          <div class="flex flex-col items-center animate-in slide-in-from-right-4 duration-300">
            <div class="w-full bg-surface-50 p-4 rounded-2xl border border-brand-200 text-center">
              <p class="text-surface-600 font-medium mb-2">Total Pembayaran QRIS:</p>
              <p class="text-3xl font-black text-brand-600">{posStore.formatRp(posStore.cartTotal)}</p>
              <p class="text-sm mt-4 text-brand-600">Tekan KONFIRMASI BAYAR untuk membuat QRIS</p>
            </div>
          </div>
        {:else if posStore.paymentMethod === 'split'}
          <div class="space-y-4 animate-in slide-in-from-bottom-4 duration-300">
            <div>
              <label class="block text-sm font-medium text-surface-600 mb-1">Uang Tunai Diterima</label>
              <div class="relative">
                <span class="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-surface-400 text-xl">Rp</span>
                <input type="number" bind:value={posStore.splitCashAmount} class="w-full pl-14 pr-4 py-4 bg-surface-50 border-2 border-surface-200 rounded-2xl text-2xl font-bold focus:ring-4 focus:ring-brand-500/20 focus:border-brand-500 outline-none transition-all" />
              </div>
            </div>
            {#if posStore.splitQrisAmount > 0}
              <div class="p-4 bg-brand-50 rounded-xl border border-brand-200">
                <p class="text-sm text-brand-700 mb-1 font-medium">Sisa Pembayaran via QRIS</p>
                <p class="text-2xl font-black text-brand-700">{posStore.formatRp(posStore.splitQrisAmount)}</p>
              </div>
            {:else if posStore.splitCashAmount >= posStore.cartTotal && posStore.cartTotal > 0}
               <div class="p-4 bg-green-50 rounded-xl border border-green-200">
                 <p class="text-green-700 font-bold">Uang tunai sudah mencukupi total bayar.</p>
               </div>
            {/if}
          </div>
        {/if}
        </div>
      </div>

      <div class="p-5 border-t border-surface-200 bg-surface-50">
        <button 
          class="w-full h-15 text-lg font-bold rounded-2xl flex items-center justify-center gap-2 {posStore.paymentMethod === 'cash' && posStore.cashChange < 0 || posStore.paymentMethod === 'split' && posStore.splitCashAmount >= posStore.cartTotal || posStore.isProcessing ? 'bg-surface-200 text-surface-400 cursor-not-allowed' : 'glass-button'}"
          disabled={(posStore.paymentMethod === 'cash' && posStore.cashChange < 0) || (posStore.paymentMethod === 'split' && posStore.splitCashAmount >= posStore.cartTotal) || posStore.isProcessing}
          onclick={() => posService.processPayment(
            (data) => posService.startQrisWaiting(data, () => {
              if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
              posService.cancelQrisWaiting();
              posStore.lastOrderDetails = posStore.qrisOrderInfo;
              posStore.showSuccessModal = true;
              setTimeout(() => { if (posStore.showSuccessModal) posStore.resetPos(); }, 3000);
            }),
            (data) => {
              posStore.lastOrderDetails = data;
              posStore.showPaymentModal = false;
              posStore.showSuccessModal = true;
              if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
              setTimeout(() => { if (posStore.showSuccessModal) posStore.resetPos(); }, 3000);
            }
          )}
        >
          {#if posStore.isProcessing}
            <svg class="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
            MEMPROSES...
          {:else}
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            KONFIRMASI BAYAR
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

{#if posStore.isWaitingQris && posStore.qrisOrderInfo}
  <div class="fixed inset-0 bg-surface-900/90 backdrop-blur-md flex items-center justify-center z-80 p-4" role="alertdialog" aria-modal="true" aria-labelledby="qris-title">
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col text-center animate-in zoom-in-95 duration-300" use:focusTrap>
      <div class="p-6 pb-4">
        <h2 id="qris-title" class="text-xl font-bold mb-2">Menunggu Pembayaran</h2>
        <p class="text-surface-500 font-medium">#{posStore.qrisOrderInfo.client_uuid.split('-')[0].toUpperCase()}</p>
      </div>
      <div class="px-6 py-4 bg-surface-50 border-y border-surface-200">
        <div class="bg-white p-4 rounded-2xl shadow-sm border border-surface-200 inline-block mb-4">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data={encodeURIComponent(posStore.qrisOrderInfo.qr_string || '')}" alt="QRIS" class="w-48 h-48" />
        </div>
        <p class="text-3xl font-black text-brand-600 mb-1">{posStore.formatRp(posStore.qrisOrderInfo.final_price || posStore.cartTotal)}</p>
        <div class="text-red-500 font-bold font-mono text-xl animate-pulse">Sisa Waktu: {formatTime(posStore.qrisCountdown)}</div>
      </div>
      <div class="p-6">
        <button class="w-full py-3 rounded-xl font-bold border-2 border-surface-300 text-surface-600 hover:bg-surface-100" onclick={() => { posService.cancelQrisWaiting(); posStore.resetCart(); }}>BATALKAN TRANSAKSI</button>
      </div>
    </div>
  </div>
{/if}

{#if posStore.showSuccessModal && posStore.lastOrderDetails}
  <div class="fixed inset-0 bg-surface-900/80 backdrop-blur-sm flex items-center justify-center z-70 p-4" role="dialog" aria-modal="true" aria-labelledby="success-title">
    <div class="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden flex flex-col text-center animate-in zoom-in-95 border-4 border-green-500" use:focusTrap>
      <div class="p-8 pt-10 pb-6 flex flex-col items-center">
        <div class="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-6 shadow-inner">
          <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7"></path></svg>
        </div>
        <h2 id="success-title" class="text-2xl font-black text-surface-800 dark:text-surface-100 mb-2">Transaksi Berhasil!</h2>
        <p class="text-slate-500 font-medium">#{posStore.lastOrderDetails.client_uuid.split('-')[0].toUpperCase()}</p>
      </div>
      <div class="p-6 bg-slate-50 space-y-3 border-t border-slate-100">
        <button class="w-full py-4 rounded-xl font-bold border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 flex items-center justify-center gap-2" onclick={() => posStore.lastOrderDetails && printReceipt(posStore.lastOrderDetails)}>CETAK STRUK</button>
        <button class="w-full py-4 rounded-xl font-black bg-brand-600 hover:bg-brand-700 text-white shadow-lg" onclick={() => posStore.resetPos()}>SELESAI & ORDER BARU</button>
      </div>
    </div>
  </div>
{/if}

{#if posStore.showHistoryModal}
  <div class="fixed inset-0 bg-surface-900/80 backdrop-blur-sm flex items-end md:items-center justify-center z-70 md:p-4" role="dialog" aria-modal="true" aria-labelledby="history-title">
    <div class="bg-white rounded-t-3xl md:rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col h-[85vh] md:h-[70vh] animate-in slide-in-from-bottom-full md:zoom-in-95 pb-safe" use:focusTrap>
      <div class="p-5 border-b border-surface-200 flex justify-between items-center bg-surface-50">
        <h2 id="history-title" class="text-xl font-bold">Riwayat Transaksi</h2>
        <button type="button" class="w-10 h-10 rounded-full bg-surface-200 text-surface-500 flex items-center justify-center" onclick={() => posStore.showHistoryModal = false} data-modal-close>
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>
      <div class="flex-1 overflow-y-auto p-4 bg-slate-50">
        {#if posStore.historyOrders.length === 0}
          <div class="h-full flex flex-col items-center justify-center text-slate-400">
            <p>Belum ada transaksi hari ini.</p>
          </div>
        {:else}
          <div class="space-y-4">
            {#each posStore.historyOrders as order}
              <div class="bg-white border border-slate-200 rounded-2xl p-4 flex justify-between">
                <div>
                  <div class="flex items-center gap-2 mb-1">
                    <span class="font-bold text-slate-800">#{order.client_uuid.split('-')[0].toUpperCase()}</span>
                    <span class="px-2 py-0.5 bg-green-100 text-green-700 text-xs font-bold rounded uppercase">{order.payment_status || 'PENDING'}</span>
                  </div>
                  <p class="text-sm text-slate-500 mb-2">{new Date(order.created_at ?? Date.now()).toLocaleString('id-ID')} • {(order.payment_method ?? 'cash').toUpperCase()}</p>
                </div>
                <div class="text-right">
                  <p class="text-lg font-black text-brand-600">{posStore.formatRp(order.final_price)}</p>
                  <button class="text-indigo-600 text-sm font-bold mt-2 hover:underline" onclick={() => printReceipt(order)}>Cetak Ulang</button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}
