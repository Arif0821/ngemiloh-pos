<script lang="ts">
	import { pos_store } from '$lib/stores/pos.store.svelte';

	// Modal components
	import ShiftModal from './modals/ShiftModal.svelte';
	import ModifierModal from './modals/ModifierModal.svelte';
	import PaymentModal from './modals/PaymentModal.svelte';
	import QrisWaitModal from './modals/QrisWaitModal.svelte';
	import SuccessModal from './modals/SuccessModal.svelte';
	import HistoryModal from './modals/HistoryModal.svelte';
</script>

<!-- Shift Open Modal: shown when no open shift and not checking shift -->
{#if !pos_store.has_open_shift && !pos_store.is_checking_shift}
	<ShiftModal mode="open" />
{/if}

<!-- Shift Close Modal -->
{#if pos_store.show_close_shift_modal}
	<ShiftModal mode="close" />
{/if}

<!-- Modifier Selection Modal -->
{#if pos_store.show_modifier_modal && pos_store.selected_product_for_modifier}
	<ModifierModal />
{/if}

<!-- Payment Modal -->
{#if pos_store.show_payment_modal}
	<PaymentModal />
{/if}

<!-- QRIS Waiting Modal -->
{#if pos_store.is_waiting_qris && pos_store.qris_order_info}
	<QrisWaitModal />
{/if}

<!-- Success Modal -->
{#if pos_store.show_success_modal && pos_store.last_order_details}
	<SuccessModal />
{/if}

<!-- History Modal -->
{#if pos_store.show_history_modal}
	<HistoryModal />
{/if}
