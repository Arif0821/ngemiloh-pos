<script lang="ts">
	import { member_store } from '$lib/stores/member.store.svelte';

	interface Props {
		on_close: () => void;
		on_member_selected: (use_points: boolean) => void;
	}

	let { on_close, on_member_selected }: Props = $props();

	let search_input = $state('');
	let search_mode = $state<'phone' | 'code'>('phone');

	async function handle_search() {
		if (!search_input.trim()) return;

		if (search_mode === 'phone') {
			await member_store.lookup({ phone: search_input });
		} else {
			await member_store.lookup({ code: search_input });
		}
	}

	function handle_select() {
		if (!member_store.current_member) return;

		member_store.show_lookup_modal = false;
		on_member_selected(member_store.selected_for_redeem);
	}

	function handle_close() {
		member_store.clear();
		on_close();
	}
</script>

<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
	<div class="w-full max-w-md rounded-2xl bg-white shadow-2xl">
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-slate-200 p-4">
			<h2 class="text-lg font-bold text-slate-800">🔍 Cari Member</h2>
			<button
				onclick={handle_close}
				class="rounded-lg p-2 hover:bg-slate-100"
				aria-label="Close"
			>
				<svg
					class="h-5 w-5 text-slate-500"
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
			</button>
		</div>

		<!-- Content -->
		<div class="p-4 space-y-4">
			{#if !member_store.current_member}
				<!-- Search Form -->
				<div class="space-y-3">
					<!-- Mode Toggle -->
					<div class="flex gap-2">
						<button
							onclick={() => {
								search_mode = 'phone';
								search_input = '';
							}}
							class="flex-1 rounded-lg py-2 text-sm font-medium transition-colors {search_mode ===
							'phone'
								? 'bg-blue-600 text-white'
								: 'bg-slate-100 text-slate-600'}"
						>
							📱 Nomor HP
						</button>
						<button
							onclick={() => {
								search_mode = 'code';
								search_input = '';
							}}
							class="flex-1 rounded-lg py-2 text-sm font-medium transition-colors {search_mode ===
							'code'
								? 'bg-blue-600 text-white'
								: 'bg-slate-100 text-slate-600'}"
						>
							🏷️ ID Member
						</button>
					</div>

					<!-- Input -->
					<input
						type={search_mode === 'phone' ? 'tel' : 'text'}
						bind:value={search_input}
						placeholder={search_mode === 'phone' ? '081234567890' : 'MBR-A1B2C3'}
						class="w-full rounded-lg border border-slate-300 px-4 py-3 text-lg font-medium focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
					/>

					<!-- Error -->
					{#if member_store.error}
						<div class="rounded-lg bg-red-50 p-3 text-sm text-red-600">
							{member_store.error}
						</div>
					{/if}

					<!-- Search Button -->
					<button
						onclick={handle_search}
						disabled={member_store.is_loading || !search_input.trim()}
						class="w-full rounded-lg bg-blue-600 py-3 font-bold text-white transition-colors hover:bg-blue-700 disabled:bg-slate-300"
					>
						{member_store.is_loading ? 'Mencari...' : '🔍 Cari'}
					</button>
				</div>
			{:else}
				<!-- Member Found -->
				<div class="space-y-4">
					<div class="rounded-lg bg-emerald-50 p-4">
						<div class="flex items-center gap-2 text-emerald-700">
							<svg
								class="h-5 w-5"
								fill="currentColor"
								viewBox="0 0 20 20"
							>
								<path
									fill-rule="evenodd"
									d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
									clip-rule="evenodd"
								/>
							</svg>
							<span class="font-bold">Member Ditemukan!</span>
						</div>
					</div>

					<!-- Member Info -->
					<div class="space-y-2 rounded-lg border border-slate-200 p-4">
						<div class="flex items-center justify-between">
							<span class="text-slate-600">Nama</span>
							<span class="font-bold text-slate-800">{member_store.current_member.name}</span>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-slate-600">ID</span>
							<span class="font-mono text-slate-800"
								>{member_store.current_member.member_code}</span
							>
						</div>
						<div class="flex items-center justify-between">
							<span class="text-slate-600">Tier</span>
							<span class="font-bold text-amber-600">{member_store.current_member.tier}</span>
						</div>
						<div class="flex items-center justify-between border-t border-slate-100 pt-2">
							<span class="text-slate-600">Saldo Poin</span>
							<div class="text-right">
								<span class="text-xl font-black text-blue-600"
									>{member_store.current_member.loyalty_points} pts</span
								>
								<span class="ml-2 text-sm text-slate-500">({member_store.format_points_value})</span>
							</div>
						</div>
					</div>

					<!-- Redeem Option -->
					{#if member_store.current_member.loyalty_points > 0}
						<label
							class="flex cursor-pointer items-center gap-3 rounded-lg border-2 border-blue-200 bg-blue-50 p-4 transition-colors hover:bg-blue-100"
						>
							<input
								type="checkbox"
								bind:checked={member_store.selected_for_redeem}
								class="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
							/>
							<div class="flex-1">
								<span class="font-bold text-blue-800">Pakai Poin?</span>
								<p class="text-sm text-blue-600">
									Tersedia {member_store.current_member.loyalty_points} poin
									({member_store.format_points_value})
								</p>
							</div>
						</label>
					{/if}

					<!-- Actions -->
					<div class="flex gap-2">
						<button
							onclick={() => {
								search_input = '';
								member_store.current_member = null;
							}}
							class="flex-1 rounded-lg border border-slate-300 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50"
						>
							🔄 Cari Lagi
						</button>
						<button
							onclick={handle_select}
							class="flex-1 rounded-lg bg-emerald-600 py-3 font-bold text-white transition-colors hover:bg-emerald-700"
						>
							✅ Pilih
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
</div>
