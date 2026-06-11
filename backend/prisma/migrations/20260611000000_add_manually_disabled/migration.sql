-- Migration: add manually_disabled column to Discount table
-- Prevents cron from re-activating admin-disabled discounts
-- Kode error yang diperbaiki: P2022 (column does not exist)

ALTER TABLE "Discount" ADD COLUMN IF NOT EXISTS "manually_disabled" BOOLEAN NOT NULL DEFAULT false;
