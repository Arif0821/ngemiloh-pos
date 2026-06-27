#!/bin/sh
# ============================================================
# Ngemiloh POS - Redis Startup Script (Production Mode)
# WITH PASSWORD - Secure production deployment
# ============================================================

set -e

# Get password from environment or Docker secret
REDIS_PASSWORD="${REDIS_PASSWORD:-}"

# Load from Docker secret if available
if [ -f "/run/secrets/redis_password" ]; then
    REDIS_PASSWORD=$(cat /run/secrets/redis_password)
fi

# Validate password is set
if [ -z "$REDIS_PASSWORD" ]; then
    echo "[ERROR] Redis password not set!"
    echo "        Set REDIS_PASSWORD env var or /run/secrets/redis_password"
    echo "        For development, use redis-entrypoint.sh instead"
    exit 1
fi

# Validate password is not too short
if [ ${#REDIS_PASSWORD} -lt 8 ]; then
    echo "[WARNING] Redis password is less than 8 characters"
fi

echo "[PROD] Starting Redis with password authentication"

# Ensure /data directory exists and has correct permissions
# This fixes permission issues on Docker volumes
mkdir -p /data || true
chown redis:redis /data 2>/dev/null || true
chmod 755 /data 2>/dev/null || true

# Start Redis with password and security hardening
exec redis-server \
    --appendonly yes \
    --loglevel notice \
    --requirepass "$REDIS_PASSWORD" \
    --maxmemory 200mb \
    --maxmemory-policy allkeys-lru \
    --rename-command FLUSHDB "" \
    --rename-command FLUSHALL "" \
    --rename-command SHUTDOWN "SHUTDOWN_NG" \
    --rename-command CONFIG "CONFIG_NG" \
    --rename-command DEBUG ""
