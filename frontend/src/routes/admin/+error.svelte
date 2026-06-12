<script lang="ts">
	import { page } from '$app/stores';

	let errorMessage = $derived($page.error?.message || 'An unexpected error occurred');
	let errorStatus = $derived($page.status || 500);

	function goAdminDashboard() {
		window.location.href = '/admin/dashboard';
	}

	function goBack() {
		window.history.back();
	}

	const is404 = $derived(errorStatus === 404);
	const is403 = $derived(errorStatus === 403);
</script>

<div class="bg-surface-100 dark:bg-surface-900 flex min-h-screen items-center justify-center p-4">
	<div class="w-full max-w-md">
		<div class="dark:bg-surface-800 rounded-2xl bg-white p-8 text-center shadow-lg">
			<div
				class="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30"
			>
				<svg
					class="h-8 w-8 text-red-600 dark:text-red-400"
					fill="none"
					stroke="currentColor"
					viewBox="0 0 24 24"
				>
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
					></path>
				</svg>
			</div>

			<h1 class="text-surface-900 dark:text-surface-50 mb-2 text-xl font-bold">
				{#if is404}
					Halaman Admin Tidak Ditemukan
				{:else if is403}
					Akses Admin Ditolak
				{:else}
					Kesalahan Admin Panel
				{/if}
			</h1>

			<p class="text-surface-600 dark:text-surface-400 mb-6">
				{errorMessage}
			</p>

			<div class="flex justify-center gap-4">
				<button
					onclick={goBack}
					class="bg-surface-200 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-300 dark:hover:bg-surface-700 rounded-lg px-6 py-3 transition-colors"
				>
					Kembali
				</button>

				<button
					onclick={goAdminDashboard}
					class="bg-brand-600 hover:bg-brand-700 rounded-lg px-6 py-3 text-white transition-colors"
				>
					Kembali ke Dashboard
				</button>
			</div>

			<p class="text-surface-400 mt-6 text-xs">
				Error Code: {errorStatus}
			</p>
		</div>
	</div>
</div>
