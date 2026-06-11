#!/bin/bash
# ==========================================
# Prisma Migration Script
# Run this after deploying the latest changes
# ==========================================

set -e

echo "=========================================="
echo "Running Prisma Migration"
echo "=========================================="

cd "$(dirname "$0")/backend"

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
 echo "ERROR: DATABASE_URL environment variable is not set"
  echo "Please set it first:"
  echo "  export DATABASE_URL='postgresql://user:password@host:5432/dbname'"
  exit 1
fi

echo "Using DATABASE_URL: ${DATABASE_URL%@*}@***"  # Hide password in log

# Run migration
echo "Running migration: add_manually_disabled_to_discount"
npx prisma migrate deploy

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

echo "=========================================="
echo "Migration completed successfully!"
echo "=========================================="
