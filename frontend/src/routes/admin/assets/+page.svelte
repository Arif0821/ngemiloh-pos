<script lang="ts">
	import { api } from '$lib/services/api.client';
	import { toast } from '$lib/stores/toast.store.svelte';
	import { onMount } from 'svelte';

	import type { Asset } from '$lib/domain/models/types';
	let assets: Asset[] = $state([]);
	let isLoading = $state(true);

	let showModal = $state(false);
	let isEditing = $state(false);

	let formId = $state('');
	let formName = $state('');
	let formValue = $state('');
	let formLifespan = $state('');
	let formPurchaseDate = $state('');
	let formIsActive = $state(true);

	async function fetchAssets() {
		isLoading = true;
		try {
			const res = await api.request(`/admin/finance/assets`, { credentials: 'include' });
			if (res.ok) {
				const data = await res.json();
				assets = data.data;
			}
		} catch (e) {
			console.error(e);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		fetchAssets();
	});

	function openCreateModal() {
		isEditing = false;
		formId = '';
		formName = '';
		formValue = '';
		formLifespan = '';
		formPurchaseDate = new Date().toISOString().split('T')[0];
		formIsActive = true;
		showModal = true;
	}

	function openEditModal(asset: Asset) {
		isEditing = true;
		formId = asset.id;
		formName = asset.name;
		formValue = String(asset.value ?? '');
		formLifespan = String(asset.lifespan_months ?? '');
		formPurchaseDate = new Date(asset.purchase_date).toISOString().split('T')[0];
		formIsActive = asset.is_active;
		showModal = true;
	}

	async function saveAsset(e: Event) {
		e.preventDefault();
		try {
			const url = isEditing ? `/admin/finance/assets/${formId}` : `/admin/finance/assets`;
			const method = isEditing ? 'PATCH' : 'POST';

			const payload = {
				name: formName,
				value: Number(formValue),
				lifespan_months: Number(formLifespan),
				purchase_date: formPurchaseDate,
				is_active: formIsActive
			};

			const res = await api.request(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(payload)
			});

			if (res.ok) {
				showModal = false;
				fetchAssets();
			} else {
				const err = await res.json();
				toast.error('Gagal menyimpan aset: ' + (err.message || 'Error'));
			}
		} catch {
			toast.error('Error pada server');
		}
	}

	function formatRp(amount: number) {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			minimumFractionDigits: 0
		}).format(amount);
	}
</script>

<svelte:head>
	<title>Kelola Aset - Ngemiloh Admin</title>
</svelte:head>

<div class="h-full overflow-y-auto p-8">
	<div class="mx-auto max-w-7xl space-y-8">
		<header class="flex items-end justify-between">
			<div>
				<h1 class="text-3xl font-bold tracking-tight text-slate-900">
					Manajemen Aset & Depresiasi
				</h1>
				<p class="mt-2 text-slate-500">
					Pencatatan aset perusahaan dan perhitungan penyusutan (depresiasi) bulanan otomatis.
				</p>
			</div>
			<button
				onclick={openCreateModal}
				class="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
					><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"
					></path></svg
				>
				Tambah Aset Baru
			</button>
		</header>

		<div class="grid grid-cols-1 gap-6 md:grid-cols-3">
			<div
				class="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
			>
				<p class="mb-1 text-sm font-medium text-slate-500">Total Nilai Aset Aktif</p>
				<p class="text-3xl font-black text-slate-800">
					{formatRp(assets.filter((a) => a.is_active).reduce((sum, a) => sum + Number(a.value), 0))}
				</p>
			</div>
			<div
				class="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
			>
				<p class="mb-1 text-sm font-medium text-slate-500">Total Depresiasi Bulanan</p>
				<p class="text-3xl font-black text-red-500">
					- {formatRp(
						assets
							.filter((a) => a.is_active)
							.reduce((sum, a) => sum + Number(a.monthly_depreciation), 0)
					)}
				</p>
				<p class="mt-2 text-xs text-slate-400">Otomatis memotong laba bersih tiap bulan.</p>
			</div>
			<div class="flex items-center rounded-2xl border border-indigo-100 bg-indigo-50 p-6">
				<div>
					<h4 class="font-bold text-indigo-900">Aturan PRD (BR-K11)</h4>
					<p class="mt-1 text-sm text-indigo-700">
						Booth bernilai Rp 0 (gratis dari Ngemiloh Pusat). Metode garis lurus: Nilai Aset ÷ Umur
						Pakai (Bulan).
					</p>
				</div>
			</div>
		</div>

		<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			{#if isLoading}
				<div class="flex justify-center p-12">
					<div
						class="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-indigo-500"
					></div>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-slate-200">
						<thead class="bg-slate-50">
							<tr>
								<th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase"
									>Nama Aset</th
								>
								<th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase"
									>Tgl Beli</th
								>
								<th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase"
									>Nilai Aset</th
								>
								<th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase"
									>Umur (Bulan)</th
								>
								<th class="px-6 py-4 text-left text-xs font-semibold text-red-600 uppercase"
									>Depresiasi/Bulan</th
								>
								<th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase"
									>Status</th
								>
								<th class="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase"
									>Aksi</th
								>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-200 bg-white">
							{#if assets.length === 0}
								<tr>
									<td colspan="7" class="px-6 py-8 text-center text-slate-500"
										>Belum ada aset terdaftar.</td
									>
								</tr>
							{:else}
								{#each assets as asset}
									<tr
										class="transition-colors hover:bg-slate-50 {asset.is_active
											? ''
											: 'bg-slate-50 opacity-60'}"
									>
										<td class="px-6 py-4 whitespace-nowrap">
											<div class="font-bold text-slate-900">{asset.name}</div>
										</td>
										<td class="px-6 py-4 text-sm whitespace-nowrap text-slate-600">
											{new Date(asset.purchase_date).toLocaleDateString('id-ID')}
										</td>
										<td class="px-6 py-4 font-bold whitespace-nowrap text-slate-700">
											{formatRp(Number(asset.value))}
										</td>
										<td class="px-6 py-4 text-sm whitespace-nowrap text-slate-600">
											{asset.lifespan_months} bln
										</td>
										<td class="px-6 py-4 font-bold whitespace-nowrap text-red-600">
											{formatRp(Number(asset.monthly_depreciation))}
										</td>
										<td class="px-6 py-4 whitespace-nowrap">
											{#if asset.is_active}
												<span
													class="rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800"
													>Aktif</span
												>
											{:else}
												<span
													class="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-bold text-slate-700"
													>Nonaktif</span
												>
											{/if}
										</td>
										<td class="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
											<button
												onclick={() => openEditModal(asset)}
												class="rounded-lg bg-indigo-50 px-3 py-1.5 font-semibold text-indigo-600 hover:text-indigo-900"
												>Edit</button
											>
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

<!-- Modal Form Aset -->
{#if showModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4">
		<div class="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
			<div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-6">
				<h3 class="text-xl font-bold text-slate-800">
					{isEditing ? 'Edit Aset' : 'Tambah Aset Baru'}
				</h3>
				<button onclick={() => (showModal = false)} class="text-slate-400 hover:text-slate-600"
					>X</button
				>
			</div>

			<form onsubmit={saveAsset} class="space-y-4 p-6">
				<div>
					<label for="asset-name" class="mb-1 block text-sm font-bold text-slate-700"
						>Nama Aset <span class="text-red-500">*</span></label
					>
					<input
						id="asset-name"
						type="text"
						bind:value={formName}
						required
						class="w-full rounded-lg border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
						placeholder="Cth: Mesin Kasir / Booth"
					/>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="asset-value" class="mb-1 block text-sm font-bold text-slate-700"
							>Nilai Aset (Rp) <span class="text-red-500">*</span></label
						>
						<input
							id="asset-value"
							type="number"
							min="0"
							bind:value={formValue}
							required
							class="w-full rounded-lg border-slate-300 text-sm font-bold focus:border-indigo-500 focus:ring-indigo-500"
							placeholder="0"
						/>
					</div>
					<div>
						<label for="asset-lifespan" class="mb-1 block text-sm font-bold text-slate-700"
							>Umur Pakai (Bulan) <span class="text-red-500">*</span></label
						>
						<input
							id="asset-lifespan"
							type="number"
							min="1"
							bind:value={formLifespan}
							required
							class="w-full rounded-lg border-slate-300 text-sm font-bold focus:border-indigo-500 focus:ring-indigo-500"
							placeholder="12"
						/>
					</div>
				</div>

				<div>
					<label for="asset-date" class="mb-1 block text-sm font-bold text-slate-700"
						>Tanggal Beli <span class="text-red-500">*</span></label
					>
					<input
						id="asset-date"
						type="date"
						bind:value={formPurchaseDate}
						required
						class="w-full rounded-lg border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
					/>
				</div>

				{#if isEditing}
					<div class="pt-2">
						<label
							class="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 {formIsActive
								? 'border-green-200 bg-green-50'
								: 'bg-slate-50'}"
						>
							<input
								type="checkbox"
								bind:checked={formIsActive}
								class="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
							/>
							<span class="font-semibold text-slate-700">Aset Masih Aktif Didepresiasi</span>
						</label>
					</div>
				{/if}

				<div class="flex gap-3 border-t border-slate-100 pt-4">
					<button
						type="button"
						onclick={() => (showModal = false)}
						class="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50"
						>Batal</button
					>
					<button
						type="submit"
						class="flex-1 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-md hover:bg-indigo-700"
						>Simpan Aset</button
					>
				</div>
			</form>
		</div>
	</div>
{/if}
