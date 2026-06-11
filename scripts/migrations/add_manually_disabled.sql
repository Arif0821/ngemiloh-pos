-- ==========================================
-- Manual Migration: Add manually_disabled to Discount
-- Run this in pgAdmin or via psql
-- ==========================================

-- Add the manually_disabled column to Discount table
ALTER TABLE "Discount" ADD COLUMN IF NOT EXISTS "manually_disabled" BOOLEAN NOT NULL DEFAULT false;

-- Verify the column was added
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'Discount' AND column_name = 'manually_disabled';

-- Reset any existing crons that might be in weird state
-- (This is for reference - cron jobs are managed by NestJS app)
-- SELECT 1;
