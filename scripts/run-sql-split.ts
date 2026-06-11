import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe(`UPDATE "Order" SET cash_amount = total_amount, qris_amount = 0 WHERE payment_method = 'cash';`);
    await prisma.$executeRawUnsafe(`UPDATE "Order" SET cash_amount = 0, qris_amount = total_amount WHERE payment_method = 'qris';`);
    await prisma.$executeRawUnsafe(`UPDATE "Order" SET cash_amount = total_amount, qris_amount = 0 WHERE payment_method = 'split' AND (cash_amount + qris_amount != total_amount);`);

    await prisma.$executeRawUnsafe('ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS split_payment_check;');
    await prisma.$executeRawUnsafe('ALTER TABLE "Order" ADD CONSTRAINT split_payment_check CHECK (cash_amount + qris_amount = total_amount);');
    console.log('Constraint split_payment_check added successfully');
  } catch (error) {
    console.error('Error adding constraint:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
