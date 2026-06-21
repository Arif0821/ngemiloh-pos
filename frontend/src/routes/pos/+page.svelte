<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { pos_store } from '$lib/stores/pos.store.svelte';
	import { pos_service } from '$lib/services/pos.service';
	import { api } from '$lib/services/api.client';
	import { db } from '$lib/db';
	import { FLAG_REFRESH_INTERVAL_MS } from '$lib/utils/format';

	import ProductList from '$lib/components/pos/ProductList.svelte';
	import CartSidebar from '$lib/components/pos/CartSidebar.svelte';
	import ModalManager from '$lib/components/pos/ModalManager.svelte';

	// Logout handler (KRITIS-04)
	async function handle_logout() {
		try {
			await api.post('/auth/logout', {});
		} catch {
			// Lanjutkan logout walau request gagal
		} finally {
			localStorage.removeItem('user');
			window.location.href = '/login';
		}
	}

	// Track interval references for cleanup
	let flag_interval: ReturnType<typeof setInterval> | undefined;
	let shift_interval: ReturnType<typeof setInterval> | undefined;
	let handle_online: (() => void) | undefined;
	let handle_offline: (() => void) | undefined;

	// Cart persistence: reactive tracking of cart changes
	// Use a separate state to track when cart has been populated from Dexie
	let cart_initialized = $state(false);

	// Save cart to Dexie whenever cart changes (after initial load)
	$effect(() => {
		// Only save after we've loaded from Dexie and user has cart data
		if (cart_initialized && pos_store.cart.length > 0) {
			db.cart.put({ id: 'current_cart', items: [...pos_store.cart] }).catch((e) => {
				console.error('Failed to save cart to Dexie:', e);
			});
		}
	});

	onDestroy(() => {
		// Clear flag refresh interval
		if (flag_interval) {
			clearInterval(flag_interval);
			flag_interval = undefined;
		}
		// Clear shift polling interval
		if (shift_interval) {
			clearInterval(shift_interval);
			shift_interval = undefined;
		}
		// Remove event listeners
		if (handle_online) {
			window.removeEventListener('online', handle_online);
			handle_online = undefined;
		}
		if (handle_offline) {
			window.removeEventListener('offline', handle_offline);
			handle_offline = undefined;
		}
		// Cancel SSE/polling on component destroy
		pos_service.cancel_qris_waiting();
	});

	onMount(async () => {
		// Set initial offline state from browser
		pos_store.is_offline = !navigator.onLine;

		// Store handler references for cleanup
		handle_online = async () => {
			pos_store.is_offline = false; // BUG-06 FIX: Update state on online event
			await pos_service.sync_pending_orders();
		};
		handle_offline = () => {
			pos_store.is_offline = true; // BUG-06 FIX: Update state on offline event
			if (pos_store.payment_method === 'qris' || pos_store.payment_method === 'split') {
				pos_store.payment_method = 'cash';
			}
		};

		window.addEventListener('online', handle_online);
		window.addEventListener('offline', handle_offline);

		await pos_service.load_products_from_db();
		if (!pos_store.is_offline) {
			pos_service.fetch_flags();
			flag_interval = setInterval(() => pos_service.fetch_flags(), FLAG_REFRESH_INTERVAL_MS);
			await pos_service.check_shift();
			shift_interval = setInterval(() => pos_service.check_shift(), FLAG_REFRESH_INTERVAL_MS);
			await pos_service.fetch_products_from_api();
			await pos_service.fetch_discounts();
			await pos_service.sync_pending_orders();
		} else {
			pos_store.is_checking_shift = false;
		}

		// Load saved cart from Dexie
		try {
			const saved_cart = await db.cart.get('current_cart');
			if (saved_cart && Array.isArray(saved_cart.items) && saved_cart.items.length > 0) {
				pos_store.cart = saved_cart.items as typeof pos_store.cart;
			}
		} catch (e) {
			console.error('Failed to load cart', e);
		}
		// Mark cart as initialized AFTER loading (prevents saving empty cart over saved cart)
		cart_initialized = true;
	});
</script>

<div
	class="bg-surface-100 dark:bg-surface-900 text-surface-900 dark:text-surface-50 flex h-screen flex-col overflow-hidden md:flex-row"
>
	{#if pos_store.is_offline}
		<div
			class="animate-pulse-slow absolute top-0 left-0 z-50 w-full bg-red-500 py-1 text-center text-sm font-medium text-white shadow-md"
		>
			OFFLINE - Data Tersimpan Lokal
		</div>
	{/if}

	<div class="flex-1 overflow-y-auto p-4 pb-32 md:p-6 md:pb-6">
		<div class="mb-6 flex items-center justify-between pt-6">
			<h1 class="text-brand-600 dark:text-brand-400 text-2xl font-bold">Ngemiloh POS</h1>
			<div class="flex gap-2">
				<span
					class="dark:bg-surface-800 border-surface-200 dark:border-surface-700 flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-medium shadow-sm"
				>
					<div
						class="h-2 w-2 rounded-full {pos_store.is_offline ? 'bg-red-500' : 'bg-green-500'}"
					></div>
					Kasir
				</span>
				<button
					onclick={() => (pos_store.show_close_shift_modal = true)}
					class="flex items-center gap-2 rounded-full border border-amber-100 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-600 shadow-sm transition-colors hover:bg-amber-100"
				>
					<span class="hidden font-bold sm:inline">Tutup Shift</span>
				</button>
				<button
					onclick={() => {
						pos_service.fetch_history();
						pos_store.show_history_modal = true;
					}}
					class="flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-600 shadow-sm transition-colors hover:bg-indigo-100"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
						></path></svg
					>
					<span class="hidden sm:inline">Riwayat</span>
				</button>
				<button onclick={handle_logout}
					class="flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-100 dark:border-red-900/50 dark:bg-red-900/20 dark:hover:bg-red-900/40"
					title="Keluar"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
						></path></svg
					>
					<span class="hidden sm:inline">Logout</span>
				</button>
			</div>
		</div>

		<!-- Product List View -->
		<ProductList />
	</div>

	<!-- Cart Sidebar View -->
	<CartSidebar />

	<!-- Modal Manager -->
	<ModalManager />
</div>
