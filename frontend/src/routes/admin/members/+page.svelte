<script lang="ts">
	import { onMount } from 'svelte';
	import { member_service } from '$lib/services/member.service';

	let members: any[] = $state([]);
	let total = $state(0);
	let is_loading = $state(false);
	let search = $state('');
	let page = $state(1);
	let limit = $state(20);

	onMount(() => {
		fetch_members();
	});

	async function fetch_members() {
		is_loading = true;
		try {
			const result = await member_service.get_members({ page, limit, search });
			if (result.success) {
				members = result.data.data;
				total = result.data.total;
			}
		} catch (e) {
			console.error('Failed to fetch members:', e);
		} finally {
			is_loading = false;
		}
	}

	function handle_search() {
		page = 1;
		fetch_members();
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
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-black text-slate-800">Members</h1>
			<p class="text-slate-500">Total {total} member terdaftar</p>
		</div>
		<a
			href="/admin/members/analytics"
			class="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700"
		>
			📊 Analytics
		</a>
	</div>

	<!-- Search -->
	<div class="flex gap-2">
		<input
			type="text"
			bind:value={search}
			placeholder="Cari nama, HP, atau ID..."
			class="flex-1 rounded-lg border border-slate-300 px-4 py-2 font-medium"
			onkeydown={(e) => e.key === 'Enter' && handle_search()}
		/>
		<button onclick={handle_search} class="rounded-lg bg-slate-700 px-6 py-2 font-bold text-white">
			🔍 Cari
		</button>
	</div>

	<!-- Table -->
	<div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
		<table class="w-full text-left text-sm">
			<thead class="border-b border-slate-200 bg-slate-50 font-bold text-slate-700">
				<tr>
					<th class="px-4 py-3">Member</th>
					<th class="px-4 py-3">ID</th>
					<th class="px-4 py-3">HP</th>
					<th class="px-4 py-3">Tier</th>
					<th class="px-4 py-3 text-right">Poin</th>
					<th class="px-4 py-3">Register</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-slate-200">
				{#each members as member}
					<tr class="hover:bg-slate-50">
						<td class="px-4 py-3 font-medium text-slate-800">{member.name}</td>
						<td class="px-4 py-3 font-mono text-slate-600">{member.member_code}</td>
						<td class="px-4 py-3 text-slate-600">{member.phone}</td>
						<td class="px-4 py-3">
							<span
								class="rounded-full px-2 py-0.5 text-xs font-bold {get_tier_color(
									member.tier?.name
								)}"
							>
								{member.tier?.name || 'Bronze'}
							</span>
						</td>
						<td class="px-4 py-3 text-right font-bold text-blue-600">
							{member.loyalty_points} pts
						</td>
						<td class="px-4 py-3 text-slate-500">
							{new Date(member.registered_at).toLocaleDateString('id-ID')}
						</td>
					</tr>
				{:else}
					<tr>
						<td colspan="6" class="px-4 py-8 text-center text-slate-500">
							{is_loading ? 'Memuat...' : 'Belum ada member'}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<!-- Pagination -->
	{#if total > limit}
		<div class="flex items-center justify-between">
			<span class="text-sm text-slate-500">
				Halaman {page} dari {Math.ceil(total / limit)}
			</span>
			<div class="flex gap-2">
				<button
					onclick={() => {
						page = Math.max(1, page - 1);
						fetch_members();
					}}
					disabled={page === 1}
					class="rounded-lg border border-slate-300 px-4 py-2 font-medium disabled:opacity-50"
				>
					← Prev
				</button>
				<button
					onclick={() => {
						page++;
						fetch_members();
					}}
					disabled={page * limit >= total}
					class="rounded-lg border border-slate-300 px-4 py-2 font-medium disabled:opacity-50"
				>
					Next →
				</button>
			</div>
		</div>
	{/if}
</div>
