-- Migration: add_order_fields_and_system_logs
-- Add order fields (Order table is created in init migration)
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "order_number" VARCHAR(30);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customer_name" VARCHAR(50);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cash_received" DECIMAL(12, 0);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "cash_change" DECIMAL(12, 0);
CREATE UNIQUE INDEX IF NOT EXISTS "Order_order_number_unique" ON "Order"("order_number");

-- Create system_logs table (matches schema model SystemLog)
CREATE TABLE IF NOT EXISTS "SystemLog" (
  "id" BIGSERIAL PRIMARY KEY,
  "level" VARCHAR(10) NOT NULL,
  "source" VARCHAR(100) NOT NULL,
  "message" TEXT NOT NULL,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS "SystemLog_level_created_at_idx" ON "SystemLog"("level", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "SystemLog_source_created_at_idx" ON "SystemLog"("source", "created_at" DESC);
