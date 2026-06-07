import Dexie, { type Table } from 'dexie';

export interface LocalProduct {
  id: string;
  name: string;
  base_price: number;
  category_id?: string;
  image_url?: string;
  is_out_of_stock: boolean;
  modifier_groups: unknown[];
}

export interface LocalOrder {
  client_uuid: string;
  kasir_id: string;
  subtotal: number;
  tax_total: number;
  final_price: number;
  payment_method: 'cash' | 'qris';
  status: string;
  items: any[];
  sync_status: 'pending' | 'synced';
  created_at: number;
}

export interface LocalCartItem {
  id: string; // just a single record 'current_cart'
  items: unknown[];
}

export class PosDatabase extends Dexie {
  products!: Table<LocalProduct, string>;
  orders!: Table<LocalOrder, string>;
  cart!: Table<LocalCartItem, string>;

  constructor() {
    super('NgemilohPOSDB');
    this.version(2).stores({
      products: 'id, category_id',
      orders: 'client_uuid, sync_status, created_at',
      cart: 'id'
    });
  }
}

export const db = new PosDatabase();
