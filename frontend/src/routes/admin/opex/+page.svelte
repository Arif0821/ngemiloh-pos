<script lang="ts">
	import { api } from '$lib/services/api.client';
	import { onMount } from 'svelte';

	let loading = $state(true);
	import type { OperationalExpense } from '$lib/domain/models/types';
	let expenses: OperationalExpense[] = $state([]);
	let error = $state('');

	// Form State
	let name = $state('');
	let amount = $state(0);
	let category = $state('other');
	let date = $state(new Date().toISOString().split('T')[0]);
	let isSubmitting = $state(false);

	const categories = [
		{ id: 'rent', label: 'Sewa Tempat' },
		{ id: 'electricity', label: 'Listrik' },
		{ id: 'gas', label: 'Gas' },
		{ id: 'packaging', label: 'Kemasan' },
		{ id: 'other', label: 'Lainnya' }
	];

	onMount(async () => {
		await fetchExpenses();
	});

	async function fetchExpenses() {
		loading = true;
		try {
			const res = await api.request(`/api/v1/admin/finance/opex`, {
				credentials: 'include'
			});
			if (res.ok) {
				const json = await res.json();
				expenses = json.data || [];
			} else {
				error = 'Gagal memuat data Opex';
			}
		} catch (e) {
			error = 'Koneksi ke server gagal';
		} finally {
			loading = false;
		}
	}

	async function handleSubmit(e: Event) {
		e.preventDefault();
		isSubmitting = true;
		try {
			const res = await api.request(`/api/v1/admin/finance/opex`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					name,
					amount: Number(amount),
					category,
					date: new Date(date).toISOString()
				})
			});
			if (res.ok) {
				// Reset form
				name = '';
				amount = 0;
				category = 'other';
				await fetchExpenses();
			} else {
				alert('Gagal menyimpan biaya operasional');
			}
		} catch (e) {
			alert('Koneksi ke server gagal');
		} finally {
			isSubmitting = false;
		}
	}

	const formatRp = (n: number) =>
		new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(n || 0);
	const formatDate = (d: string) => new Date(d).toLocaleDateString('id-ID');
</script>

<svelte:head>
	<title>Biaya Operasional | Ngemiloh Admin</title>
</svelte:head>

<div class="mx-auto flex max-w-6xl flex-col gap-8 lg:flex-row">
	<div class="w-full lg:w-1/3">
		<div class="sticky top-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
			<h2 class="mb-4 text-lg font-bold text-slate-900">Input Biaya (Opex)</h2>
			<form onsubmit={handleSubmit} class="space-y-4">
				<div>
					<label class="mb-1 block text-sm font-medium text-slate-700" for="name"
						>Keterangan Biaya</label
					>
					<input
						type="text"
						id="name"
						bind:value={name}
						required
						placeholder="Contoh: Beli plastik klip"
						class="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:ring-indigo-500"
					/>
				</div>
				<div>
					<label class="mb-1 block text-sm font-medium text-slate-700" for="amount"
						>Nominal (Rp)</label
					>
					<input
						type="number"
						id="amount"
						bind:value={amount}
						required
						min="0"
						class="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:ring-indigo-500"
					/>
				</div>
				<div>
					<label class="mb-1 block text-sm font-medium text-slate-700" for="category"
						>Kategori</label
					>
					<select
						id="category"
						bind:value={category}
						class="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:ring-indigo-500"
					>
						{#each categories as cat}
							<option value={cat.id}>{cat.label}</option>
						{/each}
					</select>
				</div>
				<div>
					<label class="mb-1 block text-sm font-medium text-slate-700" for="date">Tanggal</label>
					<input
						type="date"
						id="date"
						bind:value={date}
						required
						class="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-indigo-500 focus:ring-indigo-500"
					/>
				</div>
				<button
					type="submit"
					disabled={isSubmitting}
					class="w-full rounded-lg border border-transparent bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:opacity-50"
				>
					{isSubmitting ? 'Menyimpan...' : 'Simpan Biaya'}
				</button>
			</form>
		</div>
	</div>

	<div class="w-full lg:w-2/3">
		<div class="mb-6 flex items-center justify-between">
			<h1 class="text-2xl font-bold text-slate-900">Riwayat Operasional</h1>
		</div>

		{#if loading}
			<div class="flex justify-center p-12">
				<div class="h-8 w-8 animate-spin rounded-full border-b-2 border-indigo-600"></div>
			</div>
		{:else if error}
			<div class="rounded-xl border border-red-100 bg-red-50 p-4 text-red-600">{error}</div>
		{:else}
			<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
				<table class="w-full text-left text-sm">
					<thead
						class="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase"
					>
						<tr>
							<th class="px-6 py-4">Tanggal</th>
							<th class="px-6 py-4">Keterangan</th>
							<th class="px-6 py-4">Kategori</th>
							<th class="px-6 py-4 text-right">Nominal</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-slate-200">
						{#if expenses.length === 0}
							<tr>
								<td colspan="4" class="px-6 py-8 text-center text-slate-500"
									>Belum ada catatan biaya.</td
								>
							</tr>
						{:else}
							{#each expenses as exp}
								<tr class="hover:bg-slate-50">
									<td class="px-6 py-4 whitespace-nowrap text-slate-600"
										>{formatDate(exp.expense_date)}</td
									>
									<td class="px-6 py-4 font-medium text-slate-900">{exp.description ?? '-'}</td>
									<td class="px-6 py-4">
										<span
											class="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-800"
										>
											{categories.find((c) => c.id === exp.category)?.label || exp.category}
										</span>
									</td>
									<td class="px-6 py-4 text-right font-bold text-red-600"
										>-{formatRp(Number(exp.amount))}</td
									>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>
