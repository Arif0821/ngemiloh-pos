<script lang="ts">
	import { api } from '$lib/services/api.client';
	import { toast } from '$lib/stores/toast.store.svelte';
	import { onMount } from 'svelte';

	let settings: Record<string, string> = $state({});
	import type { FeatureFlag } from '$lib/domain/models/types';
	let featureFlags: FeatureFlag[] = $state([]);
	let isLoading = $state(true);

	let isSavingSettings = $state(false);

	// Settings Forms
	let storeName = $state('');
	let halalNumber = $state('');
	let storeAddress = $state('');
	let receiptFooter = $state('');

	async function fetchData() {
		isLoading = true;
		try {
			// Fetch settings
			const resSettings = await api.request(`/admin/settings`, { credentials: 'include' });
			if (resSettings.ok) {
				const json = await resSettings.json();
				// convert array [{key, value}] to object {key: value}
				const st: Record<string, string> = {};
				json.data.forEach((s: { key: string; value: string }) => {
					st[s.key] = s.value;
				});
				settings = st;

				storeName = st['STORE_NAME'] || 'Ngemiloh F&B';
				halalNumber = st['HALAL_NUMBER'] || '';
				storeAddress = st['STORE_ADDRESS'] || '';
				receiptFooter = st['RECEIPT_FOOTER'] || 'Terima kasih atas kunjungannya!';
			}

			// Fetch flags
			const resFlags = await api.request(`/admin/feature-flags`, { credentials: 'include' });
			if (resFlags.ok) {
				const json = await resFlags.json();
				featureFlags = json.data;
			}
		} catch (e) {
			console.error(e);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		fetchData();
	});

	async function saveSettings(e: Event) {
		e.preventDefault();
		if (isSavingSettings) return;
		isSavingSettings = true;
		try {
			const payload = {
				STORE_NAME: storeName,
				HALAL_NUMBER: halalNumber,
				STORE_ADDRESS: storeAddress,
				RECEIPT_FOOTER: receiptFooter
			};

			const res = await api.request(`/admin/settings`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(payload)
			});

			if (res.ok) {
				toast.success('Pengaturan berhasil disimpan!');
			} else {
				toast.error('Gagal menyimpan pengaturan');
			}
		} catch {
			toast.error('Error pada server');
		} finally {
			isSavingSettings = false;
		}
	}

	async function toggleFlag(id: string, currentStatus: boolean) {
		try {
			const res = await api.request(`/admin/feature-flags/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ is_enabled: !currentStatus })
			});

			if (res.ok) {
				fetchData();
			}
		} catch {
			console.error(e);
		}
	}
</script>

<svelte:head>
	<title>Settings - Ngemiloh Admin</title>
</svelte:head>

<div class="h-full overflow-y-auto p-8">
	<div class="mx-auto max-w-4xl space-y-8">
		<header>
			<h1 class="text-3xl font-bold tracking-tight text-slate-900">
				Pengaturan & Konfigurasi Sistem
			</h1>
			<p class="mt-2 text-slate-500">
				Kelola informasi bisnis Ngemiloh dan kontrol fitur secara dinamis.
			</p>
		</header>

		{#if isLoading}
			<div class="flex justify-center rounded-2xl border border-slate-200 bg-white p-12 shadow-sm">
				<div
					class="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-indigo-500"
				></div>
			</div>
		{:else}
			<!-- Section 1: Business Settings -->
			<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div class="border-b border-slate-200 bg-slate-50 p-6">
					<h2 class="text-xl font-bold text-slate-800">Profil Bisnis & Struk</h2>
				</div>
				<form onsubmit={saveSettings} class="space-y-6 p-6">
					<div class="grid grid-cols-1 gap-6 md:grid-cols-2">
						<div>
							<label for="store-name" class="mb-1 block text-sm font-bold text-slate-700">Nama Toko</label>
							<input
								id="store-name"
								type="text"
								bind:value={storeName}
								required
								class="w-full rounded-lg border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
							/>
						</div>
						<div>
							<label for="halal-number" class="mb-1 block text-sm font-bold text-slate-700">Sertifikat Halal MUI</label
							>
							<input
								id="halal-number"
								type="text"
								bind:value={halalNumber}
								class="w-full rounded-lg border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
								placeholder="ID123456789"
							/>
						</div>
						<div class="md:col-span-2">
							<label for="store-address" class="mb-1 block text-sm font-bold text-slate-700">Alamat Outlet</label>
							<textarea
								id="store-address"
								bind:value={storeAddress}
								rows="2"
								class="w-full rounded-lg border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
							></textarea>
						</div>
						<div class="md:col-span-2">
							<label for="receipt-footer" class="mb-1 block text-sm font-bold text-slate-700"
								>Pesan Penutup (Footer) Struk</label
							>
							<input
								id="receipt-footer"
								type="text"
								bind:value={receiptFooter}
								class="w-full rounded-lg border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
							/>
						</div>
					</div>
					<div class="flex justify-end border-t border-slate-100 pt-4">
						<button
							type="submit"
							disabled={isSavingSettings}
							class="rounded-lg bg-indigo-600 px-6 py-2.5 font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:bg-indigo-400"
						>
							{isSavingSettings ? 'Menyimpan...' : 'Simpan Pengaturan'}
						</button>
					</div>
				</form>
			</div>

			<!-- Section 2: Feature Flags -->
			<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<div class="border-b border-slate-200 bg-slate-50 p-6">
					<h2 class="text-xl font-bold text-slate-800">Feature Flags (Toggle Fitur)</h2>
					<p class="mt-1 text-sm text-slate-500">
						Nyalakan/matikan fitur aplikasi secara instan tanpa perlu redeploy ke server.
					</p>
				</div>
				<div class="p-0">
					{#if featureFlags.length === 0}
						<div class="p-8 text-center text-slate-500 italic">
							Belum ada Feature Flag yang terdaftar di database.
						</div>
					{:else}
						<div class="divide-y divide-slate-100">
							{#each featureFlags as flag}
								<div
									class="flex items-center justify-between p-6 transition-colors hover:bg-slate-50"
								>
									<div>
										<h3 class="mb-1 font-mono text-sm font-bold text-slate-800">{flag.name}</h3>
										<p class="text-sm text-slate-500">
											{flag.description || 'Tidak ada deskripsi'}
										</p>
									</div>
									<label class="relative inline-flex cursor-pointer items-center">
										<input
											type="checkbox"
											class="peer sr-only"
											checked={flag.is_enabled}
											onchange={() => toggleFlag(flag.id, flag.is_enabled)}
										/>
										<div
											class="peer h-7 w-14 rounded-full bg-slate-200 peer-checked:bg-green-500 peer-focus:ring-4 peer-focus:ring-indigo-300 peer-focus:outline-none after:absolute after:top-0.5 after:left-0.5 after:h-6 after:w-6 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white"
										></div>
									</label>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>
</div>
