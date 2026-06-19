# Database Backup Guide

## Overview

This document describes the automated database backup procedures for POS Nabil's PostgreSQL database.

## Automated Backups

The backup script (`scripts/backup.sh`) runs daily via cron at 2 AM WIB.

### Features

- **pg_dump**: Full database dump in plain text format
- **gzip compression**: Reduces backup size significantly
- **AES-256-CBC encryption**: Secure backup files with encryption key
- **Retention policy**: Automatically removes backups older than 30 days
- **Cloud storage ready**: Placeholder for rclone/S3 upload (commented)

### Configuration

The script requires the `BACKUP_ENCRYPTION_KEY` environment variable to be set before execution.

```bash
# Set the encryption key
export BACKUP_ENCRYPTION_KEY='your-secure-256-bit-key'
```

### Cron Schedule

Set in crontab:

```bash
0 2 * * * /app/scripts/backup.sh >> /var/log/backup.log 2>&1
```

## Manual Backup

### Inside Container

```bash
# With encryption key
docker exec -e BACKUP_ENCRYPTION_KEY='your-key' ngemiloh_api sh -c "cd /app && ./scripts/backup.sh"

# Direct pg_dump (no encryption)
docker exec ngemiloh_db pg_dump -U postgres ngemiloh_db | gzip > backup_$(date +%Y%m%d).sql.gz
```

### On Host Machine

```bash
# Requires psql client installed
pg_dump -h localhost -U postgres -d ngemiloh_db | gzip > backup_$(date +%Y%m%d).sql.gz
```

## Restore from Backup

### Restore Encrypted Backup

1. Decrypt the backup file:

```bash
openssl enc -d -aes-256-cbc -salt -in db_backup_YYYYMMDD_HHMMSS.sql.gz.enc \
  -out db_backup_YYYYMMDD_HHMMSS.sql.gz -k "$BACKUP_ENCRYPTION_KEY"
```

2. Restore the database:

```bash
gunzip < db_backup_YYYYMMDD_HHMMSS.sql.gz | docker exec -i ngemiloh_db psql -U postgres -d ngemiloh_db
```

### Restore Plain Backup (from pg_dump)

```bash
gunzip < backup_YYYYMMDD.sql.gz | docker exec -i ngemiloh_db psql -U postgres -d ngemiloh_db
```

## Backup Location

Backups are stored in: `/var/backups/ngemiloh_pos/`

File naming convention: `db_backup_YYYYMMDD_HHMMSS.sql.gz.enc`

## Retention Policy

- **Daily backups**: Kept for 30 days
- **Monthly backups**: Can be implemented by moving snapshots to separate archive location
- **Automatic cleanup**: Files older than 30 days are automatically deleted

## Cloud Storage Integration

The script includes commented code for cloud upload. To enable:

1. Install rclone or awscli in the container
2. Configure your cloud storage remote
3. Uncomment the rclone line in `scripts/backup.sh`:

```bash
rclone copy "$ZIPNAME.enc" remote:my-bucket/backups/
```

## Troubleshooting

### "BACKUP_ENCRYPTION_KEY environment variable is not set"

Set the environment variable before running the script:

```bash
export BACKUP_ENCRYPTION_KEY='your-secure-key'
./scripts/backup.sh
```

### Database dump failed

- Check database connection
- Verify credentials
- Ensure database is running

### Encryption failed

- Verify openssl is installed
- Check disk space
- Confirm encryption key is valid

## Security Notes

- Store the encryption key securely (use secrets management)
- Never commit encryption keys to version control
- Restrict backup directory permissions: `chmod 700 /var/backups/ngemiloh_pos`
- Consider encrypting the backup directory at rest (LUKS)
