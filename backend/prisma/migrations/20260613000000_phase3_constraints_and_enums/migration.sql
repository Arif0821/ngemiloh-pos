-- Phase 3: Add partial unique index for shifts and missing enums
-- SEDANG-06: Partial unique index to prevent duplicate open shifts per cashier
-- D-06/D-07: Add StockMovementType and RefundMethod enums

-- Create StockMovementType enum
CREATE TYPE "StockMovementType" AS ENUM ('in', 'out', 'adjustment', 'waste');

-- Create RefundMethod enum
CREATE TYPE "RefundMethod" AS ENUM ('cash', 'transfer', 'original_payment', 'manual_cash', 'store_credit');

-- Convert existing StockMovement.type to use enum
ALTER TABLE "StockMovement" ALTER COLUMN "type" TYPE "StockMovementType" USING "type"::text::"StockMovementType";

-- Convert existing OrderRefund.refund_method to use enum
ALTER TABLE "OrderRefund" ALTER COLUMN "refund_method" TYPE "RefundMethod" USING "refund_method"::text::"RefundMethod";

-- SEDANG-06: Partial unique index for CashRegister
-- Ensures only one open shift per cashier at any given time
-- Uses PostgreSQL partial index with a WHERE clause
CREATE UNIQUE INDEX "CashRegister_cashier_id_open_unique"
ON "CashRegister"("cashier_id")
WHERE "status" = 'open';
