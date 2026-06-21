<script lang="ts">
	import { page } from '$app/stores';
	import { member_service } from '$lib/services/member.service';

	let member: any = $state(null);
	let is_loading = $state(false);

	$effect(() => {
		const id = $page.params.id;
		if (id) fetch_member(id);
	});

	async function fetch_member(id: string) {
		is_loading = true;
		try {
			const result = await member_service.get_member_detail(id);
			if (result.success) {
				member = result.data;
			}
		} catch (e) {
			console.error('Failed to fetch member:', e);
		} finally {
			is_loading = false;
		}
	}

	function get_tx_color(type: string) {
		switch (type) {
			case 'earn':
				return 'text-emerald-600';
			case 'redeem':
				return 'text-red-600';
			case 'adjust':
				return 'text-blue-600';
			case 'void_revoke':
				return 'text-red-500';
			case 'void_restore':
				return 'text-emerald-500';
			default:
				return 'text-slate-600';
		}
	}

	function get_tx_prefix(type: string) {
		switch (type) {
			case 'earn':
				return '+';
			case 'redeem':
				return '-';
			case 'void_revoke':
				return '-';
			case 'void_restore':
				return '+';
			default:
				return '±';
		}
	}

	function get_tier_color(tier: string | undefined) {
		switch (tier?.toLowerCase()) {
			case 'bronze':
				return 'bg-amber-100 text-amber-700';
			case 'silver':
				return 'bg-gray-200 text-gray-700';
			case 'gold':
				return 'bg-yellow-100 text-yellow-700';
			case 'platinum':
				return 'bg-blue-100 text-blue-700';
			default:
				return 'bg-slate-100 text-slate-700';
		}
	}
</script>

<div class="space-y-6">
	{#if is_loading}
		<div class="flex items-center justify-center py-12">
			<div class="animate-pulse text-slate-500">Memuat...</div>
		</div>
	{:else if member}
		<!-- Header -->
		<div class="flex items-center justify-between">
			<div>
				<a
					href="/admin/members"
					class="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
				>
					← Kembali ke Daftar
				</a>
				<h1 class="text-2xl font-black text-slate-800">{member.name}</h1>
				<p class="text-slate-500 font-mono">{member.member_code}</p>
			</div>
			<span class="rounded-full px-4 py-2 text-lg font-bold {get_tier_color(member.tier?.name)}">
				{member.tier?.name || 'Bronze'}
			</span>
		</div>

		<!-- Info Cards -->
		<div class="grid gap-4 sm:grid-cols-3">
			<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<div class="text-sm text-slate-500">Poin</div>
				<div class="text-3xl font-black text-blue-600">{member.loyalty_points} pts</div>
				<div class="text-sm text-slate-500">= Rp {(Math.floor(member.loyalty_points / 5) * 1000).toLocaleString()}</div>
			</div>
			<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<div class="text-sm text-slate-500">HP</div>
				<div class="text-xl font-bold text-slate-800">{member.phone}</div>
				{#if member.email}
					<div class="text-sm text-slate-500">{member.email}</div>
				{/if}
			</div>
			<div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
				<div class="text-sm text-slate-500">Terdaftar</div>
				<div class="text-xl font-bold text-slate-800">
					{new Date(member.registered_at).toLocaleDateString('id-ID', {
						year: 'numeric',
						month: 'long',
						day: 'numeric'
					})}
				</div>
				<div class="text-sm text-slate-500 capitalize">{member.registered_via?.replace('_', ' ')}</div>
			</div>
		</div>

		<!-- Transaction History -->
		<div class="rounded-xl border border-slate-200 bg-white shadow-sm">
			<div class="border-b border-slate-200 p-4">
				<h3 class="font-bold text-slate-800">Riwayat Poin</h3>
			</div>
			<div class="divide-y divide-slate-200">
				{#each (member.transactions || []) as tx}
					<div class="flex items-center justify-between p-4">
						<div>
							<span class="font-medium {get_tx_color(tx.type)}">
								{get_tx_prefix(tx.type)}{Math.abs(tx.points)} pts
							</span>
							<span class="ml-2 text-sm text-slate-500">{tx.description || tx.type}</span>
						</div>
						<div class="text-right">
							<div class="font-bold text-slate-800">{tx.balance_after} pts</div>
							<div class="text-xs text-slate-500">
								{new Date(tx.created_at).toLocaleString('id-ID')}
							</div>
						</div>
					</div>
				{:else}
					<div class="p-8 text-center text-slate-500">Belum ada transaksi poin</div>
				{/each}
			</div>
		</div>
	{:else}
		<div class="rounded-xl border border-slate-200 bg-white p-8 text-center">
			<p class="text-slate-500">Member tidak ditemukan</p>
			<a
				href="/admin/members"
				class="mt-4 inline-block text-blue-600 hover:underline"
			>
				← Kembali ke Daftar
			</a>
		</div>
	{/if}
</div>
