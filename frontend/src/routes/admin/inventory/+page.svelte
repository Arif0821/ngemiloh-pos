<script lang="ts">
	import { api } from '$lib/services/api.client';
	import { toast } from '$lib/stores/toast.store.svelte';
	import { onMount } from 'svelte';

	import type { RawMaterial } from '$lib/domain/models/types';
	let materials: RawMaterial[] = $state([]);
	let products: Array<{ id: string; name: string; base_price: number }> = $state([]);
	let isLoading = $state(true);

	let isOpnameMode = $state(false);
	let opnameData: Record<string, number> = $state({});
	let isSubmitting = $state(false);

	// Tab state
	let activeTab: 'stock' | 'waste' | 'bom' = $state('stock');

	// Cost editing state
	let editingCostId = $state<string | null>(null);
	let editingCostValue = $state(0);
	let isSavingCost = $state(false);

	// Waste tracking state
	let wasteMaterialId = $state('');
	let wasteQuantity = $state(1);
	let wasteReason = $state('expired');
	let wasteNotes = $state('');
	let wasteHistory: Array<{
		id: string;
		raw_material: { name: string; purchase_unit: string };
		quantity: string;
		notes: string;
		created_at: string;
		actor?: { name: string };
	}> = $state([]);
	let isLoadingWaste = $state(false);
	let isSubmittingWaste = $state(false);

	// BOM state
	let selectedBomProductId = $state('');
	let bomRecipes: Array<{
		id: string;
		raw_material_id: string;
		quantity_per_serving: string;
		raw_material: { id: string; name: string; cost_per_unit: string; purchase_unit: string };
	}> = $state([]);
	let isLoadingBom = $state(false);
	let isSavingBom = $state(false);
	let newBomMaterialId = $state('');
	let newBomQuantity = $state(0.01);
	let isAddingBom = $state(false);

	async function fetchInventory() {
		isLoading = true;
		try {
			const res = await api.request(`/admin/inventory`, { credentials: 'include' });
			if (res.ok) {
				const json = await res.json();
				materials = json.data;
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

	async function fetchProducts() {
		try {
			const res = await api.request(`/products`, { credentials: 'include' });
			if (res.ok) {
				const json = await res.json();
				products = json.data;
			}
		} catch (e) {
			console.error(e);
		}
	}

	async function fetchWasteHistory() {
		isLoadingWaste = true;
		try {
			const res = await api.request(`/admin/inventory/waste`, { credentials: 'include' });
			if (res.ok) {
				const json = await res.json();
				wasteHistory = json.data;
			}
		} catch (e) {
			console.error(e);
		} finally {
			isLoadingWaste = false;
		}
	}

	async function fetchBomRecipes() {
		if (!selectedBomProductId) {
			bomRecipes = [];
			return;
		}
		isLoadingBom = true;
		try {
			const res = await api.request(`/admin/inventory/bom/${selectedBomProductId}`, {
				credentials: 'include'
			});
			if (res.ok) {
				const json = await res.json();
				bomRecipes = json.data;
			}
		} catch (e) {
			console.error(e);
		} finally {
			isLoadingBom = false;
		}
	}

	async function submitWaste() {
		if (!wasteMaterialId || !wasteQuantity) {
			toast.error('Mohon isi semua field');
			return;
		}

		const material = materials.find((m) => m.id === wasteMaterialId);
		if (material && Number(material.stock) < wasteQuantity) {
			toast.error('Stok tidak mencukupi');
			return;
		}

		isSubmittingWaste = true;
		try {
			const res = await api.request(`/admin/inventory/waste`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					raw_material_id: wasteMaterialId,
					quantity: wasteQuantity,
					reason: wasteReason,
					notes: wasteNotes
				})
			});

			if (res.ok) {
				toast.success('Waste berhasil dicatat!');
				wasteMaterialId = '';
				wasteQuantity = 1;
				wasteReason = 'expired';
				wasteNotes = '';
				fetchWasteHistory();
				fetchInventory();
			} else {
				const json = await res.json();
				toast.error(json.message || 'Gagal mencatat waste');
			}
		} catch {
			toast.error('Terjadi kesalahan jaringan');
		} finally {
			isSubmittingWaste = false;
		}
	}

	async function addBomRecipe() {
		if (!selectedBomProductId || !newBomMaterialId || !newBomQuantity) {
			toast.error('Mohon isi semua field');
			return;
		}

		isAddingBom = true;
		try {
			const res = await api.request(`/admin/inventory/bom`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					product_id: selectedBomProductId,
					raw_material_id: newBomMaterialId,
					quantity_per_serving: newBomQuantity
				})
			});

			if (res.ok) {
				toast.success('Bahan berhasil ditambahkan ke resep!');
				newBomMaterialId = '';
				newBomQuantity = 0.01;
				fetchBomRecipes();
			} else {
				const json = await res.json();
				toast.error(json.message || 'Gagal menambahkan bahan');
			}
		} catch {
			toast.error('Terjadi kesalahan jaringan');
		} finally {
			isAddingBom = false;
		}
	}

	async function updateBomQuantity(bomId: string, newQty: number) {
		try {
			const res = await api.request(`/admin/inventory/bom/${bomId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ quantity_per_serving: newQty })
			});

			if (res.ok) {
				toast.success('Jumlah berhasil diupdate!');
				fetchBomRecipes();
			} else {
				toast.error('Gagal update jumlah');
			}
		} catch {
			toast.error('Terjadi kesalahan jaringan');
		}
	}

	async function deleteBomRecipe(bomId: string) {
		if (!confirm('Hapus bahan dari resep?')) return;

		try {
			const res = await api.request(`/admin/inventory/bom/${bomId}`, {
				method: 'DELETE',
				credentials: 'include'
			});

			if (res.ok) {
				toast.success('Bahan berhasil dihapus!');
				fetchBomRecipes();
			} else {
				toast.error('Gagal menghapus bahan');
			}
		} catch {
			toast.error('Terjadi kesalahan jaringan');
		}
	}

	function getTotalBomCost() {
		return bomRecipes.reduce((sum, r) => {
			const qty = Number(r.quantity_per_serving) || 0;
			const cost = Number(r.raw_material.cost_per_unit) || 0;
			return sum + qty * cost;
		}, 0);
	}

	function formatDate(dateStr: string) {
		return new Date(dateStr).toLocaleString('id-ID', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function formatReason(notes: string) {
		const reasons: Record<string, string> = {
			expired: 'Bahan Expired',
			processing_error: 'Salah Olah',
			damaged: 'Rusak',
			sample: 'Sample/Coba-coba'
		};
		const match = notes.match(/\[(.*?)\]/);
		if (match && reasons[match[1]]) {
			return reasons[match[1]];
		}
		return notes.split(']')[0]?.replace('[', '').trim() || '-';
	}

	onMount(() => {
		fetchInventory();
		fetchProducts();
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
				opnameData[m.id] = Number(m.stock);
			});
		}
	}

	async function switchToTab(tab: 'stock' | 'waste' | 'bom') {
		activeTab = tab;
		if (tab === 'waste') {
			fetchWasteHistory();
		} else if (tab === 'bom') {
			fetchBomRecipes();
		}
	}

	function onBomProductChange() {
		fetchBomRecipes();
	}

	// Cost per unit editing
	function startEditCost(material: RawMaterial) {
		editingCostId = material.id;
		editingCostValue = Number(material.cost_per_unit) || 0;
	}

	function cancelEditCost() {
		editingCostId = null;
		editingCostValue = 0;
	}

	async function saveCost(materialId: string) {
		if (editingCostValue < 0) {
			toast.error('Harga tidak boleh negatif');
			return;
		}

		isSavingCost = true;
		try {
			const res = await api.request(`/admin/inventory/materials/${materialId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ cost_per_unit: editingCostValue })
			});

			if (res.ok) {
				toast.success('Harga berhasil diupdate!');
				editingCostId = null;
				fetchInventory();
				// Refresh BOM recipes if in BOM tab
				if (activeTab === 'bom') {
					fetchBomRecipes();
				}
			} else {
				const json = await res.json();
				toast.error(json.message || 'Gagal update harga');
			}
		} catch {
			toast.error('Terjadi kesalahan jaringan');
		} finally {
			isSavingCost = false;
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
					Pantau ketersediaan bahan baku, waste tracking, dan setup resep BOM.
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

		<!-- Tab Navigation -->
		{#if !isOpnameMode}
			<div class="flex gap-1 border-b border-slate-200">
				<button
					onclick={() => switchToTab('stock')}
					class={`px-4 py-3 text-sm font-medium transition-colors ${
						activeTab === 'stock'
							? 'border-b-2 border-blue-600 text-blue-600'
							: 'text-slate-600 hover:text-slate-800'
					}`}
				>
					Stok
				</button>
				<button
					onclick={() => switchToTab('waste')}
					class={`px-4 py-3 text-sm font-medium transition-colors ${
						activeTab === 'waste'
							? 'border-b-2 border-red-600 text-red-600'
							: 'text-slate-600 hover:text-slate-800'
					}`}
				>
					Waste
				</button>
				<button
					onclick={() => switchToTab('bom')}
					class={`px-4 py-3 text-sm font-medium transition-colors ${
						activeTab === 'bom'
							? 'border-b-2 border-green-600 text-green-600'
							: 'text-slate-600 hover:text-slate-800'
					}`}
				>
					Resep / BOM
				</button>
			</div>
		{/if}

		<!-- Stock Tab -->
		{#if activeTab === 'stock'}
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
									<th class="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase"
										>Harga/Unit (Rp)</th
									>
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
											<td class="px-6 py-4 font-bold whitespace-nowrap text-slate-900"
												>{item.name}</td
											>
											<td class="px-6 py-4 whitespace-nowrap text-slate-600"
												>{item.purchase_unit || item.unit || '-'}</td
											>
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
		{/if}

		<!-- Waste Tab -->
		{#if activeTab === 'waste'}
			<div class="space-y-6">
				<!-- Waste Form -->
				<div class="overflow-hidden rounded-2xl border border-red-200 bg-white shadow-sm">
					<div class="border-b border-red-100 bg-red-50 px-6 py-4">
						<h2 class="text-lg font-bold text-red-800">Catat Waste / Kerusakan</h2>
						<p class="text-sm text-red-600">
							Catat bahan baku yang expired, rusak, atau tidak bisa dipakai.
						</p>
					</div>
					<div class="p-6">
						<div class="grid gap-4 md:grid-cols-2">
							<div>
								<label for="waste-material" class="mb-1 block text-sm font-medium text-slate-700">
									Bahan Baku
								</label>
								<select
									id="waste-material"
									bind:value={wasteMaterialId}
									class="w-full rounded-lg border border-slate-300 px-3 py-2"
								>
									<option value="">Pilih bahan...</option>
									{#each materials as m}
										<option value={m.id}>
											{m.name} (Stok: {Number(m.stock)}
											{m.purchase_unit || '-'})
										</option>
									{/each}
								</select>
							</div>

							<div>
								<label for="waste-quantity" class="mb-1 block text-sm font-medium text-slate-700">
									Jumlah Waste
								</label>
								<input
									id="waste-quantity"
									type="number"
									bind:value={wasteQuantity}
									min="0.01"
									step="0.01"
									class="w-full rounded-lg border border-slate-300 px-3 py-2"
								/>
							</div>

							<div>
								<label for="waste-reason" class="mb-1 block text-sm font-medium text-slate-700">
									Alasan
								</label>
								<select
									id="waste-reason"
									bind:value={wasteReason}
									class="w-full rounded-lg border border-slate-300 px-3 py-2"
								>
									<option value="expired">Bahan Expired</option>
									<option value="processing_error">Salah Olah</option>
									<option value="damaged">Rusak</option>
									<option value="sample">Sample/Coba-coba</option>
								</select>
							</div>

							<div>
								<label for="waste-notes" class="mb-1 block text-sm font-medium text-slate-700">
									Keterangan
								</label>
								<input
									id="waste-notes"
									type="text"
									bind:value={wasteNotes}
									placeholder="Contoh: penyimpanan kurang baik"
									class="w-full rounded-lg border border-slate-300 px-3 py-2"
								/>
							</div>
						</div>

						<button
							onclick={submitWaste}
							disabled={isSubmittingWaste}
							class="mt-4 rounded-lg bg-red-600 px-6 py-2.5 font-medium text-white hover:bg-red-700 disabled:opacity-50"
						>
							{#if isSubmittingWaste}
								<span class="flex items-center gap-2">
									<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
										<circle
											class="opacity-25"
											cx="12"
											cy="12"
											r="10"
											stroke="currentColor"
											stroke-width="4"
										></circle>
										<path
											class="opacity-75"
											fill="currentColor"
											d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
										></path>
									</svg>
									Menyimpan...
								</span>
							{:else}
								Catat Waste
							{/if}
						</button>
					</div>
				</div>

				<!-- Waste History -->
				<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
					<div class="border-b border-slate-100 bg-slate-50 px-6 py-4">
						<h2 class="text-lg font-bold text-slate-800">Riwayat Waste</h2>
					</div>
					{#if isLoadingWaste}
						<div class="flex justify-center p-12">
							<div
								class="border-brand-500 h-8 w-8 animate-spin rounded-full border-t-2 border-b-2"
							></div>
						</div>
					{:else if wasteHistory.length === 0}
						<div class="p-12 text-center text-slate-500">Belum ada data waste.</div>
					{:else}
						<div class="overflow-x-auto">
							<table class="min-w-full divide-y divide-slate-200">
								<thead class="bg-slate-50">
									<tr>
										<th class="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase"
											>Tanggal</th
										>
										<th class="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase"
											>Bahan</th
										>
										<th class="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase"
											>Jumlah</th
										>
										<th class="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase"
											>Alasan</th
										>
										<th class="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase"
											>Keterangan</th
										>
										<th class="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase"
											>Dicatat Oleh</th
										>
									</tr>
								</thead>
								<tbody class="divide-y divide-slate-200 bg-white">
									{#each wasteHistory as w}
										<tr class="hover:bg-slate-50">
											<td class="px-6 py-3 text-sm whitespace-nowrap text-slate-600">
												{formatDate(w.created_at)}
											</td>
											<td class="px-6 py-3 text-sm font-medium whitespace-nowrap text-slate-900">
												{w.raw_material.name}
											</td>
											<td
												class="px-6 py-3 text-right text-sm font-medium whitespace-nowrap text-red-600"
											>
												-{Number(w.quantity)}
												{w.raw_material.purchase_unit || '-'}
											</td>
											<td class="px-6 py-3 whitespace-nowrap">
												<span
													class="inline-flex rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700"
												>
													{formatReason(w.notes)}
												</span>
											</td>
											<td class="px-6 py-3 text-sm text-slate-600">
												{w.notes || '-'}
											</td>
											<td class="px-6 py-3 text-sm whitespace-nowrap text-slate-600">
												{w.actor?.name || '-'}
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- BOM Tab -->
		{#if activeTab === 'bom'}
			<div class="space-y-6">
				<div class="overflow-hidden rounded-2xl border border-green-200 bg-white shadow-sm">
					<div class="border-b border-green-100 bg-green-50 px-6 py-4">
						<h2 class="text-lg font-bold text-green-800">Bill of Materials (BOM)</h2>
						<p class="text-sm text-green-600">
							Setup resep untuk menghitung HPP (Harga Pokok Penjualan) per produk.
						</p>
					</div>
					<div class="p-6">
						<!-- Product Selector -->
						<div class="mb-6">
							<label for="bom-product" class="mb-1 block text-sm font-medium text-slate-700">
								Pilih Produk
							</label>
							<select
								id="bom-product"
								bind:value={selectedBomProductId}
								onchange={onBomProductChange}
								class="w-full rounded-lg border border-slate-300 px-3 py-2 md:w-1/2"
							>
								<option value="">Pilih produk...</option>
								{#each products as p}
									<option value={p.id}>{p.name}</option>
								{/each}
							</select>
						</div>

						{#if selectedBomProductId}
							{#if isLoadingBom}
								<div class="flex justify-center py-8">
									<div
										class="border-brand-500 h-8 w-8 animate-spin rounded-full border-t-2 border-b-2"
									></div>
								</div>
							{:else}
								<!-- BOM Table -->
								{#if bomRecipes.length > 0}
									<div class="mb-4 overflow-x-auto rounded-lg border border-slate-200">
										<table class="min-w-full divide-y divide-slate-200 text-sm">
											<thead class="bg-slate-50">
												<tr>
													<th
														class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase"
														>Bahan Baku</th
													>
													<th
														class="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase"
														>Jumlah per Porsi</th
													>
													<th
														class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase"
														>Unit</th
													>
													<th
														class="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase"
														>Harga/Unit</th
													>
													<th
														class="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase"
														>Subtotal HPP</th
													>
													<th
														class="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase"
														>Aksi</th
													>
												</tr>
											</thead>
											<tbody class="divide-y divide-slate-200 bg-white">
												{#each bomRecipes as item}
													<tr class="hover:bg-slate-50">
														<td class="px-4 py-3 font-medium text-slate-900"
															>{item.raw_material.name}</td
														>
														<td class="px-4 py-3 text-center">
															<input
																type="number"
																step="0.01"
																min="0"
																value={item.quantity_per_serving}
																onchange={(e) =>
																	updateBomQuantity(item.id, parseFloat(e.currentTarget.value))}
																class="w-20 rounded border border-slate-300 px-2 py-1 text-center font-medium"
															/>
														</td>
														<td class="px-4 py-3 text-slate-600"
															>{item.raw_material.purchase_unit || '-'}</td
														>
														<td class="px-4 py-3 text-right text-slate-600">
															Rp {Number(item.raw_material.cost_per_unit || 0).toLocaleString(
																'id-ID'
															)}
														</td>
														<td class="px-4 py-3 text-right font-medium text-slate-900">
															Rp {(
																Number(item.quantity_per_serving) *
																Number(item.raw_material.cost_per_unit || 0)
															).toLocaleString('id-ID')}
														</td>
														<td class="px-4 py-3 text-center">
															<button
																onclick={() => deleteBomRecipe(item.id)}
																class="text-red-600 hover:text-red-800"
															>
																Hapus
															</button>
														</td>
													</tr>
												{/each}
											</tbody>
											<tfoot class="bg-green-50">
												<tr>
													<td colspan="4" class="px-4 py-3 text-right font-bold text-slate-900"
														>Total HPP per Porsi:</td
													>
													<td class="px-4 py-3 text-right font-bold text-green-700">
														Rp {getTotalBomCost().toLocaleString('id-ID')}
													</td>
													<td></td>
												</tr>
											</tfoot>
										</table>
									</div>
								{/if}

								<!-- Add Material Form -->
								<div
									class="flex flex-wrap gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4"
								>
									<select
										bind:value={newBomMaterialId}
										class="min-w-48 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
									>
										<option value="">Tambah bahan...</option>
										{#each materials as m}
											<option value={m.id}>{m.name} (Stok: {Number(m.stock)})</option>
										{/each}
									</select>
									<input
										type="number"
										step="0.01"
										min="0.01"
										bind:value={newBomQuantity}
										placeholder="Qty"
										class="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
									/>
									<button
										onclick={addBomRecipe}
										disabled={isAddingBom || !newBomMaterialId}
										class="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
									>
										{isAddingBom ? 'Menyimpan...' : 'Tambah'}
									</button>
								</div>
							{/if}
						{:else}
							<div class="py-12 text-center text-slate-500">
								<p>Pilih produk di atas untuk melihat atau menambah resep.</p>
							</div>
						{/if}
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
