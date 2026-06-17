-- Add cashier_letter to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cashier_letter" CHAR(1);
CREATE UNIQUE INDEX IF NOT EXISTS "User_cashier_letter_unique" ON "User"("cashier_letter") WHERE "cashier_letter" IS NOT NULL;
