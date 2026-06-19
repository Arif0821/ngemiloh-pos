#!/bin/bash

# ==========================================
# Automated PostgreSQL Backup Script
# Schedule via Cron (e.g., 0 2 * * * for 02:00 WIB daily)
# ==========================================

# Configuration
DB_NAME="ngemiloh_db"
DB_USER="postgres"
BACKUP_DIR="/var/backups/ngemiloh_pos"
DATE=$(date +"%Y%m%d_%H%M%S")
FILENAME="$BACKUP_DIR/db_backup_$DATE.sql"
ZIPNAME="$FILENAME.gz"

# Encrypt Configuration
# SEDANG-08: Require env var - fail if not set
if [ -z "$BACKUP_ENCRYPTION_KEY" ]; then
  echo "ERROR: BACKUP_ENCRYPTION_KEY environment variable is not set"
  echo "Please set it before running this script: export BACKUP_ENCRYPTION_KEY='your-secure-key'"
  exit 1
fi
ENCRYPTION_KEY="$BACKUP_ENCRYPTION_KEY"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Step 1: Dump database
echo "Starting backup for $DB_NAME at $DATE..."
pg_dump -U "$DB_USER" -d "$DB_NAME" -F p -f "$FILENAME"

if [ $? -ne 0 ]; then
  echo "Database dump failed!"
  # Optional: Send alert to webhook/email here
  exit 1
fi

# Step 2: Compress
echo "Compressing..."
gzip "$FILENAME"

if [ $? -ne 0 ]; then
  echo "Compression failed!"
  exit 1
fi

# Step 3: Encrypt using password file (avoids key exposure in process list/history)
# Create temp file with key, set restrictive perms, use it, then remove
echo "Encrypting..."
TMP_KEY_FILE=$(mktemp)
chmod 600 "$TMP_KEY_FILE"
echo "$ENCRYPTION_KEY" > "$TMP_KEY_FILE"

openssl enc -aes-256-cbc -salt -in "$ZIPNAME" -out "$ZIPNAME.enc" -pass file:"$TMP_KEY_FILE"
ENCRYPT_RESULT=$?

# Cleanup temp key file
shred -u "$TMP_KEY_FILE"

if [ $ENCRYPT_RESULT -eq 0 ]; then
  # Step 4: Verify encrypted file exists and is non-empty before cleanup
  if [ -s "$ZIPNAME.enc" ]; then
    echo "Verification passed: backup file exists and is non-empty"
  else
    echo "ERROR: Encrypted backup file is missing or empty"
    exit 1
  fi

  # Step 5: Generate SHA-256 checksum
  sha256sum "$ZIPNAME.enc" > "$ZIPNAME.enc.sha256"
  echo "Checksum generated: $ZIPNAME.enc.sha256"

  # Step 6: Cleanup raw and unencrypted files
  rm "$ZIPNAME"
  echo "Backup successfully encrypted: $ZIPNAME.enc"

  # Step 7: Retention Policy (Keep 30 days)
  echo "Applying retention policy (deleting older than 30 days)..."
  find "$BACKUP_DIR" -type f \( -name "*.enc" -o -name "*.sha256" \) -mtime +30 -exec rm {} \;

  # Step 8: Upload to Cloud Storage (e.g. Backblaze B2/AWS S3 via rclone/awscli)
  # rclone copy "$ZIPNAME.enc" remote:my-bucket/backups/
else
  echo "Encryption failed!"
  exit 1
fi

echo "Backup process completed."
