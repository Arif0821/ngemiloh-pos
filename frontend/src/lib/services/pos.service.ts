import { db, type LocalProduct } from '$lib/db';
import { pos_store } from '../stores/pos.store.svelte';
import { api } from '$lib/services/api.client';
import { toast } from '$lib/stores/toast.store.svelte';
import { goto } from '$app/navigation';
import type {
	ApiResponse,
	Discount,
	OrderResponse,
	CreateOrderPayload,
	ShiftInfo
} from '../domain/models/types';

// ============================================
// POS SERVICE - Business Logic Layer
// Using snake_case naming convention
// ============================================

export class PosService {
	async fetch_flags() {
		try {
			const res = await api.get(`/flags`);
			if (res.ok) {
				const json: ApiResponse<any> = await res.json();
				pos_store.feature_flags = json.data;
			} else {
				console.warn('Failed to fetch feature flags:', res.status);
			}
		} catch (e) {
			console.warn('Failed to fetch feature flags (offline or network error)');
		}
	}

	async check_shift() {
		pos_store.is_checking_shift = true;
		try {
			const res = await api.get(`/cash/current`);
			if (res.ok) {
				const json: ApiResponse<ShiftInfo | null> = await res.json();
				pos_store.has_open_shift = !!json.data;
			} else if (res.status === 401) {
				pos_store.has_open_shift = false;
			} else {
				console.warn('Failed to check shift:', res.status);
				pos_store.has_open_shift = false;
			}
		} catch (e) {
			console.warn('Failed to check shift (offline or network error)');
			pos_store.has_open_shift = false;
		} finally {
			pos_store.is_checking_shift = false;
		}
	}

	async handle_open_shift(opening_balance: number) {
		try {
			const res = await api.post(`/cash/open`, { opening_balance });
			if (res.ok) {
				pos_store.has_open_shift = true;
				toast.success('Shift berhasil dibuka');
				return true;
			} else {
				const json = await res.json();
				toast.error('Gagal buka shift: ' + (json.message || 'Unknown error'));
				return false;
			}
		} catch (e) {
			toast.error('Error: Tidak dapat terhubung ke server');
			return false;
		}
	}

	async handle_close_shift(closing_balance: number) {
		try {
			const res = await api.post(`/cash/close`, { closing_balance });
			if (res.ok) {
				pos_store.has_open_shift = false;
				pos_store.show_close_shift_modal = false;
				toast.success('Shift berhasil ditutup');
				return true;
			} else {
				const json = await res.json();
				toast.error('Gagal tutup shift: ' + (json.message || 'Unknown error'));
				return false;
			}
		} catch (e) {
			toast.error('Error: Tidak dapat terhubung ke server');
			return false;
		}
	}

	async load_products_from_db() {
		try {
			pos_store.products = await db.products.toArray();
		} catch (e) {
			console.error('Failed to load products from local DB:', e);
			toast.error('Gagal memuat data produk lokal');
		}
	}

	async fetch_products_from_api() {
		try {
			const res = await api.get(`/products?include_modifiers=true`);
			if (res.ok) {
				const json = await res.json();
				if (json.success) {
					await db.products.clear();
					await db.products.bulkAdd(json.data);
					await this.load_products_from_db();
				}
			} else if (res.status === 401) {
				goto('/login');
			} else {
				console.warn('Failed to fetch products:', res.status);
				toast.warning('Gagal memuat produk dari server');
			}
		} catch (e) {
			console.warn('Failed to fetch products (offline or network error)');
			await this.load_products_from_db();
		}
	}

	async fetch_discounts() {
		try {
			const res = await api.get(`/admin/discounts`);
			if (res.ok) {
				const json: ApiResponse<Discount[]> = await res.json();
				if (json.success) {
					pos_store.active_discounts = json.data.filter((d) => d.is_active);
				}
			} else {
				console.warn('Failed to fetch discounts:', res.status);
			}
		} catch (e) {
			console.warn('Failed to fetch discounts (offline or network error)');
		}
	}

	async fetch_history() {
		try {
			const res = await api.get(`/orders`);
			if (res.ok) {
				const json = await res.json();
				if (json.success) pos_store.history_orders = json.data;
			} else if (res.status === 401) {
				goto('/login');
			} else {
				console.warn('Failed to fetch history:', res.status);
				toast.warning('Gagal memuat riwayat transaksi');
			}
		} catch (e) {
			console.warn('Failed to fetch history (offline or network error)');
			toast.warning('Tidak dapat memuat riwayat (mode offline)');
		}
	}

	async sync_pending_orders() {
		const pending = await db.orders.where('sync_status').equals('pending').toArray();
		if (pending.length === 0) return;

		try {
			const payload = {
				orders: pending.map((order) => ({
					client_uuid: order.client_uuid,
					payment_method: order.payment_method,
					client_final_price: order.final_price,
					items: order.items,
					customer_name: order.customer_name
				}))
			};

			const res = await api.post(`/orders/sync-batch`, payload);

			if (res.ok) {
				const json = await res.json();
				if (json.success && json.data) {
					for (const result of json.data) {
						if (result.status === 'success') {
							await db.orders.update(result.client_uuid, { sync_status: 'synced' });
						}
					}
					const synced_count = json.data.filter((r: any) => r.status === 'success').length;
					if (synced_count > 0) {
						toast.success(`${synced_count} pesanan berhasil di-sync`);
					}
				}
			} else {
				console.warn('Batch sync failed:', res.status);
				toast.error('Gagal sync pesanan offline');
			}
		} catch (e) {
			console.warn('Batch sync failed (network error)');
			toast.error('Gagal sync pesanan offline');
		}
	}

	// Polling states (using snake_case)
	qris_timer: ReturnType<typeof setInterval> | null = null;
	polling_interval: ReturnType<typeof setInterval> | null = null;
	sse_event_source: EventSource | null = null;
	private is_order_completed = false;
	private qris_start_time: number = 0;
	private qris_total_seconds: number = 900;

	start_qris_waiting(order_data: OrderResponse, on_success: () => void) {
		pos_store.is_waiting_qris = true;
		pos_store.show_payment_modal = false;
		pos_store.qris_order_info = order_data;
		this.qris_start_time = Date.now();
		this.qris_total_seconds = 900;
		pos_store.qris_countdown = this.qris_total_seconds;
		this.is_order_completed = false;

		if (this.qris_timer) clearInterval(this.qris_timer);
		// Use timestamp-based countdown that doesn't pause when tab is hidden
		this.qris_timer = setInterval(() => {
			const elapsed = Math.floor((Date.now() - this.qris_start_time) / 1000);
			pos_store.qris_countdown = Math.max(0, this.qris_total_seconds - elapsed);
			if (pos_store.qris_countdown <= 0) {
				this.cancel_qris_waiting();
				toast.warning('Waktu pembayaran QRIS habis');
			}
		}, 1000);

		this.sse_event_source = new EventSource(`/api/v1/orders/${order_data.id}/sse`, {
			withCredentials: true
		});
		this.sse_event_source.onmessage = (event) => {
			if (this.is_order_completed) return;
			try {
				const data = JSON.parse(event.data);
				if (data.status === 'completed') {
					this.is_order_completed = true;
					on_success();
				}
			} catch (e) {
				console.warn('Failed to parse SSE message:', e);
			}
		};

		this.sse_event_source.onerror = () => {
			console.warn('SSE connection error, relying on polling');
			this.sse_event_source?.close();
			this.sse_event_source = null;
		};

		if (this.polling_interval) clearInterval(this.polling_interval);
		this.polling_interval = setInterval(async () => {
			if (this.is_order_completed) return;
			try {
				const res = await api.get(`/orders/${order_data.id}/status`);
				if (res.ok) {
					const json = await res.json();
					if (json.data?.status === 'completed') {
						this.is_order_completed = true;
						on_success();
					}
				}
			} catch (e) {
				console.warn('Polling error', e);
			}
		}, 5000);
	}

	cancel_qris_waiting() {
		pos_store.is_waiting_qris = false;
		this.is_order_completed = false;
		if (this.qris_timer) clearInterval(this.qris_timer);
		if (this.polling_interval) clearInterval(this.polling_interval);
		if (this.sse_event_source) {
			this.sse_event_source.close();
			this.sse_event_source = null;
		}
	}

	async process_payment(
		on_qris_wait: (data: OrderResponse) => void,
		on_success: (data: OrderResponse) => void
	) {
		if (pos_store.cart.length === 0 || pos_store.is_processing) return;
		// Guard: split payment requires cash < total (QRIS needed)
		if (
			pos_store.payment_method === 'split' &&
			pos_store.split_cash_amount >= pos_store.cart_total
		) {
			toast.error('Uang tunai harus kurang dari total untuk split payment');
			pos_store.is_processing = false;
			return;
		}
		pos_store.is_processing = true;

		const client_uuid = crypto.randomUUID();
		const payload = {
			client_uuid,
			payment_method: pos_store.payment_method,
			client_final_price: pos_store.cart_total,
			discount_total: pos_store.discount_total,
			discount_id: pos_store.applied_discount?.id,
			cash_amount:
				pos_store.payment_method === 'cash'
					? Number(pos_store.cash_amount)
					: pos_store.payment_method === 'split'
						? Number(pos_store.split_cash_amount)
						: 0,
			qris_amount:
				pos_store.payment_method === 'qris'
					? pos_store.cart_total
					: pos_store.payment_method === 'split'
						? pos_store.split_qris_amount
						: 0,
			items: pos_store.cart.map((c) => ({
				product_id: c.id,
				quantity: c.quantity,
				modifiers: c.selected_modifiers.map((m: any) => ({ option_id: m.id }))
			}))
		} as CreateOrderPayload;

		try {
			if (pos_store.is_offline) {
				if (pos_store.payment_method === 'qris' || pos_store.payment_method === 'split') {
					toast.error('QRIS tidak dapat diproses saat offline. Gunakan pembayaran tunai.');
					pos_store.is_processing = false;
					return;
				}

				await db.orders.add({
					client_uuid,
					kasir_id: 'offline',
					subtotal: pos_store.cart_total,
					tax_total: 0,
					final_price: pos_store.cart_total,
					payment_method: pos_store.payment_method,
					status: 'pending',
					items: payload.items,
					sync_status: 'pending',
					created_at: Date.now()
				});
				toast.success('Offline: Pesanan disimpan dan akan di-sync nanti');
				pos_store.reset_cart();
			} else {
				const res = await api.post(`/orders`, payload);

				if (res.ok) {
					const json: ApiResponse<OrderResponse> = await res.json();
					if (pos_store.payment_method === 'qris' || pos_store.payment_method === 'split') {
						on_qris_wait(json.data);
					} else {
						on_success(json.data);
					}
				} else if (res.status === 401) {
					goto('/login');
				} else {
					const err_data = await res.json();
					toast.error('Gagal: ' + (err_data.message || 'Server Error'));
				}
			}
		} catch (err) {
			console.error('Payment error:', err);
			toast.error('Gagal memproses transaksi. Cek koneksi Anda.');
		} finally {
			pos_store.is_processing = false;
		}
	}
}

export const pos_service = new PosService();
