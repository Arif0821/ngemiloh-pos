<script lang="ts">
	import { page } from '$app/stores';

	let errorMessage = $derived($page.error?.message || 'An unexpected error occurred');
	let errorStatus = $derived($page.status || 500);

	function goHome() {
		window.location.href = '/';
	}

	function goBack() {
		window.history.back();
	}

	const is404 = $derived(errorStatus === 404);
	const is403 = $derived(errorStatus === 403);
	const is500 = $derived(errorStatus >= 500);
</script>

<div class="bg-surface-100 dark:bg-surface-900 flex min-h-screen items-center justify-center p-4">
	<div class="w-full max-w-md">
		<div class="text-center">
			<div class="text-surface-300 dark:text-surface-700 mb-4 text-8xl font-bold">
				{errorStatus}
			</div>

			<h1 class="text-surface-900 dark:text-surface-50 mb-2 text-2xl font-bold">
				{#if is404}
					Halaman Tidak Ditemukan
				{:else if is403}
					Akses Ditolak
				{:else if is500}
					Kesalahan Server
				{:else}
					Terjadi Kesalahan
				{/if}
			</h1>

			<p class="text-surface-600 dark:text-surface-400 mb-8">
				{errorMessage}
			</p>

			<div class="flex flex-wrap justify-center gap-4">
				<button
					onclick={goBack}
					class="bg-surface-200 dark:bg-surface-800 text-surface-700 dark:text-surface-300 hover:bg-surface-300 dark:hover:bg-surface-700 rounded-lg px-6 py-3 transition-colors"
				>
					Kembali
				</button>

				<button
					onclick={goHome}
					class="bg-brand-600 hover:bg-brand-700 rounded-lg px-6 py-3 text-white transition-colors"
				>
					Ke Beranda
				</button>
			</div>

			<p class="text-surface-400 mt-8 text-sm">
				Jika masalah terus berlanjut, hubungi administrator.
			</p>
		</div>
	</div>
</div>
