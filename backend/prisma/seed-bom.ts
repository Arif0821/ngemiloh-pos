/**
 * Seed BOM Testing Data
 *
 * Purpose: Populate realistic cost data for Issue #8 (BOM Cost Per Unit = 0)
 * This ensures financial reporting (HPP calculation) works correctly.
 *
 * Usage:
 *   npx prisma db seed --env-label seed-bom
 *   Or: npx ts-node prisma/seed-bom.ts
 *
 * NOTE: Raw materials must exist first. Run seed.ts first!
 * This script updates existing raw materials with correct costs
 * and creates products with proper BOM recipes.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** Mapping: [usage_qty_in_grams, cost_per_unit_in_idr] */
type RawMaterialSeed = {
  name: string;
  unit: string;
  min_stock: number;
  current_stock: number;
  cost_per_unit: number; // per usage_unit (Gram/Liter/Pcs/etc)
};

async function main() {
  console.log('🍱 Seeding BOM testing data...\n');

  // ── 1. Seed/update raw materials with realistic costs ──────────────────────
  const rawMaterials: RawMaterialSeed[] = [
    // Snack Base Materials
    { name: 'Makaroni Mentah', unit: 'Gram', min_stock: 1000, current_stock: 5000, cost_per_unit: 25 },
    { name: 'Mie Lidi Mentah', unit: 'Gram', min_stock: 1000, current_stock: 5000, cost_per_unit: 20 },
    { name: 'Basreng Mentah', unit: 'Gram', min_stock: 1000, current_stock: 3000, cost_per_unit: 35 },
    // Cooking
    { name: 'Minyak Goreng', unit: 'Liter', min_stock: 5, current_stock: 20, cost_per_unit: 18000 },
    // Seasonings (per gram)
    { name: 'Bumbu Asin', unit: 'Gram', min_stock: 500, current_stock: 2000, cost_per_unit: 8 },
    { name: 'Bumbu Pedas', unit: 'Gram', min_stock: 500, current_stock: 2000, cost_per_unit: 10 },
    { name: 'Bumbu Balado', unit: 'Gram', min_stock: 500, current_stock: 2000, cost_per_unit: 12 },
    { name: 'Bumbu Keju', unit: 'Gram', min_stock: 500, current_stock: 1500, cost_per_unit: 15 },
    { name: 'Bumbu BBQ', unit: 'Gram', min_stock: 500, current_stock: 1500, cost_per_unit: 14 },
    { name: 'Bumbu Jagung Bakar', unit: 'Gram', min_stock: 500, current_stock: 1500, cost_per_unit: 13 },
    { name: 'Bumbu Sapi Panggang', unit: 'Gram', min_stock: 500, current_stock: 1500, cost_per_unit: 18 },
    { name: 'Bumbu Pizza', unit: 'Gram', min_stock: 500, current_stock: 1000, cost_per_unit: 16 },
    // Packaging
    { name: 'Plastik Kemasan Kecil', unit: 'Pcs', min_stock: 100, current_stock: 500, cost_per_unit: 200 },
    { name: 'Plastik Kemasan Besar', unit: 'Pcs', min_stock: 100, current_stock: 300, cost_per_unit: 400 },
    { name: 'Plastik Kresek', unit: 'Pcs', min_stock: 100, current_stock: 200, cost_per_unit: 150 },
    { name: 'Karet Gelang', unit: 'Gram', min_stock: 100, current_stock: 500, cost_per_unit: 5 },
    // Utilities
    { name: 'Gas Elpiji 3kg', unit: 'Tabung', min_stock: 1, current_stock: 3, cost_per_unit: 27000 },
    { name: 'Saus Sambal', unit: 'Sachet', min_stock: 50, current_stock: 200, cost_per_unit: 500 },
    { name: 'Saus Tomat', unit: 'Sachet', min_stock: 50, current_stock: 150, cost_per_unit: 450 },
    { name: 'Kertas Struk', unit: 'Roll', min_stock: 2, current_stock: 10, cost_per_unit: 8000 },
    // Cleaning
    { name: 'Sarung Tangan Plastik', unit: 'Pcs', min_stock: 50, current_stock: 200, cost_per_unit: 300 },
    { name: 'Masker', unit: 'Pcs', min_stock: 20, current_stock: 100, cost_per_unit: 500 },
    { name: 'Sabun Cuci Tangan', unit: 'Botol', min_stock: 1, current_stock: 5, cost_per_unit: 12000 },
    { name: 'Sabun Cuci Piring', unit: 'Botol', min_stock: 1, current_stock: 5, cost_per_unit: 15000 },
    { name: 'Spons Cuci', unit: 'Pcs', min_stock: 2, current_stock: 10, cost_per_unit: 2500 },
    { name: 'Lap Kain', unit: 'Pcs', min_stock: 5, current_stock: 20, cost_per_unit: 5000 },
  ];

  for (const rm of rawMaterials) {
    await prisma.rawMaterial.upsert({
      where: { name: rm.name },
      update: {
        cost_per_unit: rm.cost_per_unit,
        current_stock: rm.current_stock,
        min_stock: rm.min_stock,
        purchase_unit: rm.unit,
        usage_unit: rm.unit,
        conversion_factor: 1,
      },
      create: {
        name: rm.name,
        purchase_unit: rm.unit,
        purchase_qty: 1,
        usage_unit: rm.unit,
        conversion_factor: 1,
        current_stock: rm.current_stock,
        min_stock: rm.min_stock,
        cost_per_unit: rm.cost_per_unit,
      },
    });
  }
  console.log(`✅ Updated ${rawMaterials.length} raw materials with costs`);

  // ── 2. Get dependencies ─────────────────────────────────────────────────────
  const category = await prisma.category.findFirst({ where: { name: 'Makanan' } })
    ?? await prisma.category.create({ data: { name: 'Makanan', sort_order: 1 } });

  const admin = await prisma.user.findFirst({ where: { role: 'superadmin' } });
  if (!admin) {
    console.error('❌ No superadmin user found. Run seed.ts first!');
    process.exit(1);
  }

  // ── 3. Helper: get raw material by name ────────────────────────────────────
  const getRm = async (name: string) => {
    const rm = await prisma.rawMaterial.findUnique({ where: { name } });
    if (!rm) throw new Error(`Raw material not found: ${name}`);
    return rm;
  };

  // ── 4. Define products with BOM recipes ─────────────────────────────────────
  // Each recipe: raw_material_name + quantity_per_serving
  // HPP is calculated by summing: qty * cost_per_unit
  type BomEntry = { rmName: string; qtyPerServing: number };
  type ProductSeed = {
    name: string;
    base_price: number;
    category_id: string;
    recipes: BomEntry[];
    modifier_groups?: Array<{
      name: string;
      is_required: boolean;
      options: Array<{ name: string; additional_price: number; recipe?: BomEntry[] }>;
    }>;
  };

  const products: ProductSeed[] = [
    {
      name: 'Macaroni Keju',
      base_price: 8000,
      category_id: category.id,
      recipes: [
        { rmName: 'Makaroni Mentah', qtyPerServing: 80 },
        { rmName: 'Minyak Goreng', qtyPerServing: 0.05 },
        { rmName: 'Bumbu Keju', qtyPerServing: 10 },
        { rmName: 'Plastik Kemasan Kecil', qtyPerServing: 1 },
      ],
    },
    {
      name: 'Macaroni Balado',
      base_price: 7500,
      category_id: category.id,
      recipes: [
        { rmName: 'Makaroni Mentah', qtyPerServing: 80 },
        { rmName: 'Minyak Goreng', qtyPerServing: 0.05 },
        { rmName: 'Bumbu Balado', qtyPerServing: 12 },
        { rmName: 'Plastik Kemasan Kecil', qtyPerServing: 1 },
      ],
    },
    {
      name: 'Macaroni BBQ',
      base_price: 8500,
      category_id: category.id,
      recipes: [
        { rmName: 'Makaroni Mentah', qtyPerServing: 80 },
        { rmName: 'Minyak Goreng', qtyPerServing: 0.05 },
        { rmName: 'Bumbu BBQ', qtyPerServing: 10 },
        { rmName: 'Plastik Kemasan Kecil', qtyPerServing: 1 },
      ],
    },
    {
      name: 'Mie Lidi Pedas',
      base_price: 7000,
      category_id: category.id,
      recipes: [
        { rmName: 'Mie Lidi Mentah', qtyPerServing: 80 },
        { rmName: 'Minyak Goreng', qtyPerServing: 0.05 },
        { rmName: 'Bumbu Pedas', qtyPerServing: 15 },
        { rmName: 'Plastik Kemasan Kecil', qtyPerServing: 1 },
      ],
    },
    {
      name: 'Basreng Jagung Bakar',
      base_price: 9000,
      category_id: category.id,
      recipes: [
        { rmName: 'Basreng Mentah', qtyPerServing: 70 },
        { rmName: 'Minyak Goreng', qtyPerServing: 0.05 },
        { rmName: 'Bumbu Jagung Bakar', qtyPerServing: 10 },
        { rmName: 'Plastik Kemasan Kecil', qtyPerServing: 1 },
      ],
    },
    {
      name: 'Basreng Sapi Panggang',
      base_price: 9500,
      category_id: category.id,
      recipes: [
        { rmName: 'Basreng Mentah', qtyPerServing: 70 },
        { rmName: 'Minyak Goreng', qtyPerServing: 0.05 },
        { rmName: 'Bumbu Sapi Panggang', qtyPerServing: 10 },
        { rmName: 'Plastik Kemasan Kecil', qtyPerServing: 1 },
      ],
    },
    {
      name: 'Makaroni Asin',
      base_price: 6000,
      category_id: category.id,
      recipes: [
        { rmName: 'Makaroni Mentah', qtyPerServing: 80 },
        { rmName: 'Minyak Goreng', qtyPerServing: 0.05 },
        { rmName: 'Bumbu Asin', qtyPerServing: 10 },
        { rmName: 'Plastik Kemasan Kecil', qtyPerServing: 1 },
      ],
    },
  ];

  // ── 5. Create products with BOM recipes ────────────────────────────────────
  for (const prod of products) {
    const existing = await prisma.product.findFirst({ where: { name: prod.name } });

    const rmEntries = await Promise.all(
      prod.recipes.map(async (r) => {
        const rm = await getRm(r.rmName);
        return { raw_material_id: rm.id, quantity_per_serving: r.qtyPerServing };
      }),
    );

    // Calculate expected HPP
    let hpp = 0;
    for (const r of prod.recipes) {
      const rm = await getRm(r.rmName);
      hpp += r.qtyPerServing * Number(rm.cost_per_unit);
    }

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          base_price: prod.base_price,
          cost_per_unit: hpp, // #8: Set HPP from BOM calculation
        },
      });
      // Replace BOM recipes
      await prisma.bomRecipe.deleteMany({ where: { product_id: existing.id } });
      for (const entry of rmEntries) {
        await prisma.bomRecipe.create({
          data: { product_id: existing.id, ...entry },
        });
      }
      console.log(
        `  🔄 Updated "${prod.name}" — price: Rp ${prod.base_price.toLocaleString('id-ID')}, HPP: Rp ${Math.round(hpp).toLocaleString('id-ID')}`,
      );
    } else {
      const created = await prisma.product.create({
        data: {
          name: prod.name,
          base_price: prod.base_price,
          cost_per_unit: hpp, // #8: Set HPP from BOM calculation
          category_id: prod.category_id,
          created_by: admin.id,
        },
      });
      for (const entry of rmEntries) {
        await prisma.bomRecipe.create({
          data: { product_id: created.id, ...entry },
        });
      }
      console.log(
        `  ✅ Created "${prod.name}" — price: Rp ${prod.base_price.toLocaleString('id-ID')}, HPP: Rp ${Math.round(hpp).toLocaleString('id-ID')}`,
      );
    }
  }

  // ── 6. Summary ──────────────────────────────────────────────────────────────
  console.log('\n📊 HPP Summary (HPP = Σ qty × cost_per_unit):');
  console.log('─'.repeat(70));
  console.log(
    `${'Product'.padEnd(25)} ${'Harga Jual'.padEnd(12)} ${'HPP'.padEnd(12)} ${'Margin'}`,
  );
  console.log('─'.repeat(70));

  const allProducts = await prisma.product.findMany({
    where: { category: { name: 'Makanan' } },
    include: { bom_recipes: { include: { raw_material: true } } },
  });

  for (const p of allProducts) {
    let calculatedHpp = 0;
    for (const bom of p.bom_recipes) {
      calculatedHpp +=
        Number(bom.quantity_per_serving) * Number(bom.raw_material.cost_per_unit);
    }
    const margin = Math.round(((Number(p.base_price) - calculatedHpp) / Number(p.base_price)) * 100);
    console.log(
      `${p.name.padEnd(25)} Rp ${Number(p.base_price).toLocaleString('id-ID').padEnd(10)} Rp ${Math.round(calculatedHpp).toLocaleString('id-ID').padEnd(10)} ${margin}%`,
    );
  }
  console.log('─'.repeat(70));
  console.log('\n🎉 BOM seed complete! All products have cost_per_unit set.');
}

main()
  .catch((e) => {
    console.error('\n❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
