-- Add shift enhanced fields to CashRegister
-- F7: shift_number, carry_over_from_shift_id, is_auto_closed, planned_close_at, actual_close_at

ALTER TABLE "CashRegister" ADD COLUMN IF NOT EXISTS "shift_number" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CashRegister" ADD COLUMN IF NOT EXISTS "carry_over_from_shift_id" UUID NULL;
ALTER TABLE "CashRegister" ADD COLUMN IF NOT EXISTS "is_auto_closed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CashRegister" ADD COLUMN IF NOT EXISTS "planned_close_at" TIMESTAMPTZ NULL;
ALTER TABLE "CashRegister" ADD COLUMN IF NOT EXISTS "actual_close_at" TIMESTAMPTZ NULL;

-- Add self-referencing FK for carry_over
ALTER TABLE "CashRegister" ADD CONSTRAINT "CashRegister_carry_over_from_shift_id_fkey"
  FOREIGN KEY ("carry_over_from_shift_id") REFERENCES "CashRegister"("id") ON DELETE SET NULL;

-- Populate shift_number for existing shifts (sequential per cashier)
-- Use row_number() per cashier ordered by shift_start
UPDATE "CashRegister" AS cr
SET "shift_number" = sub.rn
FROM (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY cashier_id ORDER BY shift_start ASC) - 1 AS rn
  FROM "CashRegister"
) AS sub
WHERE cr.id = sub.id;

-- Create ProfitShareDetail table (F8)
CREATE TABLE "ProfitShareDetail" (
  id                   UUID    NOT NULL DEFAULT gen_random_uuid(),
  "profit_share_log_id" UUID   NOT NULL,
  cashier_id           UUID    NOT NULL,
  cashier_name         VARCHAR(100) NOT NULL,
  "total_sales"       DECIMAL(14,2) NOT NULL DEFAULT 0,
  "total_orders"       INTEGER NOT NULL DEFAULT 0,
  "shift_count"        INTEGER NOT NULL DEFAULT 0,
  "share_amount"      DECIMAL(14,2) NOT NULL DEFAULT 0,
  "is_paid"            BOOLEAN NOT NULL DEFAULT false,
  paid_at             TIMESTAMPTZ NULL,
  notes               TEXT NULL,
  CONSTRAINT "ProfitShareDetail_pkey" PRIMARY KEY (id),
  CONSTRAINT "ProfitShareDetail_profit_share_log_id_fkey"
    FOREIGN KEY ("profit_share_log_id") REFERENCES "ProfitShareLog"("id") ON DELETE CASCADE,
  CONSTRAINT "ProfitShareDetail_cashier_id_fkey"
    FOREIGN KEY (cashier_id) REFERENCES "User"("id") ON DELETE RESTRICT,
  CONSTRAINT "ProfitShareDetail_profit_share_log_id_cashier_id_unique"
    UNIQUE ("profit_share_log_id", cashier_id)
);

CREATE INDEX "ProfitShareDetail_cashier_id_idx" ON "ProfitShareDetail"(cashier_id);
CREATE INDEX "ProfitShareDetail_profit_share_log_id_idx" ON "ProfitShareDetail"("profit_share_log_id");
