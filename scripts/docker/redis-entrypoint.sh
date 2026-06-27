#!/bin/sh
# ============================================================
# Ngemiloh POS - Redis Startup Script (Development Mode)
# NO PASSWORD - For local development only
# ============================================================

set -e

echo "[DEV] Starting Redis without password (DEVELOPMENT ONLY!)"

# Ensure /data directory exists and has correct permissions
# This fixes permission issues on Windows Docker Desktop
mkdir -p /data || true
chown redis:redis /data 2>/dev/null || true
chmod 755 /data 2>/dev/null || true

# Start Redis without password authentication
# TEMPORARY: Disabled appendonly due to volume permission issues on Windows Docker Desktop
# Note: EVAL command is allowed because Bull queue needs it for job processing
exec redis-server \
    --appendonly no \
    --loglevel warning \
    --maxmemory 200mb \
    --maxmemory-policy noeviction \
    --rename-command FLUSHDB "" \
    --rename-command FLUSHALL "" \
    --rename-command SHUTDOWN "SHUTDOWN_NG" \
    --rename-command CONFIG "CONFIG_NG" \
    --rename-command DEBUG ""
