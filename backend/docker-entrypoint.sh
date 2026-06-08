#!/bin/sh
set -e

echo "=============================================="
echo "  Ngemiloh POS - Container Startup"
echo "=============================================="

# Step 1: Run Prisma Migrations
echo ""
echo "[1/3] Running Prisma migrations..."
npx prisma migrate deploy
echo "[1/3] ✅ Migrations completed successfully!"

# Step 2: Run Prisma Seed (non-fatal — jika gagal, server tetap jalan)
echo ""
echo "[2/3] Running database seed..."
if npx prisma db seed 2>&1; then
  echo "[2/3] ✅ Seed completed successfully!"
else
  echo "[2/3] ⚠️  Seed failed (non-fatal). Server will still start."
  echo "[2/3]    Seed mungkin sudah pernah dijalankan sebelumnya."
fi

# Step 3: Start NestJS server
echo ""
echo "[3/3] Starting NestJS server on port 3000..."
echo "=============================================="
exec node dist/main.js
