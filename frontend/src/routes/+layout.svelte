<script lang="ts">
	import '../app.css';
	import Toast from '$lib/components/Toast.svelte';
	import ErrorBoundary from '$lib/components/ErrorBoundary.svelte';
	let { children } = $props();
</script>

<svelte:head>
	<title>Ngemiloh POS</title>
	<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
	<meta
		name="viewport"
		content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0"
	/>
	<meta name="theme-color" content="#f43f5e" />
	<meta http-equiv="x-ua-compatible" content="IE=edge" />
	<meta name="format-detection" content="telephone=no" />
	<meta name="referrer" content="strict-origin-when-cross-origin" />
	<!-- CSP is configured server-side in backend/main.ts and Caddy proxy -->
</svelte:head>

<ErrorBoundary>
	{@render children()}
</ErrorBoundary>
<Toast />
