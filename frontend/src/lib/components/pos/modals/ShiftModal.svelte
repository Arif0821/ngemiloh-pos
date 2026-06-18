<script lang="ts">
	import { pos_store } from '$lib/stores/pos.store.svelte';
	import { pos_service } from '$lib/services/pos.service';

	interface Props {
		mode: 'open' | 'close';
	}

	let { mode }: Props = $props();

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

	// Handle form submission based on mode
	function handle_submit(e: Event) {
		e.preventDefault();
		if (mode === 'open') {
			pos_service.handle_open_shift(pos_store.opening_balance);
		} else {
			pos_service.handle_close_shift(pos_store.closing_balance);
		}
	}

	// handle_close is a no-op in 'open' mode — Escape key and close button are present
	// for consistency with other modals, but users must open a shift to proceed.
	// Only in 'close' mode does Escape/close button dismiss the modal.
	function handle_close() {
		if (mode === 'close') {
			pos_store.show_close_shift_modal = false;
		}
	}
</script>

{#if mode === 'open'}
	<!-- Open Shift Modal -->
	<div
		class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="open-shift-title"
	>
		<div
			class="dark:bg-surface-800 animate-in fade-in zoom-in w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl duration-200"
			use:focus_trap
		>
			<!-- Header -->
			<div
				class="border-b border-amber-100 bg-amber-50 p-6 dark:border-amber-900/30 dark:bg-amber-900/20"
			>
				<h2 id="open-shift-title" class="text-xl font-bold text-amber-800 dark:text-amber-500">
					Mulai Shift
				</h2>
				<p class="mt-1 text-sm text-amber-700/80 dark:text-amber-400/80">
					Anda belum memulai shift hari ini. Silakan masukkan uang modal laci (Kas Awal).
				</p>
			</div>

			<!-- Form -->
			<form onsubmit={handle_submit} class="p-6">
				<div class="space-y-4">
					<div>
						<label
							for="opening-balance"
							class="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300"
							>Kas Awal (Rp)</label
						>
						<input
							id="opening-balance"
							type="number"
							bind:value={pos_store.opening_balance}
							required
							class="dark:border-surface-600 dark:bg-surface-900 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500 dark:text-slate-100"
						/>
					</div>
				</div>
				<button
					type="submit"
					class="mt-6 w-full rounded-xl bg-amber-500 py-3 font-bold text-white shadow-lg shadow-amber-500/30 hover:bg-amber-600"
				>
					Buka Laci & Mulai Shift
				</button>
			</form>
		</div>
	</div>
{:else}
	<!-- Close Shift Modal -->
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-labelledby="close-shift-title"
	>
		<div
			class="dark:bg-surface-800 animate-in fade-in zoom-in w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl duration-200"
			use:focus_trap
		>
			<!-- Header -->
			<div
				class="dark:border-surface-700 flex items-center justify-between border-b border-slate-100 p-6"
			>
				<h2 id="close-shift-title" class="text-xl font-bold text-slate-800 dark:text-slate-100">
					Tutup Shift
				</h2>
				<button
					type="button"
					onclick={handle_close}
					data-modal-close
					class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
					aria-label="Tutup modal"
				>
					<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M6 18L18 6M6 6l12 12"
						></path></svg
					>
				</button>
			</div>

			<!-- Form -->
			<form onsubmit={handle_submit} class="space-y-4 p-6">
				<p class="text-sm text-slate-600 dark:text-slate-400">
					Silakan hitung uang fisik di laci kasir dan masukkan nominal akhirnya untuk dicocokkan
					dengan sistem.
				</p>
				<div>
					<label
						for="closing-balance"
						class="mb-1 block text-sm font-bold text-slate-700 dark:text-slate-300"
						>Kas Akhir Laci (Fisik)</label
					>
					<input
						id="closing-balance"
						type="number"
						bind:value={pos_store.closing_balance}
						required
						class="dark:border-surface-600 dark:bg-surface-900 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-red-500 dark:text-slate-100"
					/>
				</div>
				<div class="flex justify-end gap-3 pt-4">
					<button
						type="button"
						onclick={handle_close}
						class="dark:hover:bg-surface-700 rounded-lg px-4 py-2 font-bold text-slate-600 hover:bg-slate-50 dark:text-slate-300"
						>Batal</button
					>
					<button
						type="submit"
						class="rounded-lg bg-red-600 px-6 py-2 font-bold text-white shadow-lg hover:bg-red-700"
						>Tutup Shift & Log Out</button
					>
				</div>
			</form>
		</div>
	</div>
{/if}
