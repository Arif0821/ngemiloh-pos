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
ENCRYPTION_KEY="your_super_secret_encryption_key_here" # Use env var in prod

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

# Step 2: Compress and encrypt (using gzip and openssl)
echo "Compressing and encrypting..."
gzip "$FILENAME"
openssl enc -aes-256-cbc -salt -in "$ZIPNAME" -out "$ZIPNAME.enc" -k "$ENCRYPTION_KEY"

if [ $? -eq 0 ]; then
  # Step 3: Cleanup raw and unencrypted files
  rm "$ZIPNAME"
  echo "Backup successfully encrypted: $ZIPNAME.enc"
  
  # Step 4: Retention Policy (Keep 30 days)
  echo "Applying retention policy (deleting older than 30 days)..."
  find "$BACKUP_DIR" -type f -name "*.enc" -mtime +30 -exec rm {} \;

  # Step 5: Upload to Cloud Storage (e.g. Backblaze B2/AWS S3 via rclone/awscli)
  # rclone copy "$ZIPNAME.enc" remote:my-bucket/backups/
else
  echo "Encryption failed!"
  exit 1
fi

echo "Backup process completed."
