#!/bin/sh
set -e

echo "=============================================="
echo "  Ngemiloh POS - Container Startup"
echo "=============================================="

# Debug: Check if dist exists and list contents
echo ""
echo "[DEBUG] Checking /app directory..."
ls -la /app/

echo ""
echo "[DEBUG] Checking /app/dist directory..."
if [ -d "/app/dist" ]; then
    echo "/app/dist exists!"
    ls -la /app/dist/
    echo ""
    echo "[DEBUG] Finding all JS files in /app/dist..."
    find /app/dist -name "*.js" -type f 2>/dev/null | head -30
else
    echo "/app/dist does NOT exist!"
fi

echo ""
echo "[DEBUG] Checking for main.js..."
if [ -f "/app/dist/main.js" ]; then
    echo "/app/dist/main.js EXISTS!"
    ls -la /app/dist/main.js
else
    echo "/app/dist/main.js DOES NOT EXIST!"
    echo "[DEBUG] Looking for any main*.js files:"
    find /app -name "main*.js" -type f 2>/dev/null
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
    echo "[DEBUG] Current directory: $(pwd)"
    echo "[DEBUG] /app contents:"
    ls -la /app/
    echo "[DEBUG] /app/dist contents:"
    ls -la /app/dist/ 2>/dev/null || echo "/app/dist not found"
    exit 1
fi

exec node /app/dist/main.js
