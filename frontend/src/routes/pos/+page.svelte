<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { pos_store } from '$lib/stores/pos.store.svelte';
	import { pos_service } from '$lib/services/pos.service';
	import { auth_store } from '$lib/stores/auth.store.svelte';
	import { api } from '$lib/services/api.client';
	import { db } from '$lib/db';
	import { FLAG_REFRESH_INTERVAL_MS } from '$lib/utils/format';
	import { printer_service } from '$lib/services/printer.service';

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
			localStorage.removeItem('selected_outlet');
			pos_store.selected_outlet_id = '';
			pos_store.selected_outlet_name = '';
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

	// FIX #4: Track pending offline receipts for badge display
	let pending_receipts_count = $state(0);

	// Load pending receipts count on mount and periodically
	async function load_pending_receipts_count() {
		pending_receipts_count = await printer_service.get_pending_receipts_count();
	}

	// Reactive effect to load pending count when coming online
	$effect(() => {
		if (!pos_store.is_offline) {
			load_pending_receipts_count();
		}
	});

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
		// Clear silent refresh timer
		auth_store.clear_refresh_timer();
	});

	onMount(async () => {
		// Verify auth and init silent refresh
		api
			.get('/auth/me')
			.then(async (res) => {
				if (!res.ok) {
					localStorage.removeItem('user');
					goto('/login');
					return;
				}
				// Get actual role from verified user
				const user = JSON.parse(localStorage.getItem('user') || '{}');
				auth_store.init_silent_refresh(user.role || 'kasir');
			})
			.catch(() => {
				// Jika offline, percayakan localStorage sementara
				console.warn('Cannot verify session — network offline');
			});

		// FASE 4: Multi-Outlet - Load selected outlet from localStorage
		const saved_outlet = localStorage.getItem('selected_outlet');
		if (saved_outlet) {
			try {
				const outlet = JSON.parse(saved_outlet);
				pos_store.selected_outlet_id = outlet.id;
				pos_store.selected_outlet_name = outlet.name;
			} catch (e) {
				console.error('Failed to parse saved outlet:', e);
			}
		}

		// Redirect to outlet selection if no outlet selected
		if (!pos_store.selected_outlet_id) {
			goto('/outlet-selection');
			return;
		}

		// Set initial offline state from browser
		pos_store.is_offline = !navigator.onLine;

		// Store handler references for cleanup
		handle_online = async () => {
			pos_store.is_offline = false; // BUG-06 FIX: Update state on online event
			await pos_service.sync_pending_orders();
			// FIX #4: Auto-print pending offline receipts when back online
			const pending_count = await printer_service.get_pending_receipts_count();
			if (pending_count > 0) {
				const printed = await printer_service.print_pending_receipts();
				if (printed > 0) {
					console.log(`[POS] Printed ${printed} pending offline receipts`);
				}
			}
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

			// Parallelize independent API calls for faster loading
			const [shiftResult, productsResult, discountsResult, syncResult] = await Promise.all([
				pos_service.check_shift().catch(() => null),
				pos_service.fetch_products_from_api().catch(() => null),
				pos_service.fetch_discounts().catch(() => null),
				pos_service.sync_pending_orders().catch(() => null)
			]);

			// Handle shift check failure
			if (shiftResult === null) {
				pos_store.is_checking_shift = false;
			}

			shift_interval = setInterval(() => pos_service.check_shift(), FLAG_REFRESH_INTERVAL_MS);
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
			<div>
				<h1 class="text-brand-600 dark:text-brand-400 text-2xl font-bold">Ngemiloh POS</h1>
				{#if pos_store.selected_outlet_name}
					<p class="text-sm text-slate-500 dark:text-slate-400">{pos_store.selected_outlet_name}</p>
				{/if}
			</div>
			<div class="flex gap-2">
				<span
					class="dark:bg-surface-800 border-surface-200 dark:border-surface-700 flex items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-medium shadow-sm"
				>
					<div
						class="h-2 w-2 rounded-full {pos_store.is_offline ? 'bg-red-500' : 'bg-green-500'}"
					></div>
					{pos_store.selected_outlet_name || 'Kasir'}
				</span>
				<button
					onclick={() => (pos_store.show_close_shift_modal = true)}
					class="flex items-center gap-2 rounded-full border border-amber-100 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-600 shadow-sm transition-colors hover:bg-amber-100"
				>
					<span class="hidden font-bold sm:inline">Tutup Shift</span>
				</button>
				<button
					onclick={() => goto('/outlet-selection')}
					class="flex items-center gap-2 rounded-full border border-purple-100 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-600 shadow-sm transition-colors hover:bg-purple-100 dark:border-purple-900/50 dark:bg-purple-900/20 dark:text-purple-400 dark:hover:bg-purple-900/40"
					title="Ganti Outlet"
				>
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
						></path></svg
					>
					<span class="hidden sm:inline">Outlet</span>
				</button>
				<button
					onclick={() => {
						pos_service.fetch_history();
						pos_store.show_history_modal = true;
					}}
					class="relative flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-600 shadow-sm transition-colors hover:bg-indigo-100"
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
					<!-- FIX #4: Badge for pending offline receipts -->
					{#if pending_receipts_count > 0}
						<span
							class="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white"
						>
							{pending_receipts_count}
						</span>
					{/if}
				</button>
				<!-- FIX #4: Manual print pending receipts button -->
				{#if pending_receipts_count > 0}
					<button
						onclick={async () => {
							const printed = await printer_service.print_pending_receipts();
							if (printed > 0) {
								await load_pending_receipts_count();
							}
						}}
						class="flex items-center gap-2 rounded-full border border-orange-100 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-600 shadow-sm transition-colors hover:bg-orange-100"
						title="Cetak struk tertunda ({pending_receipts_count})"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
							></path></svg
						>
						<span class="hidden font-bold sm:inline">PRINT</span>
						<span class="hidden sm:inline">({pending_receipts_count})</span>
					</button>
				{/if}
				<button
					onclick={handle_logout}
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
