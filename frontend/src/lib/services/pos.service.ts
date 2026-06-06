import { db, type LocalProduct } from '$lib/db';
import { posStore } from '../stores/pos.store.svelte';

export class PosService {
  async fetchFlags() {
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/v1/flags`);
      if (res.ok) {
        const json = await res.json();
        posStore.featureFlags = json.data;
      }
    } catch (e) {}
  }

  async checkShift() {
    posStore.isCheckingShift = true;
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/v1/cash/current`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        posStore.hasOpenShift = !!json.data;
      }
    } catch (e) {
      console.error('Failed to check shift', e);
    } finally {
      posStore.isCheckingShift = false;
    }
  }

  async handleOpenShift(openingBalance: number) {
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/v1/cash/open`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ opening_balance: openingBalance })
      });
      if (res.ok) {
        posStore.hasOpenShift = true;
        posStore.showOpenShiftModal = false;
        return true;
      } else {
        const json = await res.json();
        alert('Gagal buka shift: ' + json.message);
        return false;
      }
    } catch (e) {
      alert('Error buka shift');
      return false;
    }
  }

  async handleCloseShift(closingBalance: number) {
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/v1/cash/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ closing_balance: closingBalance })
      });
      if (res.ok) {
        posStore.hasOpenShift = false;
        posStore.showCloseShiftModal = false;
        alert('Shift berhasil ditutup.');
        return true;
      } else {
        const json = await res.json();
        alert('Gagal tutup shift: ' + json.message);
        return false;
      }
    } catch (e) {
      alert('Error tutup shift');
      return false;
    }
  }

  async loadProductsFromDb() {
    posStore.products = await db.products.toArray();
  }

  async fetchProductsFromApi() {
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/v1/products?include_modifiers=true`, {
        credentials: 'include'
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          await db.products.clear();
          await db.products.bulkAdd(json.data);
          await this.loadProductsFromDb();
        }
      } else if (res.status === 401) {
        window.location.href = '/login';
      }
    } catch (e) {
      console.error('Failed to sync products', e);
    }
  }

  async fetchDiscounts() {
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/v1/admin/discounts`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        if (json.success) {
          posStore.activeDiscounts = json.data.filter((d: any) => d.is_active);
        }
      }
    } catch (e) {
      console.error('Failed to fetch discounts');
    }
  }

  async fetchHistory() {
    try {
      const res = await fetch(`http://${window.location.hostname}:3000/api/v1/orders`, { credentials: 'include' });
      if (res.ok) {
        const json = await res.json();
        if (json.success) posStore.historyOrders = json.data;
      }
    } catch (e) {
      console.error('Failed to fetch history', e);
    }
  }

  async syncPendingOrders() {
    const pending = await db.orders.where('sync_status').equals('pending').toArray();
    for (const order of pending) {
      try {
        const res = await fetch(`http://${window.location.hostname}:3000/api/v1/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            client_uuid: order.client_uuid,
            payment_method: order.payment_method,
            order_type: 'dine_in',
            client_final_price: order.final_price,
            items: order.items
          })
        });
        if (res.ok) {
          await db.orders.update(order.client_uuid, { sync_status: 'synced' });
        }
      } catch (e) {
        console.error('Sync failed for order ' + order.client_uuid, e);
      }
    }
  }

  // Polling states
  qrisTimer: any;
  pollingInterval: any;
  sseEventSource: EventSource | null = null;

  startQrisWaiting(orderData: any, onSuccess: () => void) {
    posStore.isWaitingQris = true;
    posStore.showPaymentModal = false;
    posStore.qrisOrderInfo = orderData;
    posStore.qrisCountdown = 900;
    
    clearInterval(this.qrisTimer);
    this.qrisTimer = setInterval(() => {
      posStore.qrisCountdown--;
      if (posStore.qrisCountdown <= 0) {
        this.cancelQrisWaiting();
        alert('Waktu pembayaran QRIS habis.');
      }
    }, 1000);

    this.sseEventSource = new EventSource(`http://${window.location.hostname}:3000/api/v1/orders/${orderData.id}/sse`);
    this.sseEventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.status === 'completed') {
        onSuccess();
      }
    };

    clearInterval(this.pollingInterval);
    this.pollingInterval = setInterval(async () => {
      try {
        const res = await fetch(`http://${window.location.hostname}:3000/api/v1/orders/${orderData.id}/status`);
        if (res.ok) {
          const json = await res.json();
          if (json.data?.status === 'completed') {
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
    clearInterval(this.qrisTimer);
    clearInterval(this.pollingInterval);
    if (this.sseEventSource) {
      this.sseEventSource.close();
      this.sseEventSource = null;
    }
  }

  async processPayment(onQrisWait: (data: any) => void, onSuccess: (data: any) => void) {
    if (posStore.cart.length === 0 || posStore.isProcessing) return;
    posStore.isProcessing = true;
    
    const clientUuid = crypto.randomUUID();
    const payload = {
      client_uuid: clientUuid,
      payment_method: posStore.paymentMethod,
      order_type: 'dine_in',
      client_final_price: posStore.cartTotal,
      discount_total: posStore.discountTotal,
      discount_id: posStore.appliedDiscount?.id,
      cash_amount: posStore.paymentMethod === 'cash' ? Number(posStore.cashAmount) : (posStore.paymentMethod === 'split' ? Number(posStore.splitCashAmount) : 0),
      qris_amount: posStore.paymentMethod === 'qris' ? posStore.cartTotal : (posStore.paymentMethod === 'split' ? posStore.splitQrisAmount : 0),
      items: posStore.cart.map(c => ({
        product_id: c.id,
        quantity: c.quantity,
        modifiers: c.selectedModifiers.map((m:any) => ({ option_id: m.id }))
      }))
    };

    try {
      if (posStore.isOffline) {
        if (posStore.paymentMethod === 'qris' || posStore.paymentMethod === 'split') {
          alert('QRIS tidak dapat diproses saat sistem offline. Mohon arahkan ke pembayaran tunai.');
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
        alert('Offline: Pesanan disimpan ke perangkat.');
        posStore.resetCart();
      } else {
        const res = await fetch(`http://${window.location.hostname}:3000/api/v1/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(payload)
        });
        
        if (res.ok) {
          const json = await res.json();
          if (posStore.paymentMethod === 'qris' || posStore.paymentMethod === 'split') {
            onQrisWait(json.data);
          } else {
            onSuccess(json.data);
          }
        } else if (res.status === 401) {
          window.location.href = '/login';
        } else {
          const errData = await res.json();
          alert('Gagal: ' + (errData.message || 'Server Error'));
        }
      }
    } catch (err) {
      console.error(err);
      alert('Gagal memproses transaksi. Cek koneksi Anda.');
    } finally {
      posStore.isProcessing = false;
    }
  }
}

export const posService = new PosService();
