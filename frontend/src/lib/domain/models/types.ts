// ============================================
// SHARED TYPES - Single Source of Truth
// Using snake_case naming convention
// ============================================

export interface ApiResponse<T> {
	success: boolean;
	data: T;
	message?: string;
}

// Product Types
export interface ProductItem {
	id: string;
	name: string;
	category_id: string;
	base_price: number | string;
	image_url: string | null;
	is_active: boolean;
	is_out_of_stock: boolean;
	modifier_groups?: ModifierGroup[];
}

export interface ModifierGroup {
	id: string;
	name: string;
	is_required?: boolean;
	max_selections?: number;
	is_active?: boolean;
	options: ModifierOption[];
}

export interface ModifierOption {
	id: string;
	name: string;
	additional_price: number | string;
	is_active?: boolean;
}

// Discount Types
export interface Discount {
	id: string;
	name: string;
	type: 'percentage' | 'fixed_amount';
	value: number | string;
	scope: 'all_products' | 'category' | 'specific_product';
	target_id?: string | null;
	is_active: boolean;
	valid_from?: string;
	valid_until?: string;
	applicable_days?: number[];
	// Extended properties (computed in frontend)
	calculated_amount?: number;
}

// Order Types
export interface OrderItem {
	product_id: string;
	quantity: number;
	modifiers?: { option_id: string }[];
}

export interface CreateOrderPayload {
	client_uuid: string;
	payment_method: 'cash' | 'qris' | 'split';
	client_final_price: number;
	discount_total?: number;
	discount_id?: string;
	cash_amount?: number;
	qris_amount?: number;
	customer_name?: string;
	items: OrderItem[];
}

export interface OrderItemResponse {
	id: string;
	product_id: string;
	product_name_snapshot?: string;
	quantity: number;
	subtotal: number;
	modifiers?: {
		name: string;
		additional_price: number;
		option_name_snapshot?: string;
		additional_price_at_time?: number;
	}[];
}

export interface OrderResponse {
	id: string;
	client_uuid: string;
	total_amount: number | string;
	subtotal?: number;
	tax_total?: number;
	final_price: number;
	discount_total?: number;
	status: string;
	payment_status: string;
	payment_method?: 'cash' | 'qris' | 'split';
	cash_amount?: number;
	qris_amount?: number;
	cash_received?: number;
	cash_change?: number;
	qr_string?: string;
	midtrans_transaction_id?: string;
	items?: OrderItemResponse[];
	cashier?: { id: string; name: string };
	customer_name?: string;
	void_reason?: string;
	voider?: string;
	client_created_at?: string;
	created_at?: string;
	verification_status?: string;
}

// Shift Types
export interface ShiftInfo {
	id: string;
	cashier_id: string;
	cashier?: { name: string; username?: string };
	shift_date: string;
	shift_start?: string;
	shift_end?: string;
	opening_balance: number | string;
	closing_balance?: number | string;
	system_cash_total?: number | string;
	discrepancy?: number | string;
	status: string;
}

// Analytics Types
export interface AnalyticsTrend {
	label: string;
	value: number;
}

export interface AnalyticsResponse {
	trend: AnalyticsTrend[];
	top_products: {
		by_qty: { name: string; qty: number; revenue: number }[];
		by_revenue: { name: string; qty: number; revenue: number }[];
	};
	payment_distribution: {
		counts: { cash: number; qris: number; split: number };
		values: { cash: number; qris: number; split: number };
	};
	peak_hours: { hour: number; count: number }[];
}

// Asset Types
export interface Asset {
	id: string;
	name: string;
	purchase_price: number | string;
	value?: number | string;
	useful_life_months: number;
	lifespan_months?: number;
	monthly_depreciation: number | string;
	purchase_date: string;
	is_active: boolean;
}

// Audit Types
export interface AuditLog {
	id: string;
	actor_id: string;
	action: string;
	entity_type: string;
	entity_id: string;
	old_value?: unknown;
	new_value?: unknown;
	created_at: string;
	actor?: { name: string; username?: string; role: string };
}

// Operational Expense Types
export interface OperationalExpense {
	id: string;
	category: string;
	description?: string | null;
	amount: number | string;
	expense_date: string;
	date?: string;
}

// Raw Material Types
export interface RawMaterial {
	id: string;
	name: string;
	unit?: string;
	stock?: number;
	current_stock: number;
	stock_level?: number;
	min_stock?: number;
	purchase_unit?: string;
	purchase_qty?: number;
	usage_unit?: string;
	conversion_factor?: number;
	cost_per_unit?: number;
	supplier?: string;
	last_purchase_price?: number;
	is_active?: boolean;
}

// Profit Share Types
export interface ProfitShareData {
	period: string;
	revenue: number;
	total_hpp: number;
	total_opex: number;
	total_depreciation: number;
	net_profit: number;
	owner_share: number;
	cashier_share: number;
}

// Feature Flag Types
export interface FeatureFlag {
	id: string;
	name: string;
	description: string;
	is_enabled: boolean;
}

// User Types
export interface User {
	id: string;
	name: string;
	username?: string;
	role: string;
	is_active: boolean;
	locked_until?: string | null;
	last_login_at?: string | null;
	failed_login_count?: number;
}

// ============================================
// LOCAL TYPES (Dexie/Offline Storage)
// Using snake_case for consistency
// ============================================

export interface LocalProduct {
	id: string;
	name: string;
	base_price: number;
	category_id?: string;
	image_url?: string;
	is_out_of_stock: boolean;
	modifier_groups: ModifierGroup[];
}

export interface LocalOrderItem {
	product_id: string;
	quantity: number;
	price?: number;
	modifiers?: { option_id: string }[];
}

export interface LocalOrder {
	client_uuid: string;
	kasir_id: string;
	subtotal: number;
	tax_total: number;
	final_price: number;
	payment_method: 'cash' | 'qris' | 'split';
	status: string;
	items: LocalOrderItem[];
	sync_status: 'pending' | 'synced';
	created_at: number;
	customer_name?: string;
}

export interface LocalCartItem {
	id: string;
	items: unknown[];
}

// ============================================
// CART TYPES
// ============================================

export type CartItem = LocalProduct & {
	quantity: number;
	cart_item_id: string;
	selected_modifiers: ModifierOption[];
};
