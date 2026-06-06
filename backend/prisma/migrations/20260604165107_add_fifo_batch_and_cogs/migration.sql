-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "cogs_total" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "InventoryBatch" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "raw_material_id" UUID NOT NULL,
    "qty_initial" DECIMAL(10,2) NOT NULL,
    "qty_remaining" DECIMAL(10,2) NOT NULL,
    "cost_per_unit" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryBatch_raw_material_id_created_at_idx" ON "InventoryBatch"("raw_material_id", "created_at" ASC);

-- AddForeignKey
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_raw_material_id_fkey" FOREIGN KEY ("raw_material_id") REFERENCES "RawMaterial"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
