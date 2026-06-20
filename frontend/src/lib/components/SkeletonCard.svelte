<script lang="ts">
	// ============================================
	// CARD SKELETON COMPONENTS
	// FIX F-11: Add loading skeletons for better UX
	// ============================================

	interface Props {
		count?: number;
		class?: string;
	}

	let { count = 6, class: class_name = '' }: Props = $props();
</script>

<div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 {class_name}">
	{#each Array(count) as _, i}
		<div
			class="animate-pulse rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
		>
			<div class="mb-3 h-24 rounded-lg bg-slate-200 dark:bg-slate-700"></div>
			<div class="mb-2 h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-700"></div>
			<div class="h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-700"></div>
		</div>
	{/each}
</div>
