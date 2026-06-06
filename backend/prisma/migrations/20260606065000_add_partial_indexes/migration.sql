-- Users
CREATE INDEX IF NOT EXISTS "idx_users_role" ON "User"("role") WHERE "is_active" = true;

-- Products
CREATE INDEX IF NOT EXISTS "idx_products_category_active" ON "Product"("category_id", "sort_order") WHERE "is_active" = true;

-- Modifier Groups & Options
CREATE INDEX IF NOT EXISTS "idx_modifier_groups_product" ON "ProductModifierGroup"("product_id") WHERE "is_active" = true;
CREATE INDEX IF NOT EXISTS "idx_modifier_options_group" ON "ProductModifierOption"("group_id", "sort_order") WHERE "is_active" = true;

-- Discounts
CREATE INDEX IF NOT EXISTS "idx_discounts_active_schedule" ON "Discount"("is_active", "valid_from", "valid_until") WHERE "is_active" = true;

-- Orders
CREATE INDEX IF NOT EXISTS "idx_orders_cashier_date" ON "Order"("cashier_id", "client_created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_orders_date" ON "Order"("client_created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_orders_status" ON "Order"("status") WHERE "status" = 'completed'::"OrderStatus";
CREATE INDEX IF NOT EXISTS "idx_orders_payment_method" ON "Order"("payment_method");

-- Order Items
CREATE INDEX IF NOT EXISTS "idx_order_items_order" ON "OrderItem"("order_id");
CREATE INDEX IF NOT EXISTS "idx_order_items_product" ON "OrderItem"("product_id");
CREATE INDEX IF NOT EXISTS "idx_order_items_discount" ON "OrderItem"("discount_id") WHERE "discount_id" IS NOT NULL;

-- Order Item Modifiers
CREATE INDEX IF NOT EXISTS "idx_order_item_modifiers_item" ON "OrderItemModifier"("order_item_id");

-- Cash Registers
CREATE INDEX IF NOT EXISTS "idx_cash_registers_cashier_date" ON "CashRegister"("cashier_id", "shift_date" DESC);

-- Audit Logs
CREATE INDEX IF NOT EXISTS "idx_audit_logs_actor_date" ON "AuditLog"("actor_id", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_audit_logs_action" ON "AuditLog"("action", "created_at" DESC);

-- Revoked Tokens
CREATE INDEX IF NOT EXISTS "idx_revoked_tokens_expires" ON "RevokedToken"("expires_at");
