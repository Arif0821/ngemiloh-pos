<script lang="ts">
	import { onMount } from 'svelte';
	import { member_service } from '$lib/services/member.service';

	let stats: any = $state(null);
	let is_loading = $state(false);

	onMount(() => {
		fetch_stats();
	});

	async function fetch_stats() {
		is_loading = true;
		try {
			const result = await member_service.get_stats();
			if (result.success) {
				stats = result.data;
			}
		} catch (e) {
			console.error('Failed to fetch stats:', e);
		} finally {
			is_loading = false;
		}
	}

	function get_tier_color(tier: string) {
		switch (tier.toLowerCase()) {
			case 'bronze':
				return 'bg-gradient-to-r from-amber-400 to-amber-600';
			case 'silver':
				return 'bg-gradient-to-r from-gray-300 to-gray-500';
			case 'gold':
				return 'bg-gradient-to-r from-yellow-400 to-yellow-600';
			case 'platinum':
				return 'bg-gradient-to-r from-blue-400 to-blue-600';
			default:
				return 'bg-gradient-to-r from-slate-400 to-slate-600';
		}
	}
</script>

<div class="space-y-6">
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-black text-slate-800">Member Analytics</h1>
			<p class="text-slate-500">Statistik program loyalitas member</p>
		</div>
		<a
			href="/admin/members"
			class="rounded-lg border border-slate-300 px-4 py-2 font-medium text-slate-700 hover:bg-slate-50"
		>
			← Kembali
		</a>
	</div>

	{#if is_loading}
		<div class="flex items-center justify-center py-12">
			<div class="animate-pulse text-slate-500">Memuat...</div>
		</div>
	{:else if stats}
		<!-- KPI Cards -->
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<div class="text-sm text-slate-500">Total Member</div>
				<div class="text-3xl font-black text-slate-800">{stats.total_members.toLocaleString()}</div>
			</div>
			<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<div class="text-sm text-slate-500">Member Baru (Bulan Ini)</div>
				<div class="text-3xl font-black text-emerald-600">+{stats.new_this_month}</div>
			</div>
			<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<div class="text-sm text-slate-500">Tier Distribution</div>
				<div class="mt-2 space-y-1 text-sm">
					{#each Object.entries(stats.tier_distribution || {}) as [tier, count]}
						<div class="flex justify-between">
							<span>{tier}</span>
							<span class="font-bold">{count}</span>
						</div>
					{/each}
				</div>
			</div>
			<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<div class="text-sm text-slate-500">Program Aktif</div>
				<div class="mt-2 flex items-center gap-2">
					<span class="text-2xl">✓</span>
					<span class="font-bold text-emerald-600">LOYALTY</span>
				</div>
			</div>
		</div>

		<!-- Tier Distribution Chart -->
		<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
			<h3 class="mb-4 font-bold text-slate-800">Distribusi Tier</h3>
			<div class="space-y-3">
				{#each Object.entries(stats.tier_distribution || {}) as [tier, count]}
					{@const total = stats.total_members || 1}
					{@const pct = Math.round((Number(count) / total) * 100)}
					<div>
						<div class="mb-1 flex justify-between text-sm">
							<span class="flex items-center gap-2 font-medium">
								<span class="h-3 w-3 rounded-full {get_tier_color(tier)}"></span>
								{tier}
							</span>
							<span class="text-slate-500">{count} ({pct}%)</span>
						</div>
						<div class="h-4 w-full overflow-hidden rounded-full bg-slate-100">
							<div
								class="h-full rounded-full {get_tier_color(tier)} transition-all"
								style="width: {pct}%"
							></div>
						</div>
					</div>
				{:else}
					<div class="text-center text-slate-500">Belum ada data tier</div>
				{/each}
			</div>
		</div>

		<!-- Benefits Info -->
		<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
			<h3 class="mb-4 font-bold text-slate-800">🌟 Benefit Tier</h3>
			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
				<div class="rounded-lg border border-amber-200 bg-amber-50 p-4">
					<div class="mb-2 text-lg font-bold text-amber-700">🥉 Bronze</div>
					<ul class="space-y-1 text-sm text-amber-800">
						<li>5 poin per Rp 1.000</li>
						<li>Tukar 100 poin = Rp 1.000</li>
					</ul>
				</div>
				<div class="rounded-lg border border-gray-200 bg-gray-50 p-4">
					<div class="mb-2 text-lg font-bold text-gray-700">🥈 Silver</div>
					<ul class="space-y-1 text-sm text-gray-800">
						<li>5% diskon</li>
						<li>Prioritas layanan</li>
					</ul>
				</div>
				<div class="rounded-lg border border-yellow-200 bg-yellow-50 p-4">
					<div class="mb-2 text-lg font-bold text-yellow-700">🥇 Gold</div>
					<ul class="space-y-1 text-sm text-yellow-800">
						<li>10% diskon</li>
						<li>Free item bulanan</li>
					</ul>
				</div>
				<div class="rounded-lg border border-blue-200 bg-blue-50 p-4">
					<div class="mb-2 text-lg font-bold text-blue-700">💎 Platinum</div>
					<ul class="space-y-1 text-sm text-blue-800">
						<li>15% diskon</li>
						<li>Free item mingguan</li>
					</ul>
				</div>
			</div>
		</div>
	{/if}
</div>
