#!/bin/bash

# ==========================================
# Automated PostgreSQL Backup Script v2
# Schedule via Cron (e.g., 0 2 * * * for 02:00 WIB daily)
# ==========================================

set -euo pipefail

# ==========================================
# Configuration - Override via environment variables
# ==========================================
DB_NAME="${DB_NAME:-ngemiloh_db}"
DB_USER="${DB_USER:-postgres}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/ngemiloh_pos}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
MIN_BACKUP_SIZE_KB="${MIN_BACKUP_SIZE_KB:-10}"
MAX_BACKUP_SIZE_MB="${MAX_BACKUP_SIZE_MB:-500}"

DATE=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/db_backup_$DATE.sql"
ZIPNAME="$FILENAME.gz"
ENCNAME="$ZIPNAME.enc"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# ==========================================
# Encryption Configuration (REQUIRED)
# ==========================================
if [ -z "$BACKUP_ENCRYPTION_KEY" ]; then
  echo -e "${RED}ERROR: BACKUP_ENCRYPTION_KEY environment variable is not set${NC}"
  echo "Please set it before running this script:"
  echo "  export BACKUP_ENCRYPTION_KEY='your-64-char-secret-key-here'"
  exit 1
fi
ENCRYPTION_KEY="$BACKUP_ENCRYPTION_KEY"

# ==========================================
# Logging Functions
# ==========================================
log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message"
}

log_info() { log "INFO" "$@"; }
log_warn() { log "WARN" "$@"; }
log_error() { log "ERROR" "$@"; }

# ==========================================
# Alert Functions
# ==========================================
send_alert() {
    local severity="$1"
    local message="$2"

    # Telegram alert (if configured)
    if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=${TELEGRAM_CHAT_ID}" \
            -d "text=🗄️ *Ngemiloh POS Backup*

*Severity:* $severity
*Message:* $message
*Time:* $(date '+%Y-%m-%d %H:%M:%S')" \
            -d "parse_mode=Markdown" > /dev/null 2>&1 || true
    fi

    # Webhook alert (if configured)
    if [[ -n "${BACKUP_WEBHOOK_URL:-}" ]]; then
        curl -s -X POST "${BACKUP_WEBHOOK_URL}" \
            -H "Content-Type: application/json" \
            -d "{\"severity\":\"$severity\",\"message\":\"$message\",\"timestamp\":\"$(date -Iseconds)\"}" > /dev/null 2>&1 || true
    fi
}

# ==========================================
# Backup Verification Functions
# ==========================================
verify_pg_dump_format() {
    local dump_file="$1"

    # Check file exists and is non-empty
    if [ ! -s "$dump_file" ]; then
        log_error "Dump file is missing or empty: $dump_file"
        return 1
    fi

    # Check PostgreSQL dump magic header
    if ! head -c 10 "$dump_file" | grep -q "PGDMP"; then
        log_error "Invalid PostgreSQL dump format - missing PGDMP header"
        return 1
    fi

    # Check minimum size
    local size_kb=$(stat -c%s "$dump_file" 2>/dev/null || stat -f%z "$dump_file" 2>/dev/null || echo 0)
    size_kb=$((size_kb / 1024))
    if [ "$size_kb" -lt "$MIN_BACKUP_SIZE_KB" ]; then
        log_error "Dump file suspiciously small: ${size_kb}KB (min: ${MIN_BACKUP_SIZE_KB}KB)"
        return 1
    fi

    log_info "Dump verification passed: ${size_kb}KB"
    return 0
}

verify_compressed_size() {
    local zip_file="$1"
    local size_mb=$(stat -c%s "$zip_file" 2>/dev/null || stat -f%z "$zip_file" 2>/dev/null || echo 0)
    size_mb=$((size_mb / 1024 / 1024))

    if [ "$size_mb" -gt "$MAX_BACKUP_SIZE_MB" ]; then
        log_warn "Compressed backup unusually large: ${size_mb}MB (max: ${MAX_BACKUP_SIZE_MB}MB)"
        log_warn "Consider reviewing database for unusual data growth"
    fi

    log_info "Compressed size: ${size_mb}MB"
    return 0
}

# ==========================================
# Retention Policy
# ==========================================
cleanup_old_backups() {
    local backup_dir="$1"
    local retention_days="$2"

    log_info "Cleaning up backups older than $retention_days days..."

    local deleted_count=0
    while IFS= read -r -d '' file; do
        rm -f "$file"
        deleted_count=$((deleted_count + 1))
    done < <(find "$backup_dir" -type f \( -name "*.enc" -o -name "*.sha256" \) -mtime +"$retention_days" -print0)

    if [ "$deleted_count" -gt 0 ]; then
        log_info "Cleaned up $deleted_count old backup files"
    else
        log_info "No old backups to clean up"
    fi
}

# ==========================================
# Main Backup Process
# ==========================================
main() {
    log_info "Starting backup for $DB_NAME at $DATE..."
    log_info "Backup directory: $BACKUP_DIR"

    # Create backup directory
    mkdir -p "$BACKUP_DIR"
    chmod 700 "$BACKUP_DIR"  # Restrict permissions

    # ==========================================
    # Step 1: Dump database
    # ==========================================
    log_info "Step 1: Dumping database..."
    if ! PGPASSWORD="${DB_PASSWORD:-}" pg_dump -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -F p -f "$FILENAME" 2>&1; then
        log_error "Database dump failed!"
        send_alert "CRITICAL" "Database backup failed during pg_dump"
        exit 1
    fi

    # Verify dump format
    if ! verify_pg_dump_format "$FILENAME"; then
        log_error "Dump verification failed!"
        send_alert "CRITICAL" "Database backup verification failed"
        rm -f "$FILENAME"
        exit 1
    fi

    # ==========================================
    # Step 2: Compress
    # ==========================================
    log_info "Step 2: Compressing..."
    if ! gzip "$FILENAME" 2>&1; then
        log_error "Compression failed!"
        send_alert "CRITICAL" "Database backup compression failed"
        rm -f "$FILENAME"
        exit 1
    fi

    verify_compressed_size "$ZIPNAME"

    # ==========================================
    # Step 3: Encrypt
    # ==========================================
    log_info "Step 3: Encrypting..."

    # Create temp file with key (avoids key exposure in process list)
    local tmp_key_file
    tmp_key_file=$(mktemp)
    trap 'shred -u "$tmp_key_file" 2>/dev/null || true' EXIT

    chmod 600 "$tmp_key_file"
    printf '%s' "$ENCRYPTION_KEY" > "$tmp_key_file"

    if ! openssl enc -aes-256-cbc -salt -in "$ZIPNAME" -out "$ENCNAME" -pass "file:$tmp_key_file" 2>&1; then
        log_error "Encryption failed!"
        send_alert "CRITICAL" "Database backup encryption failed"
        rm -f "$ZIPNAME"
        exit 1
    fi

    # ==========================================
    # Step 4: Verify encrypted file
    # ==========================================
    log_info "Step 4: Verifying encrypted backup..."
    if [ ! -s "$ENCNAME" ]; then
        log_error "Encrypted backup file is missing or empty"
        send_alert "CRITICAL" "Encrypted backup file validation failed"
        exit 1
    fi

    # ==========================================
    # Step 5: Generate checksum
    # ==========================================
    log_info "Step 5: Generating SHA-256 checksum..."
    sha256sum "$ENCNAME" > "$ENCNAME.sha256"
    log_info "Checksum: $(head -c 16 "$ENCNAME.sha256")..."

    # ==========================================
    # Step 6: Cleanup unencrypted files
    # ==========================================
    log_info "Step 6: Cleaning up unencrypted files..."
    rm -f "$ZIPNAME"
    log_info "Unencrypted backup removed"

    # ==========================================
    # Step 7: Apply retention policy
    # ==========================================
    cleanup_old_backups "$BACKUP_DIR" "$RETENTION_DAYS"

    # ==========================================
    # Step 8: Upload to cloud (optional)
    # ==========================================
    if [[ -n "${BACKUP_RCLONE_REMOTE:-}" ]]; then
        log_info "Step 8: Uploading to cloud storage..."
        if rclone copy "$ENCNAME" "$BACKUP_RCLONE_REMOTE" 2>&1; then
            log_info "Backup uploaded successfully"
        else
            log_warn "Backup upload failed - local backup still available"
            send_alert "WARNING" "Backup upload to cloud storage failed"
        fi
    fi

    # ==========================================
    # Success
    # ==========================================
    log_info "=========================================="
    log_info "Backup completed successfully!"
    log_info "File: $ENCNAME"
    log_info "=========================================="

    send_alert "INFO" "Backup completed: $ENCNAME"
}

# Run main function
main "$@"
