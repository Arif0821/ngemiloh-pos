<script lang="ts">
	import { api } from '$lib/services/api.client';
	import { toast } from '$lib/stores/toast.store.svelte';
	import { onMount } from 'svelte';

	import type { FeatureFlag } from '$lib/domain/models/types';
	let flags: FeatureFlag[] = $state([]);
	let isLoading = $state(false);

	async function fetchFlags() {
		isLoading = true;
		try {
			const res = await api.request(`/flags/admin`, { credentials: 'include' });
			if (res.ok) {
				const json = await res.json();
				flags = json.data;
			}
		} catch (e) {
			console.error(e);
		} finally {
			isLoading = false;
		}
	}

	async function toggleFlag(flag: FeatureFlag) {
		const newValue = !flag.is_enabled;
		const oldFlags = [...flags];
		// Optimistic update
		flag.is_enabled = newValue;

		try {
			const res = await api.request(`/flags/toggle`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ name: flag.name, is_enabled: newValue })
			});
			if (!res.ok) {
				throw new Error('Gagal update flag');
			}
		} catch {
			toast.error('Gagal menyimpan perubahan');
			flags = oldFlags; // revert
		}
	}

	onMount(() => {
		fetchFlags();
	});
</script>

<div class="mx-auto max-w-4xl space-y-6 p-6">
	<div>
		<h1 class="text-2xl font-black text-slate-800 dark:text-slate-100">Feature Flags</h1>
		<p class="text-slate-500">
			Nyalakan atau matikan fitur aplikasi secara instan tanpa perlu redeploy (Berlaku dalam &lt; 30
			detik di seluruh cabang).
		</p>
	</div>

	<div
		class="dark:bg-surface-800 dark:border-surface-700 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
	>
		<div class="p-6">
			{#if isLoading && flags.length === 0}
				<p class="animate-pulse py-10 text-center text-slate-500">Memuat konfigurasi...</p>
			{:else}
				<div class="space-y-6">
					{#each flags as flag}
						<div
							class="dark:border-surface-700 dark:hover:bg-surface-700/50 flex items-center justify-between rounded-xl border border-slate-100 p-4 transition hover:bg-slate-50"
						>
							<div>
								<h3 class="font-bold text-slate-800 dark:text-slate-100">{flag.name}</h3>
								<p class="text-sm text-slate-500">{flag.description}</p>
							</div>
							<button
								onclick={() => toggleFlag(flag)}
								class="relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none {flag.is_enabled
									? 'bg-emerald-500'
									: 'dark:bg-surface-600 bg-slate-300'}"
							>
								<span class="sr-only">Toggle {flag.name}</span>
								<span
									class="pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out {flag.is_enabled
										? 'translate-x-5'
										: 'translate-x-0'}"
								></span>
							</button>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
