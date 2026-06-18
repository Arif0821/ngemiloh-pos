<script lang="ts">
	import { api } from '$lib/services/api.client';
	import { toast } from '$lib/stores/toast.store.svelte';
	import { onMount } from 'svelte';

	interface AuditLog {
		id: string;
		actor_id: string | null;
		action: string;
		entity_type: string | null;
		entity_id: string | null;
		old_value: Record<string, unknown> | null;
		new_value: Record<string, unknown> | null;
		ip_address: string | null;
		created_at: string;
		actor?: { name: string };
	}

	let logs = $state<AuditLog[]>([]);
	let is_loading = $state(true);
	let current_page = $state(1);
	let total_pages = $state(1);
	let total_count = $state(0);

	// Filters
	let filter_action = $state('');
	let filter_date_from = $state('');
	let filter_date_to = $state('');

	async function fetch_logs(page = 1) {
		is_loading = true;
		try {
			const params = new URLSearchParams({ page: String(page) });
			if (filter_action) params.set('action', filter_action);
			if (filter_date_from) params.set('date_from', filter_date_from);
			if (filter_date_to) params.set('date_to', filter_date_to);

			const res = await api.get(`/admin/audit-logs?${params.toString()}`);
			if (res.ok) {
				const data = await res.json();
				logs = data.data || [];
				total_pages = data.pagination?.total_pages || 1;
				total_count = data.pagination?.total || 0;
				current_page = page;
			}
		} catch (e) {
			console.error(e);
			toast.error('Gagal memuat log');
		} finally {
			is_loading = false;
		}
	}

	onMount(() => {
		fetch_logs();
	});

	function format_date(d: string) {
		return new Date(d).toLocaleString('id-ID', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
	}

	function get_action_color(action: string) {
		if (action.includes('CREATE') || action.includes('ADD')) return 'bg-green-100 text-green-800';
		if (action.includes('UPDATE') || action.includes('PATCH')) return 'bg-blue-100 text-blue-800';
		if (action.includes('DELETE') || action.includes('REMOVE')) return 'bg-red-100 text-red-800';
		if (action.includes('LOGIN') || action.includes('AUTH')) return 'bg-purple-100 text-purple-800';
		if (action.includes('VOID') || action.includes('FRAUD')) return 'bg-red-100 text-red-800';
		return 'bg-slate-100 text-slate-800';
	}

	function format_value(val: unknown): string {
		if (!val) return '-';
		if (typeof val === 'object') return JSON.stringify(val);
		return String(val);
	}

	const COMMON_ACTIONS = [
		'CASHIER_LOGIN',
		'ADMIN_LOGIN',
		'LOGOUT',
		'ORDER_CREATE',
		'ORDER_VOID',
		'FLAG_TRANSACTION',
		'SHIFT_OPEN',
		'SHIFT_CLOSE',
		'PRODUCT_CREATE',
		'PRODUCT_UPDATE',
		'DISCOUNT_CREATE',
		'DISCOUNT_UPDATE'
	];
</script>

<svelte:head>
	<title>Audit Log - Ngemiloh Admin</title>
</svelte:head>

<div class="h-full overflow-y-auto p-8">
	<div class="mx-auto max-w-7xl space-y-6">
		<header>
			<h1 class="text-3xl font-bold tracking-tight text-slate-900">Audit Log</h1>
			<p class="mt-2 text-slate-500">Riwayat aktivitas dan perubahan di sistem.</p>
		</header>

		<!-- Filters -->
		<div class="flex flex-wrap gap-4 rounded-xl bg-white p-4 shadow-sm">
			<div>
				<label for="log-filter-action" class="mb-1 block text-xs font-semibold text-slate-500"
					>Tipe Aksi</label
				>
				<select
					id="log-filter-action"
					bind:value={filter_action}
					onchange={() => fetch_logs(1)}
					class="rounded-lg border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
				>
					<option value="">Semua Aksi</option>
					{#each COMMON_ACTIONS as action}
						<option value={action}>{action}</option>
					{/each}
				</select>
			</div>
			<div>
				<label for="log-filter-date-from" class="mb-1 block text-xs font-semibold text-slate-500"
					>Dari Tanggal</label
				>
				<input
					id="log-filter-date-from"
					type="date"
					bind:value={filter_date_from}
					onchange={() => fetch_logs(1)}
					class="rounded-lg border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
				/>
			</div>
			<div>
				<label for="log-filter-date-to" class="mb-1 block text-xs font-semibold text-slate-500"
					>Sampai Tanggal</label
				>
				<input
					id="log-filter-date-to"
					type="date"
					bind:value={filter_date_to}
					onchange={() => fetch_logs(1)}
					class="rounded-lg border-slate-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
				/>
			</div>
			<div class="flex items-end">
				<button
					onclick={() => fetch_logs(1)}
					class="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
				>
					Filter
				</button>
			</div>
		</div>

		<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
			{#if is_loading}
				<div class="flex justify-center p-12">
					<div
						class="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-indigo-500"
					></div>
				</div>
			{:else if logs.length === 0}
				<div class="p-12 text-center">
					<p class="text-slate-500">Tidak ada log yang cocok dengan filter.</p>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-slate-200">
						<thead class="bg-slate-50">
							<tr>
								<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase"
									>Waktu</th
								>
								<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase"
									>Aksi</th
								>
								<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase"
									>Actor</th
								>
								<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase"
									>Entity</th
								>
								<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase"
									>Detail</th
								>
								<th class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase"
									>IP</th
								>
							</tr>
						</thead>
						<tbody class="divide-y divide-slate-200">
							{#each logs as log}
								<tr class="hover:bg-slate-50">
									<td class="px-4 py-3 text-xs whitespace-nowrap text-slate-500">
										{format_date(log.created_at)}
									</td>
									<td class="px-4 py-3 whitespace-nowrap">
										<span
											class="rounded-full px-2 py-1 text-xs font-semibold {get_action_color(
												log.action
											)}"
										>
											{log.action}
										</span>
									</td>
									<td class="px-4 py-3 text-sm text-slate-700">
										{log.actor?.name || log.actor_id || '-'}
									</td>
									<td class="px-4 py-3 text-sm text-slate-600">
										{#if log.entity_type}
											<span class="font-medium">{log.entity_type}</span>
											{#if log.entity_id}
												<span class="text-slate-400">#{log.entity_id.slice(0, 8)}</span>
											{/if}
										{:else}
											-
										{/if}
									</td>
									<td class="max-w-xs truncate px-4 py-3 text-xs text-slate-500">
										{#if log.new_value}
											<code class="rounded bg-slate-100 px-1">{format_value(log.new_value)}</code>
										{:else}
											-
										{/if}
									</td>
									<td class="px-4 py-3 text-xs text-slate-400">{log.ip_address || '-'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Pagination -->
				{#if total_pages > 1}
					<div class="flex items-center justify-between border-t border-slate-200 px-6 py-4">
						<p class="text-sm text-slate-500">
							Menampilkan {logs.length} dari {total_count} log
						</p>
						<div class="flex gap-2">
							<button
								disabled={current_page <= 1}
								onclick={() => fetch_logs(current_page - 1)}
								class="rounded-lg border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
							>
								Prev
							</button>
							<span class="px-3 py-1 text-sm text-slate-600">
								Halaman {current_page} / {total_pages}
							</span>
							<button
								disabled={current_page >= total_pages}
								onclick={() => fetch_logs(current_page + 1)}
								class="rounded-lg border border-slate-300 px-3 py-1 text-sm hover:bg-slate-50 disabled:opacity-50"
							>
								Next
							</button>
						</div>
					</div>
				{/if}
			{/if}
		</div>
	</div>
</div>
