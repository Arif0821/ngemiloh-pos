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
  is_required: boolean;
  max_selections: number;
  options: ModifierOption[];
}

export interface ModifierOption {
  id: string;
  name: string;
  additional_price: number | string;
}

export interface Discount {
  id: string;
  name: string;
  type: 'percentage' | 'fixed_amount';
  value: number | string;
  scope: 'all_products' | 'category' | 'specific_product';
  target_id: string | null;
  is_active: boolean;
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

export interface OrderResponse {
  id: string;
  client_uuid: string;
  total_amount: number | string;
  status: string;
  payment_status: string;
  qr_string?: string;
  midtrans_transaction_id?: string;
}

export interface ShiftInfo {
  id: string;
  cashier_id: string;
  shift_date: string;
  opening_balance: number | string;
  status: string;
}

export interface AnalyticsTrend {
  label: string;
  value: number;
}
