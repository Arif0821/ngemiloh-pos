<script lang="ts">
  import '../app.css';
  let { children } = $props();
</script>

<svelte:head>
  <title>Ngemiloh POS</title>
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=0">
  <meta name="theme-color" content="#f43f5e">
  <!-- SECURITY: Disable XSS protection in older browsers (CSP is the modern solution) -->
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no">
  <meta name="referrer" content="strict-origin-when-cross-origin">
  <!-- CSP is configured server-side in backend/main.ts and Caddy proxy -->
</svelte:head>

{@render children()}
