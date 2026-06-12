<script lang="ts">
	import { toast } from '$lib/stores/toast.store.svelte';

	const typeStyles: Record<string, string> = {
		success:
			'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200',
		error:
			'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
		warning:
			'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
		info: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
	};

	const typeIcons: Record<string, string> = {
		success: 'M5 13l4 4L19 7',
		error: 'M6 18L18 6M6 6l12 12',
		warning:
			'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
		info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
	};
</script>

<div class="pointer-events-none fixed right-4 bottom-4 z-9999 flex w-full max-w-sm flex-col gap-2">
	{#each toast.toasts as t (t.id)}
		<div
			class="pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg backdrop-blur-sm {typeStyles[
				t.type
			]}"
			role="alert"
		>
			<svg class="mt-0.5 h-5 w-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={typeIcons[t.type]}
				></path>
			</svg>
			<p class="flex-1 text-sm font-medium">{t.message}</p>
			<button
				onclick={() => toast.remove(t.id)}
				class="shrink-0 opacity-70 transition-opacity hover:opacity-100"
				aria-label="Dismiss"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					></path>
				</svg>
			</button>
		</div>
	{/each}
</div>
