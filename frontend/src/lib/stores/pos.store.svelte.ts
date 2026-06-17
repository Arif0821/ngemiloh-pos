import { db, type LocalProduct, type ModifierOption } from '$lib/db';
import type { Discount, OrderResponse } from '../domain/models/types';
import { DEFAULT_OPENING_BALANCE, QRIS_COUNTDOWN_SECONDS, format_rp } from '../utils/format';

// ============================================
// CART ITEM TYPE
// Using snake_case naming
// ============================================

export type CartItem = LocalProduct & {
	quantity: number;
	cart_item_id: string;
	selected_modifiers: ModifierOption[];
};

// ============================================
// POS STORE - Main Application State
// Using Svelte 5 Runes
// Using snake_case naming convention
// ============================================

export class PosStore {
	// Application State
	is_offline: boolean = $state(false);
	feature_flags: Record<string, boolean> = $state({});

	// Products & Cart
	products: LocalProduct[] = $state([]);
	cart: CartItem[] = $state([]);
	is_cart_loaded: boolean = $state(false);

	// Modals & UI Toggles
	show_payment_modal: boolean = $state(false);
	show_modifier_modal: boolean = $state(false);
	show_success_modal: boolean = $state(false);
	show_history_modal: boolean = $state(false);
	show_close_shift_modal: boolean = $state(false);

	// Shift Logic
	has_open_shift: boolean = $state(true);
	opening_balance: number = $state(DEFAULT_OPENING_BALANCE);
	closing_balance: number = $state(0);
	is_checking_shift: boolean = $state(true);

	// Modifier Logic
	selected_product_for_modifier: LocalProduct | null = $state(null);
	selected_modifiers: Record<string, ModifierOption> = $state({});
	modifier_total: number = $derived(
		Object.values(this.selected_modifiers).reduce(
			(sum, opt) => sum + Number(opt.additional_price || 0),
			0
		)
	);

	is_all_required_modifiers_selected: boolean = $derived.by(() => {
		if (!this.selected_product_for_modifier) return false;
		for (const g of this.selected_product_for_modifier.modifier_groups) {
			if (g.is_required === true && !this.selected_modifiers[g.id]) return false;
		}
		return true;
	});

	// Discounts
	active_discounts: Discount[] = $state([]);
	applied_discount: Discount | null = $state(null);

	// Payment Logic
	payment_method: 'cash' | 'qris' | 'split' = $state('cash');
	cash_amount: number = $state(0);
	split_cash_amount: number = $state(0);
	is_processing: boolean = $state(false);

	// Derived values using snake_case
	cart_total_before_discount = $derived(
		this.cart.reduce(
			(sum, item) =>
				sum +
				item.base_price * item.quantity +
				item.selected_modifiers.reduce(
					(s: number, m: ModifierOption) => s + Number(m.additional_price),
					0
				) *
					item.quantity,
			0
		)
	);

	// ============================================
	// CONTEXT-AWARE DISCOUNT SYSTEM
	// Priority: specific_product > category > all_products
	// Auto-apply if only 1 applicable discount
	// ============================================

	discount_total: number = $derived(
		this.cart.reduce((sum, item) => {
			const discount = this.get_best_discount_for_product(item);
			if (!discount) return sum;
			// Discount only applies to base_price, NOT modifier total
			const base_total = Number(item.base_price) * item.quantity;
			return (
				sum +
				(discount.type === 'percentage'
					? base_total * (Number(discount.value) / 100)
					: Number(discount.value) * item.quantity)
			);
		}, 0)
	);

	cart_total: number = $derived(Math.max(0, this.cart_total_before_discount - this.discount_total));
	split_qris_amount: number = $derived(
		Math.max(0, this.cart_total - Number(this.split_cash_amount || 0))
	);
	cash_change: number = $derived(
		this.payment_method === 'cash' ? Number(this.cash_amount || 0) - this.cart_total : 0
	);

	// QRIS Waiting State
	is_waiting_qris: boolean = $state(false);
	qris_countdown: number = $state(QRIS_COUNTDOWN_SECONDS); // 15 minutes
	qris_order_info: OrderResponse | null = $state(null);
	last_order_details: OrderResponse | null = $state(null);
	history_orders: OrderResponse[] = $state([]);

	// Methods

	format_rp = format_rp;

	// ============================================
	// CONTEXT-AWARE DISCOUNT LOGIC
	// Returns best discount based on priority rules:
	// 1. specific_product discounts have highest priority
	// 2. category discounts come second
	// 3. all_products discounts come last
	// ============================================

	get_best_discount_for_product(product: LocalProduct): Discount | null {
		if (!this.active_discounts || this.active_discounts.length === 0) return null;

		const today = new Date().getDay() || 7;
		let applicable_discounts: Discount[] = [];

		for (const d of this.active_discounts) {
			// Check if discount is applicable today
			if (!d.applicable_days || d.applicable_days.includes(today)) {
				// Check scope match
				if (
					d.scope === 'all_products' ||
					(d.scope === 'category' && d.target_id === product.category_id) ||
					(d.scope === 'specific_product' && d.target_id === product.id)
				) {
					applicable_discounts.push(d);
				}
			}
		}

		if (applicable_discounts.length === 0) return null;

		// Sort by priority: specific_product > category > all_products
		const priority_map: Record<string, number> = {
			specific_product: 3,
			category: 2,
			all_products: 1
		};

		applicable_discounts.sort((a, b) => {
			const priority_diff = (priority_map[b.scope] || 0) - (priority_map[a.scope] || 0);
			if (priority_diff !== 0) return priority_diff;

			// If same priority, calculate actual discount amount
			const a_amount =
				a.type === 'percentage'
					? Number(product.base_price) * (Number(a.value) / 100)
					: Number(a.value);
			const b_amount =
				b.type === 'percentage'
					? Number(product.base_price) * (Number(b.value) / 100)
					: Number(b.value);
			return b_amount - a_amount;
		});

		const best = applicable_discounts[0];
		return { ...best, calculated_amount: this.calculate_discount_amount(product, best) };
	}

	private calculate_discount_amount(product: LocalProduct, discount: Discount): number {
		const base_price = Number(product.base_price);
		if (discount.type === 'percentage') {
			return base_price * (Number(discount.value) / 100);
		}
		return Number(discount.value);
	}

	add_to_cart(product: LocalProduct, modifiers: ModifierOption[]) {
		const modifier_sig = modifiers
			.map((m) => m.id)
			.sort()
			.join(',');
		const existing_idx = this.cart.findIndex(
			(item) =>
				item.id === product.id &&
				item.selected_modifiers
					.map((m) => m.id)
					.sort()
					.join(',') === modifier_sig
		);

		if (existing_idx >= 0) {
			// Replace item with updated quantity (reactive reassignment)
			const updated = {
				...this.cart[existing_idx],
				quantity: this.cart[existing_idx].quantity + 1
			};
			this.cart = [
				...this.cart.slice(0, existing_idx),
				updated,
				...this.cart.slice(existing_idx + 1)
			];
		} else {
			this.cart = [
				...this.cart,
				{
					...product,
					quantity: 1,
					cart_item_id: crypto.randomUUID(),
					selected_modifiers: [...modifiers]
				}
			];
		}
		this.show_modifier_modal = false;
	}

	update_quantity(cart_item_id: string, delta: number) {
		const idx = this.cart.findIndex((item) => item.cart_item_id === cart_item_id);
		if (idx < 0) return;
		const new_qty = this.cart[idx].quantity + delta;
		if (new_qty <= 0) {
			this.remove_from_cart(cart_item_id);
		} else {
			// Reactive reassignment
			const updated = { ...this.cart[idx], quantity: new_qty };
			this.cart = [...this.cart.slice(0, idx), updated, ...this.cart.slice(idx + 1)];
		}
	}

	remove_from_cart(cart_item_id: string) {
		this.cart = this.cart.filter((item) => item.cart_item_id !== cart_item_id);
	}

	reset_cart() {
		this.show_payment_modal = false;
		this.cart = [];
		this.cash_amount = 0;
		this.split_cash_amount = 0;
		this.applied_discount = null;
	}

	reset_pos() {
		this.cart = [];
		db.cart.delete('current_cart'); // Clear only current cart, keep other data
		this.payment_method = 'cash';
		this.cash_amount = 0;
		this.split_cash_amount = 0;
		this.applied_discount = null;
		this.show_success_modal = false;
		this.last_order_details = null;
	}
}

export const pos_store = new PosStore();
