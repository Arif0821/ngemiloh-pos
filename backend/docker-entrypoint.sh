#!/bin/sh

echo "=============================================="
echo "  Ngemiloh POS - Container Startup"
echo "=============================================="

# Step 1: Run Prisma Migrations
echo ""
echo "[1/3] Running Prisma migrations..."
if npx prisma migrate deploy 2>&1; then
  echo "[1/3] ✅ Migrations completed successfully!"
else
  echo "[1/3] ❌ Migrations failed! Server will still attempt to start for debugging."
fi

# Step 2: Run Prisma Seed
echo ""
echo "[2/3] Running database seed..."
if npx prisma db seed 2>&1; then
  echo "[2/3] ✅ Seed completed successfully!"
else
  echo "[2/3] ⚠️  Seed failed (non-fatal). Server will still start."
fi

# Step 3: Start NestJS server
echo ""
echo "[3/3] Starting NestJS server on port 3000..."
echo "=============================================="
exec node dist/main.js
