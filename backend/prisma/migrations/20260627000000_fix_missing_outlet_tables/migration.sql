-- ============================================================
-- Fix Missing Outlet Tables Migration
-- Created: 2026-06-27
-- Purpose: Add Outlet, UserOutlet tables and related FKs
-- ============================================================

-- 1. Create Outlet table (if not exists)
CREATE TABLE IF NOT EXISTS "Outlet" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(100) NOT NULL,
    "address" TEXT,
    "phone" VARCHAR(20),
    "is_active" BOOLEAN DEFAULT true,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create UserOutlet table (if not exists)
CREATE TABLE IF NOT EXISTS "UserOutlet" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "outlet_id" UUID NOT NULL,
    "assigned_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "is_primary" BOOLEAN DEFAULT false
);

-- 3. Add outlet_id to CashRegister (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'CashRegister' AND column_name = 'outlet_id'
    ) THEN
        ALTER TABLE "CashRegister" ADD COLUMN "outlet_id" UUID;
    END IF;
END $$;

-- 4. Add outlet_id to Order (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'Order' AND column_name = 'outlet_id'
    ) THEN
        ALTER TABLE "Order" ADD COLUMN "outlet_id" UUID;
    END IF;
END $$;

-- 5. Insert default outlet
INSERT INTO "Outlet" (id, name, created_at)
SELECT gen_random_uuid(), 'Main Store', CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "Outlet" LIMIT 1);

-- 6. Add Foreign Keys
DO $$
BEGIN
    -- CashRegister -> Outlet
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'CashRegister_outlet_id_fkey'
    ) THEN
        ALTER TABLE "CashRegister" ADD CONSTRAINT "CashRegister_outlet_id_fkey"
            FOREIGN KEY ("outlet_id") REFERENCES "Outlet"("id") ON DELETE RESTRICT;
    END IF;
END $$;

DO $$
BEGIN
    -- Order -> Outlet
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'Order_outlet_id_fkey'
    ) THEN
        ALTER TABLE "Order" ADD CONSTRAINT "Order_outlet_id_fkey"
            FOREIGN KEY ("outlet_id") REFERENCES "Outlet"("id") ON DELETE RESTRICT;
    END IF;
END $$;

DO $$
BEGIN
    -- UserOutlet -> User
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'UserOutlet_user_id_fkey'
    ) THEN
        ALTER TABLE "UserOutlet" ADD CONSTRAINT "UserOutlet_user_id_fkey"
            FOREIGN KEY ("user_id") REFERENCES "User"("id") ON DELETE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    -- UserOutlet -> Outlet
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'UserOutlet_outlet_id_fkey'
    ) THEN
        ALTER TABLE "UserOutlet" ADD CONSTRAINT "UserOutlet_outlet_id_fkey"
            FOREIGN KEY ("outlet_id") REFERENCES "Outlet"("id") ON DELETE CASCADE;
    END IF;
END $$;

-- 7. Add Indexes
CREATE INDEX IF NOT EXISTS "UserOutlet_user_id_idx" ON "UserOutlet"("user_id");
CREATE INDEX IF NOT EXISTS "UserOutlet_outlet_id_idx" ON "UserOutlet"("outlet_id");
CREATE UNIQUE INDEX IF NOT EXISTS "UserOutlet_user_id_outlet_id_key" ON "UserOutlet"("user_id", "outlet_id");
CREATE INDEX IF NOT EXISTS "CashRegister_outlet_id_idx" ON "CashRegister"("outlet_id");
CREATE INDEX IF NOT EXISTS "Order_outlet_id_idx" ON "Order"("outlet_id");
CREATE INDEX IF NOT EXISTS "Outlet_is_active_idx" ON "Outlet"("is_active");
