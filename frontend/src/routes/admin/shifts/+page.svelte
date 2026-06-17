<script lang="ts">
	import { api } from '$lib/services/api.client';
	import { format_rp } from '$lib/utils/format';
	import { toast } from '$lib/stores/toast.store.svelte';
	import { onMount } from 'svelte';

	interface Shift {
		id: string;
		cashier_id: string;
		shift_date: string;
		shift_start: string;
		shift_end: string | null;
		opening_balance: number;
		closing_balance: number | null;
		system_cash_total: number | null;
		discrepancy: number | null;
		status: 'open' | 'closed';
		shift_number: number;
		is_auto_closed: boolean;
		planned_close_at: string | null;
		notes: string | null;
		cashier?: { name: string };
	}

	let shifts = $state<Shift[]>([]);
	let is_loading = $state(true);
	let filter_date = $state('');
	let filter_status = $state('');

	async function fetch_shifts() {
		is_loading = true;
		try {
			const params = new URLSearchParams();
			if (filter_date) params.set('date', filter_date);
			if (filter_status) params.set('status', filter_status);

			const res = await api.get(`/admin/finance/cash/shifts?${params.toString()}`);
			if (res.ok) {
				const data = await res.json();
				shifts = data.data || [];
			}
		} catch (e) {
			console.error(e);
			toast.error('Gagal memuat data shift');
		} finally {
			is_loading = false;
		}
	}

	onMount(() => {
		fetch_shifts();
	});

	function format_date(d: string) {
		return new Date(d).toLocaleString('id-ID', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function format_rp_val(v: number | null | undefined) {
		return format_rp(v || 0);
	}

	function get_discrepancy_class(d: number | null | undefined) {
		if (d === null || d === undefined) return '';
		if (d > 0) return 'text-green-600';
		if (d < 0) return 'text-red-600';
		return 'text-slate-600';
	}
</script>

<svelte:head>
	<title>Riwayat Shift - Ngemiloh Admin</title>
</svelte:head>

<div class="h-full overflow-y-auto p-8">
	<div class="mx-auto max-w-6xl space-y-8">
		<header class="flex items-end justify-between">
			<div>
				<h1 class="text-3xl font-bold tracking-tight text-slate-900">Riwayat Shift</h1>
				<p class="mt-2 text-slate-500">Riwayat buka/tutup shift kasir.</p>
			</div>
			<button
				onclick={() => fetch_shifts()}
				class="flex items-center gap-2 rounded-lg bg-slate-600 px-4 py-2 font-medium text-white hover:bg-slate-700"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
					/>
				</svg>
				Refresh
			</button>
		</header>

		<!-- Filters -->
		<div class="flex gap-4 rounded-xl bg-white p-4 shadow-sm">
			<div>
				<label for="shift-filter-date" class="mb-1 block text-xs font-semibold text-slate-500">Filter Tanggal</label>
				<input
					id="shift-filter-date"
					type="date"
					bind:value={filter_date}
					onchange={fetch_shifts}
					class="rounded-lg border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
				/>
			</div>
			<div>
				<label for="shift-filter-status" class="mb-1 block text-xs font-semibold text-slate-500">Status</label>
				<select
					id="shift-filter-status"
					bind:value={filter_status}
					onchange={fetch_shifts}
					class="rounded-lg border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
				>
					<option value="">Semua</option>
					<option value="open">Buka</option>
					<option value="closed">Tutup</option>
				</select>
			</div>
		</div>

		<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			{#if is_loading}
				<div class="flex justify-center p-12">
					<div
						class="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-indigo-500"
					></div>
				</div>
			{:else if shifts.length === 0}
				<div class="p-12 text-center">
					<p class="text-slate-500">Tidak ada data shift.</p>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-slate-200">
						<thead class="bg-slate-50">
							<tr>
								<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase"
									>Tanggal</th
								>
								<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase"
									>Kasir</th
								>
								<th class="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase"
									>Shift #</th
								>
								<th class="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase"
									>Kas Awal</th
								>
								<th class="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase"
									>Kas Sistem</th
								>
								<th class="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase"
									>Kas Akhir</th
								>
								<th class="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase"
									>Selisih</th
								>
								<th class="px-4 py-3 text-center text-xs font-semibold text-slate-500 uppercase"
									>Status</th
								>
								<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase"
									>Waktu</th
								>
								<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase"
									>Plan Tutup</th
								>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-200">
							{#each shifts as shift}
								<tr class="hover:bg-slate-50">
									<td class="px-4 py-3 text-sm whitespace-nowrap text-slate-900">
										{new Date(shift.shift_date).toLocaleDateString('id-ID')}
									</td>
									<td class="px-4 py-3 text-sm font-medium whitespace-nowrap text-slate-900">
										{shift.cashier?.name || '-'}
									</td>
									<td class="px-4 py-3 text-center text-sm whitespace-nowrap text-slate-600">
										{shift.shift_number}
									</td>
									<td class="px-4 py-3 text-right text-sm whitespace-nowrap text-slate-600">
										{format_rp_val(shift.opening_balance)}
									</td>
									<td class="px-4 py-3 text-right text-sm whitespace-nowrap text-slate-600">
										{format_rp_val(shift.system_cash_total)}
									</td>
									<td class="px-4 py-3 text-right text-sm whitespace-nowrap text-slate-600">
										{format_rp_val(shift.closing_balance)}
									</td>
									<td
										class="px-4 py-3 text-right text-sm font-semibold whitespace-nowrap {get_discrepancy_class(
											shift.discrepancy
										)}"
									>
										{format_rp_val(shift.discrepancy)}
									</td>
									<td class="px-4 py-3 text-center whitespace-nowrap">
										<span
											class="rounded-full px-2.5 py-1 text-xs font-bold {shift.status === 'open'
												? 'bg-green-100 text-green-800'
												: 'bg-slate-200 text-slate-600'}"
										>
											{shift.status === 'open' ? 'Buka' : 'Tutup'}
										</span>
										{#if shift.is_auto_closed}
											<span class="ml-1 text-xs text-slate-400">(auto)</span>
										{/if}
									</td>
									<td class="px-4 py-3 text-xs whitespace-nowrap text-slate-500">
										<div>{format_date(shift.shift_start)}</div>
										{#if shift.shift_end}
											<div class="text-slate-400">{format_date(shift.shift_end)}</div>
										{/if}
									</td>
									<td
										class="px-4 py-3 text-xs whitespace-nowrap {shift.planned_close_at
											? 'text-slate-500'
											: 'text-slate-300'}"
									>
										{#if shift.planned_close_at}
											{format_date(shift.planned_close_at)}
										{:else}
											-
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	</div>
</div>
