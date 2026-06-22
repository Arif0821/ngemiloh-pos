<script lang="ts">
	import { goto } from '$app/navigation';
	import { api } from '$lib/services/api.client';
	import { toast } from '$lib/stores/toast.store.svelte';
	import { pos_store } from '$lib/stores/pos.store.svelte';

	interface Outlet {
		id: string;
		name: string;
		address: string | null;
		phone: string | null;
		is_primary: boolean;
	}

	let outlets: Outlet[] = $state([]);
	let is_loading: boolean = $state(true);
	let error: string = $state('');
	let selected_outlet_id: string = $state('');

	// Fetch assigned outlets on mount
	$effect(() => {
		fetch_outlets();
	});

	async function fetch_outlets() {
		is_loading = true;
		error = '';

		try {
			const res = await api.get('/outlets');
			if (res.ok) {
				const json = await res.json();
				if (json.success && json.data) {
					outlets = json.data;
					// Auto-select primary outlet if only one
					if (outlets.length === 1) {
						select_outlet(outlets[0].id);
					} else if (outlets.length > 0) {
						const primary = outlets.find((o) => o.is_primary);
						if (primary) {
							selected_outlet_id = primary.id;
						} else {
							selected_outlet_id = outlets[0].id;
						}
					}
				} else {
					error = json.message || 'Gagal mengambil data outlet';
				}
			} else if (res.status === 401) {
				goto('/login');
			} else {
				error = 'Gagal terhubung ke server';
			}
		} catch (e) {
			error = 'Terjadi kesalahan saat mengambil data outlet';
			console.error('Error fetching outlets:', e);
		} finally {
			is_loading = false;
		}
	}

	function select_outlet(outlet_id: string) {
		selected_outlet_id = outlet_id;
	}

	async function confirm_selection() {
		if (!selected_outlet_id) {
			toast.error('Pilih outlet terlebih dahulu');
			return;
		}

		// Find selected outlet details
		const selected_outlet = outlets.find((o) => o.id === selected_outlet_id);
		if (!selected_outlet) {
			toast.error('Outlet tidak valid');
			return;
		}

		// Save to localStorage for persistence
		localStorage.setItem('selected_outlet', JSON.stringify(selected_outlet));

		// Store in pos_store
		pos_store.selected_outlet_id = selected_outlet_id;
		pos_store.selected_outlet_name = selected_outlet.name;

		// Navigate to POS
		goto('/pos');
	}
</script>

<div
	class="flex min-h-screen items-center justify-center bg-linear-to-br from-indigo-900 via-purple-900 to-slate-900 p-4"
>
	<div
		class="w-full max-w-md overflow-hidden rounded-3xl border border-slate-700/50 bg-slate-900/80 shadow-2xl backdrop-blur-xl"
	>
		<!-- Header -->
		<div class="p-8 pb-4 text-center">
			<div
				class="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-2xl bg-linear-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30"
			>
				<svg class="h-10 w-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
					></path></svg
				>
			</div>
			<h1 class="mb-2 text-3xl font-black tracking-tight text-white">Pilih Outlet</h1>
			<p class="text-sm font-medium text-slate-400">Pilih outlet tempat Anda bekerja hari ini</p>
		</div>

		<!-- Content -->
		<div class="flex-1 px-8 pb-4">
			{#if is_loading}
				<div class="flex items-center justify-center py-12">
					<svg class="h-8 w-8 animate-spin text-indigo-500" fill="none" viewBox="0 0 24 24"
						><circle
							class="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="4"
						></circle><path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path></svg
					>
				</div>
			{:else if error}
				<div
					class="rounded-xl border border-red-500/50 bg-red-500/20 px-4 py-3 text-sm font-bold text-red-400"
				>
					{error}
				</div>
				<button
					class="mt-4 w-full rounded-xl bg-slate-700 py-3 font-bold text-white hover:bg-slate-600"
					onclick={fetch_outlets}
				>
					Coba Lagi
				</button>
			{:else if outlets.length === 0}
				<div class="py-8 text-center text-slate-400">
					<p>Tidak ada outlet yang ditugaskan untuk akun Anda.</p>
					<p class="mt-2 text-sm">Hubungi admin untuk informasi lebih lanjut.</p>
				</div>
			{:else}
				<div class="space-y-3">
					{#each outlets as outlet}
						<button
							class="w-full rounded-xl p-4 text-left transition-all {selected_outlet_id ===
							outlet.id
								? 'border-2 border-indigo-500 bg-indigo-500/20 shadow-lg shadow-indigo-500/20'
								: 'border border-slate-600 bg-slate-800/50 hover:border-slate-500 hover:bg-slate-800'}"
							onclick={() => select_outlet(outlet.id)}
						>
							<div class="flex items-start gap-3">
								<!-- Radio indicator -->
								<div
									class="mt-1 h-5 w-5 flex-shrink-0 rounded-full border-2 {selected_outlet_id ===
									outlet.id
										? 'border-indigo-500 bg-indigo-500'
										: 'border-slate-500'}"
								>
									{#if selected_outlet_id === outlet.id}
										<svg
											class="h-full w-full text-white"
											fill="none"
											stroke="currentColor"
											viewBox="0 0 24 24"
											><path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="3"
												d="M5 13l4 4L19 7"
											></path></svg
										>
									{/if}
								</div>

								<div class="flex-1">
									<div class="flex items-center gap-2">
										<h3 class="font-bold text-white">{outlet.name}</h3>
										{#if outlet.is_primary}
											<span
												class="rounded-full bg-amber-500/20 px-2 py-0.5 text-xs font-medium text-amber-400"
											>
												Utama
											</span>
										{/if}
									</div>
									{#if outlet.address}
										<p class="mt-1 text-sm text-slate-400">{outlet.address}</p>
									{/if}
									{#if outlet.phone}
										<p class="mt-1 text-sm text-slate-500">{outlet.phone}</p>
									{/if}
								</div>
							</div>
						</button>
					{/each}
				</div>

				<button
					class="mt-6 w-full rounded-xl py-3 font-bold tracking-wide transition-all {selected_outlet_id
						? 'bg-linear-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 hover:from-indigo-500 hover:to-purple-500 active:scale-98'
						: 'bg-slate-700 text-slate-500'}"
					disabled={!selected_outlet_id}
					onclick={confirm_selection}
				>
					Mulai POS
				</button>
			{/if}
		</div>

		<!-- Back to login -->
		<div class="border-t border-slate-700/50 p-6 text-center">
			<button
				onclick={() => goto('/login')}
				class="text-sm font-medium text-slate-400 transition-colors hover:text-white"
			>
				Kembali ke Login
			</button>
		</div>
	</div>
</div>
