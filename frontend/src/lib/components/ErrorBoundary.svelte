<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		fallback?: Snippet;
		children: Snippet;
		on_error_handler?: (error: Error, stack: string) => void;
	}

	let { fallback, children, on_error_handler }: Props = $props();

	let has_error = $state(false);
	let error_message = $state('');
	let error_stack = $state('');

	function handle_window_error(event: Event) {
		const err_event = event as ErrorEvent;
		has_error = true;
		error_message = err_event.message || 'Terjadi kesalahan';
		error_stack = err_event.error?.stack || '';
		on_error_handler?.(err_event.error || new Error(err_event.message), error_stack);
		event.preventDefault();
	}

	function handle_rejection(event: PromiseRejectionEvent) {
		has_error = true;
		const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
		error_message = error.message || 'Terjadi kesalahan tak terduga';
		error_stack = error.stack || '';
		on_error_handler?.(error, error_stack);
		event.preventDefault();
	}

	function retry() {
		has_error = false;
		error_message = '';
		error_stack = '';
	}
</script>

<svelte:window onerror={handle_window_error} onunhandledrejection={handle_rejection} />

{#if has_error}
	{#if fallback}
		{@render fallback()}
	{:else}
		<div
			class="flex min-h-[200px] flex-col items-center justify-center gap-4 rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center"
		>
			<div class="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/20">
				<svg class="h-6 w-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
					/>
				</svg>
			</div>
			<div>
				<p class="font-bold text-red-400">Terjadi Kesalahan</p>
				<p class="mt-1 text-sm text-slate-400">{error_message}</p>
			</div>
			<button
				onclick={retry}
				class="rounded-lg bg-red-500/20 px-4 py-2 text-sm font-medium text-red-400 transition-colors hover:bg-red-500/30"
			>
				Coba Lagi
			</button>
		</div>
	{/if}
{:else}
	{@render children()}
{/if}
