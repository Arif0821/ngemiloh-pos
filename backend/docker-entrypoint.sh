#!/bin/sh
# ============================================================
# Ngemiloh POS - Production Startup Script
# For distroless/static images
# Includes OOM Recovery with graceful restart
# ============================================================

set -e

# OOM Recovery Configuration
OOM_THRESHOLD_MB=${OOM_THRESHOLD_MB:-400}
OOM_CHECK_INTERVAL=${OOM_CHECK_INTERVAL:-30}
OOM_GRACE_PERIOD=${OOM_GRACE_PERIOD:-5}

# Load secrets from Docker secrets files (if available)
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

# Check if application is healthy
check_app_health() {
    wget --quiet --tries=1 --spider http://127.0.0.1:3000/_health 2>/dev/null
    return $?
}

# Get memory usage in MB
get_memory_usage_mb() {
    # Linux memory usage of node process (RSS in KB)
    if [ -f /proc/self/status ]; then
        grep VmRSS /proc/self/status 2>/dev/null | awk '{print int($2/1024)}'
    else
        echo "0"
    fi
}

# OOM recovery loop - gracefully restart when memory exceeds threshold
start_with_oom_recovery() {
    local restart_count=0
    local max_restarts=${MAX_RESTARTS:-5}
    local restart_cooldown=${RESTART_COOLDOWN:-60}

    echo "[INFO] OOM Recovery enabled (threshold: ${OOM_THRESHOLD_MB}MB, check interval: ${OOM_CHECK_INTERVAL}s)"

    while true; do
        echo "[INFO] Starting Ngemiloh POS (attempt $((restart_count + 1)))..."

        # Run database migrations (always, including development)
        if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
            echo "[INFO] Running database migrations..."
            npx prisma migrate deploy
            echo "[INFO] Migrations complete"
        fi

        # Start the application in background
        node /app/dist/main.js &
        local app_pid=$!

        # Monitor memory in background
        (
            while kill -0 $app_pid 2>/dev/null; do
                sleep ${OOM_CHECK_INTERVAL}

                # Get current memory usage
                local mem_usage=$(get_memory_usage_mb)

                if [ "$mem_usage" -gt "${OOM_THRESHOLD_MB}" ]; then
                    echo "[WARN] Memory usage high: ${mem_usage}MB > ${OOM_THRESHOLD_MB}MB threshold"
                    echo "[INFO] Initiating graceful shutdown..."

                    # Send SIGTERM for graceful shutdown
                    kill -TERM $app_pid 2>/dev/null

                    # Wait for graceful shutdown (with timeout)
                    local waited=0
                    while kill -0 $app_pid 2>/dev/null && [ $waited -lt $((OOM_GRACE_PERIOD * 10)) ]; do
                        sleep 0.1
                        waited=$((waited + 1))
                    done

                    # Force kill if still running
                    if kill -0 $app_pid 2>/dev/null; then
                        echo "[WARN] Graceful shutdown timeout, forcing..."
                        kill -KILL $app_pid 2>/dev/null
                    fi

                    echo "[INFO] Process terminated"
                    break
                fi
            done
        ) &
        local monitor_pid=$!

        # Wait for application to exit
        wait $app_pid 2>/dev/null
        local exit_code=$?

        # Stop the monitor
        kill $monitor_pid 2>/dev/null
        wait $monitor_pid 2>/dev/null

        # Check if we should restart
        restart_count=$((restart_count + 1))

        if [ $restart_count -ge $max_restarts ]; then
            echo "[ERROR] Max restarts (${max_restarts}) reached. Exiting."
            exit 1
        fi

        echo "[INFO] Process exited with code ${exit_code}. Restarting in ${restart_cooldown}s..."
        echo "[INFO] Restart ${restart_count}/${max_restarts}"

        sleep $restart_cooldown
    done
}

# Minimal startup - no debug output
if [ "${NODE_ENV}" = "production" ]; then
    echo "[INFO] Starting Ngemiloh POS..."
    # In production, use OOM recovery
    start_with_oom_recovery
else
    echo "[DEV] Starting Ngemiloh POS in development mode..."

    # Verify main.js exists
    if [ ! -f "/app/dist/main.js" ]; then
        echo "[ERROR] Application not built: /app/dist/main.js not found"
        exit 1
    fi

    # Run database migrations (always, including development)
    if [ "${SKIP_MIGRATIONS:-false}" != "true" ]; then
        echo "[INFO] Running database migrations..."
        npx prisma migrate deploy
        echo "[INFO] Migrations complete"
    fi

    # Start the application
    exec node /app/dist/main.js
fi
