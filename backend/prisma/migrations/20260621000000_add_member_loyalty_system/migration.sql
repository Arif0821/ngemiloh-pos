-- Migration: add_member_loyalty_system
-- Created: 2026-06-21

-- Create LoyaltyTier table
CREATE TABLE "LoyaltyTier" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "name" VARCHAR(20) NOT NULL UNIQUE,
    "min_points" INT NOT NULL DEFAULT 0,
    "points_multiplier" DECIMAL(3, 2) NOT NULL DEFAULT 1.0,
    "discount_rate" SMALLINT,
    "free_item_id" UUID,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INT NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "LoyaltyTier_sort_order_idx" ON "LoyaltyTier"("sort_order");
CREATE INDEX "LoyaltyTier_is_active_idx" ON "LoyaltyTier"("is_active");

-- Create Member table
CREATE TABLE "Member" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "member_code" VARCHAR(20) NOT NULL UNIQUE,
    "phone" VARCHAR(20) NOT NULL UNIQUE,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(150),
    "loyalty_points" INT NOT NULL DEFAULT 0,
    "current_tier_id" UUID,
    "registered_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "registered_via" VARCHAR(50) NOT NULL DEFAULT 'qr_link',
    "registered_outlet_id" VARCHAR(50),
    "last_transaction_at" TIMESTAMPTZ,
    "tier_downgrade_at" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "Member_phone_idx" ON "Member"("phone");
CREATE INDEX "Member_member_code_idx" ON "Member"("member_code");
CREATE INDEX "Member_loyalty_points_idx" ON "Member"("loyalty_points" DESC);
CREATE INDEX "Member_is_active_idx" ON "Member"("is_active");

-- Create MemberTransaction table
CREATE TABLE "MemberTransaction" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "member_id" UUID NOT NULL,
    "order_id" UUID,
    "type" VARCHAR(30) NOT NULL,
    "points" INT NOT NULL,
    "balance_after" INT NOT NULL,
    "description" TEXT,
    "cashier_id" UUID,
    "reference_order" VARCHAR(30),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX "MemberTransaction_member_id_idx" ON "MemberTransaction"("member_id");
CREATE INDEX "MemberTransaction_order_id_idx" ON "MemberTransaction"("order_id");
CREATE INDEX "MemberTransaction_type_idx" ON "MemberTransaction"("type");
CREATE INDEX "MemberTransaction_created_at_idx" ON "MemberTransaction"("created_at" DESC);

-- Add member_id to Order table
ALTER TABLE "Order" ADD COLUMN "member_id" UUID;
CREATE INDEX "Order_member_id_idx" ON "Order"("member_id");

-- Add foreign key for LoyaltyTier.free_item_id -> Product
ALTER TABLE "LoyaltyTier" ADD CONSTRAINT "LoyaltyTier_free_item_id_fkey"
    FOREIGN KEY ("free_item_id") REFERENCES "Product"("id") ON DELETE SET NULL;

-- Add foreign keys for Member
ALTER TABLE "Member" ADD CONSTRAINT "Member_current_tier_id_fkey"
    FOREIGN KEY ("current_tier_id") REFERENCES "LoyaltyTier"("id") ON DELETE SET NULL;

-- Add foreign keys for MemberTransaction
ALTER TABLE "MemberTransaction" ADD CONSTRAINT "MemberTransaction_member_id_fkey"
    FOREIGN KEY ("member_id") REFERENCES "Member"("id") ON DELETE CASCADE;

ALTER TABLE "MemberTransaction" ADD CONSTRAINT "MemberTransaction_order_id_fkey"
    FOREIGN KEY ("order_id") REFERENCES "Order"("id") ON DELETE SET NULL;

-- Add foreign key for Order.member_id -> Member
ALTER TABLE "Order" ADD CONSTRAINT "Order_member_id_fkey"
    FOREIGN KEY ("member_id") REFERENCES "Member"("id") ON DELETE SET NULL;

-- Seed default loyalty tiers
INSERT INTO "LoyaltyTier" ("name", "min_points", "points_multiplier", "discount_rate", "is_active", "sort_order")
VALUES
    ('Bronze', 0, 1.0, NULL, true, 1),
    ('Silver', 500, 1.0, 5, true, 2),
    ('Gold', 1500, 1.0, 10, true, 3),
    ('Platinum', 5000, 1.0, 15, true, 4)
ON CONFLICT ("name") DO NOTHING;

-- Update FeatureFlag for ENABLE_LOYALTY_PROGRAM
UPDATE "FeatureFlag" SET "is_enabled" = true, "updated_at" = now() WHERE "name" = 'ENABLE_LOYALTY_PROGRAM';
