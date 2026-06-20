#!/bin/bash
# ============================================================
# Ngemiloh POS - Container Health Monitor
# Monitors all containers and alerts on unhealthy status
# ============================================================

set -e

# ============================================================
# Configuration - Override via environment variables
# ============================================================

# Get container names from env var or use defaults
# Format: space-separated list
NGEMILOH_CONTAINERS="${NGEMILOH_CONTAINERS:-ngemiloh_db ngemiloh_redis ngemiloh_api ngemiloh_caddy}"

# Parse CONTAINERS array
read -ra CONTAINERS <<< "$NGEMILOH_CONTAINERS"

HEALTHY_STATUS="Up"
UNHEALTHY_THRESHOLD=3  # Alert after N consecutive unhealthy checks
ALERT_LOG="${ALERT_LOG:-/var/log/pos-health.log}"
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID="${TELEGRAM_CHAT_ID:-}"

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter files for consecutive failures
COUNTER_DIR="/tmp/pos-health-counters"
mkdir -p "$COUNTER_DIR"

# Logging function
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$ALERT_LOG"
}

# Send Telegram alert
send_telegram_alert() {
    local container="$1"
    local status="$2"
    local message="$3"

    if [[ -n "$TELEGRAM_BOT_TOKEN" && -n "$TELEGRAM_CHAT_ID" ]]; then
        curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
            -d "chat_id=$TELEGRAM_CHAT_ID" \
            -d "text=🚨 *POS Alert*

*Container:* \`$container\`
*Status:* $status
*Details:* $message

_$(date '+%Y-%m-%d %H:%M:%S')_" \
            -d "parse_mode=Markdown" > /dev/null 2>&1
    fi
}

# Check container health
check_container_health() {
    local container="$1"
    local counter_file="$COUNTER_DIR/$container"
    local current_count=0

    # Get container status
    local status=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "unknown")
    local health=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}no-healthcheck{{end}}' "$container" 2>/dev/null || echo "unknown")

    # Determine if container is healthy
    if [[ "$status" == "running" ]]; then
        if [[ "$health" == "healthy" || "$health" == "no-healthcheck" ]]; then
            # Container is healthy - reset counter
            rm -f "$counter_file"
            echo "healthy"
            return 0
        else
            # Container is running but unhealthy
            current_count=$(cat "$counter_file" 2>/dev/null || echo "0")
            current_count=$((current_count + 1))
            echo "$current_count" > "$counter_file"

            if [[ $current_count -ge $UNHEALTHY_THRESHOLD ]]; then
                echo "critical"
                return 2
            else
                echo "unhealthy"
                return 1
            fi
        fi
    else
        # Container is not running
        echo "down"
        current_count=$(cat "$counter_file" 2>/dev/null || echo "0")
        current_count=$((current_count + 1))
        echo "$current_count" > "$counter_file"

        if [[ $current_count -ge $UNHEALTHY_THRESHOLD ]]; then
            echo "critical"
            return 2
        else
            echo "down"
            return 1
        fi
    fi
}

# Main monitoring loop
monitor_containers() {
    local all_healthy=true
    local critical_containers=()

    echo "========================================"
    echo "Ngemiloh POS - Container Health Check"
    echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
    echo "========================================"

    for container in "${CONTAINERS[@]}"; do
        local health_status=$(check_container_health "$container")
        local status=$(docker inspect --format='{{.State.Status}}' "$container" 2>/dev/null || echo "not found")
        local health_detail=$(docker inspect --format='{{if .State.Health}}{{.State.Health.Status}}{{else}}N/A{{end}}' "$container" 2>/dev/null || echo "N/A")
        local started=$(docker inspect --format='{{.State.StartedAt}}' "$container" 2>/dev/null || echo "N/A")

        if [[ "$health_status" == "healthy" ]]; then
            echo -e "${GREEN}✓${NC} $container: $status (health: $health_detail)"
        elif [[ "$health_status" == "unhealthy" || "$health_status" == "down" ]]; then
            echo -e "${YELLOW}⚠${NC} $container: $status (health: $health_detail)"
            all_healthy=false
        else
            echo -e "${RED}✗${NC} $container: $status (health: $health_detail)"
            all_healthy=false
            critical_containers+=("$container")
        fi
    done

    echo "========================================"

    # Send alert if critical containers found
    if [[ ${#critical_containers[@]} -gt 0 ]]; then
        log "CRITICAL" "Containers in critical state: ${critical_containers[*]}"
        for container in "${critical_containers[@]}"; do
            send_telegram_alert "$container" "CRITICAL" "Container unhealthy for $UNHEALTHY_THRESHOLD+ consecutive checks"
        done
    elif [[ "$all_healthy" == false ]]; then
        log "WARNING" "Some containers are not healthy"
    else
        log "INFO" "All containers healthy"
    fi

    return $([[ "$all_healthy" == true ]] && echo 0 || echo 1)
}

# One-shot check mode
if [[ "${1:-}" == "--check" ]]; then
    monitor_containers
    exit $?
fi

# Continuous monitoring mode
if [[ "${1:-}" == "--watch" ]]; then
    local interval="${2:-30}"
    log "INFO" "Starting continuous monitoring (interval: ${interval}s)"

    while true; do
        monitor_containers
        sleep "$interval"
    done
fi

# Default: single check
monitor_containers
