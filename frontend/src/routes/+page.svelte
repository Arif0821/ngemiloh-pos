<script lang="ts">
	import { onMount } from 'svelte';

	onMount(() => {
		window.location.href = '/login';
	});
</script>

<div class="bg-surface-100 flex min-h-screen items-center justify-center">
	<div class="flex animate-pulse flex-col items-center">
		<div
			class="border-brand-500 mb-4 h-12 w-12 animate-spin rounded-full border-4 border-t-transparent"
		></div>
		<p class="text-surface-500 font-medium">Mengarahkan...</p>
	</div>
</div>
