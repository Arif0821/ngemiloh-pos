<script lang="ts">
	import { api } from '$lib/services/api.client';
	import { toast } from '$lib/stores/toast.store.svelte';

	let startDate = $state(new Date(new Date().setDate(1)).toISOString().split('T')[0]); // First day of month
	let endDate = $state(new Date().toISOString().split('T')[0]);
	let isExporting = $state(false);

	async function handleExport() {
		isExporting = true;
		try {
			// Call real backend endpoint
			window.open(`/admin/reports/export?startDate=${startDate}&endDate=${endDate}`, '_blank');

			// Simulating a short delay so the loading state shows
			await new Promise((r) => setTimeout(r, 1000));
			toast.success('Export dimulai. File akan terunduh otomatis.');
		} catch {
			toast.error('Gagal membuat laporan');
		} finally {
			isExporting = false;
		}
	}
</script>

<svelte:head>
	<title>Export Laporan | Ngemiloh Admin</title>
</svelte:head>

<div class="mx-auto max-w-3xl">
	<div class="mb-8">
		<h1 class="text-2xl font-bold text-slate-900">Export Laporan Data</h1>
		<p class="mt-1 text-slate-500">
			Unduh seluruh riwayat transaksi dan operasional ke format Excel / CSV.
		</p>
	</div>

	<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
		<div class="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
			<div>
				<label class="mb-2 block text-sm font-medium text-slate-700" for="startDate"
					>Dari Tanggal</label
				>
				<input
					type="date"
					id="startDate"
					bind:value={startDate}
					class="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:ring-indigo-500"
				/>
			</div>
			<div>
				<label class="mb-2 block text-sm font-medium text-slate-700" for="endDate"
					>Sampai Tanggal</label
				>
				<input
					type="date"
					id="endDate"
					bind:value={endDate}
					class="w-full rounded-xl border border-slate-300 px-4 py-3 focus:border-indigo-500 focus:ring-indigo-500"
				/>
			</div>
		</div>

		<div
			class="mb-8 flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800"
		>
			<svg
				class="mt-0.5 h-5 w-5 shrink-0 text-blue-600"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
				><path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
				></path></svg
			>
			<div>
				<p class="mb-1 font-medium">Informasi Export CSV</p>
				<p class="text-blue-700 opacity-90">
					File CSV akan berisi rincian: ID Transaksi, Kasir, Tanggal, Base Price, Diskon, Tambahan
					Modifier, Metode Bayar, dan Status. (Batas maksimal 5 export per jam sesuai PRD).
				</p>
			</div>
		</div>

		<div class="flex justify-end">
			<button
				onclick={handleExport}
				disabled={isExporting}
				class="inline-flex w-full items-center justify-center rounded-xl border border-transparent bg-indigo-600 px-6 py-3 text-base font-medium text-white shadow-sm transition-colors hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50 md:w-auto"
			>
				{#if isExporting}
					<svg
						class="mr-3 -ml-1 h-5 w-5 animate-spin text-white"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
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
					Memproses File...
				{:else}
					<svg class="mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
						></path></svg
					>
					Export Transaksi (CSV)
				{/if}
			</button>
		</div>
	</div>
</div>
