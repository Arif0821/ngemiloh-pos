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
  const kasirPinHash = await bcrypt.hash(kasirPinPlain + pepper, 12);

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

  // 4. Create Default Outlet (FASE 4: Multi-Outlet)
  const defaultOutlet = await prisma.outlet.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      name: 'Outlet Utama',
      address: 'Jl. Raya Ngemiloh No. 1',
      phone: '021-12345678',
      is_active: true,
    },
  });
  console.log(`Created Default Outlet: ${defaultOutlet.name}`);

  // 5. Assign Superadmin and Kasir to Default Outlet
  await prisma.userOutlet.upsert({
    where: {
      user_id_outlet_id: {
        user_id: superadmin.id,
        outlet_id: defaultOutlet.id,
      }
    },
    update: {},
    create: {
      user_id: superadmin.id,
      outlet_id: defaultOutlet.id,
      is_primary: true,
    },
  });

  await prisma.userOutlet.upsert({
    where: {
      user_id_outlet_id: {
        user_id: kasir.id,
        outlet_id: defaultOutlet.id,
      }
    },
    update: {},
    create: {
      user_id: kasir.id,
      outlet_id: defaultOutlet.id,
      is_primary: true,
    },
  });
  console.log('Assigned users to default outlet');

  // 5. Seed 26 Raw Materials with realistic costs for BOM testing
  // NOTE: cost_per_unit is per usage_unit (e.g., per Gram, per Liter, per Pcs)
  const rawMaterialsData = [
    // Snack Base Materials
    { name: 'Makaroni Mentah', unit: 'Gram', min_stock: 1000, current_stock: 5000, cost_per_unit: 25 },        // Rp 25/gram
    { name: 'Mie Lidi Mentah', unit: 'Gram', min_stock: 1000, current_stock: 5000, cost_per_unit: 20 },        // Rp 20/gram
    { name: 'Basreng Mentah', unit: 'Gram', min_stock: 1000, current_stock: 3000, cost_per_unit: 35 },         // Rp 35/gram
    // Cooking Materials
    { name: 'Minyak Goreng', unit: 'Liter', min_stock: 5, current_stock: 20, cost_per_unit: 18000 },          // Rp 18.000/liter
    // Seasonings (per gram)
    { name: 'Bumbu Asin', unit: 'Gram', min_stock: 500, current_stock: 2000, cost_per_unit: 8 },               // Rp 8/gram
    { name: 'Bumbu Pedas', unit: 'Gram', min_stock: 500, current_stock: 2000, cost_per_unit: 10 },             // Rp 10/gram
    { name: 'Bumbu Balado', unit: 'Gram', min_stock: 500, current_stock: 2000, cost_per_unit: 12 },             // Rp 12/gram
    { name: 'Bumbu Keju', unit: 'Gram', min_stock: 500, current_stock: 1500, cost_per_unit: 15 },              // Rp 15/gram
    { name: 'Bumbu BBQ', unit: 'Gram', min_stock: 500, current_stock: 1500, cost_per_unit: 14 },                // Rp 14/gram
    { name: 'Bumbu Jagung Bakar', unit: 'Gram', min_stock: 500, current_stock: 1500, cost_per_unit: 13 },       // Rp 13/gram
    { name: 'Bumbu Sapi Panggang', unit: 'Gram', min_stock: 500, current_stock: 1500, cost_per_unit: 18 },      // Rp 18/gram
    { name: 'Bumbu Pizza', unit: 'Gram', min_stock: 500, current_stock: 1000, cost_per_unit: 16 },             // Rp 16/gram
    // Packaging
    { name: 'Plastik Kemasan Kecil', unit: 'Pcs', min_stock: 100, current_stock: 500, cost_per_unit: 200 },    // Rp 200/pcs
    { name: 'Plastik Kemasan Besar', unit: 'Pcs', min_stock: 100, current_stock: 300, cost_per_unit: 400 },     // Rp 400/pcs
    { name: 'Plastik Kresek', unit: 'Pcs', min_stock: 100, current_stock: 200, cost_per_unit: 150 },            // Rp 150/pcs
    { name: 'Karet Gelang', unit: 'Gram', min_stock: 100, current_stock: 500, cost_per_unit: 5 },               // Rp 5/gram
    // Utilities
    { name: 'Gas Elpiji 3kg', unit: 'Tabung', min_stock: 1, current_stock: 3, cost_per_unit: 27000 },         // Rp 27.000/tabung
    { name: 'Saus Sambal', unit: 'Sachet', min_stock: 50, current_stock: 200, cost_per_unit: 500 },             // Rp 500/sachet
    { name: 'Saus Tomat', unit: 'Sachet', min_stock: 50, current_stock: 150, cost_per_unit: 450 },              // Rp 450/sachet
    { name: 'Kertas Struk', unit: 'Roll', min_stock: 2, current_stock: 10, cost_per_unit: 8000 },               // Rp 8.000/roll
    // Cleaning Supplies (non-BOM, for completeness)
    { name: 'Sarung Tangan Plastik', unit: 'Pcs', min_stock: 50, current_stock: 200, cost_per_unit: 300 },      // Rp 300/pcs
    { name: 'Masker', unit: 'Pcs', min_stock: 20, current_stock: 100, cost_per_unit: 500 },                     // Rp 500/pcs
    { name: 'Sabun Cuci Tangan', unit: 'Botol', min_stock: 1, current_stock: 5, cost_per_unit: 12000 },         // Rp 12.000/botol
    { name: 'Sabun Cuci Piring', unit: 'Botol', min_stock: 1, current_stock: 5, cost_per_unit: 15000 },        // Rp 15.000/botol
    { name: 'Spons Cuci', unit: 'Pcs', min_stock: 2, current_stock: 10, cost_per_unit: 2500 },                 // Rp 2.500/pcs
    { name: 'Lap Kain', unit: 'Pcs', min_stock: 5, current_stock: 20, cost_per_unit: 5000 },                   // Rp 5.000/pcs
  ];

  for (const rm of rawMaterialsData) {
    const rawMaterial = await prisma.rawMaterial.upsert({
      where: { name: rm.name },
      update: { cost_per_unit: rm.cost_per_unit, current_stock: rm.current_stock },
      create: {
        name: rm.name,
        purchase_unit: rm.unit,
        purchase_qty: 1,
        usage_unit: rm.unit,
        conversion_factor: 1,
        current_stock: rm.current_stock,
        min_stock: rm.min_stock,
        cost_per_unit: rm.cost_per_unit,
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
    const existingBoms = await prisma.bomRecipe.findMany({ where: { product_id: product.id } });
    if (existingBoms.length === 0) {
      await prisma.bomRecipe.createMany({
        data: [
          { product_id: product.id, raw_material_id: makaroni.id, quantity_per_serving: 100 },
          { product_id: product.id, raw_material_id: minyak.id, quantity_per_serving: 0.05 },
          { product_id: product.id, raw_material_id: bumbuAsin.id, quantity_per_serving: 10 },
          { product_id: product.id, raw_material_id: plastik.id, quantity_per_serving: 1 }
        ],
        skipDuplicates: true
      });
    }
  }

  // 6. Seed Store Settings
  const storeSettings = [
    { key: 'store_name', value: 'Ngemiloh' },
    { key: 'store_address', value: 'Jalan Raya No. 1, Jakarta' },
    { key: 'store_phone', value: '021-12345678' },
    { key: 'store_whatsapp', value: '081234567890' },
  ];
  for (const s of storeSettings) {
    await prisma.setting.upsert({
      where: { key: s.key },
      update: {},
      create: { key: s.key, value: s.value, updated_at: new Date() } as any,
    });
  }

  // 7. Seed Feature Flags (8 Item)
  const featureFlags = [
    { name: 'ENABLE_SPLIT_PAYMENT', description: 'Fitur pembayaran pisah bill', is_enabled: true },
    { name: 'ENABLE_LOYALTY_PROGRAM', description: 'Fitur poin pelanggan', is_enabled: true },
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

  // 8. Seed Loyalty Tiers (FASE 3: Member & Loyalty System)
  const loyaltyTiers = [
    { name: 'Bronze', min_points: 0, sort_order: 1, points_multiplier: 1.0, discount_rate: null },
    { name: 'Silver', min_points: 500, sort_order: 2, points_multiplier: 1.0, discount_rate: 5 },
    { name: 'Gold', min_points: 1500, sort_order: 3, points_multiplier: 1.0, discount_rate: 10 },
    { name: 'Platinum', min_points: 5000, sort_order: 4, points_multiplier: 1.0, discount_rate: 15 },
  ];

  for (const tier of loyaltyTiers) {
    await prisma.loyaltyTier.upsert({
      where: { name: tier.name },
      update: {},
      create: {
        name: tier.name,
        min_points: tier.min_points,
        sort_order: tier.sort_order,
        points_multiplier: tier.points_multiplier,
        discount_rate: tier.discount_rate,
        is_active: true,
      },
    });
  }
  console.log('Seeded Loyalty Tiers: Bronze, Silver, Gold, Platinum');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
