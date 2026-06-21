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

// Dexie Database
export class PosDatabase extends Dexie {
	products!: Table<LocalProduct, string>;
	orders!: Table<LocalOrder, string>;
	cart!: Table<LocalCartItem, string>;
	discounts!: Table<Discount, string>;

	constructor() {
		super('NgemilohPOSDB');
		this.version(4).stores({
			products: 'id, category_id',
			orders: 'client_uuid, sync_status, created_at',
			cart: 'id',
			discounts: 'id, is_active'
		});
	}
}

export const db = new PosDatabase();
