<script lang="ts">
	import { pos_store } from '$lib/stores/pos.store.svelte';
	import { toast } from '$lib/stores/toast.store.svelte';

	// Focus trap action for modals
	function focus_trap(node: HTMLElement) {
		const focusable_elements = node.querySelectorAll<HTMLElement>(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
		);
		const first_element = focusable_elements[0];
		const last_element = focusable_elements[focusable_elements.length - 1];

		function handle_keydown(e: KeyboardEvent) {
			if (e.key === 'Tab') {
				if (e.shiftKey && document.activeElement === first_element) {
					e.preventDefault();
					last_element?.focus();
				} else if (!e.shiftKey && document.activeElement === last_element) {
					e.preventDefault();
					first_element?.focus();
				}
			}
			if (e.key === 'Escape') {
				const close_button = node.querySelector<HTMLElement>('[data-modal-close]');
				close_button?.click();
			}
		}

		node.addEventListener('keydown', handle_keydown);
		first_element?.focus();

		return {
			destroy() {
				node.removeEventListener('keydown', handle_keydown);
			}
		};
	}

	// Toggle modifier selection
	function toggle_modifier(
		group_id: string,
		option: { id: string; name: string; additional_price: number | string }
	) {
		if (
			pos_store.selected_modifiers[group_id]?.id === option.id &&
			!pos_store.selected_product_for_modifier?.modifier_groups.find((g) => g.id === group_id)
				?.is_required
		) {
			delete pos_store.selected_modifiers[group_id];
		} else {
			pos_store.selected_modifiers[group_id] =
				option as (typeof pos_store.selected_modifiers)[string];
		}
	}

	// Calculate total price with modifiers
	let total_price = $derived(
		Number(pos_store.selected_product_for_modifier?.base_price || 0) + pos_store.modifier_total
	);

	// Handle add to cart
	function handle_add_to_cart() {
		if (!pos_store.selected_product_for_modifier) return;
		for (const g of pos_store.selected_product_for_modifier.modifier_groups) {
			if (g.is_required && !pos_store.selected_modifiers[g.id]) {
				toast.warning(`Pilihan ${g.name} wajib diisi!`);
				return;
			}
		}
		pos_store.add_to_cart(
			pos_store.selected_product_for_modifier,
			Object.values(pos_store.selected_modifiers)
		);
	}

	function handle_close() {
		pos_store.show_modifier_modal = false;
	}
</script>

<div
	class="bg-surface-900/80 fixed inset-0 z-60 flex items-center justify-center p-4 backdrop-blur-sm"
	role="dialog"
	aria-modal="true"
	aria-labelledby="modifier-title"
>
	<div
		class="dark:bg-surface-800 animate-in zoom-in-95 flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white shadow-2xl duration-200"
		use:focus_trap
	>
		<!-- Header -->
		<div
			class="border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50 flex items-center justify-between border-b p-5"
		>
			<h2 id="modifier-title" class="text-xl font-bold">
				{pos_store.selected_product_for_modifier?.name}
			</h2>
			<button
				type="button"
				class="bg-surface-200 dark:bg-surface-700 text-surface-500 hover:text-surface-700 flex h-10 w-10 items-center justify-center rounded-full"
				onclick={handle_close}
				data-modal-close
				aria-label="Tutup modal"
			>
				<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					></path></svg
				>
			</button>
		</div>

		<!-- Modifier Options -->
		<div class="flex-1 space-y-6 overflow-y-auto p-5">
			{#each pos_store.selected_product_for_modifier?.modifier_groups || [] as group}
				<div>
					<h3 class="mb-3 flex items-center justify-between font-bold">
						<span>{group.name} {group.is_required ? '*' : ''}</span>
					</h3>
					<div class="grid grid-cols-2 gap-3">
						{#each group.options as option}
							{@const is_selected = pos_store.selected_modifiers[group.id]?.id === option.id}
							<button
								class="rounded-xl border-2 p-3 text-left transition-all {is_selected
									? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300'
									: 'border-surface-200 dark:border-surface-700'}"
								onclick={() => toggle_modifier(group.id, option)}
							>
								<div class="text-sm font-medium">{option.name}</div>
								{#if Number(option.additional_price) > 0}
									<div class="text-brand-600 dark:text-brand-400 mt-1 text-xs font-bold">
										+{pos_store.format_rp(Number(option.additional_price))}
									</div>
								{/if}
							</button>
						{/each}
					</div>
				</div>
			{/each}
		</div>

		<!-- Footer with price and add button -->
		<div
			class="border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900/50 border-t p-5"
		>
			<div class="mb-4 flex items-center justify-between">
				<span class="text-surface-500 font-medium">Total Harga</span>
				<span class="text-brand-600 dark:text-brand-400 text-2xl font-bold">
					{pos_store.format_rp(total_price)}
				</span>
			</div>
			<button
				class="w-full rounded-xl py-4 text-lg font-bold shadow-md transition-all active:scale-95 {pos_store.is_all_required_modifiers_selected
					? 'bg-brand-600 hover:bg-brand-700 text-white'
					: 'bg-surface-300 text-surface-500 cursor-not-allowed'}"
				onclick={handle_add_to_cart}
				disabled={!pos_store.is_all_required_modifiers_selected}
			>
				TAMBAH PESANAN
			</button>
		</div>
	</div>
</div>
