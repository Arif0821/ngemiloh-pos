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

<div class="min-h-screen flex items-center justify-center bg-surface-100 dark:bg-surface-900 p-4">
  <div class="max-w-md w-full">
    <div class="text-center">
      <div class="text-8xl font-bold text-surface-300 dark:text-surface-700 mb-4">
        {errorStatus}
      </div>

      <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-50 mb-2">
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

      <div class="flex gap-4 justify-center flex-wrap">
        <button
          onclick={goBack}
          class="px-6 py-3 bg-surface-200 dark:bg-surface-800 text-surface-700 dark:text-surface-300 rounded-lg hover:bg-surface-300 dark:hover:bg-surface-700 transition-colors"
        >
          Kembali
        </button>

        <button
          onclick={goHome}
          class="px-6 py-3 bg-brand-600 text-white rounded-lg hover:bg-brand-700 transition-colors"
        >
          Ke Beranda
        </button>
      </div>

      <p class="mt-8 text-sm text-surface-400">
        Jika masalah terus berlanjut, hubungi administrator.
      </p>
    </div>
  </div>
</div>