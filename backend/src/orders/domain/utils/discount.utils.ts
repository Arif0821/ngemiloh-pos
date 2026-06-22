import { DiscountType, DiscountScope, Prisma } from '@prisma/client';

/**
 * Interface for discount calculation result
 */
export interface DiscountCalculationResult {
  /** The discount ID that was applied (null if no discount) */
  applied_discount_id: string | null;
  /** The amount of discount per unit */
  discount_amount: number;
}

/**
 * Interface for discount item used in calculations
 */
export interface DiscountItem {
  id: string;
  type: DiscountType;
  value: number | Prisma.Decimal;
  scope: DiscountScope;
  target_id: string | null;
  applicable_days: number[] | null;
}

/**
 * Product context for discount applicability check
 */
export interface ProductContext {
  product_id: string;
  category_id: string;
}

/**
 * Calculate the best applicable discount for a product
 *
 * Checks:
 * 1. applicable_days - validates day of week (1=Monday to 7=Sunday)
 * 2. scope - all_products, specific_product, or category match
 * 3. type - percentage or fixed_amount discount calculation
 *
 * Returns the discount with the highest amount (best for customer)
 */
export function calculate_product_discount(
  basePrice: number,
  activeDiscounts: DiscountItem[],
  product: ProductContext,
): DiscountCalculationResult {
  let maxDiscountAmount = 0;
  let appliedDiscountId: string | null = null;

  if (!activeDiscounts || activeDiscounts.length === 0) {
    return {
      applied_discount_id: null,
      discount_amount: 0,
    };
  }

  for (const disc of activeDiscounts) {
    // Check applicable_days (day of week validation)
    // valid values: 1=Monday, 2=Tuesday, ..., 6=Saturday, 7=Sunday
    // JS Date.getUTCDay(): 0=Sunday, 1=Monday, ..., 6=Saturday
    if (disc.applicable_days && disc.applicable_days.length > 0) {
      const now = new Date();
      const dayOfWeek = now.getUTCDay() || 7; // Convert Sunday (0) to 7 for consistency
      if (!disc.applicable_days.includes(dayOfWeek)) {
        continue;
      }
    }

    // Check scope applicability
    const isApplicable =
      disc.scope === DiscountScope.all_products ||
      (disc.scope === DiscountScope.specific_product &&
        disc.target_id === product.product_id) ||
      (disc.scope === DiscountScope.category &&
        disc.target_id === product.category_id);

    if (!isApplicable) {
      continue;
    }

    // Calculate discount amount based on type
    let currentDiscAmount = 0;
    if (disc.type === DiscountType.percentage) {
      currentDiscAmount = basePrice * (Number(disc.value) / 100);
    } else if (disc.type === DiscountType.fixed_amount) {
      // Fixed amount cannot exceed base price
      currentDiscAmount = Math.min(Number(disc.value), basePrice);
    }

    // Track the best (highest) discount
    if (currentDiscAmount > maxDiscountAmount) {
      maxDiscountAmount = currentDiscAmount;
      appliedDiscountId = disc.id;
    }
  }

  return {
    applied_discount_id: appliedDiscountId,
    discount_amount: maxDiscountAmount,
  };
}
