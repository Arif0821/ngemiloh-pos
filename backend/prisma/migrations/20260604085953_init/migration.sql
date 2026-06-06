-- CreateEnum
CREATE TYPE "Role" AS ENUM ('kasir', 'superadmin');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('percentage', 'fixed_amount');

-- CreateEnum
CREATE TYPE "DiscountScope" AS ENUM ('all_products', 'category', 'specific_product');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'qris', 'split');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('completed', 'voided', 'pending_sync');

-- CreateEnum
CREATE TYPE "RegisterStatus" AS ENUM ('open', 'closed');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "email" VARCHAR(150),
    "pin_hash" VARCHAR(72),
    "password_hash" VARCHAR(72),
    "role" "Role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "must_change_pin" BOOLEAN NOT NULL DEFAULT false,
    "failed_login_count" SMALLINT NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ,
    "last_login_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(50) NOT NULL,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "category_id" UUID NOT NULL,
    "base_price" DECIMAL(12,2) NOT NULL,
    "image_url" VARCHAR(255),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_out_of_stock" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductModifierGroup" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "is_required" BOOLEAN NOT NULL DEFAULT true,
    "max_selections" SMALLINT NOT NULL DEFAULT 1,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ProductModifierGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductModifierOption" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "group_id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "additional_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sort_order" SMALLINT NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ProductModifierOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Discount" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "type" "DiscountType" NOT NULL,
    "value" DECIMAL(10,2) NOT NULL,
    "scope" "DiscountScope" NOT NULL,
    "target_id" UUID,
    "valid_from" TIMESTAMPTZ NOT NULL,
    "valid_until" TIMESTAMPTZ,
    "applicable_days" SMALLINT[],
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" UUID,

    CONSTRAINT "Discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cashier_id" UUID NOT NULL,
    "client_uuid" UUID NOT NULL,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "discount_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payment_method" "PaymentMethod" NOT NULL DEFAULT 'cash',
    "cash_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "qris_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payment_gateway" VARCHAR(20),
    "payment_gateway_ref" VARCHAR(100),
    "payment_status" VARCHAR(30),
    "qris_expiry_at" TIMESTAMPTZ,
    "payment_settled_at" TIMESTAMPTZ,
    "payment_raw_response" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'completed',
    "voided_by" UUID,
    "voided_at" TIMESTAMPTZ,
    "void_reason" TEXT,
    "synced_from_offline" BOOLEAN NOT NULL DEFAULT false,
    "client_created_at" TIMESTAMPTZ NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "product_name_snapshot" VARCHAR(100) NOT NULL,
    "base_price" DECIMAL(12,2) NOT NULL,
    "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount_id" UUID,
    "discounted_base" DECIMAL(12,2) NOT NULL,
    "modifier_total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "final_price" DECIMAL(12,2) NOT NULL,
    "quantity" SMALLINT NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItemModifier" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_item_id" UUID NOT NULL,
    "option_id" UUID NOT NULL,
    "group_name_snapshot" VARCHAR(50) NOT NULL,
    "option_name_snapshot" VARCHAR(100) NOT NULL,
    "additional_price_at_time" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "OrderItemModifier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderRefund" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "refund_method" VARCHAR(30) NOT NULL DEFAULT 'manual_cash',
    "refunded_by" UUID NOT NULL,
    "refunded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "OrderRefund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CashRegister" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cashier_id" UUID NOT NULL,
    "shift_date" DATE NOT NULL,
    "shift_start" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "shift_end" TIMESTAMPTZ,
    "opening_balance" DECIMAL(12,2) NOT NULL DEFAULT 500000,
    "closing_balance" DECIMAL(12,2),
    "system_cash_total" DECIMAL(12,2),
    "discrepancy" DECIMAL(12,2),
    "status" "RegisterStatus" NOT NULL DEFAULT 'open',
    "notes" TEXT,

    CONSTRAINT "CashRegister_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OperationalExpense" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "category" VARCHAR(50) NOT NULL,
    "description" VARCHAR(200),
    "amount" DECIMAL(12,2) NOT NULL,
    "expense_date" DATE NOT NULL,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OperationalExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "purchase_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "useful_life_months" SMALLINT NOT NULL,
    "monthly_depreciation" DECIMAL(12,2) NOT NULL,
    "purchase_date" DATE NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfitShareLog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "period_month" DATE NOT NULL,
    "total_revenue" DECIMAL(14,2) NOT NULL,
    "total_hpp" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_opex" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_depreciation" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "net_profit" DECIMAL(14,2) NOT NULL,
    "owner_share" DECIMAL(14,2) NOT NULL,
    "cashier_share" DECIMAL(14,2) NOT NULL,
    "cashier_paid_amount" DECIMAL(14,2),
    "cashier_paid_at" TIMESTAMPTZ,
    "cashier_paid_by" UUID,
    "is_hpp_actual" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "ProfitShareLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" VARCHAR(100) NOT NULL,
    "value" TEXT NOT NULL,
    "updated_by" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" BIGSERIAL NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(50),
    "entity_id" VARCHAR(100),
    "old_value" JSONB,
    "new_value" JSONB,
    "ip_address" INET,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevokedToken" (
    "jti" VARCHAR(36) NOT NULL,
    "user_id" UUID NOT NULL,
    "expires_at" TIMESTAMPTZ NOT NULL,
    "revoked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RevokedToken_pkey" PRIMARY KEY ("jti")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "Product_category_id_sort_order_idx" ON "Product"("category_id", "sort_order");

-- CreateIndex
CREATE INDEX "ProductModifierGroup_product_id_idx" ON "ProductModifierGroup"("product_id");

-- CreateIndex
CREATE INDEX "ProductModifierOption_group_id_sort_order_idx" ON "ProductModifierOption"("group_id", "sort_order");

-- CreateIndex
CREATE INDEX "Discount_is_active_valid_from_valid_until_idx" ON "Discount"("is_active", "valid_from", "valid_until");

-- CreateIndex
CREATE UNIQUE INDEX "Order_client_uuid_key" ON "Order"("client_uuid");

-- CreateIndex
CREATE INDEX "Order_cashier_id_client_created_at_idx" ON "Order"("cashier_id", "client_created_at" DESC);

-- CreateIndex
CREATE INDEX "Order_client_created_at_idx" ON "Order"("client_created_at" DESC);

-- CreateIndex
CREATE INDEX "Order_status_idx" ON "Order"("status");

-- CreateIndex
CREATE INDEX "Order_payment_method_idx" ON "Order"("payment_method");

-- CreateIndex
CREATE INDEX "OrderItem_order_id_idx" ON "OrderItem"("order_id");

-- CreateIndex
CREATE INDEX "OrderItem_product_id_idx" ON "OrderItem"("product_id");

-- CreateIndex
CREATE INDEX "OrderItem_discount_id_idx" ON "OrderItem"("discount_id");

-- CreateIndex
CREATE INDEX "OrderItemModifier_order_item_id_idx" ON "OrderItemModifier"("order_item_id");

-- CreateIndex
CREATE INDEX "CashRegister_cashier_id_shift_date_idx" ON "CashRegister"("cashier_id", "shift_date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "ProfitShareLog_period_month_key" ON "ProfitShareLog"("period_month");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_name_key" ON "FeatureFlag"("name");

-- CreateIndex
CREATE INDEX "AuditLog_actor_id_created_at_idx" ON "AuditLog"("actor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "AuditLog_action_created_at_idx" ON "AuditLog"("action", "created_at" DESC);

-- CreateIndex
CREATE INDEX "RevokedToken_expires_at_idx" ON "RevokedToken"("expires_at");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModifierGroup" ADD CONSTRAINT "ProductModifierGroup_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductModifierOption" ADD CONSTRAINT "ProductModifierOption_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "ProductModifierGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Discount" ADD CONSTRAINT "Discount_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_voided_by_fkey" FOREIGN KEY ("voided_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_discount_id_fkey" FOREIGN KEY ("discount_id") REFERENCES "Discount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemModifier" ADD CONSTRAINT "OrderItemModifier_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "OrderItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItemModifier" ADD CONSTRAINT "OrderItemModifier_option_id_fkey" FOREIGN KEY ("option_id") REFERENCES "ProductModifierOption"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderRefund" ADD CONSTRAINT "OrderRefund_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderRefund" ADD CONSTRAINT "OrderRefund_refunded_by_fkey" FOREIGN KEY ("refunded_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashRegister" ADD CONSTRAINT "CashRegister_cashier_id_fkey" FOREIGN KEY ("cashier_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OperationalExpense" ADD CONSTRAINT "OperationalExpense_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProfitShareLog" ADD CONSTRAINT "ProfitShareLog_cashier_paid_by_fkey" FOREIGN KEY ("cashier_paid_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeatureFlag" ADD CONSTRAINT "FeatureFlag_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Setting" ADD CONSTRAINT "Setting_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevokedToken" ADD CONSTRAINT "RevokedToken_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
