#!/bin/bash

# ==========================================
# Restore Script for Ngemiloh POS Database
# Usage: ./restore.sh <backup_file> [options]
# ==========================================

set -euo pipefail

# ==========================================
# Configuration
# ==========================================
BACKUP_DIR="${BACKUP_DIR:-./backups}"
DB_NAME="${DB_NAME:-ngemiloh_db}"
DB_USER="${DB_USER:-ngemiloh}"
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
RESTORE_DIR="${RESTORE_DIR:-/var/backups/ngemiloh}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ==========================================
# Usage
# ==========================================
usage() {
    cat << EOF
${BLUE}Ngemiloh POS - Database Restore Script${NC}

${GREEN}Usage:${NC}
    $0 <backup_file> [options]

${GREEN}Arguments:${NC}
    backup_file    Path to encrypted backup file (.enc) or gzip (.gz)

${GREEN}Options:${NC}
    -h, --help              Show this help message
    -d, --dir DIR           Backup directory (default: $BACKUP_DIR)
    --no-verify             Skip verification step
    --dry-run               Show what would be done without executing

${GREEN}Examples:${NC}
    $0 ./backups/db_backup_20240115_020000.sql.gz.enc
    $0 ./backups/db_backup_20240115_020000.sql.gz --dry-run
    BACKUP_ENCRYPTION_KEY=xxx $0 ./backups/latest.enc

${GREEN}Restore Steps:${NC}
    1. Verify backup file integrity
    2. Decrypt (if encrypted)
    3. Decompress
    4. Drop existing connections
    5. Restore database
    6. Verify restored data

EOF
    exit 0
}

# ==========================================
# Logging
# ==========================================
log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log_info() { log "${GREEN}[INFO]${NC} $@"; }
log_warn() { log "${YELLOW}[WARN]${NC} $@"; }
log_error() { log "${RED}[ERROR]${NC} $@"; }
log_step() { log "${BLUE}[STEP]${NC} $@"; }

# ==========================================
# Parse Arguments
# ==========================================
BACKUP_FILE=""
NO_VERIFY=false
DRY_RUN=false
LOG_FILE="/tmp/restore_$(date +%Y%m%d_%H%M%S).log"

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            usage
            ;;
        -d|--dir)
            BACKUP_DIR="$2"
            shift 2
            ;;
        --no-verify)
            NO_VERIFY=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        -*)
            log_error "Unknown option: $1"
            usage
            ;;
        *)
            if [ -z "$BACKUP_FILE" ]; then
                BACKUP_FILE="$1"
            else
                log_error "Multiple backup files specified"
                exit 1
            fi
            shift
            ;;
    esac
done

# ==========================================
# Validation
# ==========================================
if [ -z "$BACKUP_FILE" ]; then
    log_error "Backup file required"
    usage
fi

# Resolve full path
if [[ ! "$BACKUP_FILE" = /* ]]; then
    BACKUP_FILE="$BACKUP_DIR/$(basename "$BACKUP_FILE")"
fi

if [ ! -f "$BACKUP_FILE" ]; then
    log_error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

# ==========================================
# Detect File Type
# ==========================================
detect_file_type() {
    local file="$1"

    if [[ "$file" == *.enc ]]; then
        echo "encrypted"
    elif [[ "$file" == *.gz ]]; then
        echo "compressed"
    elif head -c 10 "$file" | grep -q "PGDMP"; then
        echo "plain"
    else
        echo "unknown"
    fi
}

# ==========================================
# Verify Backup Integrity
# ==========================================
verify_backup() {
    local file="$1"
    local file_type="$2"

    log_step "Verifying backup file..."

    # Check file exists and size
    local size=$(stat -c%s "$file" 2>/dev/null || stat -f%z "$file" 2>/dev/null || echo 0)
    if [ "$size" -lt 1024 ]; then
        log_error "Backup file too small: $size bytes"
        return 1
    fi
    log_info "File size: $((size / 1024))KB"

    # Verify checksum if exists
    local checksum_file="${file}.sha256"
    if [ -f "$checksum_file" ]; then
        log_info "Verifying checksum..."
        if ! sha256sum -c "$checksum_file" --status; then
            log_error "Checksum verification FAILED!"
            log_warn "File may be corrupted"
            return 1
        fi
        log_info "Checksum verified"
    else
        log_warn "No checksum file found: ${checksum_file}"
    fi

    # For encrypted files, verify OpenSSL format
    if [ "$file_type" = "encrypted" ]; then
        log_info "Verifying encrypted format..."
        if ! openssl enc -aes-256-cbc -salt -in "$file" -pass pass:test -d -t 2>/dev/null > /dev/null; then
            log_warn "Could not verify encryption format (this is normal if key is different)"
        else
            log_info "Encryption format valid"
        fi
    fi

    # For compressed files, verify gzip format
    if [ "$file_type" = "compressed" ] || [ "$file_type" = "encrypted" ]; then
        log_info "Verifying gzip format..."
        if ! gzip -t "$file" 2>/dev/null; then
            if [ "$file_type" = "encrypted" ]; then
                log_info "Cannot verify gzip (file is encrypted - will verify after decryption)"
            else
                log_error "Invalid gzip format"
                return 1
            fi
        else
            log_info "Gzip format valid"
        fi
    fi

    log_info "Verification complete"
    return 0
}

# ==========================================
# Decrypt Backup
# ==========================================
decrypt_backup() {
    local encrypted_file="$1"
    local decrypted_file="${encrypted_file%.enc}"

    if [ -z "${BACKUP_ENCRYPTION_KEY:-}" ]; then
        log_error "BACKUP_ENCRYPTION_KEY required for encrypted backups"
        log_info "Set it: export BACKUP_ENCRYPTION_KEY='your_key'"
        return 1
    fi

    log_step "Decrypting backup..."

    local tmp_key_file
    tmp_key_file=$(mktemp)
    trap 'shred -u "$tmp_key_file" 2>/dev/null || true' EXIT

    chmod 600 "$tmp_key_file"
    printf '%s' "$BACKUP_ENCRYPTION_KEY" > "$tmp_key_file"

    if ! openssl enc -aes-256-cbc -d -salt -in "$encrypted_file" -out "$decrypted_file" -pass "file:$tmp_key_file" 2>&1; then
        log_error "Decryption failed! Check BACKUP_ENCRYPTION_KEY"
        rm -f "$decrypted_file"
        return 1
    fi

    log_info "Decryption complete: $decrypted_file"
    echo "$decrypted_file"
}

# ==========================================
# Decompress Backup
# ==========================================
decompress_backup() {
    local compressed_file="$1"
    local decompressed_file="${compressed_file%.gz}"

    log_step "Decompressing backup..."

    if ! gzip -d "$compressed_file" 2>&1; then
        log_error "Decompression failed!"
        return 1
    fi

    log_info "Decompression complete: $decompressed_file"
    echo "$decompressed_file"
}

# ==========================================
# Check Active Connections
# ==========================================
check_connections() {
    log_step "Checking active database connections..."

    local connections
    connections=$(PGPPASSWORD="${DB_PASSWORD:-}" psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d postgres -t -c "SELECT count(*) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid != pg_backend_pid();" 2>/dev/null || echo "0")

    connections=$(echo "$connections" | tr -d '[:space:]')

    if [ "$connections" -gt 0 ]; then
        log_warn "Active connections found: $connections"
        log_info "Terminating connections..."

        PGPPASSWORD="${DB_PASSWORD:-}" psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid != pg_backend_pid();" 2>/dev/null || true

        sleep 2
    fi

    log_info "No active connections"
}

# ==========================================
# Restore Database
# ==========================================
restore_database() {
    local dump_file="$1"

    log_step "Dropping existing database..."
    PGPPASSWORD="${DB_PASSWORD:-}" psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};" 2>/dev/null || true

    log_step "Creating database..."
    PGPPASSWORD="${DB_PASSWORD:-}" psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d postgres -c "CREATE DATABASE ${DB_NAME};" 2>/dev/null || {
        log_error "Failed to create database"
        return 1
    }

    log_step "Restoring database (this may take a while)..."
    log_info "File: $dump_file"

    if ! PGPPASSWORD="${DB_PASSWORD:-}" pg_restore -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" --no-owner --no-acl -v "$dump_file" 2>&1; then
        log_error "Database restore failed!"
        return 1
    fi

    log_info "Restore complete"
}

# ==========================================
# Verify Restored Data
# ==========================================
verify_restore() {
    log_step "Verifying restored database..."

    # Check table count
    local table_count
    table_count=$(PGPPASSWORD="${DB_PASSWORD:-}" psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d '[:space:]' || echo "0")

    if [ "$table_count" -lt 10 ]; then
        log_error "Suspicious table count: $table_count"
        return 1
    fi
    log_info "Tables found: $table_count"

    # Check for critical tables
    for table in users orders products members; do
        local count
        count=$(PGPPASSWORD="${DB_PASSWORD:-}" psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -t -c "SELECT count(*) FROM \"$table\";" 2>/dev/null | tr -d '[:space:]' || echo "0")
        log_info "Table '$table': $count rows"
    done

    log_info "Verification complete"
}

# ==========================================
# Main
# ==========================================
main() {
    echo ""
    echo "=========================================="
    echo "  Ngemiloh POS - Database Restore"
    echo "=========================================="
    echo ""
    log_info "Backup file: $BACKUP_FILE"
    log_info "Target DB: $DB_NAME@$DB_HOST:$DB_PORT"
    log_info "Log file: $LOG_FILE"
    echo ""

    if [ "$DRY_RUN" = true ]; then
        log_warn "DRY RUN MODE - No changes will be made"
    fi

    # ==========================================
    # Step 1: Verify
    # ==========================================
    if [ "$NO_VERIFY" = false ]; then
        local file_type
        file_type=$(detect_file_type "$BACKUP_FILE")
        log_info "File type: $file_type"

        if [ "$DRY_RUN" = false ]; then
            if ! verify_backup "$BACKUP_FILE" "$file_type"; then
                log_error "Backup verification failed"
                exit 1
            fi
        fi
    fi

    # ==========================================
    # Step 2: Prepare working file
    # ==========================================
    local work_file="$BACKUP_FILE"
    local cleanup_files=()

    # Decrypt if needed
    if [[ "$work_file" == *.enc ]]; then
        if [ "$DRY_RUN" = false ]; then
            work_file=$(decrypt_backup "$work_file")
            cleanup_files+=("$work_file")
        else
            work_file="${work_file%.enc}"
            log_info "Would decrypt to: $work_file"
        fi
    fi

    # Decompress if needed
    if [[ "$work_file" == *.gz ]]; then
        if [ "$DRY_RUN" = false ]; then
            work_file=$(decompress_backup "$work_file")
            cleanup_files+=("$work_file")
        else
            work_file="${work_file%.gz}"
            log_info "Would decompress to: $work_file"
        fi
    fi

    # ==========================================
    # Step 3: Restore
    # ==========================================
    if [ "$DRY_RUN" = false ]; then
        check_connections
        restore_database "$work_file"
        verify_restore

        # Cleanup temp files
        for f in "${cleanup_files[@]}"; do
            [ -f "$f" ] && rm -f "$f"
        done

        echo ""
        echo "=========================================="
        log_info "Restore completed successfully!"
        echo "=========================================="
        echo ""
        log_info "Next steps:"
        log_info "1. Run migrations: docker compose exec nestjs-api npx prisma migrate deploy"
        log_info "2. Verify data: docker compose exec postgres psql -U ngemiloh -d ngemiloh_db -c 'SELECT count(*) FROM orders;'"
        echo ""
    else
        echo ""
        echo "=========================================="
        log_info "Dry run complete - no changes made"
        echo "=========================================="
    fi
}

main "$@"
