<script lang="ts">
	import { api } from '$lib/services/api.client';
	import { onMount } from 'svelte';

	import type { AuditLog } from '$lib/domain/models/types';
	let logs: AuditLog[] = $state([]);
	let total: number = $state(0);
	let isLoading = $state(false);

	// Filters
	let filterAction = $state('');
	let filterDateFrom = $state('');
	let filterDateTo = $state('');
	let currentPage = $state(1);

	const ACTIONS = [
		'USER_LOGIN',
		'PRODUCT_PRICE_UPDATE',
		'DISCOUNT_CREATE',
		'DISCOUNT_UPDATE',
		'QRIS_PAYMENT_SUCCESS',
		'ORDER_VOID',
		'CASH_REGISTER_CLOSE',
		'PROFIT_SHARE_PAID'
	];

	async function fetchLogs() {
		isLoading = true;
		try {
			const params = new URLSearchParams({ page: currentPage.toString() });
			if (filterAction) params.append('action', filterAction);
			if (filterDateFrom) params.append('date_from', filterDateFrom);
			if (filterDateTo) params.append('date_to', filterDateTo);

			const res = await api.request(`/admin/audit-logs?${params.toString()}`, {
				credentials: 'include'
			});
			if (res.ok) {
				const json = await res.json();
				logs = json.logs;
				total = json.total;
			}
		} catch (e) {
			console.error(e);
		} finally {
			isLoading = false;
		}
	}

	function applyFilters() {
		currentPage = 1;
		fetchLogs();
	}

	function formatDate(iso: string) {
		if (!iso) return '-';
		return new Date(iso).toLocaleString('id-ID', {
			year: 'numeric',
			month: 'short',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	function formatJson(data: unknown) {
		if (!data) return '-';
		try {
			return JSON.stringify(data, null, 2);
		} catch {
			return '-';
		}
	}

	onMount(() => {
		fetchLogs();
	});
</script>

<div class="space-y-6 p-6">
	<div class="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
		<div>
			<h1 class="flex items-center gap-2 text-2xl font-black text-slate-800 dark:text-slate-100">
				<svg class="h-6 w-6 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
					></path></svg
				>
				Audit Log System
			</h1>
			<p class="text-slate-500">Rekam jejak aktivitas sensitif secara Immutable.</p>
		</div>
	</div>

	<!-- Filters -->
	<div
		class="dark:bg-surface-800 dark:border-surface-700 flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
	>
		<div>
			<label for="filter-action" class="mb-1 block text-xs font-bold text-slate-500">Aksi / Event Type</label>
			<select
				id="filter-action"
				bind:value={filterAction}
				class="dark:border-surface-600 dark:bg-surface-900 focus:border-brand-500 w-48 rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none"
			>
				<option value="">Semua Aksi</option>
				{#each ACTIONS as action}
					<option value={action}>{action}</option>
				{/each}
			</select>
		</div>
		<div>
			<label for="filter-date-from" class="mb-1 block text-xs font-bold text-slate-500">Mulai Tanggal</label>
			<input
				id="filter-date-from"
				type="date"
				bind:value={filterDateFrom}
				class="dark:border-surface-600 dark:bg-surface-900 focus:border-brand-500 w-40 rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none"
			/>
		</div>
		<div>
			<label for="filter-date-to" class="mb-1 block text-xs font-bold text-slate-500">Sampai Tanggal</label>
			<input
				id="filter-date-to"
				type="date"
				bind:value={filterDateTo}
				class="dark:border-surface-600 dark:bg-surface-900 focus:border-brand-500 w-40 rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none"
			/>
		</div>
		<button
			onclick={applyFilters}
			class="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white shadow transition-colors hover:bg-slate-900"
		>
			Filter Data
		</button>
	</div>

	<!-- Table -->
	<div
		class="dark:bg-surface-800 dark:border-surface-700 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
	>
		<div class="overflow-x-auto">
			<table class="w-full text-left text-sm text-slate-600 dark:text-slate-300">
				<thead
					class="dark:bg-surface-700/50 dark:border-surface-600 border-b border-slate-200 bg-slate-50 font-bold text-slate-700 dark:text-slate-200"
				>
					<tr>
						<th class="px-4 py-3">Waktu (WIB)</th>
						<th class="px-4 py-3">Aktor (Pengguna)</th>
						<th class="px-4 py-3">Action Type</th>
						<th class="px-4 py-3">Entity Info</th>
						<th class="max-w-xs px-4 py-3">Old Value</th>
						<th class="max-w-xs px-4 py-3">New Value</th>
					</tr>
				</thead>
				<tbody class="dark:divide-surface-700 divide-y divide-slate-100">
					{#if isLoading}
						<tr
							><td colspan="6" class="animate-pulse py-10 text-center text-slate-500"
								>Memuat log audit...</td
							></tr
						>
					{:else if logs.length === 0}
						<tr
							><td colspan="6" class="py-10 text-center text-slate-500"
								>Tidak ada log yang sesuai kriteria.</td
							></tr
						>
					{:else}
						{#each logs as log}
							<tr class="dark:hover:bg-surface-700/30 font-mono text-xs hover:bg-slate-50">
								<td class="px-4 py-3 whitespace-nowrap">{formatDate(log.created_at)}</td>
								<td class="px-4 py-3 font-sans">
									{#if log.actor}
										<span class="font-bold text-slate-800 dark:text-slate-200"
											>{log.actor.username}</span
										>
										<span
											class="dark:bg-surface-600 ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 uppercase dark:text-slate-300"
											>{log.actor.role}</span
										>
									{:else}
										<span class="text-slate-400 italic">System</span>
									{/if}
								</td>
								<td class="px-4 py-3">
									<span
										class="font-bold {log.action.includes('VOID') || log.action.includes('FAILED')
											? 'text-red-600 dark:text-red-400'
											: 'text-blue-600 dark:text-blue-400'}"
									>
										{log.action}
									</span>
								</td>
								<td class="px-4 py-3 text-slate-500">
									{log.entity_type} <br />
									<span class="block w-32 truncate text-[10px] text-slate-400" title={log.entity_id}
										>{log.entity_id || '-'}</span
									>
								</td>
								<td class="max-w-xs px-4 py-3">
									{#if log.old_value}
										<pre
											class="dark:bg-surface-900 dark:border-surface-600 max-h-32 overflow-x-auto rounded border border-slate-100 bg-slate-50 p-2 text-[10px]">{formatJson(
												log.old_value
											)}</pre>
									{:else}
										-
									{/if}
								</td>
								<td class="max-w-xs px-4 py-3">
									{#if log.new_value}
										<pre
											class="dark:bg-surface-900 dark:border-surface-600 max-h-32 overflow-x-auto rounded border border-slate-100 bg-slate-50 p-2 text-[10px]">{formatJson(
												log.new_value
											)}</pre>
									{:else}
										-
									{/if}
								</td>
							</tr>
						{/each}
					{/if}
				</tbody>
			</table>
		</div>

		<div
			class="dark:border-surface-700 flex items-center justify-between border-t border-slate-200 p-4 text-sm"
		>
			<span class="text-slate-500"
				>Total: <strong class="text-slate-800 dark:text-slate-200">{total}</strong> records</span
			>
			<div class="flex gap-2">
				<button
					disabled={currentPage === 1}
					onclick={() => {
						currentPage--;
						fetchLogs();
					}}
					class="dark:border-surface-600 dark:hover:bg-surface-700 rounded border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
					>Prev</button
				>
				<span class="px-3 py-1.5 font-bold">Page {currentPage}</span>
				<button
					disabled={logs.length < 50}
					onclick={() => {
						currentPage++;
						fetchLogs();
					}}
					class="dark:border-surface-600 dark:hover:bg-surface-700 rounded border border-slate-200 px-3 py-1.5 hover:bg-slate-50 disabled:opacity-50"
					>Next</button
				>
			</div>
		</div>
	</div>
</div>
