<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { posStore } from '$lib/stores/pos.store.svelte';
  import { posService } from '$lib/services/pos.service';
  import { db } from '$lib/db';
  import { FLAG_REFRESH_INTERVAL_MS } from '$lib/utils/format';

  import ProductList from '$lib/components/pos/ProductList.svelte';
  import CartSidebar from '$lib/components/pos/CartSidebar.svelte';
  import Modals from '$lib/components/pos/Modals.svelte';

  // FIX F-01: Track interval references for cleanup
  let flagInterval: ReturnType<typeof setInterval> | undefined;
  // FIX F-03: Track event handler references for cleanup
  let handleOnline: (() => void) | undefined;
  let handleOffline: (() => void) | undefined;

  $effect(() => {
    if (posStore.isCartLoaded) {
      db.cart.put({ id: 'current_cart', items: $state.snapshot(posStore.cart) });
    }
  });

  // FIX F-02 & F-03: Cleanup on component destroy
  onDestroy(() => {
    // Clear flag refresh interval
    if (flagInterval) {
      clearInterval(flagInterval);
      flagInterval = undefined;
    }
    // Remove event listeners
    if (handleOnline) {
      window.removeEventListener('online', handleOnline);
      handleOnline = undefined;
    }
    if (handleOffline) {
      window.removeEventListener('offline', handleOffline);
      handleOffline = undefined;
    }
    // FIX F-01: Cancel SSE/polling on component destroy
    posService.cancelQrisWaiting();
  });

  onMount(async () => {
    posStore.isOffline = !navigator.onLine;

    // FIX F-03: Store handler references for cleanup
    handleOnline = async () => {
      posStore.isOffline = false;
      await posService.syncPendingOrders();
    };
    handleOffline = () => {
      posStore.isOffline = true;
      if (posStore.paymentMethod === 'qris' || posStore.paymentMethod === 'split') {
        posStore.paymentMethod = 'cash';
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    await posService.loadProductsFromDb();
    if (!posStore.isOffline) {
      posService.fetchFlags();
      // FIX F-02: Store interval reference for cleanup
      flagInterval = setInterval(() => posService.fetchFlags(), FLAG_REFRESH_INTERVAL_MS);
      await posService.checkShift();
      await posService.fetchProductsFromApi();
      await posService.fetchDiscounts();
      // FIX F-08: Sync pending orders on app start if online
      await posService.syncPendingOrders();
    } else {
      posStore.isCheckingShift = false;
    }

    try {
      const savedCart = await db.cart.get('current_cart');
      if (savedCart && savedCart.items && savedCart.items.length > 0) {
        posStore.cart = savedCart.items as typeof posStore.cart;
      }
    } catch (e) {
      console.error('Failed to load cart', e);
    }
    posStore.isCartLoaded = true;
  });
</script>

<div class="h-screen flex flex-col md:flex-row bg-surface-100 dark:bg-surface-900 overflow-hidden text-surface-900 dark:text-surface-50">
  {#if posStore.isOffline}
    <div class="absolute top-0 left-0 w-full bg-red-500 text-white text-center py-1 z-50 font-medium text-sm shadow-md animate-pulse-slow">
      OFFLINE - Data Tersimpan Lokal
    </div>
  {/if}

  <div class="flex-1 overflow-y-auto p-4 md:p-6 pb-32 md:pb-6">
    <div class="flex justify-between items-center mb-6 pt-6">
      <h1 class="text-2xl font-bold text-brand-600 dark:text-brand-400">Ngemiloh POS</h1>
      <div class="flex gap-2">
        <span class="px-4 py-2 bg-white dark:bg-surface-800 shadow-sm rounded-full text-sm font-medium border border-surface-200 dark:border-surface-700 flex items-center gap-2">
          <div class="w-2 h-2 rounded-full {posStore.isOffline ? 'bg-red-500' : 'bg-green-500'}"></div>
          Kasir: Nabil
        </span>
        <button onclick={() => posStore.showCloseShiftModal = true} class="px-4 py-2 bg-amber-50 text-amber-600 hover:bg-amber-100 shadow-sm rounded-full text-sm font-medium border border-amber-100 flex items-center gap-2 transition-colors">
          <span class="hidden sm:inline font-bold">Tutup Shift</span>
        </button>
        <button onclick={() => { posService.fetchHistory(); posStore.showHistoryModal = true; }} class="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 shadow-sm rounded-full text-sm font-medium border border-indigo-100 flex items-center gap-2 transition-colors">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
          <span class="hidden sm:inline">Riwayat</span>
        </button>
        <a href="/login" class="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 shadow-sm rounded-full text-sm font-medium border border-red-100 dark:border-red-900/50 flex items-center gap-2 transition-colors" title="Keluar">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
          <span class="hidden sm:inline">Logout</span>
        </a>
      </div>
    </div>

    <!-- Product List View -->
    <ProductList />
  </div>

  <!-- Cart Sidebar View -->
  <CartSidebar />

  <!-- Modals -->
  <Modals />
</div>
