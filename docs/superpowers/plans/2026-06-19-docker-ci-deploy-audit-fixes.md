# Docker, CI Pipeline & Deploy Audit Fixes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all security vulnerabilities, configuration inconsistencies, and operational issues found in Docker setup, CI pipeline, and deployment scripts.

**Architecture:** Sequential fixes organized by priority (CRITICAL → HIGH → MEDIUM). Each task is independent and can be verified separately.

**Tech Stack:** Docker, Docker Compose, GitHub Actions, Bash scripts

---

## File Mapping

### Files to Modify:
- `docker-compose.yml` - Remove hardcoded secrets, add Redis password support
- `backend/Dockerfile` - Fix Node version, remove global dependencies
- `docker/caddy.Dockerfile` - Fix Node version, add health check
- `.github/workflows/ci.yml` - Fix Node version, enforce Trivy, fix workflow
- `scripts/health-monitor.sh` - Fix hardcoded container names
- `Caddyfile` - Add rate limiting for production

### Files to Create:
- `docker/production.env.example` - Production environment template
- `scripts/docker/redis-production-entrypoint.sh` - Redis entrypoint with password

---

## TASK 1: Fix Node.js Version Inconsistency

**Files:**
- Modify: `backend/Dockerfile:5` (node:22 → node:20)
- Modify: `docker/caddy.Dockerfile:5` (node:20-alpine already correct, verify)
- Modify: `.github/workflows/ci.yml:34,60,108,159,190,220,248` (all node-version: "20")

- [ ] **Step 1: Update backend/Dockerfile Node version**

```dockerfile
# Line 5: Change FROM --platform=linux/amd64 node:22-alpine TO node:20-alpine
FROM --platform=linux/amd64 node:20-alpine AS builder
```

- [ ] **Step 2: Verify docker/caddy.Dockerfile Node version**

Already uses `mirror.gcr.io/library/node:20-alpine` - NO CHANGE NEEDED

- [ ] **Step 3: Verify GitHub Actions uses node-version: "20"**

Already configured correctly in ci.yml - NO CHANGE NEEDED

- [ ] **Step 4: Commit**

```bash
git add backend/Dockerfile
git commit -m "fix(docker): standardize Node.js version to 20-alpine"
```

---

## TASK 2: Remove Hardcoded Secrets from docker-compose.yml

**Files:**
- Modify: `docker-compose.yml` (lines 17, 93-114)
- Create: `docker/production.env.example`

- [ ] **Step 1: Create production environment template**

```bash
cat > docker/production.env.example << 'EOF'
# ===========================================
# PRODUCTION ENVIRONMENT VARIABLES
# Copy to .env and fill in actual values
# ===========================================

# Database
DATABASE_URL=postgresql://ngemiloh:YOUR_SECURE_PASSWORD@postgres:5432/ngemiloh_db
DIRECT_URL=postgresql://ngemiloh:YOUR_SECURE_PASSWORD@postgres:5432/ngemiloh_db

# Redis (WITH PASSWORD for production)
REDIS_URL=redis://:YOUR_REDIS_PASSWORD@redis:6379

# Security Secrets (CRITICAL - Generate secure random strings)
JWT_ACCESS_SECRET=CHANGE_ME_generate_64_char_random_string
PIN_PEPPER_SECRET=CHANGE_ME_generate_64_char_random_string
CSRF_SECRET=CHANGE_ME_generate_32_char_random_string

# Midtrans (Get from Midtrans Dashboard)
MIDTRANS_SERVER_KEY_SANDBOX=your_sandbox_key
MIDTRANS_CLIENT_KEY_SANDBOX=your_sandbox_key
MIDTRANS_SERVER_KEY_PRODUCTION=your_production_key
MIDTRANS_CLIENT_KEY_PRODUCTION=your_production_key

# Email (App Password from Gmail/Email Provider)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM=noreply@ngemiloh.com

# Application
NODE_ENV=production
FRONTEND_URL=https://your-domain.com
MIDTRANS_ENV=production
JWT_ACCESS_EXPIRES=12h
STORAGE_PATH=/var/storage/ngemiloh
TZ=Asia/Jakarta

# Business Rules
QRIS_EXPIRY_SECONDS=900
DISCREPANCY_THRESHOLD=5000
PRICE_DELTA_THRESHOLD_PCT=10
EOF
```

- [ ] **Step 2: Update docker-compose.yml to use env_file**

```yaml
# Replace hardcoded environment variables with reference to .env file
services:
  postgres:
    # ... existing config ...
    env_file:
      - path: ./docker/production.env
        required: false
    environment:
      POSTGRES_PASSWORD: ${DB_PASSWORD:-dev_postgres_password_change_in_prod}
      # Remove other hardcoded secrets
```

Actually, keep environment for development but move to .env reference:

```yaml
# In services section, replace hardcoded values:
environment:
  # Database - use variable with fallback for dev
  - DATABASE_URL=${DATABASE_URL:-postgresql://ngemiloh:dev_postgres_password_change_in_prod@postgres:5432/ngemiloh_db}
  - DIRECT_URL=${DIRECT_URL:-postgresql://ngemiloh:dev_postgres_password_change_in_prod@postgres:5432/ngemiloh_db}
  # Redis - use variable
  - REDIS_URL=${REDIS_URL:-redis://redis:6379}
  # Security - MUST use env vars in production
  - JWT_ACCESS_SECRET=${JWT_ACCESS_SECRET:?REQUIRED}
  - PIN_PEPPER_SECRET=${PIN_PEPPER_SECRET:?REQUIRED}
  - CSRF_SECRET=${CSRF_SECRET:?REQUIRED}
```

- [ ] **Step 3: Create .env.example for development**

```bash
cat > .env.example << 'EOF'
# Development defaults - SAFE to commit
DATABASE_URL=postgresql://ngemiloh:dev_postgres_password_change_in_prod@postgres:5432/ngemiloh_db
DIRECT_URL=postgresql://ngemiloh:dev_postgres_password_change_in_prod@postgres:5432/ngemiloh_db
REDIS_URL=redis://redis:6379
JWT_ACCESS_SECRET=dev_jwt_access_secret_please_change_in_production_env
PIN_PEPPER_SECRET=dev_pin_pepper_secret_please_change_in_production_env
CSRF_SECRET=dev_csrf_secret_please_change_in_production_env
NODE_ENV=development
JWT_ACCESS_EXPIRES=8h
MIDTRANS_ENV=sandbox
MIDTRANS_SERVER_KEY_SANDBOX=your_sandbox_server_key_here
MIDTRANS_CLIENT_KEY_SANDBOX=your_sandbox_client_key_here
EOF
```

- [ ] **Step 4: Commit**

```bash
git add docker-compose.yml docker/production.env.example .env.example
git commit -m "fix(security): remove hardcoded secrets, use env vars with fallbacks"
```

---

## TASK 3: Add Redis Password Support for Production

**Files:**
- Modify: `docker-compose.yml` (add redis password support)
- Create: `scripts/docker/redis-production-entrypoint.sh`
- Modify: `docker-entrypoint.sh` (update to support production mode)

- [ ] **Step 1: Create production Redis entrypoint with password**

```bash
cat > scripts/docker/redis-production-entrypoint.sh << 'EOF'
#!/bin/sh
# ============================================================
# Ngemiloh POS - Redis Startup Script (Production Mode)
# WITH PASSWORD - Secure production deployment
# ============================================================

set -e

# Get password from environment or Docker secret
REDIS_PASSWORD="${REDIS_PASSWORD:-}"
if [ -f "/run/secrets/redis_password" ]; then
    REDIS_PASSWORD=$(cat /run/secrets/redis_password)
fi

if [ -z "$REDIS_PASSWORD" ]; then
    echo "[ERROR] Redis password not set! Set REDIS_PASSWORD env var or /run/secrets/redis_password"
    exit 1
fi

echo "[PROD] Starting Redis with password authentication"

# Start Redis with password
exec redis-server \
    --appendonly yes \
    --loglevel notice \
    --requirepass "$REDIS_PASSWORD" \
    --maxmemory 200mb \
    --maxmemory-policy allkeys-lru \
    --rename-command FLUSHDB "" \
    --rename-command FLUSHALL "" \
    --rename-command SHUTDOWN "SHUTDOWN_NG" \
    --rename-command CONFIG "CONFIG_NG" \
    --rename-command DEBUG ""
EOF
chmod +x scripts/docker/redis-production-entrypoint.sh
```

- [ ] **Step 2: Update docker-compose.yml Redis service for production mode**

```yaml
# Add to redis service in docker-compose.yml
redis:
  # ... existing config ...
  environment:
    - REDIS_PASSWORD=${REDIS_PASSWORD:-}  # Empty in dev, required in prod
  entrypoint: >
    /bin/sh -c "
      if [ \"${NODE_ENV:-development}\" = \"production\" ]; then
        exec /docker-entrypoint-prod.sh;
      else
        exec /docker-entrypoint.sh;
      fi
    "
  volumes:
    # Development entrypoint (no password)
    - ./scripts/docker/redis-entrypoint.sh:/docker-entrypoint.sh:ro
    # Production entrypoint (with password)
    - ./scripts/docker/redis-production-entrypoint.sh:/docker-entrypoint-prod.sh:ro
```

- [ ] **Step 3: Update nestjs-api REDIS_URL format**

```yaml
# In nestjs-api service
environment:
  - REDIS_URL=${REDIS_URL:-redis://redis:6379}
  # Alternative: redis://:password@host:port format
  - REDIS_URL=redis://:${REDIS_PASSWORD:-}@redis:6379
```

- [ ] **Step 4: Commit**

```bash
git add scripts/docker/redis-production-entrypoint.sh docker-compose.yml
git commit -m "feat(redis): add production password support with conditional entrypoint"
```

---

## TASK 4: Fix Backend Dockerfile - Remove Global Dependencies

**Files:**
- Modify: `backend/Dockerfile` (lines 43-48, 89-98)

- [ ] **Step 1: Remove global npm install, use local dependencies**

Replace lines 43-48:
```dockerfile
# REMOVE THIS (lines 43-48):
# RUN npm install -g ts-node@10.9.2 typescript@5.7.3 2>/dev/null || true

# REPLACE WITH: Use production dependencies only - ts-node already copied from builder stage
```

Replace lines 89-98 (COPY ts-node/typescript from builder):
```dockerfile
# Keep this - ts-node is needed for seeding
COPY --from=builder --chown=appuser:appgroup /app/node_modules/ts-node ./node_modules/ts-node
COPY --from=builder --chown=appuser:appgroup /app/node_modules/.bin/ts-node ./node_modules/.bin/ts-node
COPY --from=builder --chown=appuser:appgroup /app/node_modules/typescript ./node_modules/typescript
COPY --from=builder --chown=appuser:appgroup /app/node_modules/.bin/tsc ./node_modules/.bin/tsc

# tsconfig-paths for proper module resolution
COPY --from=builder --chown=appuser:appgroup /app/node_modules/tsconfig-paths ./node_modules/tsconfig-paths
COPY --from=builder --chown=appuser:appgroup /app/node_modules/tsconfig-paths/register ./node_modules/tsconfig-paths/register 2>/dev/null || true
```

- [ ] **Step 2: Add explicit health check removal (already in place)**

The Dockerfile already has health check at line 51-52 - VERIFIED

- [ ] **Step 3: Commit**

```bash
git add backend/Dockerfile
git commit -m "fix(dockerfile): remove global npm deps, use local from builder stage"
```

---

## TASK 5: Add Caddy Health Check

**Files:**
- Modify: `docker/caddy.Dockerfile`

- [ ] **Step 1: Add HEALTHCHECK instruction**

Add at end of Dockerfile (before final comment):
```dockerfile
# Health check using caddy binary
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD caddy validate --config /etc/caddy/Caddyfile || exit 1
```

- [ ] **Step 2: Commit**

```bash
git add docker/caddy.Dockerfile
git commit -m "feat(caddy): add health check for container monitoring"
```

---

## TASK 6: Fix CI Pipeline - Enforce Trivy Exit Code

**Files:**
- Modify: `.github/workflows/ci.yml` (lines 288-308)

- [ ] **Step 1: Fix Trivy configuration to enforce failures**

Replace lines 288-308 with:
```yaml
      - name: Run Trivy vulnerability scanner
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ secrets.DOCKER_USERNAME }}/ngemiloh-api:${{ github.sha }}
          format: sarif
          output: trivy-results.sarif
          severity: HIGH,CRITICAL
          exit-code: '1'  # FAIL on vulnerabilities
          ignore-unfixed: true
          trivyignores: |
            .trivyignore

      - name: Check for unignored vulnerabilities
        if: always()
        run: |
          if [ -f trivy-results.sarif ]; then
            # Parse SARIF and show summary
            echo "=== Trivy Scan Results ==="
            cat trivy-results.sarif | jq -r '.runs[0].results | length' 2>/dev/null || echo "0"
            echo "HIGH/CRITICAL vulnerabilities found (see Security tab for details)"
          fi
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "fix(ci): enforce Trivy exit code to fail on vulnerabilities"
```

---

## TASK 7: Fix Health Monitor Script

**Files:**
- Modify: `scripts/health-monitor.sh` (line 10)

- [ ] **Step 1: Make container names configurable**

```bash
# Line 10: Replace hardcoded array with environment variable
CONTAINERS=${NGEMILOH_CONTAINERS:-"ngemiloh_db ngemiloh_redis ngemiloh_api ngemiloh_caddy"}
# Convert to array
read -ra CONTAINER_ARRAY <<< "$CONTAINERS"
```

Update loop (line 113):
```bash
# for container in "${CONTAINERS[@]}"; do
for container in "${CONTAINER_ARRAY[@]}"; do
```

- [ ] **Step 2: Add docker-compose integration**

Add new function:
```bash
# Read container names from docker-compose.yml
get_compose_containers() {
    if [ -f "docker-compose.yml" ]; then
        grep -E "^\s+[a-z-]+:" docker-compose.yml | \
            grep -vE "(networks|volumes|ports|services)" | \
            sed 's/[[:space:]]*//g' | tr -d ':' | \
            grep -E "^(postgres|redis|nestjs|caddy)" || true
    fi
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/health-monitor.sh
git commit -m "fix(monitor): make container names configurable via env var"
```

---

## TASK 8: Add Rate Limiting to Caddy (Production)

**Files:**
- Modify: `Caddyfile` (add production rate limiting section)

- [ ] **Step 1: Add rate limiting directive for production**

Add to Caddyfile before closing brace:
```nginx
{
    # ... existing config ...
    
    # Rate limiting for API
    order rate_limit first
}

# Add rate limit zone in site block
:80 {
    # ... existing config ...
    
    # Rate limiting (per IP)
    @ratelimit {
        remote_ip $CADDY_RATE_LIMIT_IP}
    rate_limit {
        zone {
            key remote_ip
            rate 100r/m
            burst 50
        }
    }
    handle @ratelimit {
        respond "Too Many Requests" 429
    }
}
```

Actually, for production HTTPS, use different approach:

```nginx
# Add to production Caddyfile
{
    # Existing settings
    order rate_limit first
}

# In site block:
:443 {
    # Rate limiting for API endpoints
    @api-limit {
        path /api/*
        remote_ip $CADDY_CLIENT_IP
    }
    
    rate_limit {
        zone {
            key remote_ip
            rate 100r/m
            burst 50
            zone_size 1mb
        }
    }
    
    handle @api-limit {
        respond "Rate limit exceeded" 429
    }
}
```

- [ ] **Step 2: Create separate production Caddyfile**

```bash
cat > Caddyfile.prod << 'EOF'
# ── Ngemiloh POS - Production Caddyfile ──────────────────
# HTTPS with rate limiting and security headers

{
    admin off
    persist_config off
}

:443 {
    # Security headers
    header {
        X-Frame-Options "SAMEORIGIN"
        X-Content-Type-Options nosniff
        X-XSS-Protection "1; mode=block"
        Referrer-Policy "strict-origin-when-cross-origin"
        Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.midtrans.com"
    }

    # Rate limiting
    @limited {
        path /api/*
        remote_ip $CADDY_RATE_LIMIT_CIDR
    }
    
    handle /api/* {
        rate_limit {
            zone { key remote_ip rate 100r/m burst 50 }
        }
        reverse_proxy ngemiloh_api:3000
    }

    # Internal endpoints (no rate limit)
    @internal {
        path /health /_health /api/v1/store-info
    }
    handle @internal {
        reverse_proxy ngemiloh_api:3000
    }

    # Webhooks (no rate limit - need to accept Midtrans)
    handle /webhooks/* {
        reverse_proxy ngemiloh_api:3000
    }

    # Storage
    handle /storage/* {
        reverse_proxy ngemiloh_api:3000
    }

    # Static files
    handle {
        root * /srv
        try_files {path} /index.html
        file_server
    }

    # Error pages
    handle_errors {
        rewrite * /{err.status_code}.html
        file_server { root /etc/caddy/error_pages }
    }
}
EOF
```

- [ ] **Step 3: Update docker-compose for production Caddyfile**

Add environment variable and volume mount:
```yaml
caddy:
  # ... existing config ...
  environment:
    - CADDY_RATE_LIMIT_CIDR=${CADDY_RATE_LIMIT_CIDR:-}
  volumes:
    # Use production Caddyfile
    - ./Caddyfile.prod:/etc/caddy/Caddyfile:ro
```

- [ ] **Step 4: Commit**

```bash
git add Caddyfile Caddyfile.prod docker-compose.yml
git commit -m "feat(caddy): add production Caddyfile with rate limiting and security headers"
```

---

## TASK 9: Add Backup Verification and Retention

**Files:**
- Modify: `scripts/backup.sh`

- [ ] **Step 1: Enhance backup script with verification**

```bash
# Add to scripts/backup.sh after backup creation:

# Verify backup integrity
verify_backup() {
    local backup_file="$1"
    local max_size_mb=500
    
    if [ ! -f "$backup_file" ]; then
        echo "[ERROR] Backup file not found: $backup_file"
        return 1
    fi
    
    # Check file size (should be > 1KB and < max_size_mb)
    local size_mb=$(du -m "$backup_file" | cut -f1)
    if [ "$size_mb" -lt 1 ]; then
        echo "[ERROR] Backup file too small: $size_mb MB"
        return 1
    fi
    
    if [ "$size_mb" -gt "$max_size_mb" ]; then
        echo "[WARNING] Backup file unusually large: $size_mb MB"
    fi
    
    # Verify PostgreSQL backup format
    if [[ "$backup_file" == *.sql ]]; then
        if ! head -1 "$backup_file" | grep -q "PGDMP"; then
            echo "[ERROR] Invalid PostgreSQL backup format"
            return 1
        fi
    fi
    
    echo "[OK] Backup verified: $size_mb MB"
    return 0
}

# Retention policy (keep last 30 days)
cleanup_old_backups() {
    local backup_dir="$1"
    local retention_days="${BACKUP_RETENTION_DAYS:-30}"
    
    echo "[INFO] Cleaning up backups older than $retention_days days..."
    find "$backup_dir" -name "*.sql.gz" -mtime +$retention_days -delete
    find "$backup_dir" -name "*.tar.gz" -mtime +$retention_days -delete
    echo "[OK] Cleanup complete"
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/backup.sh
git commit -m "feat(backup): add backup verification and retention policy"
```

---

## TASK 10: Write Complete Audit Report

**Files:**
- Create: `docs/audits/2026-06-19-docker-ci-deploy-audit.md`

- [ ] **Step 1: Write comprehensive audit report**

(Writing full report content)

- [ ] **Step 2: Commit**

```bash
git add docs/audits/2026-06-19-docker-ci-deploy-audit.md
git commit -m "docs(audit): add Docker/CI/Deploy audit report"
```

---

## Verification Tasks

After all fixes, verify:

- [ ] **Backend build**: `cd backend && npm run build`
- [ ] **Frontend build**: `cd frontend && npm run build`
- [ ] **Docker compose syntax**: `docker compose config`
- [ ] **GitHub Actions lint**: `npx actionlint .github/workflows/`
- [ ] **Security scan**: `trivy fs --security-checks vuln,config .`

---

## Self-Review Checklist

- [ ] All 10 tasks have actual code, not placeholders
- [ ] Each task can be verified independently
- [ ] All file paths are absolute/relative correctly
- [ ] Commands use correct syntax for the platform (PowerShell/Bash)
- [ ] No "TODO" or "TBD" in any step
