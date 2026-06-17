<script lang="ts">
	import { api } from '$lib/services/api.client';
	import { toast } from '$lib/stores/toast.store.svelte';
	import { onMount } from 'svelte';

	import type { RawMaterial } from '$lib/domain/models/types';
	let materials: RawMaterial[] = $state([]);
	let isLoading = $state(true);

	let isOpnameMode = $state(false);
	let opnameData: Record<string, number> = $state({});
	let isSubmitting = $state(false);

	async function fetchInventory() {
		isLoading = true;
		try {
			const res = await api.request(`/admin/inventory`, { credentials: 'include' });
			if (res.ok) {
				const json = await res.json();
				materials = json.data;
				// Initialize opnameData with current system stock
				materials.forEach((m) => {
					if (opnameData[m.id] === undefined) {
						opnameData[m.id] = Number(m.stock);
					}
				});
			}
		} catch (e) {
			console.error(e);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		fetchInventory();
	});

	async function submitOpname() {
		if (
			!confirm(
				'Apakah Anda yakin ingin menyimpan hasil stok opname ini? Stok sistem akan diperbarui secara permanen sesuai fisik.'
			)
		)
			return;

		isSubmitting = true;
		try {
			const payload = {
				items: materials.map((m) => ({
					id: m.id,
					physical_stock: opnameData[m.id]
				}))
			};

			const res = await api.request(`/admin/inventory/opname`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(payload)
			});

			if (res.ok) {
				toast.success('Stok opname berhasil disimpan!');
				isOpnameMode = false;
				fetchInventory();
			} else {
				toast.error('Gagal menyimpan opname');
			}
		} catch {
			toast.error('Terjadi kesalahan jaringan');
		} finally {
			isSubmitting = false;
		}
	}

	function toggleOpnameMode() {
		isOpnameMode = !isOpnameMode;
		if (isOpnameMode) {
			materials.forEach((m) => {
				opnameData[m.id] = Number(m.stock); // Reset to system stock when entering mode
			});
		}
	}
</script>

<svelte:head>
	<title>Inventory - Ngemiloh Admin</title>
</svelte:head>

<div class="h-full overflow-y-auto p-8">
	<div class="mx-auto max-w-7xl space-y-8">
		<header class="flex items-end justify-between">
			<div>
				<h1 class="text-3xl font-bold tracking-tight text-slate-900">Manajemen Inventory</h1>
				<p class="mt-2 text-slate-500">
					Pantau ketersediaan bahan baku dan lakukan stok opname mingguan.
				</p>
			</div>
			<div>
				{#if !isOpnameMode}
					<button
						onclick={toggleOpnameMode}
						class="bg-brand-600 hover:bg-brand-700 flex items-center gap-2 rounded-xl px-6 py-2.5 font-bold text-white shadow-sm transition-colors"
					>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
							><path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
							></path></svg
						>
						Lakukan Stok Opname
					</button>
				{:else}
					<div class="flex gap-3">
						<button
							onclick={toggleOpnameMode}
							class="rounded-xl border border-slate-300 px-4 py-2 font-bold text-slate-700 transition-colors hover:bg-white"
							disabled={isSubmitting}
						>
							Batal
						</button>
						<button
							onclick={submitOpname}
							class="flex items-center gap-2 rounded-xl bg-emerald-600 px-6 py-2 font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
							disabled={isSubmitting}
						>
							{#if isSubmitting}
								<svg class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24"
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
								Menyimpan...
							{:else}
								Simpan Hasil Opname
							{/if}
						</button>
					</div>
				{/if}
			</div>
		</header>

		<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			{#if isLoading}
				<div class="flex justify-center p-12">
					<div
						class="border-brand-500 h-8 w-8 animate-spin rounded-full border-t-2 border-b-2"
					></div>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-slate-200">
						<thead class="bg-slate-50">
							<tr>
								<th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase"
									>Bahan Baku</th
								>
								<th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase"
									>Unit</th
								>
								<th class="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase"
									>Stok Sistem</th
								>
								{#if isOpnameMode}
									<th class="text-brand-600 px-6 py-4 text-right text-xs font-bold uppercase"
										>Stok Fisik</th
									>
									<th class="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase"
										>Selisih</th
									>
								{/if}
								<th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase"
									>Status</th
								>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-200 bg-white">
							{#if materials.length === 0}
								<tr>
									<td colspan="6" class="px-6 py-8 text-center text-slate-500"
										>Belum ada bahan baku.</td
									>
								</tr>
							{:else}
								{#each materials as item}
									<tr
										class="hover:bg-slate-50 {Number(item.stock) <= Number(item.min_stock)
											? 'bg-red-50/30'
											: ''}"
									>
										<td class="px-6 py-4 font-bold whitespace-nowrap text-slate-900">{item.name}</td
										>
										<td class="px-6 py-4 whitespace-nowrap text-slate-600">{item.unit}</td>
										<td class="px-6 py-4 text-right font-medium whitespace-nowrap text-slate-700"
											>{Number(item.stock)}</td
										>

										{#if isOpnameMode}
											{@const diff = opnameData[item.id] - Number(item.stock)}
											<td class="px-6 py-3 text-right whitespace-nowrap">
												<input
													type="number"
													bind:value={opnameData[item.id]}
													class="border-brand-300 focus:ring-brand-500 focus:border-brand-500 w-24 rounded border-2 px-2 py-1 text-right font-bold"
													min="0"
												/>
											</td>
											<td class="px-6 py-4 text-right font-bold whitespace-nowrap">
												{#if diff > 0}
													<span class="text-emerald-600">+{diff}</span>
												{:else if diff < 0}
													<span class="text-red-600">{diff}</span>
												{:else}
													<span class="text-slate-400">0</span>
												{/if}
											</td>
										{/if}

										<td class="px-6 py-4 text-sm whitespace-nowrap">
											{#if !item.is_active}
												<span class="font-medium text-slate-500">Nonaktif</span>
											{:else if Number(item.stock) <= Number(item.min_stock)}
												<span class="flex items-center gap-1 font-bold text-red-600">
													<span class="h-2 w-2 rounded-full bg-red-600"></span> Stok Menipis
												</span>
											{:else}
												<span class="font-medium text-emerald-600">Aman</span>
											{/if}
										</td>
									</tr>
								{/each}
							{/if}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</div>
</div>
