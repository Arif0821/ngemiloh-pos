#!/bin/bash
# scripts/backup-config.sh - Backup configuration files
# Run via cron: 0 3 * * * /app/scripts/backup-config.sh

BACKUP_DIR="${BACKUP_DIR:-/backups/config}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting config backup..."

# Backup Caddyfile
if [ -f "Caddyfile" ]; then
    cp Caddyfile "$BACKUP_DIR/Caddyfile.$TIMESTAMP"
    log "Backed up Caddyfile"
fi

# Backup docker-compose.yml
if [ -f "docker-compose.yml" ]; then
    cp docker-compose.yml "$BACKUP_DIR/docker-compose.yml.$TIMESTAMP"
    log "Backed up docker-compose.yml"
fi

# Backup backend .env.example (not secrets)
if [ -f "backend/.env.example" ]; then
    cp backend/.env.example "$BACKUP_DIR/backend.env.example.$TIMESTAMP"
    log "Backed up backend .env.example"
fi

# Backup frontend .env.example
if [ -f "frontend/.env.example" ]; then
    cp frontend/.env.example "$BACKUP_DIR/frontend.env.example.$TIMESTAMP"
    log "Backed up frontend .env.example"
fi

# Compress old backups (keep last 30 days)
find "$BACKUP_DIR" -name "Caddyfile.*" -mtime +30 -delete 2>/dev/null
find "$BACKUP_DIR" -name "*.yml.*" -mtime +30 -delete 2>/dev/null
find "$BACKUP_DIR" -name "*.example.*" -mtime +30 -delete 2>/dev/null

log "Config backup complete: $BACKUP_DIR"
