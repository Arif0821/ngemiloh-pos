-- Migration: Add cost_per_unit to Product model for Issue #8 BOM Cost
-- This allows manual cost input for financial reporting
-- Owner can update this field directly in database

-- Step 1: Add column with default value
ALTER TABLE "Product" ADD COLUMN "cost_per_unit" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- Step 2: (Optional) Add comment for documentation
COMMENT ON COLUMN "Product"."cost_per_unit" IS 'Manual cost per unit for BOM financial reporting. Default 0 means cost not set.';
