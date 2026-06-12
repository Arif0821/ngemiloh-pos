<script lang="ts">
	import { posStore } from '$lib/stores/pos.store.svelte';
	import { toast } from '$lib/stores/toast.store.svelte';
	import type { LocalProduct } from '$lib/db';

	// SECURITY: Validate image URL to prevent XSS attacks
	// Only allow HTTPS URLs from approved sources or relative paths
	function getSafeImageUrl(url: string | null | undefined): string {
		if (!url) return 'https://placehold.co/150x150/f43f5e/fff?text=Menu';
		// Allow only HTTPS URLs or /uploads/ relative paths
		if (url.startsWith('/uploads/') || url.startsWith('https://')) {
			return url;
		}
		// Reject javascript:, data:, or other dangerous schemes
		return 'https://placehold.co/150x150/f43f5e/fff?text=Menu';
	}

	function selectProduct(product: LocalProduct) {
		if (product.is_out_of_stock) {
			if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
			toast.warning('Stok habis');
			return;
		}
		if (navigator.vibrate) navigator.vibrate(50);

		if (product.modifier_groups && product.modifier_groups.length > 0) {
			posStore.selectedProductForModifier = product;
			posStore.selectedModifiers = {};
			product.modifier_groups.forEach((g) => {
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

<div class="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-4">
	{#each posStore.products as product}
		{@const disc = posStore.getBestDiscountForProduct(product)}
		<button
			class="dark:bg-surface-800 border-surface-200 dark:border-surface-700 relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white text-left shadow-sm transition-all hover:shadow-md active:scale-95 {product.is_out_of_stock
				? 'opacity-50 grayscale'
				: ''}"
			onclick={() => selectProduct(product)}
		>
			{#if product.is_out_of_stock}
				<div
					class="bg-surface-800/90 absolute top-2 right-2 z-10 rounded px-2 py-1 text-xs font-bold text-white shadow-sm backdrop-blur"
				>
					HABIS
				</div>
			{:else if disc}
				<div
					class="absolute top-2 left-2 z-10 animate-pulse rounded bg-orange-600 px-2 py-1 text-xs font-black text-white shadow-sm"
				>
					{disc.type === 'percentage'
						? `DISKON ${disc.value}%`
						: `HEMAT ${posStore.formatRp(Number(disc.value))}`}
				</div>
			{/if}

			<div class="bg-surface-100 aspect-square w-full overflow-hidden">
				<img
					src={getSafeImageUrl(product.image_url)}
					alt={product.name}
					loading="lazy"
					class="h-full w-full object-cover mix-blend-multiply dark:mix-blend-normal"
				/>
			</div>
			<div class="flex flex-1 flex-col justify-between p-3">
				<h3 class="text-surface-800 dark:text-surface-100 mb-2 text-sm leading-tight font-semibold">
					{product.name}
				</h3>
				<div>
					{#if disc}
						<p class="text-surface-400 text-xs line-through">
							{posStore.formatRp(product.base_price)}
						</p>
						<p class="font-bold text-orange-600 dark:text-orange-400">
							{posStore.formatRp(product.base_price - disc.calculatedAmount)}
						</p>
					{:else}
						<p class="text-surface-800 dark:text-surface-100 font-bold">
							{posStore.formatRp(product.base_price)}
						</p>
					{/if}
				</div>
			</div>
		</button>
	{/each}
</div>
