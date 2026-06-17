-- Add cashier_letter to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "cashier_letter" CHAR(1);
CREATE UNIQUE INDEX IF NOT EXISTS "users_cashier_letter_unique" ON "users"("cashier_letter") WHERE "cashier_letter" IS NOT NULL;
