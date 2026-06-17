-- Migration: add_order_fields_and_system_logs
-- Add order fields (orders table may be partitioned, use IF NOT EXISTS for safety)
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "order_number" VARCHAR(30);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_name" VARCHAR(50);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cash_received" DECIMAL(12, 0);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "cash_change" DECIMAL(12, 0);
CREATE UNIQUE INDEX IF NOT EXISTS "orders_order_number_unique" ON "orders"("order_number");

-- Create system_logs table
CREATE TABLE IF NOT EXISTS "system_logs" (
  "id" BIGSERIAL PRIMARY KEY,
  "level" VARCHAR(10) NOT NULL,
  "source" VARCHAR(100) NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "system_logs_level_created_at_idx" ON "system_logs"("level", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "system_logs_source_created_at_idx" ON "system_logs"("source", "created_at" DESC);
