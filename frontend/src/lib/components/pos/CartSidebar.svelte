<script lang="ts">
  import { posStore } from '$lib/stores/pos.store.svelte';

  function vibrate() {
    if (navigator.vibrate) navigator.vibrate(50);
  }
</script>

<div class="w-full md:w-96 bg-white/90 dark:bg-surface-800/90 backdrop-blur-md border-l border-surface-200 dark:border-surface-700 flex flex-col shadow-xl z-20 fixed md:relative bottom-0 h-[70vh] md:h-full rounded-t-3xl md:rounded-none transition-transform duration-300">
  <div class="p-4 border-b border-surface-200 dark:border-surface-700 flex justify-between items-center bg-surface-50/50 dark:bg-surface-900/50 rounded-t-3xl md:rounded-none">
    <h2 class="text-lg font-bold flex items-center gap-2">
      <svg class="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
      Keranjang ({posStore.cart.reduce((sum, i) => sum + i.quantity, 0)})
    </h2>
    {#if posStore.cart.length > 0}
      <button class="text-brand-500 hover:text-brand-600 text-sm font-medium p-2" onclick={() => { vibrate(); posStore.cart = []; }}>Kosongkan</button>
    {/if}
  </div>

  <div class="flex-1 overflow-y-auto p-4">
    {#if posStore.cart.length === 0}
      <div class="h-full flex flex-col items-center justify-center text-surface-400">
        <svg class="w-16 h-16 mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path></svg>
        <p>Belum ada pesanan</p>
      </div>
    {:else}
      <div class="space-y-3">
        {#each posStore.cart as item}
          <div class="flex items-center gap-3 bg-surface-50 dark:bg-surface-900/50 p-3 rounded-2xl border border-surface-100 dark:border-surface-700/50">
            <div class="flex-1">
              <h4 class="font-medium text-sm leading-tight text-surface-800 dark:text-surface-100">{item.name}</h4>
              {#if item.selectedModifiers.length > 0}
                <p class="text-xs text-surface-500 mt-0.5">
                  + {item.selectedModifiers.map((m) => m.name).join(', ')}
                </p>
              {/if}
              <p class="text-brand-600 dark:text-brand-400 font-bold text-sm mt-1">{posStore.formatRp((item.base_price + item.selectedModifiers.reduce((s:number,m)=>s+Number(m.additional_price),0)) * item.quantity)}</p>
            </div>
            <div class="flex items-center gap-1 bg-white dark:bg-surface-800 rounded-xl shadow-sm border border-surface-200 dark:border-surface-700 p-1">
              <button class="w-11 h-11 flex items-center justify-center text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg active:scale-95 transition-all" onclick={() => { vibrate(); posStore.updateQuantity(item.cartItemId, -1); }}>
                {#if item.quantity === 1}
                  <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                {:else}
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"></path></svg>
                {/if}
              </button>
              <span class="w-8 text-center font-bold">{item.quantity}</span>
              <button class="w-11 h-11 flex items-center justify-center text-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/30 rounded-lg active:scale-95 transition-all" onclick={() => { vibrate(); posStore.updateQuantity(item.cartItemId, 1); }}>
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
              </button>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>

  <div class="p-4 bg-surface-50/80 dark:bg-surface-900/80 backdrop-blur border-t border-surface-200 dark:border-surface-700 pb-safe">
    <div class="mb-3">
      <select bind:value={posStore.appliedDiscount} class="w-full text-sm border-surface-200 dark:border-surface-600 rounded-lg bg-white dark:bg-surface-800 text-surface-700 dark:text-surface-200 py-2">
        <option value={null}>-- Tanpa Promo Diskon --</option>
        {#each posStore.activeDiscounts as d}
          <option value={d}>{d.name} ({d.type === 'percentage' ? d.value + '%' : posStore.formatRp(Number(d.value))})</option>
        {/each}
      </select>
    </div>
    {#if posStore.discountTotal > 0}
      <div class="flex justify-between items-center mb-2 px-2 text-red-500 font-medium">
        <span>Diskon Promo</span>
        <span>- {posStore.formatRp(posStore.discountTotal)}</span>
      </div>
    {/if}
    <div class="flex justify-between items-center mb-4 px-2">
      <span class="text-surface-500 font-medium">Total Bayar</span>
      <span class="text-3xl font-black text-brand-600 dark:text-brand-400">{posStore.formatRp(posStore.cartTotal)}</span>
    </div>
    <button
      class="w-full h-60 text-lg font-bold rounded-2xl {posStore.cart.length > 0 ? 'glass-button' : 'bg-surface-200 text-surface-400 cursor-not-allowed'}"
      disabled={posStore.cart.length === 0}
      onclick={() => posStore.showPaymentModal = true}
    >
      BAYAR SEKARANG
    </button>
  </div>
</div>

<style>
  .pb-safe {
    padding-bottom: env(safe-area-inset-bottom, 1rem);
  }
</style>
