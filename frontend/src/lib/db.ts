import Dexie, { type Table } from 'dexie';

// Re-export types from single source of truth
export type {
	LocalProduct,
	ModifierGroup,
	ModifierOption,
	LocalOrderItem,
	LocalOrder,
	LocalCartItem
} from '$lib/domain/models/types';
import type {
	LocalProduct,
	LocalOrderItem,
	LocalOrder,
	LocalCartItem,
	Discount
} from '$lib/domain/models/types';

// Receipt storage for offline mode
export interface LocalReceipt {
	id: string; // Same as client_uuid
	order_data: LocalOrder;
	receipt_html: string;
	receipt_text: string;
	printed_at?: number;
	print_status: 'pending' | 'printed' | 'failed';
	created_at: number;
}

// Dexie Database
export class PosDatabase extends Dexie {
	products!: Table<LocalProduct, string>;
	orders!: Table<LocalOrder, string>;
	cart!: Table<LocalCartItem, string>;
	discounts!: Table<Discount, string>;
	receipts!: Table<LocalReceipt, string>;

	constructor() {
		super('NgemilohPOSDB');
		this.version(5).stores({
			products: 'id, category_id',
			orders: 'client_uuid, sync_status, created_at',
			cart: 'id',
			discounts: 'id, is_active',
			receipts: 'id, order_data_client_uuid, print_status, created_at'
		});
	}
}

export const db = new PosDatabase();
