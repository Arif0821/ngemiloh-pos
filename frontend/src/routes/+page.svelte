<script lang="ts">
  import { onMount } from 'svelte';
  
  onMount(() => {
    window.location.href = '/login';
  });
</script>

<div class="min-h-screen bg-surface-100 flex items-center justify-center">
  <div class="animate-pulse flex flex-col items-center">
    <div class="w-12 h-12 border-4 border-brand-500 border-t-transparent rounded-full animate-spin mb-4"></div>
    <p class="text-surface-500 font-medium">Mengarahkan...</p>
  </div>
</div>
