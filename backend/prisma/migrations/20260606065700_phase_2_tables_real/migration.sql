TRUNCATE TABLE "RawMaterial" CASCADE;

-- DropForeignKey
ALTER TABLE "InventoryBatch" DROP CONSTRAINT "InventoryBatch_raw_material_id_fkey";

-- DropForeignKey
ALTER TABLE "InventoryTransaction" DROP CONSTRAINT "InventoryTransaction_created_by_fkey";

-- DropForeignKey
ALTER TABLE "InventoryTransaction" DROP CONSTRAINT "InventoryTransaction_raw_material_id_fkey";

-- DropForeignKey
ALTER TABLE "ProductIngredient" DROP CONSTRAINT "ProductIngredient_product_id_fkey";

-- DropForeignKey
ALTER TABLE "ProductIngredient" DROP CONSTRAINT "ProductIngredient_raw_material_id_fkey";

-- AlterTable
ALTER TABLE "RawMaterial" DROP COLUMN "is_active",
DROP COLUMN "price_per_unit",
DROP COLUMN "stock",
DROP COLUMN "unit",
ADD COLUMN     "conversion_factor" DECIMAL(10,4) NOT NULL,
ADD COLUMN     "cost_per_unit" DECIMAL(12,2) NOT NULL DEFAULT 0,
ADD COLUMN     "current_stock" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "purchase_qty" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "purchase_unit" VARCHAR(20) NOT NULL,
ADD COLUMN     "supplier" VARCHAR(100),
ADD COLUMN     "usage_unit" VARCHAR(20) NOT NULL;

-- DropTable
DROP TABLE "InventoryBatch";

-- DropTable
DROP TABLE "InventoryTransaction";

-- DropTable
DROP TABLE "ProductIngredient";

-- CreateTable
CREATE TABLE "Customer" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "phone" VARCHAR(20) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "loyalty_points" INTEGER NOT NULL DEFAULT 0,
    "registered_via" VARCHAR(50),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RawMaterialPriceHistory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "raw_material_id" UUID NOT NULL,
    "cost_per_unit" DECIMAL(12,2) NOT NULL,
    "valid_from" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "recorded_by" UUID,

    CONSTRAINT "RawMaterialPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BomRecipe" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "product_id" UUID,
    "modifier_option_id" UUID,
    "raw_material_id" UUID NOT NULL,
    "quantity_per_serving" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "BomRecipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "raw_material_id" UUID NOT NULL,
    "type" VARCHAR(20) NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "reference_order_id" UUID,
    "notes" TEXT,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "BomRecipe_product_id_idx" ON "BomRecipe"("product_id");

-- CreateIndex
CREATE INDEX "BomRecipe_modifier_option_id_idx" ON "BomRecipe"("modifier_option_id");

-- AddForeignKey
ALTER TABLE "RawMaterialPriceHistory" ADD CONSTRAINT "RawMaterialPriceHistory_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "RawMaterial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RawMaterialPriceHistory" ADD CONSTRAINT "RawMaterialPriceHistory_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomRecipe" ADD CONSTRAINT "BomRecipe_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomRecipe" ADD CONSTRAINT "BomRecipe_modifier_option_id_fkey" FOREIGN KEY ("modifier_option_id") REFERENCES "ProductModifierOption"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BomRecipe" ADD CONSTRAINT "BomRecipe_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "RawMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "RawMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_reference_order_id_fkey" FOREIGN KEY ("reference_order_id") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

