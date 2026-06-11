-- Migration: Add missing columns from schema.prisma to init migration
-- Fixes D-01, D-03

-- D-01: Add verification_status column to Order
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "verification_status" VARCHAR(20);

-- D-03: Add description column to OperationalExpense
ALTER TABLE "OperationalExpense" ADD COLUMN IF NOT EXISTS "description" VARCHAR(200);