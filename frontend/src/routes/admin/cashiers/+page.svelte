<script lang="ts">
	import { api } from '$lib/services/api.client';
	import { toast } from '$lib/stores/toast.store.svelte';
	import { onMount } from 'svelte';

	interface Cashier {
		id: string;
		name: string;
		username: string;
		role: string;
		is_active: boolean;
		cashier_letter: string | null;
		last_login_at: string | null;
		created_at: string;
	}

	let cashiers = $state<Cashier[]>([]);
	let is_loading = $state(true);
	let show_modal = $state(false);
	let is_editing = $state(false);
	let cashier_id = $state('');
	let cashier_name = $state('');
	let cashier_username = $state('');
	let cashier_pin = $state('');

	async function fetch_cashiers() {
		is_loading = true;
		try {
			const res = await api.get('/admin/users/cashiers');
			if (res.ok) {
				const data = await res.json();
				cashiers = data.data || [];
			}
		} catch (e) {
			console.error(e);
			toast.error('Gagal memuat data kasir');
		} finally {
			is_loading = false;
		}
	}

	onMount(() => {
		fetch_cashiers();
	});

	function open_create_modal() {
		is_editing = false;
		cashier_id = '';
		cashier_name = '';
		cashier_username = '';
		cashier_pin = '';
		show_modal = true;
	}

	async function save_cashier(e: Event) {
		e.preventDefault();
		try {
			if (!is_editing && !cashier_pin) {
				toast.error('PIN wajib diisi untuk kasir baru');
				return;
			}
			const body: Record<string, unknown> = {
				name: cashier_name,
				username: cashier_username
			};
			if (cashier_pin) body.pin = cashier_pin;

			const url = is_editing ? `/admin/users/cashiers/${cashier_id}` : '/admin/users/cashiers';
			const method = is_editing ? 'PATCH' : 'POST';

			const res = await api.request(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (res.ok) {
				show_modal = false;
				toast.success(is_editing ? 'Kasir berhasil diperbarui' : 'Kasir berhasil ditambahkan');
				fetch_cashiers();
			} else {
				const err = await res.json();
				toast.error('Gagal menyimpan: ' + (err.message || 'Error'));
			}
		} catch {
			toast.error('Gagal menyimpan kasir');
		}
	}

	async function toggle_status(cashier: Cashier) {
		try {
			const res = await api.request(`/admin/users/cashiers/${cashier.id}/toggle-status`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ is_active: !cashier.is_active })
			});
			if (res.ok) {
				toast.success(cashier.is_active ? 'Kasir dinonaktifkan' : 'Kasir diaktifkan');
				fetch_cashiers();
			}
		} catch {
			toast.error('Gagal mengubah status');
		}
	}

	async function reset_pin(cashier: Cashier) {
		if (!confirm(`Reset PIN untuk ${cashier.name}? PIN baru akan dibuatkan sistem.`)) return;
		try {
			// SECURITY: Request server to generate random PIN (never exposed to frontend)
			const res = await api.request(`/admin/users/cashiers/${cashier.id}/reset-pin`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' }
			});
			if (res.ok) {
				const data = await res.json();
				// SECURITY: Mask PIN - show only first 2 and last 2 digits
				const masked_pin = data.data?.masked_pin || '****';
				toast.success(`PIN berhasil di-reset. PIN baru: ${masked_pin}`);
				// SECURITY: In production, show via secure channel (e.g., print receipt)
				toast.info('PIN baru telah di-mask untuk keamanan. Hubungi kasir secara langsung.');
			}
		} catch {
			toast.error('Gagal reset PIN');
		}
	}

	function format_date(d: string | null) {
		if (!d) return '-';
		return new Date(d).toLocaleString('id-ID', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}
</script>

<svelte:head>
	<title>Manajemen Kasir - Ngemiloh Admin</title>
</svelte:head>

<div class="h-full overflow-y-auto p-8">
	<div class="mx-auto max-w-5xl space-y-8">
		<header class="flex items-end justify-between">
			<div>
				<h1 class="text-3xl font-bold tracking-tight text-slate-900">Manajemen Kasir</h1>
				<p class="mt-2 text-slate-500">Kelola akun kasir dan PIN login.</p>
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
				Tambah Kasir
			</button>
		</header>

		<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			{#if is_loading}
				<div class="flex justify-center p-12">
					<div
						class="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-indigo-500"
					></div>
				</div>
			{:else if cashiers.length === 0}
				<div class="p-12 text-center">
					<p class="text-slate-500">Belum ada kasir.</p>
				</div>
			{:else}
				<table class="min-w-full divide-y divide-slate-200">
					<thead class="bg-slate-50">
						<tr>
							<th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase"
								>Nama</th
							>
							<th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase"
								>Username</th
							>
							<th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase"
								>Huruf</th
							>
							<th class="px-6 py-4 text-center text-xs font-semibold text-slate-500 uppercase"
								>Status</th
							>
							<th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase"
								>Login Terakhir</th
							>
							<th class="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase"
								>Aksi</th
							>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-200">
						{#each cashiers as cashier}
							<tr class="hover:bg-slate-50 {cashier.is_active ? '' : 'bg-slate-50 opacity-60'}">
								<td class="px-6 py-4 font-medium text-slate-900">{cashier.name}</td>
								<td class="px-6 py-4 text-slate-600">{cashier.username}</td>
								<td class="px-6 py-4 text-center">
									{#if cashier.cashier_letter}
										<span
											class="inline-flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700"
										>
											{cashier.cashier_letter}
										</span>
									{/if}
								</td>
								<td class="px-6 py-4 text-center">
									<span
										class="rounded-full px-2.5 py-1 text-xs font-bold {cashier.is_active
											? 'bg-green-100 text-green-800'
											: 'bg-slate-200 text-slate-600'}"
									>
										{cashier.is_active ? 'Aktif' : 'Nonaktif'}
									</span>
								</td>
								<td class="px-6 py-4 text-sm text-slate-500"
									>{format_date(cashier.last_login_at)}</td
								>
								<td class="px-6 py-4 text-right text-sm font-medium">
									<button
										onclick={() => reset_pin(cashier)}
										class="mr-3 text-amber-600 hover:text-amber-900">Reset PIN</button
									>
									<button
										onclick={() => toggle_status(cashier)}
										class={cashier.is_active
											? 'text-red-600 hover:text-red-900'
											: 'text-green-600 hover:text-green-900'}
									>
										{cashier.is_active ? 'Nonaktifkan' : 'Aktifkan'}
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
					{is_editing ? 'Edit Kasir' : 'Tambah Kasir Baru'}
				</h3>
				<button onclick={() => (show_modal = false)} class="text-slate-400 hover:text-slate-600"
					>✕</button
				>
			</div>
			<form onsubmit={save_cashier} class="space-y-5 p-6">
				<div>
					<label for="cashier-name" class="mb-1 block text-sm font-bold text-slate-700"
						>Nama Lengkap <span class="text-red-500">*</span></label
					>
					<input
						id="cashier-name"
						type="text"
						bind:value={cashier_name}
						required
						class="w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
						placeholder="Nama kasir"
					/>
				</div>
				<div>
					<label for="cashier-username" class="mb-1 block text-sm font-bold text-slate-700"
						>Username <span class="text-red-500">*</span></label
					>
					<input
						id="cashier-username"
						type="text"
						bind:value={cashier_username}
						required
						class="w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
						placeholder="Username unik"
					/>
				</div>
				<div>
					<label for="cashier-pin" class="mb-1 block text-sm font-bold text-slate-700">
						PIN {is_editing ? '(kosongkan jika tidak diubah)' : ''}
						{#if !is_editing}<span class="text-red-500">*</span>{/if}
					</label>
					<input
						id="cashier-pin"
						type="password"
						maxlength="6"
						bind:value={cashier_pin}
						required={!is_editing}
						class="w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
						placeholder="6 digit PIN"
					/>
					<p class="mt-1 text-xs text-slate-500">Hanya angka, 6 digit.</p>
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
