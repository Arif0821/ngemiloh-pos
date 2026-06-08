import { PrismaClient, Role, PaymentMethod, OrderStatus, RegisterStatus, DiscountType, DiscountScope } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  const pepper = process.env.PIN_PEPPER_SECRET || 'DEV_PEPPER_DO_NOT_USE_IN_PROD';
  
  // 1. Create Users
  // Superadmin Password: min 16 characters (wajib: angka, huruf kapital, simbol)
  const adminPassword = await bcrypt.hash('SuperAdminP@ssw0rd123!', 12);
  const kasirPinPlain = '1234';
  const kasirPinPeppered = `${pepper}:${kasirPinPlain}:${pepper}`;
  const kasirPinHash = await bcrypt.hash(kasirPinPeppered, 12);

  const superadmin = await prisma.user.upsert({
    where: { email: 'admin@ngemiloh.com' },
    update: {},
    create: {
      name: 'Arif Hidayat',
      username: 'admin',
      email: 'admin@ngemiloh.com',
      password_hash: adminPassword,
      role: Role.superadmin,
    },
  });

  const kasir = await prisma.user.upsert({
    where: { username: 'kasir1' },
    update: {},
    create: {
      name: 'Kasir Outlet',
      username: 'kasir1',
      pin_hash: kasirPinHash,
      role: Role.kasir,
    },
  });

  console.log(`Created Superadmin: ${superadmin.email}`);
  console.log(`Created Kasir: ${kasir.username} (PIN: 1234)`);

  // 2. Create Categories (5 Kategori)
  const categories = ['Makanan', 'Minuman', 'Camilan', 'Paket Hemat', 'Lain-lain'];
  let sortOrder = 1;
  const categoryRecords: any[] = [];
  for (const catName of categories) {
    const cat = await prisma.category.upsert({
      where: { name: catName },
      update: {},
      create: { name: catName, sort_order: sortOrder++ },
    });
    categoryRecords.push(cat);
  }
  const catFood: any = categoryRecords[0];

  // 3. Create Product (idempotent — aman dijalankan berulang kali)
  let product = await prisma.product.findFirst({
    where: { name: 'Macaroni Mateng' }
  });

  if (!product) {
    product = await prisma.product.create({
      data: {
        name: 'Macaroni Mateng',
        base_price: 5450,
        category_id: catFood.id,
        created_by: superadmin.id,
        modifier_groups: {
          create: [
            {
              name: 'Pilih Bumbu Tabur',
              is_required: true,
              max_selections: 1,
              options: {
                create: [
                  { name: 'Keju', additional_price: 1500 },
                  { name: 'Balado', additional_price: 1500 },
                ]
              }
            },
            {
              name: 'Pilih Saus',
              is_required: true,
              max_selections: 1,
              options: {
                create: [
                  { name: 'Saus BBQ', additional_price: 2500 },
                  { name: 'Saus Keju', additional_price: 3000 },
                ]
              }
            }
          ]
        }
      }
    });
    console.log('Created Product: Macaroni Mateng with modifiers');
  } else {
    console.log('Product Macaroni Mateng already exists, skipping...');
  }

  console.log('Seeded Category and Product with Modifiers');

  // 4. Seed 26 Raw Materials
  const rawMaterialsData = [
    { name: 'Makaroni Mentah', unit: 'Gram', min_stock: 1000 },
    { name: 'Mie Lidi Mentah', unit: 'Gram', min_stock: 1000 },
    { name: 'Basreng Mentah', unit: 'Gram', min_stock: 1000 },
    { name: 'Minyak Goreng', unit: 'Liter', min_stock: 5 },
    { name: 'Bumbu Asin', unit: 'Gram', min_stock: 500 },
    { name: 'Bumbu Pedas', unit: 'Gram', min_stock: 500 },
    { name: 'Bumbu Balado', unit: 'Gram', min_stock: 500 },
    { name: 'Bumbu Keju', unit: 'Gram', min_stock: 500 },
    { name: 'Bumbu BBQ', unit: 'Gram', min_stock: 500 },
    { name: 'Bumbu Jagung Bakar', unit: 'Gram', min_stock: 500 },
    { name: 'Bumbu Sapi Panggang', unit: 'Gram', min_stock: 500 },
    { name: 'Bumbu Pizza', unit: 'Gram', min_stock: 500 },
    { name: 'Plastik Kemasan Kecil', unit: 'Pcs', min_stock: 100 },
    { name: 'Plastik Kemasan Besar', unit: 'Pcs', min_stock: 100 },
    { name: 'Plastik Kresek', unit: 'Pcs', min_stock: 100 },
    { name: 'Karet Gelang', unit: 'Gram', min_stock: 100 },
    { name: 'Gas Elpiji 3kg', unit: 'Tabung', min_stock: 1 },
    { name: 'Saus Sambal', unit: 'Sachet', min_stock: 50 },
    { name: 'Saus Tomat', unit: 'Sachet', min_stock: 50 },
    { name: 'Kertas Struk', unit: 'Roll', min_stock: 2 },
    { name: 'Sarung Tangan Plastik', unit: 'Pcs', min_stock: 50 },
    { name: 'Masker', unit: 'Pcs', min_stock: 20 },
    { name: 'Sabun Cuci Tangan', unit: 'Botol', min_stock: 1 },
    { name: 'Sabun Cuci Piring', unit: 'Botol', min_stock: 1 },
    { name: 'Spons Cuci', unit: 'Pcs', min_stock: 2 },
    { name: 'Lap Kain', unit: 'Pcs', min_stock: 5 }
  ];

  for (const rm of rawMaterialsData) {
    const rawMaterial = await prisma.rawMaterial.upsert({
      where: { name: rm.name },
      update: {},
      create: {
        name: rm.name,
        purchase_unit: rm.unit,
        purchase_qty: 1,
        usage_unit: rm.unit,
        conversion_factor: 1,
        current_stock: 5000, // Initial stock for testing
        min_stock: rm.min_stock,
        cost_per_unit: 100
      }
    });
    
    // Seed an initial StockMovement for FIFO costing (idempotent)
    const existingMovement = await prisma.stockMovement.findFirst({
      where: {
        raw_material_id: rawMaterial.id,
        notes: 'Initial stock seed'
      }
    });

    if (!existingMovement) {
      await prisma.stockMovement.create({
        data: {
          raw_material_id: rawMaterial.id,
          type: 'in',
          quantity: 5000,
          notes: 'Initial stock seed'
        }
      });
    }
  }

  // 5. Relasikan Product dengan Raw Material (Resep)
  const makaroni = await prisma.rawMaterial.findUnique({ where: { name: 'Makaroni Mentah' } });
  const bumbuAsin = await prisma.rawMaterial.findUnique({ where: { name: 'Bumbu Asin' } });
  const minyak = await prisma.rawMaterial.findUnique({ where: { name: 'Minyak Goreng' } });
  const plastik = await prisma.rawMaterial.findUnique({ where: { name: 'Plastik Kemasan Kecil' } });

  if (product && makaroni && bumbuAsin && minyak && plastik) {
    await prisma.bomRecipe.createMany({
      data: [
        { product_id: product.id, raw_material_id: makaroni.id, quantity_per_serving: 100 }, // 100 gram
        { product_id: product.id, raw_material_id: minyak.id, quantity_per_serving: 0.05 }, // 0.05 liter
        { product_id: product.id, raw_material_id: bumbuAsin.id, quantity_per_serving: 10 }, // 10 gram default
        { product_id: product.id, raw_material_id: plastik.id, quantity_per_serving: 1 }     // 1 pcs
      ],
      skipDuplicates: true
    });
  }

  // 6. Seed Feature Flags (8 Item)
  const featureFlags = [
    { name: 'ENABLE_SPLIT_PAYMENT', description: 'Fitur pembayaran pisah bill', is_enabled: true },
    { name: 'ENABLE_LOYALTY_PROGRAM', description: 'Fitur poin pelanggan', is_enabled: false },
    { name: 'ENABLE_OFFLINE_MODE', description: 'Sinkronisasi offline kasir', is_enabled: true },
    { name: 'ENABLE_ADVANCED_ANALYTICS', description: 'Dashboard analitik kompleks', is_enabled: false },
    { name: 'ENABLE_PROMO_CODE', description: 'Penggunaan kode promo', is_enabled: true },
    { name: 'ENABLE_TABLE_MANAGEMENT', description: 'Manajemen meja dine-in', is_enabled: false },
    { name: 'ENABLE_INVENTORY_ALERTS', description: 'Notifikasi stok menipis', is_enabled: true },
    { name: 'ENABLE_MULTI_OUTLET', description: 'Dukungan banyak cabang', is_enabled: false },
  ];

  for (const flag of featureFlags) {
    await prisma.featureFlag.upsert({
      where: { name: flag.name },
      update: {},
      create: {
        name: flag.name,
        description: flag.description,
        is_enabled: flag.is_enabled,
        updated_by: superadmin.id
      }
    });
  }

  console.log('Seeded 26 Raw Materials, Ingredients, and 8 Feature Flags!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
