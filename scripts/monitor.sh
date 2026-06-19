#!/bin/bash
# scripts/monitor.sh - Docker-native monitoring
# Run via cron: */5 * * * * /app/scripts/monitor.sh

set -uo pipefail

ALERT_EMAIL="${EMAIL_ALERT_TO:-admin@ngemiloh.local}"
LOG_FILE="/var/log/monitor.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Check API health
if ! curl -sf --max-time 10 http://localhost:3000/_health > /dev/null 2>&1; then
    log "ERROR: API unhealthy"
    # Send alert (if mail configured)
    [ -n "$ALERT_EMAIL" ] && echo "API is down!" | mail -s "ALERT: API unhealthy" "$ALERT_EMAIL"
fi

# Check database
if ! docker exec ngemiloh_db pg_isready -U ngemiloh > /dev/null 2>&1; then
    log "ERROR: Database unhealthy"
    [ -n "$ALERT_EMAIL" ] && echo "Database is down!" | mail -s "ALERT: Database unhealthy" "$ALERT_EMAIL"
fi

# Check Redis (use stdin for password to avoid credential exposure in ps aux)
REDIS_PASS=$(cat /run/secrets/redis_password 2>/dev/null || echo '')
if [ -n "$REDIS_PASS" ]; then
    if ! (echo "$REDIS_PASS" | docker exec ngemiloh_redis redis-cli -a stdin ping 2>/dev/null | grep -q PONG); then
        log "ERROR: Redis unhealthy"
        [ -n "$ALERT_EMAIL" ] && echo "Redis is down!" | mail -s "ALERT: Redis unhealthy" "$ALERT_EMAIL"
    fi
else
    # Fallback: no auth
    if ! docker exec ngemiloh_redis redis-cli ping 2>/dev/null | grep -q PONG; then
        log "ERROR: Redis unhealthy"
        [ -n "$ALERT_EMAIL" ] && echo "Redis is down!" | mail -s "ALERT: Redis unhealthy" "$ALERT_EMAIL"
    fi
fi

# Check disk space
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | cut -d'%' -f1)
if [ "$DISK_USAGE" -gt 80 ]; then
    log "WARNING: High disk usage: ${DISK_USAGE}%"
    [ -n "$ALERT_EMAIL" ] && echo "Disk usage: ${DISK_USAGE}%" | mail -s "ALERT: High disk usage" "$ALERT_EMAIL"
fi

# Check container status
UNHEALTHY=$(docker ps --filter "health=unhealthy" --format "{{.Names}}" | wc -l)
if [ "$UNHEALTHY" -gt 0 ]; then
    CONTAINERS=$(docker ps --filter "health=unhealthy" --format "{{.Names}}")
    log "WARNING: $UNHEALTHY unhealthy containers: $CONTAINERS"
    [ -n "$ALERT_EMAIL" ] && echo "Unhealthy containers: $CONTAINERS" | mail -s "ALERT: Unhealthy containers" "$ALERT_EMAIL"
fi

log "Monitor check complete"
