-- Migration: Add Performance Indexes
-- Generated: 2026-06-10
-- Run this migration manually in your database

-- AuditLog indexes for fraud detection
CREATE INDEX IF NOT EXISTS "AuditLog_actor_id_action_created_at_idx" ON "AuditLog"("actor_id", "action", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "AuditLog_entity_type_entity_id_idx" ON "AuditLog"("entity_type", "entity_id");

-- CashRegister indexes for shift management
CREATE INDEX IF NOT EXISTS "CashRegister_cashier_id_status_idx" ON "CashRegister"("cashier_id", "status");
CREATE INDEX IF NOT EXISTS "CashRegister_cashier_id_shift_date_status_idx" ON "CashRegister"("cashier_id", "shift_date", "status");

-- Order indexes for analytics and webhook lookups
CREATE INDEX IF NOT EXISTS "Order_payment_status_status_idx" ON "Order"("payment_status", "status");
CREATE INDEX IF NOT EXISTS "Order_created_at_cashier_id_idx" ON "Order"("created_at" DESC, "cashier_id");

-- StockMovement indexes for FEFO batch tracking
CREATE INDEX IF NOT EXISTS "StockMovement_raw_material_id_created_at_idx" ON "StockMovement"("raw_material_id", "created_at" ASC);
CREATE INDEX IF NOT EXISTS "StockMovement_raw_material_id_type_created_at_idx" ON "StockMovement"("raw_material_id", "type", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "StockMovement_reference_order_id_idx" ON "StockMovement"("reference_order_id");

-- RawMaterial index for low stock alerts
CREATE INDEX IF NOT EXISTS "RawMaterial_current_stock_min_stock_idx" ON "RawMaterial"("current_stock", "min_stock");
