<script lang="ts">
  import { posStore } from '$lib/stores/pos.store.svelte';
  import type { LocalProduct } from '$lib/db';

  function selectProduct(product: LocalProduct) {
    if (product.is_out_of_stock) {
      if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      alert('Stok habis');
      return;
    }
    if (navigator.vibrate) navigator.vibrate(50);
    
    if (product.modifier_groups && product.modifier_groups.length > 0) {
      posStore.selectedProductForModifier = product;
      posStore.selectedModifiers = {}; 
      product.modifier_groups.forEach(g => {
        if (g.is_required && g.options.length > 0) {
          posStore.selectedModifiers[g.id] = g.options[0];
        }
      });
      posStore.showModifierModal = true;
    } else {
      posStore.addToCart(product, []);
    }
  }
</script>

<div class="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
  {#each posStore.products as product}
    {@const disc = posStore.getBestDiscountForProduct(product)}
    <button 
      class="relative bg-white dark:bg-surface-800 rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-95 border border-surface-200 dark:border-surface-700 overflow-hidden text-left flex flex-col h-full {product.is_out_of_stock ? 'opacity-50 grayscale' : ''}"
      onclick={() => selectProduct(product)}
    >
      {#if product.is_out_of_stock}
        <div class="absolute top-2 right-2 bg-surface-800/90 backdrop-blur text-white text-xs font-bold px-2 py-1 rounded shadow-sm z-10">HABIS</div>
      {:else}
        {#if disc}
          <div class="absolute top-2 left-2 bg-orange-600 text-white text-xs font-black px-2 py-1 rounded shadow-sm z-10 animate-pulse">
            {disc.type === 'percentage' ? `DISKON ${disc.value}%` : `HEMAT ${posStore.formatRp(Number(disc.value))}`}
          </div>
        {/if}
      {/if}
      
      <div class="aspect-square w-full overflow-hidden bg-surface-100">
        <img src={product.image_url || 'https://placehold.co/150x150/f43f5e/fff?text=Menu'} alt={product.name} loading="lazy" class="w-full h-full object-cover mix-blend-multiply dark:mix-blend-normal" />
      </div>
      <div class="p-3 flex-1 flex flex-col justify-between">
        <h3 class="font-semibold text-sm leading-tight mb-2 text-surface-800 dark:text-surface-100">{product.name}</h3>
        <div>
          {#if disc}
            <p class="text-xs text-surface-400 line-through">{posStore.formatRp(product.base_price)}</p>
            <p class="font-bold text-orange-600 dark:text-orange-400">{posStore.formatRp(product.base_price - disc.calculatedAmount)}</p>
          {:else}
            <p class="font-bold text-surface-800 dark:text-surface-100">{posStore.formatRp(product.base_price)}</p>
          {/if}
        </div>
      </div>
    </button>
  {/each}
</div>
