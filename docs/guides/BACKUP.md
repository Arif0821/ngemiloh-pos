# Database Backup Guide

## Overview

This document describes the automated and manual database backup procedures for POS Nabil's PostgreSQL database.

## Docker Compose Backup Service

The stack includes a dedicated `backup` service (docker-compose.yml) that runs automatically:

| Service | Schedule | Retention | Container Name |
|---------|----------|-----------|----------------|
| `backup` | Daily 02:00 WIB | 30 days | `ngemiloh_backup` |
| `cron` | Sundays 03:00 WIB | — | `ngemiloh_cron` |

The `backup` service runs `scripts/backup.sh` which:
- Executes `pg_dump` on the `postgres` container
- Compresses with gzip
- Encrypts with AES-256-CBC (requires `BACKUP_ENCRYPTION_KEY`)
- Stores in named volume `backup_data`
- Prunes backups older than `BACKUP_RETENTION_DAYS` (default 30)

### Verify Automated Backup

```bash
# Check backup service logs
docker compose logs ngemiloh_backup

# List backup files
docker compose exec ngemiloh_backup ls -la /backups/

# Check backup volume
docker compose exec ngemiloh_backup du -sh /backups/
```

## Manual Backup

### Inside Container

```bash
# With encryption key
docker exec -e BACKUP_ENCRYPTION_KEY='your-key' ngemiloh_api sh -c "cd /app && ./scripts/backup.sh"

# Direct pg_dump (no encryption) — uses POSTGRES_USER=ngemiloh
docker exec postgres pg_dump -U ngemiloh -d ngemiloh | gzip > backup_$(date +%Y%m%d).sql.gz
```

### On Host Machine

```bash
# Requires psql client installed
pg_dump -h localhost -U ngemiloh -d ngemiloh | gzip > backup_$(date +%Y%m%d).sql.gz
```

## Restore from Backup

### Restore Encrypted Backup

1. Copy encrypted backup from volume:
```bash
docker compose cp ngemiloh_backup:/backups/db_backup_YYYYMMDD_HHMMSS.sql.gz.enc ./
```

2. Decrypt:
```bash
openssl enc -d -aes-256-cbc -in db_backup_YYYYMMDD_HHMMSS.sql.gz.enc \
  -out db_backup_YYYYMMDD_HHMMSS.sql.gz -pass pass:"$BACKUP_ENCRYPTION_KEY"
```

3. Restore (stop API first to prevent writes):
```bash
docker compose stop nestjs-api
gunzip < db_backup_YYYYMMDD_HHMMSS.sql.gz | docker exec -i postgres psql -U ngemiloh -d ngemiloh
docker compose start nestjs-api
```

### Restore Plain Backup (pg_dump format)

```bash
docker compose stop nestjs-api
gunzip < backup_YYYYMMDD.sql.gz | docker exec -i postgres psql -U ngemiloh -d ngemiloh
docker compose start nestjs-api
```

## Backup Location

| Storage | Path |
|---------|------|
| Inside container | `/backups/` |
| Named volume | `backup_data` |
| Host (via volume mount) | `./data/backups/` |

File naming: `db_backup_YYYYMMDD_HHMMSS.sql.gz.enc` (encrypted) or `.sql.gz` (plain)

## Retention Policy

- **Daily backups**: Kept for `BACKUP_RETENTION_DAYS` (default 30 days)
- **Automatic cleanup**: Files older than retention are deleted by backup service
- **Monthly archive**: Implement by copying snapshots to separate storage

## Cloud Storage Integration

Enable cloud upload via rclone in `scripts/backup.sh`:

```bash
# Configure rclone remote
rclone config

# Uncomment in backup.sh:
rclone copy "$ZIPNAME.enc" remote:my-bucket/backups/
```

## Troubleshooting

### "BACKUP_ENCRYPTION_KEY environment variable is not set"
```bash
# Add to .env
echo "BACKUP_ENCRYPTION_KEY=$(openssl rand -hex 32)" >> .env
docker compose up -d ngemiloh_backup
```

### Backup service won't start
```bash
docker compose logs ngemiloh_backup
# Common cause: BACKUP_ENCRYPTION_KEY not set in .env
```

### Database dump failed
- Check postgres container is running: `docker compose ps postgres`
- Verify credentials match `POSTGRES_USER=ngemiloh` in docker-compose.yml
- Ensure database is accepting connections

### Encryption failed
- Verify openssl is installed in backup container
- Check disk space in `backup_data` volume
- Confirm `BACKUP_ENCRYPTION_KEY` is a valid 256-bit key

## Security Notes

- Generate encryption key: `openssl rand -hex 32`
- Store `BACKUP_ENCRYPTION_KEY` in `.env` (not committed to git)
- Never commit encryption keys to version control
- Restrict backup volume permissions
- Consider encrypting backup_data volume at rest (LUKS)
- Test restore procedure quarterly
