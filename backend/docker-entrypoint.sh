#!/bin/sh
set -e

echo "=============================================="
echo "  Ngemiloh POS - Container Startup"
echo "=============================================="

# FIX: Setup Prisma for Debian (copy glibc engine)
echo ""
echo "[FIX] Setting up Prisma for Debian..."
mkdir -p /app/node_modules/.prisma/client
# Copy linux-glibc-libssl engine from @prisma/engines
cp /app/node_modules/@prisma/engines/libquery_engine-linux-glibc.so.node /app/node_modules/.prisma/client/ 2>/dev/null || echo "[FIX] glibc engine not found"
ls -la /app/node_modules/.prisma/client/*.so* 2>/dev/null | head -5
echo "[FIX] Prisma setup complete"

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
# Check multiple possible locations for main.js
if [ -f "/app/dist/main.js" ]; then
    echo "/app/dist/main.js EXISTS!"
    ls -la /app/dist/main.js
elif [ -f "/app/dist/src/main.js" ]; then
    echo "/app/dist/src/main.js EXISTS!"
    ls -la /app/dist/src/main.js
else
    echo "main.js NOT FOUND in expected locations!"
    echo "[DEBUG] Looking for any main*.js files:"
    find /app -name "main*.js" -type f 2>/dev/null
fi

# Debug: Check Node and TypeScript
echo ""
echo "[DEBUG] Node version:"
node --version
echo "[DEBUG] TypeScript version:"
npx tsc --version 2>/dev/null || echo "tsc not found"

# Step 1: Run Prisma Migrations (skip - assume DB already migrated)
echo ""
echo "[1/3] Skipping Prisma migrations (DB already migrated)..."

# Step 2: Run Prisma Seed (skip - data already exists)
echo ""
echo "[2/3] Skipping database seed (data already exists)..."

# Step 3: Start NestJS server
echo ""
echo "[3/3] Starting NestJS server on port 3000..."
echo "=============================================="

# Find main.js in possible locations
if [ -f "/app/dist/main.js" ]; then
    MAIN_JS="/app/dist/main.js"
elif [ -f "/app/dist/src/main.js" ]; then
    MAIN_JS="/app/dist/src/main.js"
else
    echo "[ERROR] Cannot start - main.js not found!"
    echo "[DEBUG] Current directory: $(pwd)"
    echo "[DEBUG] /app contents:"
    ls -la /app/
    echo "[DEBUG] /app/dist contents:"
    ls -la /app/dist/ 2>/dev/null || echo "/app/dist not found"
    exit 1
fi

echo "[DEBUG] Starting NestJS with main.js at: $MAIN_JS"
export LD_LIBRARY_PATH="/app/node_modules/.prisma/client:${LD_LIBRARY_PATH}"
exec node "$MAIN_JS"