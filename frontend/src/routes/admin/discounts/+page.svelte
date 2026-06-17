<script lang="ts">
	import { api } from '$lib/services/api.client';
	import { toast } from '$lib/stores/toast.store.svelte';
	import { onMount } from 'svelte';

	import type { Discount } from '$lib/domain/models/types';
	let discounts = $state<Discount[]>([]);
	let isLoading = $state(true);

	let showModal = $state(false);

	let dName = $state('');
	let dType = $state<'percentage' | 'fixed_amount'>('percentage');
	let dValue = $state('');
	let dValidFrom = $state('');
	let dIsActive = $state(true);
	let dApplicableDays = $state<number[]>([1, 2, 3, 4, 5, 6, 7]);

	const daysOfWeek = [
		{ value: 1, label: 'Senin' },
		{ value: 2, label: 'Selasa' },
		{ value: 3, label: 'Rabu' },
		{ value: 4, label: 'Kamis' },
		{ value: 5, label: 'Jumat' },
		{ value: 6, label: 'Sabtu' },
		{ value: 7, label: 'Minggu' }
	];

	function toggleDay(dayValue: number) {
		if (dApplicableDays.includes(dayValue)) {
			dApplicableDays = dApplicableDays.filter((d) => d !== dayValue);
		} else {
			dApplicableDays = [...dApplicableDays, dayValue];
		}
	}

	async function fetchDiscounts() {
		isLoading = true;
		try {
			const res = await api.request(`/admin/discounts`, { credentials: 'include' });
			if (res.ok) {
				const data = await res.json();
				discounts = data.data;
			}
		} catch (e) {
			console.error(e);
		} finally {
			isLoading = false;
		}
	}

	onMount(() => {
		fetchDiscounts();
	});

	async function saveDiscount(e: Event) {
		e.preventDefault();
		try {
			const res = await api.request(`/admin/discounts`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					name: dName,
					type: dType,
					value: Number(dValue),
					scope: 'all_products',
					valid_from: new Date(dValidFrom).toISOString(),
					is_active: dIsActive,
					applicable_days: dApplicableDays
				})
			});

			if (res.ok) {
				showModal = false;
				dName = '';
				dValue = '';
				dValidFrom = '';
				fetchDiscounts();
			} else {
				toast.error('Gagal membuat diskon');
			}
		} catch {
			toast.error('Error pada server');
		}
	}

	async function toggleStatus(discount: Discount) {
		try {
			const res = await api.request(`/admin/discounts/${discount.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ is_active: !discount.is_active })
			});
			if (res.ok) {
				fetchDiscounts();
			}
		} catch {
			toast.error('Gagal mengubah status');
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
	<title>Diskon Promo - Ngemiloh Admin</title>
</svelte:head>

<div class="h-full overflow-y-auto p-8">
	<div class="mx-auto max-w-6xl space-y-8">
		<header class="flex items-end justify-between">
			<div>
				<h1 class="text-3xl font-bold tracking-tight text-slate-900">Manajemen Diskon</h1>
				<p class="mt-2 text-slate-500">
					Buat dan kelola potongan harga (persentase atau nominal tunai).
				</p>
			</div>
			<button
				onclick={() => (showModal = true)}
				class="flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 font-medium text-white shadow-sm transition-colors hover:bg-indigo-700"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
					><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"
					></path></svg
				>
				Buat Diskon
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
									>Nama Promo</th
								>
								<th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase"
									>Potongan</th
								>
								<th class="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase"
									>Masa Berlaku</th
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
							{#if discounts.length === 0}
								<tr>
									<td colspan="5" class="px-6 py-8 text-center text-slate-500"
										>Belum ada promo diskon yang dibuat.</td
									>
								</tr>
							{:else}
								{#each discounts as d}
									<tr
										class="transition-colors hover:bg-slate-50 {d.is_active
											? ''
											: 'bg-slate-50 opacity-60'}"
									>
										<td class="px-6 py-4 whitespace-nowrap">
											<div class="flex items-center gap-2 text-base font-bold text-slate-900">
												<svg
													class="h-4 w-4 text-red-500"
													fill="none"
													stroke="currentColor"
													viewBox="0 0 24 24"
													><path
														stroke-linecap="round"
														stroke-linejoin="round"
														stroke-width="2"
														d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
													></path></svg
												>
												{d.name}
											</div>
										</td>
										<td class="px-6 py-4 whitespace-nowrap">
											<div class="text-lg font-black text-red-600">
												{d.type === 'percentage' ? `${d.value}%` : formatRp(Number(d.value))}
											</div>
										</td>
										<td class="px-6 py-4 text-sm whitespace-nowrap text-slate-600">
											Mulai: {d.valid_from
												? new Date(d.valid_from).toLocaleDateString('id-ID')
												: '-'}
										</td>
										<td class="px-6 py-4 whitespace-nowrap">
											{#if d.is_active}
												<span
													class="rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800"
													>Sedang Aktif</span
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
												onclick={() => toggleStatus(d)}
												class="font-semibold text-indigo-600 hover:text-indigo-900"
												>{d.is_active ? 'Nonaktifkan' : 'Aktifkan'}</button
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

<!-- Modal Form Diskon -->
{#if showModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/75 p-4">
		<div class="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
			<div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-6">
				<h3 class="text-xl font-bold text-slate-800">Buat Promo Diskon</h3>
				<button onclick={() => (showModal = false)} class="text-slate-400 hover:text-slate-600"
					>X</button
				>
			</div>

			<form onsubmit={saveDiscount} class="space-y-5 p-6">
				<div>
					<label for="discount-name" class="mb-1 block text-sm font-bold text-slate-700"
						>Nama Promo <span class="text-red-500">*</span></label
					>
					<input
						id="discount-name"
						type="text"
						bind:value={dName}
						required
						class="w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
						placeholder="Cth: Diskon Hari Jumat"
					/>
				</div>

				<div class="grid grid-cols-2 gap-4">
					<div>
						<label for="discount-type" class="mb-1 block text-sm font-bold text-slate-700"
							>Tipe Diskon <span class="text-red-500">*</span></label
						>
						<select
							id="discount-type"
							bind:value={dType}
							class="w-full rounded-lg border-slate-300 font-medium focus:border-indigo-500 focus:ring-indigo-500"
						>
							<option value="percentage">Persentase (%)</option>
							<option value="fixed_amount">Nominal Tunai (Rp)</option>
						</select>
					</div>
					<div>
						<label for="discount-value" class="mb-1 block text-sm font-bold text-slate-700"
							>Nilai Potongan <span class="text-red-500">*</span></label
						>
						<input
							id="discount-value"
							type="number"
							bind:value={dValue}
							required
							min="1"
							class="w-full rounded-lg border-slate-300 font-bold focus:border-indigo-500 focus:ring-indigo-500"
							placeholder="0"
						/>
					</div>
				</div>

				<div>
					<label for="discount-valid-from" class="mb-1 block text-sm font-bold text-slate-700"
						>Tanggal Mulai Berlaku <span class="text-red-500">*</span></label
					>
					<input
						id="discount-valid-from"
						type="date"
						bind:value={dValidFrom}
						required
						class="w-full rounded-lg border-slate-300 focus:border-indigo-500 focus:ring-indigo-500"
					/>
				</div>

				<div>
					<label for="discount-applicable-days" class="mb-2 block text-sm font-bold text-slate-700"
						>Hari Berlaku <span class="text-red-500">*</span></label
					>
					<div class="flex flex-wrap gap-2">
						{#each daysOfWeek as day}
							<button
								type="button"
								onclick={() => toggleDay(day.value)}
								class="rounded-full border px-3 py-1.5 text-sm font-bold transition-colors
                {dApplicableDays.includes(day.value)
									? 'border-indigo-600 bg-indigo-600 text-white'
									: 'border-slate-300 bg-white text-slate-500 hover:border-indigo-400'}"
							>
								{day.label}
							</button>
						{/each}
					</div>
					{#if dApplicableDays.length === 0}
						<p class="mt-1 text-xs text-red-500">Pilih minimal 1 hari</p>
					{/if}
				</div>

				<div class="flex gap-3 border-t border-slate-100 pt-4">
					<button
						type="button"
						onclick={() => (showModal = false)}
						class="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 font-bold text-slate-700 hover:bg-slate-50"
						>Batal</button
					>
					<button
						type="submit"
						class="flex-1 rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white shadow-md hover:bg-indigo-700"
						>Simpan Promo</button
					>
				</div>
			</form>
		</div>
	</div>
{/if}
