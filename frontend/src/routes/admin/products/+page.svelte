<script lang="ts">
	import { api } from '$lib/services/api.client';
	import { onMount } from 'svelte';

	import type { ProductItem, ModifierGroup } from '$lib/domain/models/types';
	let products = $state<ProductItem[]>([]);
	let isLoading = $state(true);

	let showProductModal = $state(false);
	let isEditing = $state(false);

	let pName = $state('');
	let pBasePrice = $state('');
	let pIsOutOfStock = $state(false);
	let pIsActive = $state(true);
	let pId = $state('');

	async function fetchProducts() {
		isLoading = true;
		try {
			const res = await api.request(`/products?include_modifiers=true`, { credentials: 'include' });
			if (res.ok) {
				const data = await res.json();
				products = data.data;
			}
		} catch (e) {
			console.error(e);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		fetchProducts();
	});

	function openCreateModal() {
		isEditing = false;
		pId = '';
		pName = '';
		pBasePrice = '';
		pIsOutOfStock = false;
		pIsActive = true;
		showProductModal = true;
	}

	function openEditModal(prod: ProductItem) {
		isEditing = true;
		pId = prod.id;
		pName = prod.name;
		pBasePrice = String(prod.base_price);
		pIsOutOfStock = prod.is_out_of_stock;
		pIsActive = prod.is_active;
		showProductModal = true;
	}

	async function saveProduct(e: Event) {
		e.preventDefault();
		try {
			const url = isEditing ? `/products/${pId}` : `/products`;
			const method = isEditing ? 'PATCH' : 'POST';

			// For MVP, assuming category_id is needed, sending a dummy or default category if not present
			// In a real app we'd fetch categories and select one.
			const payload = {
				name: pName,
				base_price: Number(pBasePrice),
				is_out_of_stock: pIsOutOfStock,
				is_active: pIsActive
			};

			const res = await api.request(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(payload)
			});

			if (res.ok) {
				showProductModal = false;
				fetchProducts();
			} else {
				const err = await res.json();
				alert('Gagal menyimpan produk: ' + (err.message || ''));
			}
		} catch (e) {
			alert('Error pada server');
		}
	}

	// --- Modifier Management ---
	let showModifierModal = $state(false);
	let activeProductForModifier: ProductItem | null = $state(null);
	let newGroupName = $state('');
	let newGroupRequired = $state(true);

	let newOptionName = $state('');
	let newOptionPrice = $state('');
	let selectedGroupId = $state('');

	function openModifierModal(prod: ProductItem) {
		activeProductForModifier = prod;
		showModifierModal = true;
	}

	async function addModifierGroup(e: Event) {
		e.preventDefault();
		if (!newGroupName || !activeProductForModifier) return;
		try {
			const res = await api.request(
				`/admin/products/${activeProductForModifier.id}/modifier-groups`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify({
						name: newGroupName,
						is_required: newGroupRequired,
						max_selections: 1
					})
				}
			);
			if (res.ok) {
				newGroupName = '';
				fetchProducts();
				// Optimistic UI update or refetch active product
				// For simplicity, we just reload products and close modal or refetch
				// Let's refetch products and update activeProductForModifier
				setTimeout(() => {
					activeProductForModifier =
						products.find((p) => p.id === activeProductForModifier?.id) || null;
				}, 300);
			}
		} catch (e) {}
	}

	async function addModifierOption(e: Event) {
		e.preventDefault();
		if (!newOptionName || !selectedGroupId) return;
		try {
			const res = await api.request(`/admin/modifier-groups/${selectedGroupId}/options`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ name: newOptionName, additional_price: Number(newOptionPrice || 0) })
			});
			if (res.ok) {
				newOptionName = '';
				newOptionPrice = '';
				fetchProducts();
				setTimeout(() => {
					activeProductForModifier =
						products.find((p) => p.id === activeProductForModifier?.id) || null;
				}, 300);
			}
		} catch (e) {}
	}

	async function toggleGroupStatus(groupId: string, currentStatus?: boolean) {
		const newStatus = !currentStatus;
		try {
			const res = await api.request(`/admin/modifier-groups/${groupId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ is_active: newStatus })
			});
			if (res.ok) {
				fetchProducts();
				setTimeout(() => {
					activeProductForModifier =
						products.find((p) => p.id === activeProductForModifier?.id) || null;
				}, 300);
			}
		} catch (e) {}
	}

	async function toggleOptionStatus(optionId: string, currentStatus?: boolean) {
		const newStatus = !currentStatus;
		try {
			const res = await api.request(`/admin/modifier-options/${optionId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ is_active: newStatus })
			});
			if (res.ok) {
				fetchProducts();
				setTimeout(() => {
					activeProductForModifier =
						products.find((p) => p.id === activeProductForModifier?.id) || null;
				}, 300);
			}
		} catch (e) {}
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
	<title>Produk - Ngemiloh Admin</title>
</svelte:head>

<div class="h-full overflow-y-auto p-8">
	<div class="mx-auto max-w-7xl space-y-8">
		<header class="flex items-end justify-between">
			<div>
				<h1 class="text-3xl font-bold tracking-tight text-slate-900">Manajemen Produk & Varian</h1>
				<p class="mt-2 text-slate-500">
					Kelola produk utama, harga dasar, ketersediaan stok, dan bumbu/saus.
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
				Tambah Produk
			</button>
		</header>

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
									>Menu Produk</th
								>
								<th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase"
									>Harga Dasar</th
								>
								<th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase"
									>Status</th
								>
								<th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase"
									>Stok</th
								>
								<th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase"
									>Varian Modifier</th
								>
								<th class="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase"
									>Aksi</th
								>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-200 bg-white">
							{#if products.length === 0}
								<tr>
									<td colspan="6" class="px-6 py-8 text-center text-slate-500">Belum ada produk.</td
									>
								</tr>
							{:else}
								{#each products as prod}
									<tr
										class="transition-colors hover:bg-slate-50 {prod.is_active
											? ''
											: 'bg-slate-50 opacity-60'}"
									>
										<td class="px-6 py-4 whitespace-nowrap">
											<div class="text-base font-bold text-slate-900">{prod.name}</div>
										</td>
										<td class="px-6 py-4 whitespace-nowrap">
											<div class="font-bold text-indigo-700">
												{formatRp(Number(prod.base_price))}
											</div>
										</td>
										<td class="px-6 py-4 whitespace-nowrap">
											{#if prod.is_active}
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
										<td class="px-6 py-4 whitespace-nowrap">
											{#if prod.is_out_of_stock}
												<span
													class="rounded-full bg-red-100 px-2.5 py-1 text-xs font-bold text-red-800"
													>HABIS</span
												>
											{:else}
												<span
													class="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800"
													>Tersedia</span
												>
											{/if}
										</td>
										<td class="max-w-xs truncate px-6 py-4 text-sm text-slate-600">
											{#if prod.modifier_groups && prod.modifier_groups.filter((g) => g.is_active).length > 0}
												{prod.modifier_groups
													.filter((g) => g.is_active)
													.map((g) => g.name)
													.join(', ')}
											{:else}
												<span class="text-slate-400 italic">Tanpa modifier</span>
											{/if}
										</td>
										<td class="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
											<button
												onclick={() => openEditModal(prod)}
												class="mr-2 rounded-lg bg-indigo-50 px-3 py-1.5 font-semibold text-indigo-600 hover:text-indigo-900"
												>Edit</button
											>
											<button
												onclick={() => openModifierModal(prod)}
												class="rounded-lg bg-teal-50 px-3 py-1.5 font-semibold text-teal-600 hover:text-teal-900"
												>Varian</button
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

<!-- Modal Form Produk -->
{#if showProductModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4">
		<div class="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
			<div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-6">
				<h3 class="text-xl font-bold text-slate-800">
					{isEditing ? 'Edit Produk' : 'Tambah Produk Baru'}
				</h3>
				<button
					onclick={() => (showProductModal = false)}
					class="text-slate-400 hover:text-slate-600">X</button
				>
			</div>

			<form onsubmit={saveProduct} class="space-y-5 p-6">
				<div>
					<label class="mb-1 block text-sm font-bold text-slate-700"
						>Nama Produk <span class="text-red-500">*</span></label
					>
					<input
						type="text"
						bind:value={pName}
						required
						class="w-full rounded-lg border-slate-300 text-lg focus:border-indigo-500 focus:ring-indigo-500"
						placeholder="Cth: Macaroni Mateng"
					/>
				</div>
				<div>
					<label class="mb-1 block text-sm font-bold text-slate-700"
						>Harga Dasar (Rp) <span class="text-red-500">*</span></label
					>
					<input
						type="number"
						min="0"
						bind:value={pBasePrice}
						required
						class="w-full rounded-lg border-slate-300 text-lg font-bold text-indigo-700 focus:border-indigo-500 focus:ring-indigo-500"
						placeholder="0"
					/>
					<p class="mt-1 text-xs text-slate-500">Harga sebelum ditambah bumbu/saus.</p>
				</div>

				<div class="flex gap-6 pt-2">
					<label
						class="flex flex-1 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 {pIsActive
							? 'border-green-200 bg-green-50'
							: ''}"
					>
						<input
							type="checkbox"
							bind:checked={pIsActive}
							class="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
						/>
						<span class="font-semibold text-slate-700">Tampil di POS</span>
					</label>

					<label
						class="flex flex-1 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 {pIsOutOfStock
							? 'border-red-200 bg-red-50'
							: ''}"
					>
						<input
							type="checkbox"
							bind:checked={pIsOutOfStock}
							class="h-5 w-5 rounded border-slate-300 text-red-600 focus:ring-red-500"
						/>
						<span class="font-semibold text-slate-700">Tandai HABIS</span>
					</label>
				</div>

				<div class="flex gap-3 border-t border-slate-100 pt-4">
					<button
						type="button"
						onclick={() => (showProductModal = false)}
						class="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-700 hover:bg-slate-50"
						>Batal</button
					>
					<button
						type="submit"
						class="flex-1 rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white shadow-md hover:bg-indigo-700"
						>Simpan Produk</button
					>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Modal Kelola Varian (Modifier) -->
{#if showModifierModal && activeProductForModifier}
	<div class="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/75 p-4">
		<div
			class="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
		>
			<div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-6">
				<div>
					<h3 class="text-xl font-bold text-slate-800">Varian: {activeProductForModifier.name}</h3>
					<p class="text-sm text-slate-500">Kelola grup bumbu/saus dan harga tambahannya.</p>
				</div>
				<button
					onclick={() => (showModifierModal = false)}
					class="text-slate-400 hover:text-slate-600">X</button
				>
			</div>

			<div class="flex-1 space-y-8 overflow-y-auto bg-slate-50 p-6">
				<!-- Existing Groups -->
				<div class="space-y-4">
					<h4 class="font-bold text-slate-700">Grup Varian Saat Ini</h4>
					{#if !activeProductForModifier.modifier_groups || activeProductForModifier.modifier_groups.length === 0}
						<p class="text-sm text-slate-500 italic">Belum ada grup varian.</p>
					{:else}
						{#each activeProductForModifier.modifier_groups as group}
							<div
								class="border bg-white {group.is_active
									? 'border-slate-200'
									: 'border-red-200 bg-red-50 opacity-70'} rounded-xl p-4"
							>
								<div class="mb-3 flex items-start justify-between">
									<div>
										<span class="text-lg font-bold text-slate-800">{group.name}</span>
										{#if group.is_required}
											<span
												class="ml-2 rounded bg-red-100 px-2 py-0.5 text-xs font-bold text-red-600"
												>Wajib (Required)</span
											>
										{/if}
									</div>
									<button
										onclick={() => toggleGroupStatus(group.id, group.is_active)}
										class="text-xs font-bold {group.is_active
											? 'text-red-600 hover:text-red-800'
											: 'text-green-600 hover:text-green-800'}"
									>
										{group.is_active ? 'Nonaktifkan Grup' : 'Aktifkan Grup'}
									</button>
								</div>

								<div class="space-y-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
									{#if group.options && group.options.length > 0}
										{#each group.options as option}
											<div
												class="flex items-center justify-between p-2 text-sm {option.is_active
													? 'bg-white'
													: 'bg-slate-100 opacity-50'} rounded border border-slate-100 shadow-sm"
											>
												<div>
													<span class="font-semibold text-slate-700">{option.name}</span>
													{#if Number(option.additional_price) > 0}
														<span class="ml-2 font-bold text-indigo-600"
															>+{formatRp(Number(option.additional_price))}</span
														>
													{/if}
												</div>
												<button
													onclick={() => toggleOptionStatus(option.id, option.is_active)}
													class="text-xs font-bold {option.is_active
														? 'text-red-500 hover:text-red-700'
														: 'text-green-600 hover:text-green-800'}"
												>
													{option.is_active ? 'Nonaktifkan' : 'Aktifkan'}
												</button>
											</div>
										{/each}
									{:else}
										<p class="text-xs text-slate-400 italic">Belum ada opsi dalam grup ini.</p>
									{/if}
								</div>
							</div>
						{/each}
					{/if}
				</div>

				<!-- Add New Option to Existing Group -->
				{#if activeProductForModifier.modifier_groups && activeProductForModifier.modifier_groups.filter((g) => g.is_active).length > 0}
					<form
						onsubmit={addModifierOption}
						class="rounded-xl border border-indigo-100 bg-indigo-50 p-4"
					>
						<h4 class="mb-3 text-sm font-bold text-indigo-900">Tambah Opsi Baru ke Grup</h4>
						<div class="grid grid-cols-3 gap-3">
							<select
								bind:value={selectedGroupId}
								required
								class="rounded-lg border-indigo-200 text-sm focus:ring-indigo-500"
							>
								<option value="">Pilih Grup</option>
								{#each activeProductForModifier.modifier_groups.filter((g) => g.is_active) as group}
									<option value={group.id}>{group.name}</option>
								{/each}
							</select>
							<input
								type="text"
								bind:value={newOptionName}
								placeholder="Nama Opsi (cth: Saus BBQ)"
								required
								class="rounded-lg border-indigo-200 text-sm focus:ring-indigo-500"
							/>
							<div class="flex gap-2">
								<input
									type="number"
									bind:value={newOptionPrice}
									placeholder="+Harga"
									class="w-full rounded-lg border-indigo-200 text-sm focus:ring-indigo-500"
								/>
								<button
									type="submit"
									class="rounded-lg bg-indigo-600 px-3 text-sm font-bold text-white hover:bg-indigo-700"
									>+</button
								>
							</div>
						</div>
					</form>
				{/if}

				<!-- Add New Group -->
				<form onsubmit={addModifierGroup} class="rounded-xl border border-slate-200 bg-white p-4">
					<h4 class="mb-3 text-sm font-bold text-slate-700">Buat Grup Varian Baru</h4>
					<div class="flex items-end gap-3">
						<div class="flex-1">
							<label class="mb-1 block text-xs text-slate-500">Nama Grup</label>
							<input
								type="text"
								bind:value={newGroupName}
								placeholder="cth: Pilih Level Pedas"
								required
								class="w-full rounded-lg border-slate-300 text-sm focus:ring-slate-500"
							/>
						</div>
						<div class="mb-2 flex items-center gap-2">
							<input
								type="checkbox"
								bind:checked={newGroupRequired}
								class="h-4 w-4 rounded text-indigo-600"
							/>
							<span class="text-sm font-semibold text-slate-600">Wajib Dipilih (Required)</span>
						</div>
						<button
							type="submit"
							class="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold whitespace-nowrap text-white hover:bg-slate-900"
							>Tambah Grup</button
						>
					</div>
				</form>
			</div>
		</div>
	</div>
{/if}
