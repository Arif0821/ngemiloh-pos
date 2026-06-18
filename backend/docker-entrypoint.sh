#!/bin/sh
set -e

# ============================================================
# Ngemiloh POS - Production Startup Script
# Security: Load secrets, minimal logging, no sensitive info
# ============================================================

# Load secrets from Docker secrets files (if available)
# This allows reading from /run/secrets/<name> files

load_secrets() {
    # JWT Secret
    if [ -f "/run/secrets/jwt_access_secret" ]; then
        export JWT_ACCESS_SECRET=$(cat /run/secrets/jwt_access_secret)
    fi

    # PIN Pepper Secret
    if [ -f "/run/secrets/pin_pepper_secret" ]; then
        export PIN_PEPPER_SECRET=$(cat /run/secrets/pin_pepper_secret)
    fi

    # CSRF Secret
    if [ -f "/run/secrets/csrf_secret" ]; then
        export CSRF_SECRET=$(cat /run/secrets/csrf_secret)
    fi

    # DB Password
    if [ -f "/run/secrets/db_password" ]; then
        export DB_PASSWORD=$(cat /run/secrets/db_password)
    fi

    # Redis Password
    if [ -f "/run/secrets/redis_password" ]; then
        export REDIS_PASSWORD=$(cat /run/secrets/redis_password)
    fi

    # Midtrans Keys
    if [ -f "/run/secrets/midtrans_server_key_sandbox" ]; then
        export MIDTRANS_SERVER_KEY_SANDBOX=$(cat /run/secrets/midtrans_server_key_sandbox)
    fi

    if [ -f "/run/secrets/midtrans_server_key_production" ]; then
        export MIDTRANS_SERVER_KEY_PRODUCTION=$(cat /run/secrets/midtrans_server_key_production)
    fi

    # Email App Password
    if [ -f "/run/secrets/email_app_password" ]; then
        export EMAIL_APP_PASSWORD=$(cat /run/secrets/email_app_password)
    fi
}

# Load secrets
load_secrets

# Minimal startup - no debug output in production
if [ "${NODE_ENV}" = "production" ]; then
    # Production: Minimal logging
    echo "[INFO] Starting Ngemiloh POS..."
else
    # Development: Show info
    echo "[DEV] Starting Ngemiloh POS in development mode..."
fi

# Set library path for Prisma
export LD_LIBRARY_PATH="/app/node_modules/.prisma/client:${LD_LIBRARY_PATH}"

# Verify main.js exists
if [ ! -f "/app/dist/main.js" ]; then
    echo "[ERROR] Application not built: /app/dist/main.js not found"
    exit 1
fi

# Start the application
exec node /app/dist/main.js
