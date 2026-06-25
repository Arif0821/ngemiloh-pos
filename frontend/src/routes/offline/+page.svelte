<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	let is_checking = $state(false);
	let retry_count = $state(0);
	let max_retries = 3;

	onMount(() => {
		// Auto-redirect to admin if connection restored
	});

	async function check_connection() {
		if (is_checking) return;
		is_checking = true;

		try {
			const res = await fetch('/api/v1/health', {
				method: 'GET',
				signal: AbortSignal.timeout(5000)
			});

			if (res.ok) {
				// Connection restored, go back to admin
				goto('/admin/dashboard');
			} else {
				retry_count++;
			}
		} catch {
			retry_count++;
		} finally {
			is_checking = false;
		}
	}

	async function go_to_login() {
		localStorage.removeItem('user');
		localStorage.removeItem('pending_pin_change');
		goto('/login-admin');
	}

	// Auto-retry every 10 seconds
	onMount(() => {
		const interval = setInterval(() => {
			if (retry_count < max_retries) {
				check_connection();
			}
		}, 10000);

		return () => clearInterval(interval);
	});
</script>

<div class="flex min-h-screen items-center justify-center bg-slate-100">
	<div class="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
		<!-- Icon -->
		<div class="mb-6 flex justify-center">
			<div class="rounded-full bg-amber-100 p-4">
				<svg class="h-16 w-16 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414"
					/>
				</svg>
			</div>
		</div>

		<!-- Title -->
		<h1 class="mb-2 text-center text-2xl font-bold text-slate-800">Koneksi Terputus</h1>

		<!-- Description -->
		<p class="mb-6 text-center text-slate-600">
			Tidak dapat terhubung ke server. Perubahan yang Anda buat mungkin tidak tersimpan.
		</p>

		<!-- Status -->
		<div class="mb-6 rounded-lg bg-slate-50 p-4">
			<div class="flex items-center justify-between text-sm">
				<span class="text-slate-600">Status:</span>
				<span class="font-medium text-amber-600">Offline</span>
			</div>
			<div class="mt-2 flex items-center justify-between text-sm">
				<span class="text-slate-600">Percobaan:</span>
				<span class="font-medium text-slate-700">{retry_count} / {max_retries}</span>
			</div>
		</div>

		<!-- Actions -->
		<div class="space-y-3">
			<button
				onclick={check_connection}
				disabled={is_checking}
				class="flex w-full items-center justify-center rounded-xl bg-indigo-600 px-4 py-3 font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:bg-indigo-400"
			>
				{#if is_checking}
					<svg class="mr-2 h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
						<circle
							class="opacity-25"
							cx="12"
							cy="12"
							r="10"
							stroke="currentColor"
							stroke-width="4"
						/>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						/>
					</svg>
					Mengecek koneksi...
				{:else}
					<svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
						/>
					</svg>
					Coba Lagi
				{/if}
			</button>

			<button
				onclick={go_to_login}
				class="flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
			>
				<svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
					/>
				</svg>
				Keluar & Login Ulang
			</button>
		</div>

		<!-- Help text -->
		<p class="mt-6 text-center text-xs text-slate-400">
			Jika masalah terus berlanjut, silakan hubungi administrator.
		</p>
	</div>
</div>
