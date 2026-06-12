import { db, type LocalProduct } from '$lib/db';
import { posStore } from '../stores/pos.store.svelte';
import { api } from '$lib/services/api.client';
import { toast } from '$lib/stores/toast.store.svelte';
import type {
	ApiResponse,
	Discount,
	OrderResponse,
	CreateOrderPayload,
	ShiftInfo
} from '../domain/models/types';

export class PosService {
	async fetchFlags() {
		try {
			const res = await api.get(`/flags`);
			if (res.ok) {
				const json: ApiResponse<any> = await res.json();
				posStore.featureFlags = json.data;
			} else {
				console.warn('Failed to fetch feature flags:', res.status);
				// Don't alert user - flags are optional
			}
		} catch (e) {
			console.warn('Failed to fetch feature flags (offline or network error)');
			// Silent failure is acceptable for flags
		}
	}

	async checkShift() {
		posStore.isCheckingShift = true;
		try {
			const res = await api.get(`/cash/current`);
			if (res.ok) {
				const json: ApiResponse<ShiftInfo | null> = await res.json();
				posStore.hasOpenShift = !!json.data;
			} else if (res.status === 401) {
				// Redirect to login handled by api client
				posStore.hasOpenShift = false;
			} else {
				console.warn('Failed to check shift:', res.status);
				posStore.hasOpenShift = false;
			}
		} catch (e) {
			console.warn('Failed to check shift (offline or network error)');
			posStore.hasOpenShift = false;
		} finally {
			posStore.isCheckingShift = false;
		}
	}

	async handleOpenShift(openingBalance: number) {
		try {
			const res = await api.post(`/cash/open`, { opening_balance: openingBalance });
			if (res.ok) {
				posStore.hasOpenShift = true;
				posStore.showOpenShiftModal = false;
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

	async handleCloseShift(closingBalance: number) {
		try {
			const res = await api.post(`/cash/close`, { closing_balance: closingBalance });
			if (res.ok) {
				posStore.hasOpenShift = false;
				posStore.showCloseShiftModal = false;
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

	async loadProductsFromDb() {
		try {
			posStore.products = await db.products.toArray();
		} catch (e) {
			console.error('Failed to load products from local DB:', e);
			toast.error('Gagal memuat data produk lokal');
		}
	}

	async fetchProductsFromApi() {
		try {
			const res = await api.get(`/products?include_modifiers=true`);
			if (res.ok) {
				const json = await res.json();
				if (json.success) {
					await db.products.clear();
					await db.products.bulkAdd(json.data);
					await this.loadProductsFromDb();
				}
			} else if (res.status === 401) {
				window.location.href = '/login';
			} else {
				console.warn('Failed to fetch products:', res.status);
				toast.warning('Gagal memuat produk dari server');
			}
		} catch (e) {
			console.warn('Failed to fetch products (offline or network error)');
			// Products will load from local DB instead
			await this.loadProductsFromDb();
		}
	}

	async fetchDiscounts() {
		try {
			const res = await api.get(`/admin/discounts`);
			if (res.ok) {
				const json: ApiResponse<Discount[]> = await res.json();
				if (json.success) {
					posStore.activeDiscounts = json.data.filter((d) => d.is_active);
				}
			} else {
				console.warn('Failed to fetch discounts:', res.status);
				// Silent - discounts are optional
			}
		} catch (e) {
			console.warn('Failed to fetch discounts (offline or network error)');
			// Silent - discounts are optional
		}
	}

	async fetchHistory() {
		try {
			const res = await api.get(`/orders`);
			if (res.ok) {
				const json = await res.json();
				if (json.success) posStore.historyOrders = json.data;
			} else if (res.status === 401) {
				window.location.href = '/login';
			} else {
				console.warn('Failed to fetch history:', res.status);
				toast.warning('Gagal memuat riwayat transaksi');
			}
		} catch (e) {
			console.warn('Failed to fetch history (offline or network error)');
			toast.warning('Tidak dapat memuat riwayat (mode offline)');
		}
	}

	async syncPendingOrders() {
		const pending = await db.orders.where('sync_status').equals('pending').toArray();
		if (pending.length === 0) return;

		try {
			const payload = {
				orders: pending.map((order) => ({
					client_uuid: order.client_uuid,
					payment_method: order.payment_method,
					client_final_price: order.final_price,
					items: order.items
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
					const syncedCount = json.data.filter((r: any) => r.status === 'success').length;
					if (syncedCount > 0) {
						toast.success(`${syncedCount} pesanan berhasil di-sync`);
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

	// Polling states
	qrisTimer: ReturnType<typeof setInterval> | null = null;
	pollingInterval: ReturnType<typeof setInterval> | null = null;
	sseEventSource: EventSource | null = null;
	private isOrderCompleted = false;
	private qrisStartTime: number = 0;
	private qrisTotalSeconds: number = 900;

	startQrisWaiting(orderData: OrderResponse, onSuccess: () => void) {
		posStore.isWaitingQris = true;
		posStore.showPaymentModal = false;
		posStore.qrisOrderInfo = orderData;
		this.qrisStartTime = Date.now();
		this.qrisTotalSeconds = 900;
		posStore.qrisCountdown = this.qrisTotalSeconds;
		this.isOrderCompleted = false;

		if (this.qrisTimer) clearInterval(this.qrisTimer);
		// P2-PERF: Use timestamp-based countdown that doesn't pause when tab is hidden
		this.qrisTimer = setInterval(() => {
			const elapsed = Math.floor((Date.now() - this.qrisStartTime) / 1000);
			posStore.qrisCountdown = Math.max(0, this.qrisTotalSeconds - elapsed);
			if (posStore.qrisCountdown <= 0) {
				this.cancelQrisWaiting();
				toast.warning('Waktu pembayaran QRIS habis');
			}
		}, 1000);

		this.sseEventSource = new EventSource(`/api/v1/orders/${orderData.id}/sse`, {
			withCredentials: true
		});
		this.sseEventSource.onmessage = (event) => {
			// P2-PERF: Prevent double execution from SSE + polling race condition
			if (this.isOrderCompleted) return;
			try {
				const data = JSON.parse(event.data);
				if (data.status === 'completed') {
					this.isOrderCompleted = true;
					onSuccess();
				}
			} catch (e) {
				console.warn('Failed to parse SSE message:', e);
			}
		};

		// P2-PERF: Handle SSE errors - close and rely on polling
		this.sseEventSource.onerror = () => {
			console.warn('SSE connection error, relying on polling');
			this.sseEventSource?.close();
			this.sseEventSource = null;
			// Don't call cancelQrisWaiting - let polling continue
		};

		if (this.pollingInterval) clearInterval(this.pollingInterval);
		this.pollingInterval = setInterval(async () => {
			// HIGH: Prevent double execution from SSE + polling race condition
			if (this.isOrderCompleted) return;
			try {
				const res = await api.get(`/orders/${orderData.id}/status`);
				if (res.ok) {
					const json = await res.json();
					if (json.data?.status === 'completed') {
						this.isOrderCompleted = true;
						onSuccess();
					}
				}
			} catch (e) {
				console.warn('Polling error', e);
			}
		}, 5000);
	}

	cancelQrisWaiting() {
		posStore.isWaitingQris = false;
		this.isOrderCompleted = false;
		if (this.qrisTimer) clearInterval(this.qrisTimer);
		if (this.pollingInterval) clearInterval(this.pollingInterval);
		if (this.sseEventSource) {
			this.sseEventSource.close();
			this.sseEventSource = null;
		}
	}

	async processPayment(
		onQrisWait: (data: OrderResponse) => void,
		onSuccess: (data: OrderResponse) => void
	) {
		if (posStore.cart.length === 0 || posStore.isProcessing) return;
		posStore.isProcessing = true;

		const clientUuid = crypto.randomUUID();
		const payload = {
			client_uuid: clientUuid,
			payment_method: posStore.paymentMethod,
			client_final_price: posStore.cartTotal,
			discount_total: posStore.discountTotal,
			discount_id: posStore.appliedDiscount?.id,
			cash_amount:
				posStore.paymentMethod === 'cash'
					? Number(posStore.cashAmount)
					: posStore.paymentMethod === 'split'
						? Number(posStore.splitCashAmount)
						: 0,
			qris_amount:
				posStore.paymentMethod === 'qris'
					? posStore.cartTotal
					: posStore.paymentMethod === 'split'
						? posStore.splitQrisAmount
						: 0,
			items: posStore.cart.map((c) => ({
				product_id: c.id,
				quantity: c.quantity,
				modifiers: c.selectedModifiers.map((m: any) => ({ option_id: m.id }))
			}))
		} as CreateOrderPayload;

		try {
			if (posStore.isOffline) {
				if (posStore.paymentMethod === 'qris' || posStore.paymentMethod === 'split') {
					toast.error('QRIS tidak dapat diproses saat offline. Gunakan pembayaran tunai.');
					posStore.isProcessing = false;
					return;
				}

				await db.orders.add({
					client_uuid: clientUuid,
					kasir_id: 'offline',
					subtotal: posStore.cartTotal,
					tax_total: 0,
					final_price: posStore.cartTotal,
					payment_method: posStore.paymentMethod,
					status: 'pending',
					items: payload.items,
					sync_status: 'pending',
					created_at: Date.now()
				});
				toast.success('Offline: Pesanan disimpan dan akan di-sync nanti');
				posStore.resetCart();
			} else {
				const res = await api.post(`/orders`, payload);

				if (res.ok) {
					const json: ApiResponse<OrderResponse> = await res.json();
					if (posStore.paymentMethod === 'qris' || posStore.paymentMethod === 'split') {
						onQrisWait(json.data);
					} else {
						onSuccess(json.data);
					}
				} else if (res.status === 401) {
					window.location.href = '/login';
				} else {
					const errData = await res.json();
					toast.error('Gagal: ' + (errData.message || 'Server Error'));
				}
			}
		} catch (err) {
			console.error('Payment error:', err);
			toast.error('Gagal memproses transaksi. Cek koneksi Anda.');
		} finally {
			posStore.isProcessing = false;
		}
	}
}

export const posService = new PosService();
