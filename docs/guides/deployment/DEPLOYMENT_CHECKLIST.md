# Ngemiloh POS - Deployment Checklist

**Version:** 1.0.0  
**Last Updated:** 2026-06-19  
**Author:** Claude Code

---

## Pre-Deployment Checklist

### 1. Environment Preparation

- [ ] **Domain Configuration**
  - [ ] Domain po

...

ing DNS A record pointing to server
  - [ ] SSL certificate configured (or use Caddy auto-HTTPS)
  - [ ] `FRONTEND_URL` environment variable set correctly

- [ ] **Server Requirements**
  - [ ] Docker Engine 20.10+ installed
  - [ ] Docker Compose v2+ installed
  - [ ] Minimum 2GB RAM available
  - [ ] Minimum 20GB disk space available
  - [ ] `openssl` installed (for secret generation)

### 2. Secrets Setup

- [ ] **Create secrets directory**
  ```bash
  mkdir -p secrets
  chmod 700 secrets
  ```

- [ ] **Generate all required secrets**
  ```bash
  # Generate 256-bit random secrets
  openssl rand -hex 32 > secrets/db_password.txt
  openssl rand -hex 32 > secrets/redis_password.txt
  openssl rand -hex 64 > secrets/jwt_access_secret.txt
  openssl rand -hex 32 > secrets/pin_pepper_secret.txt
  openssl rand -hex 32 > secrets/csrf_secret.txt
  
  # Midtrans keys (from Midtrans Dashboard)
  # Sandbox
  echo "your_sandbox_server_key" > secrets/midtrans_server_key_sandbox.txt
  # Production
  echo "your_production_server_key" > secrets/midtrans_server_key_production.txt
  
  # Email app password (from Google Account Security)
  echo "your_app_password" > secrets/email_app_password.txt
  ```

- [ ] **Set proper permissions**
  ```bash
  chmod 600 secrets/*.txt
  ```

### 3. Environment Variables

- [ ] **Create `.env` file** (optional, for non-secret configs)
  ```bash
  cp .env.example .env
  ```

- [ ] **Configure environment variables**
  | Variable | Description | Required |
  |----------|-------------|----------|
  | `NODE_ENV` | `production` or `development` | Yes |
  | `FRONTEND_URL` | Your public URL (e.g., `https://pos.yourdomain.com`) | Yes |
  | `TZ` | Timezone (default: `Asia/Jakarta`) | No |
  | `MIDTRANS_ENV` | `sandbox` or `production` | Yes |
  | `MIDTRANS_CLIENT_KEY_SANDBOX` | Client key from Midtrans | Yes |
  | `MIDTRANS_CLIENT_KEY_PRODUCTION` | Client key from Midtrans | Yes |
  | `EMAIL_HOST` | SMTP server (e.g., `smtp.gmail.com`) | No |
  | `EMAIL_PORT` | SMTP port (default: `587`) | No |
  | `EMAIL_USER` | SMTP username | No |
  | `EMAIL_FROM` | From email address | No |
  | `SENTRY_DSN` | Sentry DSN for error tracking | No |

### 4. Database Initialization

- [ ] **First-time database setup**
  ```bash
  # Stop containers if running
  docker compose down
  
  # Remove old volumes (FIRST TIME ONLY, destructive!)
  docker volume rm pos_nabil_postgres_data 2>/dev/null || true
  docker volume rm pos_nabil_redis_data 2>/dev/null || true
  
  # Start fresh
  docker compose up -d postgres redis
  
  # Wait for database to be ready
  sleep 10
  
  # Initialize database with Prisma migrations
  docker compose exec nestjs-api npx prisma migrate deploy
  
  # Seed initial data (if needed)
  docker compose exec nestjs-api npx prisma db seed
  
  # Start all services
  docker compose up -d
  ```

---

## Deployment Execution

### 1. Docker Image Build

- [ ] **Build all images**
  ```bash
  docker compose build --no-cache
  ```

- [ ] **Verify images created**
  ```bash
  docker images | grep -E "(ngemiloh|pos_nabil)"
  ```
  Expected output:
  ```
  pos_nabil-nestjs-api      latest    <image_id>   <size>
  pos_nabil-caddy           latest    <image_id>   <size>
  ```

### 2. Container Startup

- [ ] **Start all services**
  ```bash
  docker compose up -d
  ```

- [ ] **Wait for containers to initialize** (allow 2-3 minutes)
  ```bash
  sleep 60
  ```

- [ ] **Check container status**
  ```bash
  docker compose ps
  ```
  Expected output:
  ```
  NAME           STATUS          PORTS
  ngemiloh_db    Up (healthy)    5432/tcp
  ngemiloh_redis Up (healthy)    6379/tcp
  ngemiloh_api   Up (healthy)    3000/tcp
  ngemiloh_caddy Up              80/tcp, 443/tcp
  ```

### 3. Health Verification

- [ ] **Run health monitor script**
  ```bash
  bash scripts/health-monitor.sh --check
  ```

- [ ] **Test API endpoints**
  ```bash
  # Health endpoint
  curl http://localhost:3000/_health
  # Expected: {"ok":true}
  
  # Full health check
  curl http://localhost:3000/health
  # Expected: {"status":"ok","database":"connected",...}
  
  # Frontend (via Caddy)
  curl http://localhost/health
  # Expected: HTML page
  ```

- [ ] **Test Redis connectivity**
  ```bash
  docker compose exec redis redis-cli -a "$(cat secrets/redis_password.txt)" ping
  # Expected: PONG
  ```

- [ ] **Test Database connectivity**
  ```bash
  docker compose exec postgres psql -U ngemiloh -d ngemiloh_db -c "SELECT 1"
  # Expected: 1
  ```

---

## Post-Deployment Verification

### 1. Functional Testing

- [ ] **Login Flow**
  - [ ] Kasir PIN login works
  - [ ] Admin email+OTP login works
  - [ ] JWT token generated correctly

- [ ] **POS Operations**
  - [ ] Product listing loads
  - [ ] Cart operations work (add, remove, update quantity)
  - [ ] Order creation works
  - [ ] Payment via Midtrans QRIS works

- [ ] **Shift Management**
  - [ ] Open shift works
  - [ ] Close shift works
  - [ ] Cash discrepancy detection works

### 2. Security Verification

- [ ] **Container Security**
  ```bash
  # Check containers are running as non-root
  docker compose exec nestjs-api whoami
  # Expected: appuser
  
  # Verify capabilities are dropped
  docker inspect ngemiloh_db | grep -A 20 "CapDrop"
  # Expected: "CapDrop": ["ALL"]
  ```

- [ ] **Network Isolation**
  ```bash
  # Verify database is not exposed externally
  docker compose ps ngemiloh_db
  # Expected: No ports listed
  
  # Verify Redis is internal only
  docker compose ps ngemiloh_redis
  # Expected: No ports listed
  ```

### 3. Monitoring Setup

- [ ] **Configure automated health monitoring**
  ```bash
  # Add to crontab for continuous monitoring
  crontab -e
  
  # Add line:
  */5 * * * * /path/to/scripts/health-monitor.sh --check >> /var/log/pos-health-cron.log 2>&1
  ```

- [ ] **Set up log rotation**
  ```bash
  # Add to /etc/logrotate.d/pos
  /var/log/pos-*.log {
      daily
      rotate 14
      compress
      delaycompress
      notifempty
      create 0640 root root
  }
  ```

---

## Rollback Procedure

If deployment fails:

1. **Stop current containers**
   ```bash
   docker compose down
   ```

2. **Restore previous version**
   ```bash
   # If using git tags
   git checkout v1.x.x
   docker compose build
   docker compose up -d
   ```

3. **Verify rollback**
   ```bash
   bash scripts/health-monitor.sh --check
   ```

---

## Maintenance Commands

### Container Management
```bash
# View logs
docker compose logs -f [service_name]

# Restart specific service
docker compose restart [service_name]

# Rebuild specific service
docker compose up -d --build [service_name]

# Access container shell
docker compose exec [service_name] sh
```

### Database Maintenance
```bash
# Run migrations
docker compose exec nestjs-api npx prisma migrate deploy

# View migrations status
docker compose exec nestjs-api npx prisma migrate status

# Reset database (DESTRUCTIVE)
docker compose exec nestjs-api npx prisma migrate reset
```

### Cleanup
```bash
# Remove unused images
docker image prune -a -f

# Remove stopped containers
docker container prune -f

# Full cleanup
docker system prune -a -f --volumes
```

---

## Troubleshooting

| Issue | Solution |
|-------|---------|
| Container stuck in restart loop | Check logs: `docker compose logs [service]` |
| Database connection failed | Verify `DATABASE_URL` and database is healthy |
| Redis permission denied | Remove volume and restart: `docker volume rm pos_nabil_redis_data` |
| Caddy SSL certificate error | Check domain DNS and Caddy logs |
| Prisma binary error | Rebuild images: `docker compose build --no-cache` |

---

## Sign-Off

| Item | Status | Date | Initials |
|------|--------|------|----------|
| Pre-deployment checks completed | ☐ | | |
| Deployment executed | ☐ | | |
| Health verification passed | ☐ | | |
| Functional testing completed | ☐ | | |
| Monitoring configured | ☐ | | |

**Deployment Date:** _______________  
**Deployed By:** _______________  
**Version Deployed:** _______________
