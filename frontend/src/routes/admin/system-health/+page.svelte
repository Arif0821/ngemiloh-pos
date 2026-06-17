<script lang="ts">
	import { api } from '$lib/services/api.client';
	import { onMount, onDestroy } from 'svelte';

	interface HealthStatus {
		status: 'ok' | 'degraded' | 'down';
		version: string;
		uptime_seconds: number;
		timestamp: string;
		checks: {
			database: { status: string; latency_ms?: number; error?: string };
			redis: { status: string; latency_ms?: number; error?: string };
			midtrans?: { status: string; qris_available?: boolean };
		};
		stats?: {
			orders_count?: number;
			order_items_count?: number;
			users_count?: number;
			products_count?: number;
		};
	}

	let health = $state<HealthStatus | null>(null);
	let is_loading = $state(true);
	let is_refreshing = $state(false);
	let last_check = $state<Date | null>(null);
	let refresh_interval: ReturnType<typeof setInterval> | null = null;

	async function fetch_health() {
		is_refreshing = true;
		try {
			const res = await api.get('/health');
			if (res.ok) {
				health = await res.json();
				last_check = new Date();
			}
		} catch (e) {
			console.error(e);
		} finally {
			is_loading = false;
			is_refreshing = false;
		}
	}

	onMount(() => {
		fetch_health();
		// Auto-refresh every 30 seconds
		refresh_interval = setInterval(fetch_health, 30000);
	});

	onDestroy(() => {
		if (refresh_interval) clearInterval(refresh_interval);
	});

	function format_uptime(seconds: number) {
		const days = Math.floor(seconds / 86400);
		const hours = Math.floor((seconds % 86400) / 3600);
		const mins = Math.floor((seconds % 3600) / 60);
		if (days > 0) return `${days}d ${hours}h ${mins}m`;
		if (hours > 0) return `${hours}h ${mins}m`;
		return `${mins}m`;
	}

	function get_status_color(status: string) {
		switch (status) {
			case 'ok':
			case 'connected':
				return 'bg-green-100 text-green-800';
			case 'degraded':
				return 'bg-yellow-100 text-yellow-800';
			case 'down':
			case 'disconnected':
				return 'bg-red-100 text-red-800';
			default:
				return 'bg-slate-100 text-slate-800';
		}
	}

	function get_latency_color(ms?: number) {
		if (!ms) return 'text-slate-500';
		if (ms < 50) return 'text-green-600';
		if (ms < 200) return 'text-yellow-600';
		return 'text-red-600';
	}

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
</script>

<svelte:head>
	<title>System Health - Ngemiloh Admin</title>
</svelte:head>

<div class="h-full overflow-y-auto p-8">
	<div class="mx-auto max-w-4xl space-y-8">
		<header class="flex items-end justify-between">
			<div>
				<h1 class="text-3xl font-bold tracking-tight text-slate-900">System Health</h1>
				<p class="mt-2 text-slate-500">Monitor status dan performa sistem.</p>
			</div>
			<div class="flex items-center gap-4">
				{#if last_check}
					<span class="text-sm text-slate-400">
						Terakhir check: {last_check.toLocaleTimeString('id-ID')}
					</span>
				{/if}
				<button
					onclick={fetch_health}
					disabled={is_refreshing}
					class="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
				>
					<svg
						class="h-4 w-4 {is_refreshing ? 'animate-spin' : ''}"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
						/>
					</svg>
					Refresh
				</button>
			</div>
		</header>

		{#if is_loading}
			<div class="flex justify-center py-12">
				<div
					class="h-8 w-8 animate-spin rounded-full border-t-2 border-b-2 border-indigo-500"
				></div>
			</div>
		{:else if health}
			<!-- Status Overview -->
			<div
				class="rounded-2xl border p-6 {health.status === 'ok'
					? 'border-green-200 bg-green-50'
					: health.status === 'degraded'
						? 'border-yellow-200 bg-yellow-50'
						: 'border-red-200 bg-red-50'}"
			>
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-4">
						<div
							class="flex h-16 w-16 items-center justify-center rounded-full {health.status === 'ok'
								? 'bg-green-500'
								: health.status === 'degraded'
									? 'bg-yellow-500'
									: 'bg-red-500'}"
						>
							{#if health.status === 'ok'}
								<svg
									class="h-8 w-8 text-white"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M5 13l4 4L19 7"
									/>
								</svg>
							{:else if health.status === 'degraded'}
								<svg
									class="h-8 w-8 text-white"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
									/>
								</svg>
							{:else}
								<svg
									class="h-8 w-8 text-white"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M6 18L18 6M6 6l12 12"
									/>
								</svg>
							{/if}
						</div>
						<div>
							<h2 class="text-2xl font-bold text-slate-900">
								System {health.status === 'ok'
									? 'Healthy'
									: health.status === 'degraded'
										? 'Degraded'
										: 'Down'}
							</h2>
							<p class="text-slate-600">
								Uptime: {format_uptime(health.uptime_seconds)} | Version: {health.version}
							</p>
						</div>
					</div>
					<div class="text-right text-sm text-slate-500">
						{format_date(health.timestamp)}
					</div>
				</div>
			</div>

			<!-- Service Checks -->
			<div class="grid gap-4 md:grid-cols-2">
				<!-- Database -->
				<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<div class="mb-4 flex items-center justify-between">
						<h3 class="font-bold text-slate-800">PostgreSQL Database</h3>
						<span
							class="rounded-full px-2.5 py-1 text-xs font-bold {get_status_color(
								health.checks.database.status
							)}"
						>
							{health.checks.database.status}
						</span>
					</div>
					{#if health.checks.database.latency_ms !== undefined}
						<p class="text-2xl font-bold {get_latency_color(health.checks.database.latency_ms)}">
							{health.checks.database.latency_ms}ms
						</p>
						<p class="text-sm text-slate-500">Response time</p>
					{/if}
					{#if health.checks.database.error}
						<p class="mt-2 text-sm text-red-600">{health.checks.database.error}</p>
					{/if}
				</div>

				<!-- Redis -->
				<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
					<div class="mb-4 flex items-center justify-between">
						<h3 class="font-bold text-slate-800">Redis Cache</h3>
						<span
							class="rounded-full px-2.5 py-1 text-xs font-bold {get_status_color(
								health.checks.redis.status
							)}"
						>
							{health.checks.redis.status}
						</span>
					</div>
					{#if health.checks.redis.latency_ms !== undefined}
						<p class="text-2xl font-bold {get_latency_color(health.checks.redis.latency_ms)}">
							{health.checks.redis.latency_ms}ms
						</p>
						<p class="text-sm text-slate-500">Response time</p>
					{/if}
					{#if health.checks.redis.error}
						<p class="mt-2 text-sm text-red-600">{health.checks.redis.error}</p>
					{/if}
				</div>

				<!-- Midtrans -->
				{#if health.checks.midtrans}
					<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
						<div class="mb-4 flex items-center justify-between">
							<h3 class="font-bold text-slate-800">Midtrans QRIS</h3>
							<span
								class="rounded-full px-2.5 py-1 text-xs font-bold {get_status_color(
									health.checks.midtrans.status
								)}"
							>
								{health.checks.midtrans.status}
							</span>
						</div>
						<div class="flex items-center gap-2">
							<span
								class="h-3 w-3 rounded-full {health.checks.midtrans.qris_available
									? 'bg-green-500'
									: 'bg-red-500'}"
							></span>
							<span class="text-sm text-slate-600">
								QRIS {health.checks.midtrans.qris_available ? 'Available' : 'Unavailable'}
							</span>
						</div>
					</div>
				{/if}
			</div>

			<!-- Database Stats -->
			{#if health.stats}
				<div class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
					<h3 class="mb-4 font-bold text-slate-800">Database Statistics</h3>
					<div class="grid grid-cols-2 gap-4 md:grid-cols-4">
						<div class="rounded-lg bg-slate-50 p-4 text-center">
							<p class="text-2xl font-bold text-indigo-600">
								{health.stats.orders_count?.toLocaleString() || 0}
							</p>
							<p class="text-sm text-slate-500">Total Orders</p>
						</div>
						<div class="rounded-lg bg-slate-50 p-4 text-center">
							<p class="text-2xl font-bold text-indigo-600">
								{health.stats.order_items_count?.toLocaleString() || 0}
							</p>
							<p class="text-sm text-slate-500">Order Items</p>
						</div>
						<div class="rounded-lg bg-slate-50 p-4 text-center">
							<p class="text-2xl font-bold text-indigo-600">
								{health.stats.products_count?.toLocaleString() || 0}
							</p>
							<p class="text-sm text-slate-500">Products</p>
						</div>
						<div class="rounded-lg bg-slate-50 p-4 text-center">
							<p class="text-2xl font-bold text-indigo-600">
								{health.stats.users_count?.toLocaleString() || 0}
							</p>
							<p class="text-sm text-slate-500">Users</p>
						</div>
					</div>
				</div>
			{/if}
		{:else}
			<div class="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
				<p class="text-red-600">Gagal memuat status sistem. Silakan refresh.</p>
				<button
					onclick={fetch_health}
					class="mt-4 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
				>
					Retry
				</button>
			</div>
		{/if}
	</div>
</div>
