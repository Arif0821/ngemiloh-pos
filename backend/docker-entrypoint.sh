#!/bin/sh
set -e

echo "=============================================="
echo "  Ngemiloh POS - Container Startup"
echo "=============================================="

# Debug: Check if dist exists
echo ""
echo "[DEBUG] Checking /app/dist directory..."
if [ -d "/app/dist" ]; then
    echo "[DEBUG] /app/dist exists!"
    ls -la /app/dist/
else
    echo "[DEBUG] /app/dist does NOT exist!"
    echo "[DEBUG] Listing /app contents:"
    ls -la /app/
fi

# Debug: Check if main.js exists
echo ""
echo "[DEBUG] Checking for main.js..."
if [ -f "/app/dist/main.js" ]; then
    echo "[DEBUG] /app/dist/main.js EXISTS!"
else
    echo "[DEBUG] /app/dist/main.js DOES NOT EXIST!"
fi

# Debug: Check Node and TypeScript
echo ""
echo "[DEBUG] Node version:"
node --version
echo "[DEBUG] TypeScript version:"
npx tsc --version 2>/dev/null || echo "tsc not found"

# Step 1: Run Prisma Migrations
echo ""
echo "[1/3] Running Prisma migrations..."
if npx prisma migrate deploy 2>&1; then
  echo "[1/3] ✅ Migrations completed successfully!"
else
  echo "[1/3] ❌ Migrations failed! Continuing anyway..."
fi

# Step 2: Run Prisma Seed
echo ""
echo "[2/3] Running database seed..."
if npx prisma db seed 2>&1; then
  echo "[2/3] ✅ Seed completed successfully!"
else
  echo "[2/3] ⚠️  Seed failed (non-fatal). Continuing..."
fi

# Step 3: Start NestJS server
echo ""
echo "[3/3] Starting NestJS server on port 3000..."
echo "=============================================="

# Check one more time before starting
if [ ! -f "/app/dist/main.js" ]; then
    echo "[ERROR] Cannot start - /app/dist/main.js not found!"
    echo "[ERROR] Build artifacts are missing!"
    exit 1
fi

exec node /app/dist/main.js
