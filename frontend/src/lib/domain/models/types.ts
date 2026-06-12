export interface ApiResponse<T> {
	success: boolean;
	data: T;
	message?: string;
}

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
}

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
	qr_string?: string;
	midtrans_transaction_id?: string;
	items?: OrderItemResponse[];
	cashier?: { id: string; name: string };
	void_reason?: string;
	voider?: string;
	client_created_at?: string;
	created_at?: string;
	verification_status?: string;
}

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

export interface AnalyticsTrend {
	label: string;
	value: number;
}

export interface AnalyticsResponse {
	trend: AnalyticsTrend[];
	topProducts: {
		byQty: { name: string; qty: number; revenue: number }[];
		byRevenue: { name: string; qty: number; revenue: number }[];
	};
	paymentDistribution: {
		counts: { cash: number; qris: number; split: number };
		values: { cash: number; qris: number; split: number };
	};
	peakHours: { hour: number; count: number }[];
}

export interface Asset {
	id: string;
	name: string;
	purchase_price: number | string;
	value?: number | string; // alias for purchase_price
	useful_life_months: number;
	lifespan_months?: number; // alias for useful_life_months
	monthly_depreciation: number | string;
	purchase_date: string;
	is_active: boolean;
}

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

export interface OperationalExpense {
	id: string;
	category: string;
	description?: string | null; // name shown from description
	amount: number | string;
	expense_date: string; // date alias
	date?: string;
}

export interface RawMaterial {
	id: string;
	name: string;
	unit?: string;
	stock?: number; // alias for current_stock used in inventory page
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

export interface ProfitShareData {
	period: string;
	revenue: number;
	totalHpp: number;
	totalOpex: number;
	totalDepreciation: number;
	netProfit: number;
	ownerShare: number;
	cashierShare: number;
}

export interface FeatureFlag {
	id: string;
	name: string;
	description: string;
	is_enabled: boolean;
}

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

// Re-export LocalProduct from db.ts for backward compatibility
export type { LocalProduct } from '$lib/db';
