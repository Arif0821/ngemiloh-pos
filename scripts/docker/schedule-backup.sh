#!/bin/bash

# ==========================================
# Schedule Backup Script for Docker/Cron
# Usage: docker compose exec postgres /scripts/schedule-backup.sh
# Schedule: 0 2 * * * (02:00 WIB daily)
# ==========================================

set -euo pipefail

# ==========================================
# Configuration
# ==========================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ngemiloh}"
LOG_FILE="${BACKUP_DIR}/backup.log"

# ==========================================
# Colors
# ==========================================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ==========================================
# Logging
# ==========================================
log() {
    local level="$1"
    shift
    local message="[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*"
    echo -e "$message" | tee -a "$LOG_FILE" 2>/dev/null || echo "$message"
}

log_info() { log "${GREEN}INFO${NC}" "$@"; }
log_warn() { log "${YELLOW}WARN${NC}" "$@"; }
log_error() { log "${RED}ERROR${NC}" "$@"; }

# ==========================================
# Environment Check
# ==========================================
check_env() {
    log_info "Checking backup environment..."

    if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
        log_warn "BACKUP_ENCRYPTION_KEY not set - backup will NOT be encrypted"
        ENCRYPT_ENABLED="false"
    else
        ENCRYPT_ENABLED="true"
        log_info "Encryption: ENABLED"
    fi

    if [ -z "${DB_PASSWORD:-}" ]; then
        log_error "DB_PASSWORD not set - cannot connect to database"
        exit 1
    fi
}

# ==========================================
# Cleanup Old Backups
# ==========================================
cleanup_old_backups() {
    local retention="${BACKUP_RETENTION_DAYS:-30}"

    log_info "Cleaning up backups older than $retention days..."

    find "$BACKUP_DIR" -type f \( -name "*.gz" -o -name "*.enc" -o -name "*.sha256" \) -mtime +"$retention" -delete 2>/dev/null || true

    log_info "Cleanup complete"
}

# ==========================================
# Send Alert (Telegram/Webhook)
# ==========================================
send_alert() {
    local severity="$1"
    local message="$2"

    # Telegram
    if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=${TELEGRAM_CHAT_ID}" \
            -d "text=🗄️ *Ngemiloh POS Backup*

*Severity:* $severity
*Message:* $message
*Time:* $(date '+%Y-%m-%d %H:%M:%S')" \
            -d "parse_mode=Markdown" > /dev/null 2>&1 || true
    fi

    # Webhook
    if [[ -n "${BACKUP_WEBHOOK_URL:-}" ]]; then
        curl -s -X POST "${BACKUP_WEBHOOK_URL}" \
            -H "Content-Type: application/json" \
            -d "{\"severity\":\"$severity\",\"message\":\"$message\",\"timestamp\":\"$(date -Iseconds)\"}" > /dev/null 2>&1 || true
    fi
}

# ==========================================
# Verify Backup
# ==========================================
verify_backup() {
    local backup_file="$1"

    # Check file exists
    if [ ! -f "$backup_file" ]; then
        log_error "Backup file not found: $backup_file"
        return 1
    fi

    # Check size
    local size_kb=$(stat -c%s "$backup_file" 2>/dev/null || stat -f%z "$backup_file" 2>/dev/null || echo 0)
    size_kb=$((size_kb / 1024))

    if [ "$size_kb" -lt "${MIN_BACKUP_SIZE_KB:-10}" ]; then
        log_error "Backup suspiciously small: ${size_kb}KB"
        return 1
    fi

    log_info "Backup verified: ${size_kb}KB"
    return 0
}

# ==========================================
# Main Backup Process
# ==========================================
main() {
    log_info "=========================================="
    log_info "Starting scheduled backup..."
    log_info "=========================================="

    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    chmod 700 "$BACKUP_DIR"

    # Check environment
    check_env

    # Generate filenames
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local db_name="${DB_NAME:-ngemiloh_db}"
    local db_user="${DB_USER:-ngemiloh}"

    local dump_file="$BACKUP_DIR/db_backup_${timestamp}.sql"
    local zip_file="$dump_file.gz"
    local enc_file="$zip_file.enc"

    # ==========================================
    # Step 1: Dump Database
    # ==========================================
    log_info "Step 1: Dumping database..."

    if ! PGPPASSWORD="$DB_PASSWORD" pg_dump -U "$db_user" -h localhost -p 5432 -d "$db_name" -F p -f "$dump_file" 2>&1; then
        log_error "Database dump failed!"
        send_alert "CRITICAL" "Database backup failed during pg_dump"
        exit 1
    fi

    log_info "Dump complete: $dump_file"

    # ==========================================
    # Step 2: Compress
    # ==========================================
    log_info "Step 2: Compressing..."

    if ! gzip "$dump_file"; then
        log_error "Compression failed!"
        send_alert "CRITICAL" "Database backup compression failed"
        rm -f "$dump_file"
        exit 1
    fi

    log_info "Compression complete: $zip_file"

    # ==========================================
    # Step 3: Encrypt (if enabled)
    # ==========================================
    if [ "$ENCRYPT_ENABLED" = "true" ]; then
        log_info "Step 3: Encrypting..."

        local tmp_key_file
        tmp_key_file=$(mktemp)
        trap 'shred -u "$tmp_key_file" 2>/dev/null || true' EXIT

        chmod 600 "$tmp_key_file"
        printf '%s' "$BACKUP_ENCRYPTION_KEY" > "$tmp_key_file"

        if ! openssl enc -aes-256-cbc -salt -in "$zip_file" -out "$enc_file" -pass "file:$tmp_key_file" 2>&1; then
            log_error "Encryption failed!"
            send_alert "CRITICAL" "Database backup encryption failed"
            rm -f "$zip_file"
            exit 1
        fi

        # Remove unencrypted
        rm -f "$zip_file"

        # Verify encrypted file
        if ! verify_backup "$enc_file"; then
            log_error "Encrypted backup verification failed!"
            exit 1
        fi

        # Generate checksum
        sha256sum "$enc_file" > "$enc_file.sha256"

        log_info "Encryption complete: $enc_file"
        log_info "=========================================="
        log_info "Backup completed successfully!"
        log_info "File: $enc_file"
        log_info "Checksum: $(head -c 16 "$enc_file.sha256")..."
        log_info "=========================================="

    else
        # No encryption - just keep gzip
        if ! verify_backup "$zip_file"; then
            log_error "Backup verification failed!"
            exit 1
        fi

        sha256sum "$zip_file" > "$zip_file.sha256"

        log_info "=========================================="
        log_info "Backup completed successfully! (UNENCRYPTED)"
        log_info "File: $zip_file"
        log_info "=========================================="
    fi

    # ==========================================
    # Step 4: Cleanup Old Backups
    # ==========================================
    cleanup_old_backups

    # ==========================================
    # Step 5: Upload to Cloud (if configured)
    # ==========================================
    if [[ -n "${BACKUP_RCLONE_REMOTE:-}" ]]; then
        log_info "Step 5: Uploading to cloud..."

        local upload_file
        if [ "$ENCRYPT_ENABLED" = "true" ]; then
            upload_file="$enc_file"
        else
            upload_file="$zip_file"
        fi

        if rclone copy "$upload_file" "$BACKUP_RCLONE_REMOTE" 2>&1; then
            log_info "Upload complete!"
        else
            log_warn "Upload failed - local backup still available"
            send_alert "WARNING" "Backup upload to cloud failed"
        fi
    fi

    # ==========================================
    # Send Success Alert
    # ==========================================
    send_alert "INFO" "Backup completed successfully"
}

# Run
main "$@"
