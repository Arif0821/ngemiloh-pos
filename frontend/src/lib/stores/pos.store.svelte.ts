import { db, type LocalProduct } from '$lib/db';
import type { Discount, OrderResponse, ModifierOption } from '../domain/models/types';
import { DEFAULT_OPENING_BALANCE, QRIS_COUNTDOWN_SECONDS, formatRp } from '../utils/format';

export type CartItem = LocalProduct & { quantity: number, cartItemId: string, selectedModifiers: ModifierOption[] };

export class PosStore {
  // Application State
  isOffline: boolean = $state(false);
  featureFlags: Record<string, boolean> = $state({});

  // Products & Cart
  products: LocalProduct[] = $state([]);
  cart: CartItem[] = $state([]);
  isCartLoaded: boolean = $state(false);

  // Modals & UI Toggles
  showPaymentModal: boolean = $state(false);
  showModifierModal: boolean = $state(false);
  showSuccessModal: boolean = $state(false);
  showHistoryModal: boolean = $state(false);
  showOpenShiftModal = $state(false);
  showCloseShiftModal = $state(false);

  // Shift Logic
  hasOpenShift = $state(true);
  openingBalance = $state(DEFAULT_OPENING_BALANCE);
  closingBalance = $state(0);
  isCheckingShift = $state(true);

  // Modifier Logic
  selectedProductForModifier: LocalProduct | null = $state(null);
  selectedModifiers: Record<string, ModifierOption> = $state({});
  modifierTotal: number = $derived(
    Object.values(this.selectedModifiers).reduce((sum, opt) => sum + Number(opt.additional_price || 0), 0)
  );

  isAllRequiredModifiersSelected: boolean = $derived.by(() => {
    if (!this.selectedProductForModifier) return false;
    for (const g of this.selectedProductForModifier.modifier_groups) {
      if (g.is_required === true && !this.selectedModifiers[g.id]) return false;
    }
    return true;
  });

  // Discounts
  activeDiscounts: Discount[] = $state([]);
  appliedDiscount: Discount | null = $state(null);

  // Payment Logic
  paymentMethod: 'cash' | 'qris' | 'split' = $state('cash');
  cashAmount: number = $state(0);
  splitCashAmount: number = $state(0);
  isProcessing: boolean = $state(false);
  
  cartTotalBeforeDiscount = $derived(
    this.cart.reduce((sum, item) => sum + (item.base_price * item.quantity) + (item.selectedModifiers.reduce((s:number, m:ModifierOption)=>s+Number(m.additional_price), 0) * item.quantity), 0)
  );
  
  discountTotal: number = $derived(
    this.cart.reduce((sum, item) => {
      const discount = this.getBestDiscountForProduct(item);
      if (!discount) return sum;
      // TINGGI-04: Discount only applies to base_price, NOT modifier total (matching backend logic)
      const baseTotal = Number(item.base_price) * item.quantity;
      return sum + (discount.type === 'percentage' ? baseTotal * (Number(discount.value) / 100) : Number(discount.value) * item.quantity);
    }, 0)
  );
  
  cartTotal: number = $derived(Math.max(0, this.cartTotalBeforeDiscount - this.discountTotal));
  splitQrisAmount: number = $derived(Math.max(0, this.cartTotal - Number(this.splitCashAmount || 0)));
  cashChange: number = $derived(this.paymentMethod === 'cash' ? Number(this.cashAmount || 0) - this.cartTotal : 0);

  // QRIS Waiting State
  isWaitingQris: boolean = $state(false);
  qrisCountdown: number = $state(QRIS_COUNTDOWN_SECONDS); // 15 minutes
  qrisOrderInfo: OrderResponse | null = $state(null);
  lastOrderDetails: OrderResponse | null = $state(null);
  historyOrders: OrderResponse[] = $state([]);

  // Methods
  
  getBestDiscountForProduct(product: LocalProduct) {
    if (!this.activeDiscounts || this.activeDiscounts.length === 0) return null;

    const today = new Date().getDay() || 7;
    let bestDiscount = null;
    let maxAmount = 0;

    for (const d of this.activeDiscounts) {
      if (!d.applicable_days || d.applicable_days.includes(today)) {
        if (d.scope === 'all_products' || (d.scope === 'category' && d.target_id === product.category_id) || (d.scope === 'specific_product' && d.target_id === product.id)) {
          // TINGGI-04: Discount only applies to base_price (matching backend logic)
          let amt = d.type === 'percentage' ? Number(product.base_price) * (Number(d.value) / 100) : Number(d.value);
          if (amt > maxAmount) {
            maxAmount = amt;
            bestDiscount = { ...d, calculatedAmount: amt };
          }
        }
      }
    }
    return bestDiscount;
  }

  formatRp = formatRp;

  addToCart(product: LocalProduct, modifiers: ModifierOption[]) {
    const modifierSig = modifiers.map(m => m.id).sort().join(',');
    const existing = this.cart.find(item => item.id === product.id && item.selectedModifiers.map(m=>m.id).sort().join(',') === modifierSig);
    
    if (existing) {
      existing.quantity++;
    } else {
      this.cart.push({ ...product, quantity: 1, cartItemId: crypto.randomUUID(), selectedModifiers: [...modifiers] });
    }
    this.showModifierModal = false;
  }

  updateQuantity(cartItemId: string, delta: number) {
    const item = this.cart.find(item => item.cartItemId === cartItemId);
    if (item) {
      if (item.quantity + delta < 0) return;
      item.quantity += delta;
      if (item.quantity <= 0) {
        this.removeFromCart(cartItemId);
      }
    }
  }

  removeFromCart(cartItemId: string) {
    this.cart = this.cart.filter(item => item.cartItemId !== cartItemId);
  }

  resetCart() {
    this.showPaymentModal = false;
    this.cart = [];
    this.cashAmount = 0;
    this.splitCashAmount = 0;
    this.appliedDiscount = null;
  }

  resetPos() {
    this.cart = [];
    db.cart.clear();
    this.paymentMethod = 'cash';
    this.cashAmount = 0;
    this.splitCashAmount = 0;
    this.appliedDiscount = null;
    this.showSuccessModal = false;
    this.lastOrderDetails = null;
  }
}

export const posStore = new PosStore();
