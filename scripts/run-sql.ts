import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    await prisma.$executeRawUnsafe('ALTER TABLE "ProductModifierOption" DROP CONSTRAINT IF EXISTS additional_price_check;');
    await prisma.$executeRawUnsafe('ALTER TABLE "ProductModifierOption" ADD CONSTRAINT additional_price_check CHECK (additional_price >= 0);');
    console.log('Constraint added successfully');
  } catch (error) {
    console.error('Error adding constraint:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
