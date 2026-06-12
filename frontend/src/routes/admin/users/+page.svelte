<script lang="ts">
	import { api } from '$lib/services/api.client';
	import { onMount } from 'svelte';

	import type { User } from '$lib/domain/models/types';
	let cashiers = $state<User[]>([]);
	let isLoading = $state(true);

	let showAddModal = $state(false);
	let newName = $state('');
	let newUsername = $state('');
	let newPin = $state('');

	let showResetModal = $state(false);
	let selectedCashier = $state<User | null>(null);
	let resetPin = $state('');

	async function fetchCashiers() {
		isLoading = true;
		try {
			const hostname = window.location.hostname;
			const res = await api.request(`/api/v1/admin/users/cashiers`, { credentials: 'include' });
			if (res.ok) {
				const data = await res.json();
				cashiers = data.data;
			}
		} catch (e) {
			console.error(e);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		fetchCashiers();
	});

	async function handleAddCashier(e: Event) {
		e.preventDefault();
		if (newPin.length !== 4) return alert('PIN harus 4 digit angka');

		try {
			const hostname = window.location.hostname;
			const res = await api.request(`/api/v1/admin/users/cashiers`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					name: newName,
					username: newUsername,
					pin: newPin
				})
			});
			if (res.ok) {
				showAddModal = false;
				newName = '';
				newUsername = '';
				newPin = '';
				fetchCashiers();
			} else {
				const err = await res.json();
				alert(err.message || 'Gagal membuat kasir');
			}
		} catch (e) {
			alert('Terjadi kesalahan server');
		}
	}

	async function handleResetPin(e: Event) {
		e.preventDefault();
		if (resetPin.length !== 4) return alert('PIN harus 4 digit angka');
		if (!selectedCashier) return;

		try {
			const hostname = window.location.hostname;
			const res = await api.request(
				`/api/v1/admin/users/cashiers/${selectedCashier.id}/reset-pin`,
				{
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					credentials: 'include',
					body: JSON.stringify({ pin: resetPin })
				}
			);
			if (res.ok) {
				showResetModal = false;
				resetPin = '';
				alert('PIN berhasil direset');
				fetchCashiers();
			}
		} catch (e) {
			alert('Gagal reset PIN');
		}
	}

	async function toggleStatus(cashier: User) {
		const confirmMsg = cashier.is_active ? 'Nonaktifkan kasir ini?' : 'Aktifkan kasir ini?';
		if (!confirm(confirmMsg)) return;

		try {
			const hostname = window.location.hostname;
			const res = await api.request(`/api/v1/admin/users/cashiers/${cashier.id}/toggle-status`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ is_active: !cashier.is_active })
			});
			if (res.ok) {
				fetchCashiers();
			}
		} catch (e) {
			alert('Gagal mengubah status');
		}
	}
</script>

<svelte:head>
	<title>Manajemen Kasir - Ngemiloh Admin</title>
</svelte:head>

<div class="h-full overflow-y-auto p-8">
	<div class="mx-auto max-w-6xl space-y-8">
		<header class="flex items-end justify-between">
			<div>
				<h1 class="text-3xl font-bold tracking-tight text-slate-900">Manajemen Karyawan (Kasir)</h1>
				<p class="mt-2 text-slate-500">Kelola akun kasir untuk login ke mesin POS.</p>
			</div>
			<button
				onclick={() => (showAddModal = true)}
				class="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
					><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"
					></path></svg
				>
				Tambah Kasir
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
									>Nama / Username</th
								>
								<th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase"
									>Status</th
								>
								<th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase"
									>Login Terakhir</th
								>
								<th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase"
									>Gagal Login</th
								>
								<th class="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase"
									>Aksi</th
								>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-200 bg-white">
							{#if cashiers.length === 0}
								<tr>
									<td colspan="5" class="px-6 py-8 text-center text-slate-500"
										>Belum ada data kasir. Silakan tambahkan.</td
									>
								</tr>
							{:else}
								{#each cashiers as cashier}
									<tr
										class="transition-colors hover:bg-slate-50 {cashier.is_active
											? ''
											: 'bg-slate-50 opacity-75'}"
									>
										<td class="px-6 py-4 whitespace-nowrap">
											<div class="font-bold text-slate-900">{cashier.name}</div>
											<div class="text-sm text-slate-500">@{cashier.username}</div>
										</td>
										<td class="px-6 py-4 whitespace-nowrap">
											{#if cashier.is_active}
												<span
													class="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800"
													>Aktif</span
												>
											{:else}
												<span
													class="rounded-full bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-800"
													>Nonaktif</span
												>
											{/if}

											{#if cashier.locked_until && new Date(cashier.locked_until) > new Date()}
												<span
													class="ml-2 rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-800"
													>Terkunci (Rate Limit)</span
												>
											{/if}
										</td>
										<td class="px-6 py-4 text-sm whitespace-nowrap text-slate-600">
											{cashier.last_login_at
												? new Date(cashier.last_login_at).toLocaleString('id-ID')
												: 'Belum pernah login'}
										</td>
										<td class="px-6 py-4 text-sm whitespace-nowrap text-slate-600">
											{cashier.failed_login_count}x
										</td>
										<td class="px-6 py-4 text-right text-sm font-medium whitespace-nowrap">
											<button
												onclick={() => toggleStatus(cashier)}
												class="mx-2 text-slate-600 hover:text-slate-900"
												>{cashier.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button
											>
											<button
												onclick={() => {
													selectedCashier = cashier;
													showResetModal = true;
												}}
												class="mx-2 font-bold text-indigo-600 hover:text-indigo-900"
												>Reset PIN</button
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

<!-- Modal Tambah Kasir -->
{#if showAddModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4">
		<div class="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl">
			<div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-6">
				<h3 class="text-lg font-bold text-slate-800">Tambah Kasir Baru</h3>
				<button onclick={() => (showAddModal = false)} class="text-slate-400 hover:text-slate-600"
					>X</button
				>
			</div>
			<form onsubmit={handleAddCashier} class="space-y-4 p-6">
				<div>
					<label class="mb-1 block text-sm font-medium text-slate-700">Nama Lengkap</label>
					<input
						type="text"
						bind:value={newName}
						required
						class="w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
					/>
				</div>
				<div>
					<label class="mb-1 block text-sm font-medium text-slate-700">Username (untuk login)</label
					>
					<input
						type="text"
						bind:value={newUsername}
						required
						class="w-full rounded-lg border-slate-300 lowercase focus:border-indigo-500 focus:ring-indigo-500"
					/>
				</div>
				<div>
					<label class="mb-1 block text-sm font-medium text-slate-700"
						>PIN Akses (4 Digit Angka)</label
					>
					<input
						type="text"
						pattern="[0-9]{4}"
						maxlength="4"
						bind:value={newPin}
						required
						class="w-full rounded-lg border-slate-300 text-center text-2xl font-bold tracking-[1em] focus:border-indigo-500 focus:ring-indigo-500"
					/>
					<p class="mt-1 text-xs text-slate-500">Kasir akan login dengan 4 digit PIN ini.</p>
				</div>
				<div class="flex gap-3 pt-4">
					<button
						type="button"
						onclick={() => (showAddModal = false)}
						class="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
						>Batal</button
					>
					<button
						type="submit"
						class="flex-1 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700"
						>Simpan</button
					>
				</div>
			</form>
		</div>
	</div>
{/if}

<!-- Modal Reset PIN -->
{#if showResetModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4">
		<div class="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-xl">
			<div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-6">
				<h3 class="text-lg font-bold text-slate-800">Reset PIN: {selectedCashier?.name}</h3>
				<button onclick={() => (showResetModal = false)} class="text-slate-400 hover:text-slate-600"
					>X</button
				>
			</div>
			<form onsubmit={handleResetPin} class="space-y-4 p-6">
				<div>
					<label class="mb-1 block text-sm font-medium text-slate-700"
						>PIN Baru (4 Digit Angka)</label
					>
					<input
						type="text"
						pattern="[0-9]{4}"
						maxlength="4"
						bind:value={resetPin}
						required
						class="w-full rounded-lg border-slate-300 text-center text-2xl font-bold tracking-[1em] focus:border-indigo-500 focus:ring-indigo-500"
					/>
				</div>
				<div class="flex gap-3 pt-4">
					<button
						type="button"
						onclick={() => (showResetModal = false)}
						class="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
						>Batal</button
					>
					<button
						type="submit"
						class="flex-1 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white shadow-sm hover:bg-indigo-700"
						>Reset</button
					>
				</div>
			</form>
		</div>
	</div>
{/if}
