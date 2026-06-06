import { db, type LocalProduct } from '$lib/db';

export type CartItem = LocalProduct & { quantity: number, cartItemId: string, selectedModifiers: any[] };

export class PosStore {
  // Application State
  isOffline: boolean = $state(false);
  featureFlags: Record<string, boolean> = $state({});
  isCartLoaded = false;
  
  // Products & Cart
  products: LocalProduct[] = $state([]);
  cart: CartItem[] = $state([]);
  
  // Modals & UI Toggles
  showPaymentModal: boolean = $state(false);
  showModifierModal: boolean = $state(false);
  showSuccessModal: boolean = $state(false);
  showHistoryModal: boolean = $state(false);
  showOpenShiftModal = $state(false);
  showCloseShiftModal = $state(false);

  // Shift Logic
  hasOpenShift = $state(true); 
  openingBalance = $state(500000);
  closingBalance = $state(0);
  isCheckingShift = $state(true);

  // Modifier Logic
  selectedProductForModifier: LocalProduct | null = $state(null);
  selectedModifiers: Record<string, any> = $state({});
  modifierTotal: number = $derived(
    Object.values(this.selectedModifiers).reduce((sum, opt: any) => sum + Number(opt.additional_price || 0), 0)
  );

  isAllRequiredModifiersSelected: boolean = $derived.by(() => {
    if (!this.selectedProductForModifier) return false;
    for (const g of this.selectedProductForModifier.modifier_groups) {
      if (g.is_required && !this.selectedModifiers[g.id]) return false;
    }
    return true;
  });

  // Discounts
  activeDiscounts: any[] = $state([]);
  appliedDiscount: any = $state(null);

  // Payment Logic
  paymentMethod: 'cash' | 'qris' | 'split' = $state('cash');
  cashAmount: number = $state(0);
  splitCashAmount: number = $state(0);
  isProcessing: boolean = $state(false);
  
  cartTotalBeforeDiscount = $derived(
    this.cart.reduce((sum, item) => sum + (item.base_price * item.quantity) + (item.selectedModifiers.reduce((s:number, m:any)=>s+Number(m.additional_price), 0) * item.quantity), 0)
  );
  
  discountTotal: number = $derived(
    this.appliedDiscount ? (this.appliedDiscount.type === 'percentage' ? this.cartTotalBeforeDiscount * (Number(this.appliedDiscount.value) / 100) : Number(this.appliedDiscount.value)) : 0
  );
  
  cartTotal: number = $derived(Math.max(0, this.cartTotalBeforeDiscount - this.discountTotal));
  splitQrisAmount: number = $derived(Math.max(0, this.cartTotal - Number(this.splitCashAmount || 0)));
  cashChange: number = $derived(this.paymentMethod === 'cash' ? Number(this.cashAmount || 0) - this.cartTotal : 0);

  // QRIS Waiting State
  isWaitingQris: boolean = $state(false);
  qrisCountdown: number = $state(900); // 15 minutes
  qrisOrderInfo: any = $state(null);
  lastOrderDetails: any = $state(null);
  historyOrders: any[] = $state([]);

  // Methods
  
  getBestDiscountForProduct(product: LocalProduct) {
    if (!this.activeDiscounts || this.activeDiscounts.length === 0) return null;
    
    const today = new Date().getDay() || 7;
    let bestDiscount = null;
    let maxAmount = 0;
    
    for (const d of this.activeDiscounts) {
      if (!d.applicable_days || d.applicable_days.includes(today)) {
        if (d.scope === 'all_products' || (d.scope === 'category' && d.target_id === product.category_id) || (d.scope === 'specific_product' && d.target_id === product.id)) {
          let amt = d.type === 'percentage' ? product.base_price * (Number(d.value) / 100) : Number(d.value);
          if (amt > maxAmount) {
            maxAmount = amt;
            bestDiscount = { ...d, calculatedAmount: amt };
          }
        }
      }
    }
    return bestDiscount;
  }

  formatRp(amount: number) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  }

  addToCart(product: LocalProduct, modifiers: any[]) {
    const modifierSig = modifiers.map(m => m.id).sort().join(',');
    const existing = this.cart.find(item => item.id === product.id && item.selectedModifiers.map((m:any)=>m.id).sort().join(',') === modifierSig);
    
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
