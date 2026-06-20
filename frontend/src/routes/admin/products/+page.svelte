<script lang="ts">
	import { api } from '$lib/services/api.client';
	import { format_rp } from '$lib/utils/format';
	import { onMount } from 'svelte';
	import { toast } from '$lib/stores/toast.store.svelte';
	import { sanitize_product_name, parse_safe_number } from '$lib/utils/sanitize';
	import { focus_trap } from '$lib/utils/a11y';

	import type { ProductItem, ModifierGroup } from '$lib/domain/models/types';

	let products = $state<ProductItem[]>([]);
	let is_loading = $state(true);

	let show_product_modal = $state(false);
	let is_editing = $state(false);

	let p_name = $state('');
	let p_base_price = $state('');
	let p_is_out_of_stock = $state(false);
	let p_is_active = $state(true);
	let p_id = $state('');

	async function fetch_products() {
		is_loading = true;
		try {
			const res = await api.request(`/products?include_modifiers=true`, { credentials: 'include' });
			if (res.ok) {
				const data = await res.json();
				products = data.data;
			}
		} catch (e) {
			console.error(e);
		} finally {
			is_loading = false;
		}
	}

	onMount(() => {
		fetch_products();
	});

	function open_create_modal() {
		is_editing = false;
		p_id = '';
		p_name = '';
		p_base_price = '';
		p_is_out_of_stock = false;
		p_is_active = true;
		show_product_modal = true;
	}

	function open_edit_modal(prod: ProductItem) {
		is_editing = true;
		p_id = prod.id;
		p_name = prod.name;
		p_base_price = String(prod.base_price);
		p_is_out_of_stock = prod.is_out_of_stock;
		p_is_active = prod.is_active;
		show_product_modal = true;
	}

	async function save_product(e: Event) {
		e.preventDefault();
		// SECURITY FIX F-03: Sanitize inputs before sending to backend
		const sanitized_name = sanitize_product_name(p_name);
		const sanitized_price = parse_safe_number(p_base_price);

		if (!sanitized_name.trim()) {
			toast.error('Nama produk tidak boleh kosong');
			return;
		}

		try {
			const url = is_editing ? `/products/${p_id}` : `/products`;
			const method = is_editing ? 'PATCH' : 'POST';

			const payload = {
				name: sanitized_name,
				base_price: sanitized_price,
				is_out_of_stock: p_is_out_of_stock,
				is_active: p_is_active
			};

			const res = await api.request(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(payload)
			});

			if (res.ok) {
				show_product_modal = false;
				toast.success(is_editing ? 'Produk berhasil diperbarui' : 'Produk berhasil ditambahkan');
				fetch_products();
			} else {
				const err = await res.json();
				toast.error('Gagal menyimpan produk: ' + (err.message || ''));
			}
		} catch (e) {
			toast.error('Gagal menyimpan produk. Cek koneksi Anda.');
		}
	}

	// --- Modifier Management ---
	let show_modifier_modal = $state(false);
	let active_product_for_modifier: ProductItem | null = $state(null);
	let new_group_name = $state('');
	let new_group_required = $state(true);

	let new_option_name = $state('');
	let new_option_price = $state('');
	let selected_group_id = $state('');

	function open_modifier_modal(prod: ProductItem) {
		active_product_for_modifier = prod;
		show_modifier_modal = true;
	}

	async function add_modifier_group(e: Event) {
		e.preventDefault();
		if (!new_group_name || !active_product_for_modifier) return;
		try {
			const res = await api.request(
				`/admin/products/${active_product_for_modifier.id}/modifier-groups`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify({
						name: new_group_name,
						is_required: new_group_required,
						max_selections: 1
					})
				}
			);
			if (res.ok) {
				new_group_name = '';
				toast.success('Grup varian berhasil ditambahkan');
				fetch_products();
				setTimeout(() => {
					active_product_for_modifier =
						products.find((p) => p.id === active_product_for_modifier?.id) || null;
				}, 300);
			} else {
				toast.error('Gagal menambahkan grup varian');
			}
		} catch (e) {
			toast.error('Gagal menambahkan grup varian. Cek koneksi Anda.');
		}
	}

	async function add_modifier_option(e: Event) {
		e.preventDefault();
		if (!new_option_name || !selected_group_id) return;
		try {
			const res = await api.request(`/admin/modifier-groups/${selected_group_id}/options`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					name: new_option_name,
					additional_price: Number(new_option_price || 0)
				})
			});
			if (res.ok) {
				new_option_name = '';
				new_option_price = '';
				toast.success('Opsi varian berhasil ditambahkan');
				fetch_products();
				setTimeout(() => {
					active_product_for_modifier =
						products.find((p) => p.id === active_product_for_modifier?.id) || null;
				}, 300);
			} else {
				toast.error('Gagal menambahkan opsi varian');
			}
		} catch (e) {
			toast.error('Gagal menambahkan opsi varian. Cek koneksi Anda.');
		}
	}

	async function toggle_group_status(group_id: string, current_status?: boolean) {
		const new_status = !current_status;
		try {
			const res = await api.request(`/admin/modifier-groups/${group_id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ is_active: new_status })
			});
			if (res.ok) {
				toast.success(new_status ? 'Grup diaktifkan' : 'Grup dinonaktifkan');
				fetch_products();
				setTimeout(() => {
					active_product_for_modifier =
						products.find((p) => p.id === active_product_for_modifier?.id) || null;
				}, 300);
			} else {
				toast.error('Gagal mengubah status grup');
			}
		} catch (e) {
			toast.error('Gagal mengubah status grup. Cek koneksi Anda.');
		}
	}

	async function toggle_option_status(option_id: string, current_status?: boolean) {
		const new_status = !current_status;
		try {
			const res = await api.request(`/admin/modifier-options/${option_id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ is_active: new_status })
			});
			if (res.ok) {
				toast.success(new_status ? 'Opsi diaktifkan' : 'Opsi dinonaktifkan');
				fetch_products();
				setTimeout(() => {
					active_product_for_modifier =
						products.find((p) => p.id === active_product_for_modifier?.id) || null;
				}, 300);
			} else {
				toast.error('Gagal mengubah status opsi');
			}
		} catch (e) {
			toast.error('Gagal mengubah status opsi. Cek koneksi Anda.');
		}
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
				onclick={open_create_modal}
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
			{#if is_loading}
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
												{format_rp(Number(prod.base_price))}
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
												onclick={() => open_edit_modal(prod)}
												class="mr-2 rounded-lg bg-indigo-50 px-3 py-1.5 font-semibold text-indigo-600 hover:text-indigo-900"
												>Edit</button
											>
											<button
												onclick={() => open_modifier_modal(prod)}
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
{#if show_product_modal}
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4"
		onkeydown={(e) => e.key === 'Escape' && (show_product_modal = false)}
		onclick={(e) => e.target === e.currentTarget && (show_product_modal = false)}
	>
		<div class="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl" use:focus_trap>
			<div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-6">
				<h3 class="text-xl font-bold text-slate-800">
					{is_editing ? 'Edit Produk' : 'Tambah Produk Baru'}
				</h3>
				<button
					onclick={() => (show_product_modal = false)}
					aria-label="Tutup modal"
					class="text-slate-400 hover:text-slate-600">X</button
				>
			</div>

			<form onsubmit={save_product} class="space-y-5 p-6">
				<div>
					<label for="product-name" class="mb-1 block text-sm font-bold text-slate-700"
						>Nama Produk <span class="text-red-500">*</span></label
					>
					<input
						id="product-name"
						type="text"
						bind:value={p_name}
						required
						class="w-full rounded-lg border-slate-300 text-lg focus:border-indigo-500 focus:ring-indigo-500"
						placeholder="Cth: Macaroni Mateng"
					/>
				</div>
				<div>
					<label for="product-base-price" class="mb-1 block text-sm font-bold text-slate-700"
						>Harga Dasar (Rp) <span class="text-red-500">*</span></label
					>
					<input
						id="product-base-price"
						type="number"
						min="0"
						bind:value={p_base_price}
						required
						class="w-full rounded-lg border-slate-300 text-lg font-bold text-indigo-700 focus:border-indigo-500 focus:ring-indigo-500"
						placeholder="0"
					/>
					<p class="mt-1 text-xs text-slate-500">Harga sebelum ditambah bumbu/saus.</p>
				</div>

				<div class="flex gap-6 pt-2">
					<label
						class="flex flex-1 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 {p_is_active
							? 'border-green-200 bg-green-50'
							: ''}"
					>
						<input
							type="checkbox"
							bind:checked={p_is_active}
							class="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
						/>
						<span class="font-semibold text-slate-700">Tampil di POS</span>
					</label>

					<label
						class="flex flex-1 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 {p_is_out_of_stock
							? 'border-red-200 bg-red-50'
							: ''}"
					>
						<input
							type="checkbox"
							bind:checked={p_is_out_of_stock}
							class="h-5 w-5 rounded border-slate-300 text-red-600 focus:ring-red-500"
						/>
						<span class="font-semibold text-slate-700">Tandai HABIS</span>
					</label>
				</div>

				<div class="flex gap-3 border-t border-slate-100 pt-4">
					<button
						type="button"
						onclick={() => (show_product_modal = false)}
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
{#if show_modifier_modal && active_product_for_modifier}
	<div class="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/75 p-4">
		<div
			class="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
		>
			<div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-6">
				<div>
					<h3 class="text-xl font-bold text-slate-800">
						Varian: {active_product_for_modifier.name}
					</h3>
					<p class="text-sm text-slate-500">Kelola grup bumbu/saus dan harga tambahannya.</p>
				</div>
				<button
					onclick={() => (show_modifier_modal = false)}
					class="text-slate-400 hover:text-slate-600">X</button
				>
			</div>

			<div class="flex-1 space-y-8 overflow-y-auto bg-slate-50 p-6">
				<!-- Existing Groups -->
				<div class="space-y-4">
					<h4 class="font-bold text-slate-700">Grup Varian Saat Ini</h4>
					{#if !active_product_for_modifier.modifier_groups || active_product_for_modifier.modifier_groups.length === 0}
						<p class="text-sm text-slate-500 italic">Belum ada grup varian.</p>
					{:else}
						{#each active_product_for_modifier.modifier_groups as group}
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
										onclick={() => toggle_group_status(group.id, group.is_active)}
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
															>+{format_rp(Number(option.additional_price))}</span
														>
													{/if}
												</div>
												<button
													onclick={() => toggle_option_status(option.id, option.is_active)}
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
				{#if active_product_for_modifier.modifier_groups && active_product_for_modifier.modifier_groups.filter((g) => g.is_active).length > 0}
					<form
						onsubmit={add_modifier_option}
						class="rounded-xl border border-indigo-100 bg-indigo-50 p-4"
					>
						<h4 class="mb-3 text-sm font-bold text-indigo-900">Tambah Opsi Baru ke Grup</h4>
						<div class="grid grid-cols-3 gap-3">
							<select
								bind:value={selected_group_id}
								required
								class="rounded-lg border-indigo-200 text-sm focus:ring-indigo-500"
							>
								<option value="">Pilih Grup</option>
								{#each active_product_for_modifier.modifier_groups.filter((g) => g.is_active) as group}
									<option value={group.id}>{group.name}</option>
								{/each}
							</select>
							<input
								type="text"
								bind:value={new_option_name}
								placeholder="Nama Opsi (cth: Saus BBQ)"
								required
								class="rounded-lg border-indigo-200 text-sm focus:ring-indigo-500"
							/>
							<div class="flex gap-2">
								<input
									type="number"
									bind:value={new_option_price}
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
				<form onsubmit={add_modifier_group} class="rounded-xl border border-slate-200 bg-white p-4">
					<h4 class="mb-3 text-sm font-bold text-slate-700">Buat Grup Varian Baru</h4>
					<div class="flex items-end gap-3">
						<div class="flex-1">
							<label for="group-name" class="mb-1 block text-xs text-slate-500">Nama Grup</label>
							<input
								id="group-name"
								type="text"
								bind:value={new_group_name}
								placeholder="cth: Pilih Level Pedas"
								required
								class="w-full rounded-lg border-slate-300 text-sm focus:ring-slate-500"
							/>
						</div>
						<div class="mb-2 flex items-center gap-2">
							<input
								type="checkbox"
								bind:checked={new_group_required}
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
