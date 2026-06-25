# Ngemiloh POS Operational Runbook

This document provides operational procedures for the Ngemiloh POS system. Keep this runbook accessible during deployments and on-call shifts.

---

## Emergency Procedures

### Container Restart

```bash
# Single container
docker compose restart <service-name>

# Common service names:
#   - nestjs-api      (Backend API)
#   - postgres        (Database)
#   - redis           (Cache)
#   - caddy           (Reverse proxy)

# All containers
docker compose restart

# View logs after restart
docker compose logs -f --tail=100
```

### Database Restore

```bash
# 1. Stop API to prevent writes during restore
docker compose stop nestjs-api

# 2. Restore from backup
gunzip < backup_YYYYMMDD.sql.gz | docker exec -i ngemiloh_db psql -U ngemiloh -d ngemiloh_db

# Alternative: Restore to specific backup file
gunzip < /backups/ngemiloh_20260619.sql.gz | docker exec -i ngemiloh_db psql -U ngemiloh ngemiloh_db

# 3. Verify restore completed
docker exec ngemiloh_db psql -U ngemiloh -d ngemiloh_db -c "SELECT count(*) FROM \"User\";"

# 4. Restart API
docker compose start nestjs-api
```

### Rollback Deployment

```bash
# 1. Revert docker-compose.yml changes
git checkout HEAD -- docker-compose.yml

# 2. Revert backend code changes
git checkout HEAD -- backend/

# 3. Pull previous image tag
docker pull ghcr.io/ngemiloh/pos-backend:<previous-version>

# 4. Update image tag in docker-compose.yml
# Edit the image line to use previous version tag

# 5. Restart services
docker compose up -d

# 6. Verify rollback
curl http://localhost:3000/_health
```

---

## Troubleshooting

### API Container Unhealthy

1. **Check logs:**
   ```bash
   docker compose logs nestjs-api --tail=200
   ```

2. **Check health endpoint:**
   ```bash
   curl -v http://localhost:3000/_health
   ```

3. **Check container status:**
   ```bash
   docker ps -a | grep nestjs
   ```

4. **Restart container:**
   ```bash
   docker compose restart nestjs-api
   ```

5. **Full rebuild if restart fails:**
   ```bash
   docker compose up -d --force-recreate nestjs-api
   ```

6. **Check environment variables:**
   ```bash
   docker exec ngemiloh_api env | grep -E "DATABASE|REDIS|JWT"
   ```

### Database Connection Errors

1. **Verify database is running:**
   ```bash
   docker exec ngemiloh_db pg_isready -U ngemiloh -d ngemiloh_db
   ```

2. **Check database logs:**
   ```bash
   docker compose logs postgres --tail=100
   ```

3. **Test connection from API container:**
   ```bash
   docker exec ngemiloh_api npx prisma db execute --stdin
   # Or manually:
   docker exec ngemiloh_api sh -c 'nc -zv postgres 5432'
   ```

4. **Restart database (last resort):**
   ```bash
   docker compose restart postgres
   ```

5. **Verify connection string secrets:**
   ```bash
   docker exec ngemiloh_api env | grep DATABASE
   ```

### Redis Connection Issues

1. **Check Redis status:**
   ```bash
   docker exec ngemiloh_redis redis-cli ping
   ```

2. **Check Redis logs:**
   ```bash
   docker compose logs redis --tail=50
   ```

3. **Restart Redis:**
   ```bash
   docker compose restart redis
   ```

### High Disk Usage

1. **Check disk usage:**
   ```bash
   df -h
   docker system df
   ```

2. **Clean Docker build cache:**
   ```bash
   docker builder prune -f
   ```

3. **Clean old container logs:**
   ```bash
   docker compose logs --tail=1000 > /tmp/recent_logs.txt
   > /var/lib/docker/containers/*/*-json.log 2>/dev/null || true
   ```

4. **Clean old backups (older than 30 days):**
   ```bash
   find /backups -name "*.gz" -mtime +30 -delete
   ```

5. **Check backup directory size:**
   ```bash
   du -sh /backups/*
   ```

### API Slow Response

1. **Check resource usage:**
   ```bash
   docker stats
   ```

2. **Check running processes:**
   ```bash
   docker compose top nestjs-api
   ```

3. **Enable query logging:**
   ```bash
   docker exec ngemiloh_db psql -U ngemiloh -d ngemiloh_db -c "SELECT pid, now() - query_start AS duration, query FROM pg_stat_activity WHERE state = 'active';"
   ```

4. **Check connection pool settings:**
   ```bash
   docker exec ngemiloh_api env | grep DATABASE_POOL
   ```

5. **Restart API with fresh connections:**
   ```bash
   docker compose restart nestjs-api
   ```

### Frontend Not Loading

1. **Check Caddy (reverse proxy) logs:**
   ```bash
   docker compose logs caddy --tail=50
   ```

2. **Check frontend container:**
   ```bash
   docker ps | grep frontend
   ```

3. **Restart Caddy:**
   ```bash
   docker compose restart caddy
   ```

4. **Check Caddyfile configuration:**
   ```bash
   docker exec caddy caddy validate --config /etc/caddy/Caddyfile
   ```

---

## Regular Maintenance

### Daily

```bash
# Check all container health
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Verify backup completed
ls -la /backups/
```

### Weekly

```bash
# Database VACUUM (reclaim space and update statistics)
docker exec ngemiloh_db psql -U ngemiloh -d ngemiloh_db -c "VACUUM ANALYZE;"

# Check disk space
df -h

# Review error logs
docker compose logs --since=168h | grep -i error | tail -50
```

### Monthly

```bash
# Test backup restore on staging/dev environment
gunzip < latest_backup.sql.gz | docker exec -i ngemiloh_db psql -U ngemiloh -d ngemiloh_db -c "SELECT 1;"

# Apply security updates
docker compose pull
docker compose up -d

# Review and rotate logs
docker compose logs --tail=10000 > /tmp/monthly_logs_$(date +%Y%m%d).txt

# Check for outdated Docker images
docker images | grep ngemiloh
```

---

## Health Check Commands

### All Containers

```bash
# Quick status
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Detailed status
docker compose ps
```

### API Health

```bash
# Basic health check
curl http://localhost:3000/_health

# Verbose output
curl -v http://localhost:3000/_health

# With auth (admin only)
curl -H "Authorization: Bearer <token>" http://localhost:3000/api/admin/health
```

### Database

```bash
# Check PostgreSQL is ready
docker exec ngemiloh_db pg_isready -U ngemiloh -d ngemiloh_db

# Check active connections
docker exec ngemiloh_db psql -U ngemiloh -d ngemiloh_db -c "SELECT count(*) FROM pg_stat_activity;"

# Check database size
docker exec ngemiloh_db psql -U ngemiloh -d ngemiloh_db -c "SELECT pg_size_pretty(pg_database_size('ngemiloh_db'));"
```

### Redis

```bash
# Basic ping
docker exec ngemiloh_redis redis-cli ping

# Check memory usage
docker exec ngemiloh_redis redis-cli info memory

# List connected clients
docker exec ngemiloh_redis redis-cli client list
```

### Caddy (Reverse Proxy)

```bash
# Check Caddy is running
docker ps | grep caddy

# Validate config
docker exec caddy caddy validate --config /etc/caddy/Caddyfile

# Check ACME certificates
docker exec caddy caddy list-certificates
```

---

## Backup and Recovery

### Backup Commands

```bash
# Create database backup
docker exec ngemiloh_db pg_dump -U ngemiloh -d ngemiloh_db | gzip > /backups/ngemiloh_$(date +%Y%m%d_%H%M%S).sql.gz

# Verify backup integrity
gunzip -t /backups/ngemiloh_latest.sql.gz

# Backup file size check
ls -lh /backups/*.sql.gz
```

### Recovery Procedures

1. **Verify backup file exists and is valid:**
   ```bash
   gunzip -t /backups/ngemiloh_latest.sql.gz
   ls -lh /backups/ngemiloh_latest.sql.gz
   ```

2. **Stop API to prevent writes:**
   ```bash
   docker compose stop nestjs-api
   ```

3. **Restore database:**
   ```bash
   gunzip < /backups/ngemiloh_latest.sql.gz | docker exec -i ngemiloh_db psql -U ngemiloh ngemiloh_db
   ```

4. **Verify data restored:**
   ```bash
   docker exec ngemiloh_db psql -U ngemiloh -d ngemiloh_db -c "SELECT count(*) FROM \"User\"; SELECT count(*) FROM \"Order\";"
   ```

5. **Restart API:**
   ```bash
   docker compose start nestjs-api
   ```

6. **Verify application health:**
   ```bash
   curl http://localhost:3000/_health
   ```

---

## Environment Variables Reference

> All variables set in `.env` or docker-compose environment section.

### Authentication

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `JWT_ACCESS_SECRET` | — | Yes | JWT signing secret (min 32 chars) |
| `JWT_ACCESS_EXPIRES` | `8h` | No | JWT expiry for kasir (e.g., `8h`, `4h`) |
| `JWT_REFRESH_EXPIRES` | `7d` | No | Refresh token expiry |
| `CSRF_SECRET` | — | Yes | CSRF token signing secret |
| `CSRF_COOKIE_MAX_AGE` | `28800` | No | CSRF cookie max-age in seconds (8h) |
| `PIN_PEPPER_SECRET` | — | Yes | Pepper added to PIN before bcrypt hash |
| `OTP_EXPIRES_IN` | `600` | No | OTP TTL in seconds (10 min) |
| `LOCKOUT_THRESHOLD` | `10` | No | Failed attempts before IP lockout |

### Database & Cache

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `DATABASE_URL` | — | Yes | PostgreSQL connection string |
| `DATABASE_HOST` | `postgres` | No | Override DB host |
| `DATABASE_USER` | `ngemiloh` | No | DB username |
| `DATABASE_PASSWORD` | — | Yes | DB password |
| `REDIS_URL` | `redis://redis:6379` | No | Redis connection URL |
| `REDIS_PASSWORD` | — | Yes (prod) | Redis auth password |

### Payment

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `MIDTRANS_SERVER_KEY` | — | Yes | Midtrans server key |
| `MIDTRANS_CLIENT_KEY` | — | Yes | Midtrans client key |
| `MIDTRANS_ENV` | `sandbox` | No | `sandbox` or `production` |
| `QRIS_EXPIRY_SECONDS` | `900` | No | QRIS payment expiry (15 min) |

### Finance & Operations

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `DISCREPANCY_THRESHOLD` | `5000` | No | Cash discrepancy alert threshold (Rp) |
| `PRICE_DELTA_THRESHOLD_PCT` | `10` | No | Max price variance before sync rejection (%) |
| `FRONTEND_URL` | `https://localhost:5173` | No | Allowed CORS origin |
| `TZ` | `Asia/Jakarta` | No | Timezone for all timestamps |

### Backup

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `BACKUP_ENCRYPTION_KEY` | — | Yes (prod) | AES-256-CBC encryption key |
| `BACKUP_RETENTION_DAYS` | `30` | No | Backup retention period |
| `BACKUP_RCLONE_REMOTE` | — | No | rclone remote for cloud upload |

### Monitoring & Alerts

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | — | No | Telegram bot token for alerts |
| `TELEGRAM_CHAT_ID` | — | No | Telegram chat ID for alerts |
| `EMAIL_HOST` | — | No | SMTP host for email alerts |
| `EMAIL_PORT` | `587` | No | SMTP port |
| `EMAIL_USER` | — | No | SMTP username |
| `EMAIL_PASSWORD` | — | No | SMTP password |
| `EMAIL_FROM` | — | No | Sender email address |

### Caddy Reverse Proxy

| Variable | Default | Required | Description |
|----------|---------|----------|-------------|
| `RATE_LIMIT_RPM` | `100` | No | Rate limit requests per minute |
| `RATE_LIMIT_BURST` | `20` | No | Burst allowance |
| `CADDY_ALLOWED_IPS` | — | No | Comma-separated allowed IPs |

---

## Developer Onboarding

### Prerequisites

- **Docker Desktop** (Windows) or **Docker Engine** (Linux/macOS)
- **Node.js 20 LTS** (for local development outside containers)
- **Git** for version control
- **WSL2** (Windows only — for native Docker performance)

### First-Time Setup

```bash
# 1. Clone repository
git clone <repo-url>
cd POS_Nabil

# 2. Copy environment template
cp .env.example .env

# 3. Edit .env — fill in required secrets
# Minimum required:
#   - JWT_ACCESS_SECRET (min 32 chars)
#   - CSRF_SECRET (min 32 chars)
#   - PIN_PEPPER_SECRET
#   - DATABASE_PASSWORD
#   - MIDTRANS_SERVER_KEY (sandbox for dev)
#   - MIDTRANS_CLIENT_KEY (sandbox for dev)

# 4. Start all containers
docker compose up -d

# 5. Run database migrations
docker compose exec nestjs-api npx prisma migrate deploy

# 6. Seed initial data (optional)
docker compose exec nestjs-api npx prisma db seed

# 7. Verify health
curl http://localhost:3000/_health

# 8. Access the app
#   Frontend: http://localhost:5173
#   Backend:  http://localhost:3000/api/v1
```

### Local Development (Backend)

```bash
# Terminal 1: Run backend outside container
cd backend
npm install
npx prisma generate
npm run start:dev

# Terminal 2: Run frontend in container (for DB/Redis)
docker compose up -d postgres redis
```

### Local Development (Frontend)

```bash
cd frontend
npm install
npm run dev
```

### Environment Variables Checklist

- [ ] `DATABASE_URL` — points to postgres container
- [ ] `REDIS_URL` — points to redis container
- [ ] `JWT_ACCESS_SECRET` — generate with `openssl rand -hex 32`
- [ ] `CSRF_SECRET` — generate with `openssl rand -hex 32`
- [ ] `PIN_PEPPER_SECRET` — generate with `openssl rand -hex 32`
- [ ] `MIDTRANS_SERVER_KEY` — sandbox key from Midtrans dashboard
- [ ] `MIDTRANS_CLIENT_KEY` — sandbox key from Midtrans dashboard
- [ ] `BACKUP_ENCRYPTION_KEY` — generate with `openssl rand -hex 32` (production)

### Common Setup Issues

**Docker Desktop won't start (Windows):**
```powershell
# Enable WSL2 and restart
wsl --set-default-version 2
wsl --install
# Restart Docker Desktop
```

**Port already in use:**
```bash
docker compose down
netstat -ano | findstr :3000  # kill process if needed
docker compose up -d
```

**Database migration fails:**
```bash
# Check if postgres is ready
docker compose exec postgres pg_isready -U ngemiloh

# Force reset (dev only — deletes data!)
docker compose exec postgres psql -U ngemiloh -c "DROP DATABASE IF EXISTS ngemiloh_db;"
docker compose exec postgres psql -U ngemiloh -c "CREATE DATABASE ngemiloh_db;"
docker compose exec nestjs-api npx prisma migrate deploy
```

### Stopping the Stack

```bash
# Stop containers (data persists)
docker compose stop

# Stop and remove containers + volumes (deletes all data!)
docker compose down -v
```

---

## Contact List

| Role | Contact | Notes |
|------|---------|-------|
| On-Call Engineer | [oncall@ngemiloh.local] | Primary responder |
| DevOps Lead | [devops@ngemiloh.local] | Infrastructure issues |
| Backend Lead | [backend@ngemiloh.local] | API/logic issues |
| Escalation Manager | [manager@ngemiloh.local] | Business impact |
| Midtrans Support | support@midtrans.com | Payment gateway |

---

## Quick Reference

```bash
# Full status check
docker ps --format "table {{.Names}}\t{{.Status}}" && echo "---" && curl -s http://localhost:3000/_health | jq .

# Restart everything
docker compose restart

# View all logs
docker compose logs -f

# Shell into container
docker compose exec nestjs-api sh
```
