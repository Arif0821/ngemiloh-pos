<script lang="ts">
	import { api } from '$lib/services/api.client';
	import { toast } from '$lib/stores/toast.store.svelte';
	import { onMount } from 'svelte';

	interface Category {
		id: string;
		name: string;
		sort_order: number;
		is_active: boolean;
		created_at: string;
	}

	let categories = $state<Category[]>([]);
	let is_loading = $state(true);
	let show_modal = $state(false);
	let is_editing = $state(false);
	let cat_id = $state('');
	let cat_name = $state('');
	let cat_sort_order = $state('0');

	async function fetch_categories() {
		is_loading = true;
		try {
			const res = await api.get('/products/categories');
			if (res.ok) {
				const data = await res.json();
				categories = data.data || [];
			}
		} catch (e) {
			console.error(e);
			toast.error('Gagal memuat kategori');
		} finally {
			is_loading = false;
		}
	}

	onMount(() => {
		fetch_categories();
	});

	function open_create_modal() {
		is_editing = false;
		cat_id = '';
		cat_name = '';
		cat_sort_order = '0';
		show_modal = true;
	}

	function open_edit_modal(cat: Category) {
		is_editing = true;
		cat_id = cat.id;
		cat_name = cat.name;
		cat_sort_order = String(cat.sort_order || 0);
		show_modal = true;
	}

	async function save_category(e: Event) {
		e.preventDefault();
		try {
			const url = is_editing ? `/products/categories/${cat_id}` : '/products/categories';
			const method = is_editing ? 'PATCH' : 'POST';
			const body = {
				name: cat_name,
				sort_order: Number(cat_sort_order) || 0
			};

			const res = await api.request(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (res.ok) {
				show_modal = false;
				toast.success(
					is_editing ? 'Kategori berhasil diperbarui' : 'Kategori berhasil ditambahkan'
				);
				fetch_categories();
			} else {
				const err = await res.json();
				toast.error('Gagal menyimpan: ' + (err.message || 'Error tidak diketahui'));
			}
		} catch {
			toast.error('Gagal menyimpan kategori');
		}
	}

	async function toggle_status(cat: Category) {
		try {
			const res = await api.request(`/products/categories/${cat.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ is_active: !cat.is_active })
			});
			if (res.ok) {
				toast.success(cat.is_active ? 'Kategori dinonaktifkan' : 'Kategori diaktifkan');
				fetch_categories();
			}
		} catch {
			toast.error('Gagal mengubah status');
		}
	}
</script>

<svelte:head>
	<title>Kategori Produk - Ngemiloh Admin</title>
</svelte:head>

<div class="h-full overflow-y-auto p-8">
	<div class="mx-auto max-w-4xl space-y-8">
		<header class="flex items-end justify-between">
			<div>
				<h1 class="text-3xl font-bold tracking-tight text-slate-900">Kategori Produk</h1>
				<p class="mt-2 text-slate-500">Kelola kategori untuk mengorganisir produk di POS.</p>
			</div>
			<button
				onclick={open_create_modal}
				class="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 4v16m8-8H4"
					/>
				</svg>
				Tambah Kategori
			</button>
		</header>

		<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			{#if is_loading}
				<div class="flex justify-center p-12">
					<div
						class="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-indigo-500"
					></div>
				</div>
			{:else if categories.length === 0}
				<div class="p-12 text-center">
					<p class="text-slate-500">Belum ada kategori.</p>
					<button onclick={open_create_modal} class="mt-4 text-indigo-600 hover:text-indigo-800">
						Tambah kategori pertama
					</button>
				</div>
			{:else}
				<table class="min-w-full divide-y divide-slate-200">
					<thead class="bg-slate-50">
						<tr>
							<th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase"
								>Urutan</th
							>
							<th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase"
								>Nama Kategori</th
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
						{#each categories.sort((a, b) => a.sort_order - b.sort_order) as cat}
							<tr class="hover:bg-slate-50 {cat.is_active ? '' : 'bg-slate-50 opacity-60'}">
								<td class="px-6 py-4 text-sm whitespace-nowrap text-slate-500">{cat.sort_order}</td>
								<td class="px-6 py-4 font-medium whitespace-nowrap text-slate-900">{cat.name}</td>
								<td class="px-6 py-4 whitespace-nowrap">
									<span
										class="rounded-full px-2.5 py-1 text-xs font-bold {cat.is_active
											? 'bg-green-100 text-green-800'
											: 'bg-slate-200 text-slate-600'}"
									>
										{cat.is_active ? 'Aktif' : 'Nonaktif'}
									</span>
								</td>
								<td class="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
									<button
										onclick={() => open_edit_modal(cat)}
										class="mr-3 text-indigo-600 hover:text-indigo-900">Edit</button
									>
									<button
										onclick={() => toggle_status(cat)}
										class={cat.is_active
											? 'text-red-600 hover:text-red-900'
											: 'text-green-600 hover:text-green-900'}
									>
										{cat.is_active ? 'Nonaktifkan' : 'Aktifkan'}
									</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	</div>
</div>

<!-- Modal -->
{#if show_modal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4">
		<div class="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
			<div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-6">
				<h3 class="text-xl font-bold text-slate-800">
					{is_editing ? 'Edit Kategori' : 'Tambah Kategori Baru'}
				</h3>
				<button onclick={() => (show_modal = false)} class="text-slate-400 hover:text-slate-600"
					>✕</button
				>
			</div>
			<form onsubmit={save_category} class="space-y-5 p-6">
				<div>
					<label for="cat-name" class="mb-1 block text-sm font-bold text-slate-700"
						>Nama Kategori <span class="text-red-500">*</span></label
					>
					<input
						id="cat-name"
						type="text"
						bind:value={cat_name}
						required
						class="w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
						placeholder="cth: Makanan Ringan"
					/>
				</div>
				<div>
					<label for="cat-sort-order" class="mb-1 block text-sm font-bold text-slate-700">Urutan Tampilan</label>
					<input
						id="cat-sort-order"
						type="number"
						bind:value={cat_sort_order}
						min="0"
						class="w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
					/>
					<p class="mt-1 text-xs text-slate-500">Angka kecil muncul lebih dulu.</p>
				</div>
				<div class="flex gap-3 border-t border-slate-100 pt-4">
					<button
						type="button"
						onclick={() => (show_modal = false)}
						class="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-700 hover:bg-slate-50"
						>Batal</button
					>
					<button
						type="submit"
						class="flex-1 rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white shadow-md hover:bg-indigo-700"
						>Simpan</button
					>
				</div>
			</form>
		</div>
	</div>
{/if}
