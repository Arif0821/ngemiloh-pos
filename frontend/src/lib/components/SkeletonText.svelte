<script lang="ts">
	// ============================================
	// LOADING SKELETON COMPONENTS
	// FIX F-11: Add loading skeletons for better UX
	// ============================================

	interface Props {
		lines?: number;
		height?: string;
		class?: string;
	}

	let { lines = 3, height = 'h-4', class: class_name = '' }: Props = $props();
</script>

<div class="animate-pulse space-y-3 {class_name}">
	{#each Array(lines) as _, i}
		<div
			class="rounded bg-slate-200 dark:bg-slate-700 {height}"
			style="width: {100 - i * 15}%"
		></div>
	{/each}
</div>
