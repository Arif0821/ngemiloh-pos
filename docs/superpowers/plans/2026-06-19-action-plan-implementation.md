# ACTION PLAN Implementation (P0-P4) + JWT Auth Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all ACTION PLAN items from FINAL_AUDIT_REPORT.md sequentially (P0→P1→P2→P3→P4) plus fix JWT auth for unlimited kasir PIN expiry.

**Architecture:** 
- All Docker-native solutions (no external services) unless specified
- Follow Gordon's recommendations from audit report
- Test-driven approach for code changes
- Use superpowers + agent-skills for each task

**Tech Stack:** Bash scripts, NestJS, Prisma, Docker, Caddy, SvelteKit

---

## File Structure Summary

```
scripts/
├── backup.sh              # EXISTS - test & document
├── monitor.sh             # CREATE - P1.1
├── backup-config.sh       # CREATE - P2.3
└── rate-limit-logger.ts   # CREATE - P1.3

docs/
├── SECRETS_MANAGEMENT.md  # CREATE - P0.3
├── RUNBOOK.md             # CREATE - P1.2
├── ERROR_PAGES/           # CREATE - P2.1
│   ├── 400.html
│   ├── 404.html
│   ├── 500.html
│   └── 503.html
└── SUPERPOWERS/plans/
    └── 2026-06-19-action-plan-implementation.md  # THIS FILE

backend/src/
├── app.controller.ts      # MODIFY - P0.1
├── app.module.ts          # MODIFY - P1.3
├── auth/
│   └── application/services/auth.service.ts  # MODIFY - JWT fix
└── common/database/
    └── query-logger.ts    # CREATE - P2.2
```

---

## PHASE 0: CRITICAL BLOCKERS

---

### Task P0.1: Fix Health Check Rate Limiting

**Files:**
- Modify: `backend/src/app.controller.ts`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Add new internal health endpoint**

Open `backend/src/app.controller.ts` and add a new endpoint:

```typescript
// Add after existing health() method (around line 41)
@Get('_health')
@SkipThrottle()
async internalHealth(@Res() res: Response) {
  return res.status(200).json({ ok: true, timestamp: new Date().toISOString() });
}
```

- [ ] **Step 2: Update docker-compose.yml healthcheck**

Find nestjs-api healthcheck section and change endpoint:

```yaml
# In docker-compose.yml, find:
healthcheck:
  test: ["CMD", "node", "-e", "const http=require('http');http.get('http://127.0.0.1:3000/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]

# Change to:
healthcheck:
  test: ["CMD", "node", "-e", "const http=require('http');http.get('http://127.0.0.1:3000/_health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]
```

- [ ] **Step 3: Test health check works**

```bash
# Restart containers
docker compose restart nestjs-api

# Verify both endpoints work
curl http://localhost:3000/_health
curl http://localhost:3000/health
```

Expected: Both return 200 OK

- [ ] **Step 4: Commit**

```bash
git add backend/src/app.controller.ts docker-compose.yml
git commit -m "fix(P0.1): add separate internal health endpoint for Docker"
```

---

### Task P0.2: Test & Document Database Backup Script

**Files:**
- Modify: `scripts/backup.sh`
- Create: `docs/BACKUP.md`

- [ ] **Step 1: Review existing backup script**

```bash
cat scripts/backup.sh
```

Verify it has: pg_dump, gzip, encryption, retention

- [ ] **Step 2: Create backup documentation**

Create `docs/BACKUP.md`:

```markdown
# Database Backup Guide

## Automated Backups

The backup script runs daily via cron at 2 AM.

### Configuration

Set in crontab:
```bash
0 2 * * * /app/scripts/backup.sh >> /var/log/backup.log 2>&1
```

### Manual Backup

```bash
# Inside container
docker exec ngemiloh_api sh -c "cd /app && ./scripts/backup.sh"

# Direct pg_dump
docker exec ngemiloh_db pg_dump -U ngemiloh ngemiloh_db | gzip > backup_$(date +%Y%m%d).sql.gz
```

### Restore from Backup

```bash
gunzip < backup_YYYYMMDD.sql.gz | docker exec -i ngemiloh_db psql -U ngemiloh ngemiloh_db
```

### Retention Policy

- Daily backups: 30 days
- Monthly backups: 12 months
```

- [ ] **Step 3: Test backup execution**

```bash
# Test backup script
docker exec ngemiloh_api sh -c "cd /app && ./scripts/backup.sh"
```

Expected: Backup file created in /backups/postgres/

- [ ] **Step 4: Commit**

```bash
git add scripts/backup.sh docs/BACKUP.md
git commit -m "docs(P0.2): document backup procedures"
```

---

### Task P0.3: Document Secrets Management

**Files:**
- Create: `docs/SECRETS_MANAGEMENT.md`

- [ ] **Step 1: Create secrets documentation**

Create `docs/SECRETS_MANAGEMENT.md`:

```markdown
# Secrets Management

## Required Secrets (8 Total)

| Secret | File | Purpose |
|--------|------|---------|
| db_password | secrets/db_password.txt | PostgreSQL admin |
| redis_password | secrets/redis_password.txt | Redis auth |
| jwt_access_secret | secrets/jwt_access_secret.txt | JWT signing (min 32 chars) |
| pin_pepper_secret | secrets/pin_pepper_secret.txt | PIN hashing pepper |
| csrf_secret | secrets/csrf_secret.txt | CSRF token secret |
| midtrans_server_key_sandbox | secrets/midtrans_server_key_sandbox.txt | Sandbox payments |
| midtrans_server_key_production | secrets/midtrans_server_key_production.txt | Production payments |
| email_app_password | secrets/email_app_password.txt | Email service |

## Verification Checklist

- [ ] All 8 secrets created
- [ ] Secrets have proper permissions (chmod 400)
- [ ] docker-compose.yml references all secrets
- [ ] docker-entrypoint.sh loads all secrets
- [ ] Application reads all secrets successfully

## Secret Generation

```bash
# Generate secure secret
openssl rand -base64 32

# Or for specific length
head -c 32 /dev/urandom | base64
```

## Rotation Procedure

1. Generate new secret
2. Update secrets/SECRET_NAME.txt
3. Restart affected containers
4. Verify application works
5. Update any documentation
```

- [ ] **Step 2: Commit**

```bash
git add docs/SECRETS_MANAGEMENT.md
git commit -m "docs(P0.3): add secrets management documentation"
```

---

## PHASE 1: HIGH PRIORITY

---

### Task P1.1: Implement Monitoring & Alerting System

**Files:**
- Create: `scripts/monitor.sh`

- [ ] **Step 1: Create monitoring script**

Create `scripts/monitor.sh`:

```bash
#!/bin/bash
# scripts/monitor.sh - Docker-native monitoring
# Run via cron: */5 * * * * /app/scripts/monitor.sh

ALERT_EMAIL="${EMAIL_ALERT_TO:-admin@ngemiloh.local}"
LOG_FILE="/var/log/monitor.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

# Check API health
if ! curl -sf http://localhost:3000/_health > /dev/null 2>&1; then
    log "ERROR: API unhealthy"
    # Send alert (if mail configured)
    [ -n "$ALERT_EMAIL" ] && echo "API is down!" | mail -s "ALERT: API unhealthy" "$ALERT_EMAIL"
fi

# Check database
if ! docker exec ngemiloh_db pg_isready -U ngemiloh > /dev/null 2>&1; then
    log "ERROR: Database unhealthy"
    [ -n "$ALERT_EMAIL" ] && echo "Database is down!" | mail -s "ALERT: Database unhealthy" "$ALERT_EMAIL"
fi

# Check Redis
if ! docker exec ngemiloh_redis redis-cli -a "$(cat /run/secrets/redis_password 2>/dev/null || echo '')" ping 2>/dev/null | grep -q PONG; then
    log "ERROR: Redis unhealthy"
    [ -n "$ALERT_EMAIL" ] && echo "Redis is down!" | mail -s "ALERT: Redis unhealthy" "$ALERT_EMAIL"
fi

# Check disk space
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | cut -d'%' -f1)
if [ "$DISK_USAGE" -gt 80 ]; then
    log "WARNING: High disk usage: ${DISK_USAGE}%"
    [ -n "$ALERT_EMAIL" ] && echo "Disk usage: ${DISK_USAGE}%" | mail -s "ALERT: High disk usage" "$ALERT_EMAIL"
fi

# Check container status
UNHEALTHY=$(docker ps --filter "health=unhealthy" --format "{{.Names}}" | wc -l)
if [ "$UNHEALTHY" -gt 0 ]; then
    log "WARNING: $UNHEALTHY unhealthy containers"
fi

log "Monitor check complete"
```

- [ ] **Step 2: Make script executable**

```bash
chmod +x scripts/monitor.sh
```

- [ ] **Step 3: Test monitoring script**

```bash
# Dry run test (no alerts)
./scripts/monitor.sh

# View log
cat /var/log/monitor.log
```

- [ ] **Step 4: Commit**

```bash
git add scripts/monitor.sh
git commit -m "feat(P1.1): add Docker-native monitoring script"
```

---

### Task P1.2: Create Operational Runbook

**Files:**
- Create: `docs/RUNBOOK.md`

- [ ] **Step 1: Create comprehensive runbook**

Create `docs/RUNBOOK.md`:

```markdown
# Ngemiloh POS Operational Runbook

## Emergency Procedures

### Container Restart

```bash
# Single container
docker compose restart <service-name>

# All containers
docker compose restart

# View logs after restart
docker compose logs -f --tail=100
```

### Database Restore

```bash
# 1. Stop API
docker compose stop nestjs-api

# 2. Restore
gunzip < backup_YYYYMMDD.sql.gz | docker exec -i ngemiloh_db psql -U ngemiloh ngemiloh_db

# 3. Restart API
docker compose start nestjs-api
```

### Rollback Deployment

```bash
# 1. Revert docker-compose.yml changes
git checkout HEAD -- docker-compose.yml

# 2. Pull previous image
docker pull <previous-image-tag>

# 3. Restart
docker compose up -d
```

## Troubleshooting

### API Container Unhealthy

1. Check logs: `docker compose logs nestjs-api`
2. Check health: `curl http://localhost:3000/_health`
3. Restart: `docker compose restart nestjs-api`
4. Full rebuild: `docker compose up -d --force-recreate nestjs-api`

### Database Connection Errors

1. Check DB: `docker exec ngemiloh_db pg_isready -U ngemiloh`
2. Check logs: `docker compose logs postgres`
3. Restart DB: `docker compose restart postgres`
4. Verify secrets: `docker exec ngemiloh_api env | grep DATABASE`

### High Disk Usage

```bash
# Check disk usage
df -h

# Clean old logs
docker compose logs --tail=1000 > /tmp/logs.txt
truncate -s 0 $(docker inspect --format='{{.LogPath}}' ngemiloh_api)

# Clean old backups
find /backups -name "*.gz" -mtime +30 -delete
```

### API Slow Response

1. Check DB queries: `docker exec ngemiloh_api cat /var/log/postgresql/slow.log`
2. Check resource usage: `docker stats`
3. Check connection pool: `docker exec ngemiloh_db psql -U ngemiloh -c "SELECT count(*) FROM pg_stat_activity;"`

## Regular Maintenance

### Weekly

```bash
# Database VACUUM
docker exec ngemiloh_db psql -U ngemiloh -d ngemiloh_db -c "VACUUM ANALYZE;"

# Log rotation
docker compose logs --tail=0 > /dev/null # Flush buffer
```

### Monthly

```bash
# Test backup restore
gunzip < latest_backup.sql.gz | docker exec -i ngemiloh_db psql -U ngemiloh ngemiloh_db -c "SELECT 1;"

# Security updates
docker compose pull
docker compose up -d
```

## Health Check Commands

```bash
# All containers
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Specific service
curl http://localhost:3000/_health
curl http://localhost:3000/health

# Database
docker exec ngemiloh_db pg_isready -U ngemiloh

# Redis
docker exec ngemiloh_redis redis-cli -a "$(cat secrets/redis_password.txt)" ping
```

## Contact List

| Role | Contact |
|------|---------|
| On-Call | [oncall@ngemiloh.local] |
| DevOps Lead | [devops@ngemiloh.local] |
| Escalation | [manager@ngemiloh.local] |
```

- [ ] **Step 2: Commit**

```bash
git add docs/RUNBOOK.md
git commit -m "docs(P1.2): add operational runbook"
```

---

### Task P1.3: Add Rate Limiting Metrics & Logging

**Files:**
- Modify: `backend/src/auth/guards/throttler-logger.guard.ts` (CREATE)
- Modify: `backend/src/app.module.ts`

- [ ] **Step 1: Create custom throttler guard with logging**

Create `backend/src/auth/guards/throttler-logger.guard.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException } from '@nestjs/throttler';
import { Request, Response } from 'express';

@Injectable()
export class ThrottlerLoggerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(context: { switchToHttp: () => { getRequest: () => Request; getResponse: () => Response } }): Promise<void> {
    const req = context.switchToHttp().getRequest();
    const ip = this.getClientIP(req);
    const method = req.method;
    const url = req.url;
    
    // Log throttling event
    console.warn(`[THROTTLE] Rate limit exceeded: ${method} ${url} from ${ip}`);
    
    throw new ThrottlerException('Too many requests');
  }

  protected async getTracker(req: Request): Promise<string> {
    return this.getClientIP(req);
  }

  private getClientIP(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  }
}
```

- [ ] **Step 2: Update app.module.ts to use custom guard**

Find the APP_GUARD provider and change:

```typescript
// In app.module.ts, change:
{
  provide: APP_GUARD,
  useClass: ThrottlerGuard,
},

// To:
{
  provide: APP_GUARD,
  useClass: ThrottlerLoggerGuard,
},
```

- [ ] **Step 3: Test throttle logging**

```bash
# Make many rapid requests to trigger logging
for i in {1..110}; do curl -s http://localhost:3000/_health > /dev/null; done

# Check logs
docker compose logs nestjs-api | grep THROTTLE
```

Expected: See `[THROTTLE]` warnings in logs

- [ ] **Step 4: Commit**

```bash
git add backend/src/auth/guards/throttler-logger.guard.ts backend/src/app.module.ts
git commit -m "feat(P1.3): add throttler logging guard"
```

---

### Task P1.4: Full E2E Midtrans Payment Testing

**Files:**
- No code changes
- Browser DevTools testing via agent-skills:browser-testing-with-devtools

- [ ] **Step 1: Launch browser testing agent**

Use `agent-skills:browser-testing-with-devtools` skill to perform full E2E test:

**Test Scenarios:**
1. Create order with QRIS payment method
2. Verify Midtrans redirect works
3. Test sandbox payment completion
4. Verify order status updates to paid
5. Test refund flow (if sandbox supports)

- [ ] **Step 2: Document test results**

Update `docs/PAYMENT_TESTING.md` with test results

- [ ] **Step 3: Commit**

```bash
git add docs/PAYMENT_TESTING.md
git commit -m "test(P1.4): document Midtrans E2E test results"
```

---

## PHASE 2: MEDIUM PRIORITY

---

### Task P2.1: Add Custom Error Pages

**Files:**
- Create: `caddy/error_pages/*.html`
- Modify: `Caddyfile`

- [ ] **Step 1: Create error page directory and files**

Create `caddy/error_pages/400.html`:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Bad Request - Ngemiloh POS</title>
    <style>
        body { font-family: system-ui; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #f5f5f5; }
        .error { text-align: center; padding: 2rem; background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #e67e22; margin: 0; }
        p { color: #666; }
    </style>
</head>
<body>
    <div class="error">
        <h1>400 - Bad Request</h1>
        <p>Request yang Anda kirim tidak valid.</p>
        <a href="/">Kembali ke Beranda</a>
    </div>
</body>
</html>
```

Create similar files for: `404.html`, `500.html`, `503.html` with appropriate colors (blue, red, orange)

- [ ] **Step 2: Configure Caddy to serve error pages**

Add to `Caddyfile` before the last closing brace:

```caddy
handle_errors {
    rewrite * /error_pages/{err.status_code}.html
    file_server
}
```

- [ ] **Step 3: Test error pages**

```bash
# Test 404
curl http://localhost/nonexistent-page

# Test 500 (trigger via API)
# Trigger via invalid request
```

- [ ] **Step 4: Commit**

```bash
git add caddy/error_pages/ Caddyfile
git commit -m "feat(P2.1): add custom Caddy error pages"
```

---

### Task P2.2: Implement Database Query Logging

**Files:**
- Create: `backend/src/common/database/query-logger.ts`
- Modify: `backend/src/prisma/prisma.service.ts`

- [ ] **Step 1: Create query logger**

Create `backend/src/common/database/query-logger.ts`:

```typescript
import { Prisma } from '@prisma/client';

const SLOW_QUERY_THRESHOLD_MS = 1000; // 1 second

export function setupQueryLogger(prisma: Prisma.Client) {
  prisma.$on('query' as never, (event: { query: string; duration: number; params: unknown }) => {
    const duration = event.duration;
    
    // Log slow queries
    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      console.warn(`[SLOW QUERY] ${duration}ms: ${event.query}`, {
        params: event.params,
        duration,
      });
    }
    
    // Log all queries in development
    if (process.env.NODE_ENV === 'development') {
      console.debug(`[QUERY] ${duration}ms: ${event.query}`);
    }
  });
}

export function setupQueryErrorLogger(prisma: Prisma.Client) {
  prisma.$on('query' as never, (event: { query: string; duration: number; params: unknown }) => {
    // Check for potential N+1 queries
    const query = event.query.toLowerCase();
    if (query.includes('select') && !query.includes('join')) {
      // Could be N+1 - log for analysis
      console.debug(`[SELECT-QUERY] ${event.query}`);
    }
  });
}
```

- [ ] **Step 2: Integrate into PrismaService**

Modify `backend/src/prisma/prisma.service.ts`:

```typescript
import { OnModuleInit } from '@nestjs/common';
import { setupQueryLogger } from '../common/database/query-logger';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    // Existing code...
    await this.$connect();
    
    // Add query logging in development
    if (process.env.NODE_ENV === 'development') {
      setupQueryLogger(this);
    }
  }
}
```

- [ ] **Step 3: Test query logging**

```bash
# Make various API requests
curl http://localhost:3000/api/v1/products
curl http://localhost:3000/api/v1/orders

# Check logs for query output
docker compose logs nestjs-api | grep -E "\[QUERY\]|\[SLOW QUERY\]"
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/common/database/query-logger.ts backend/src/prisma/prisma.service.ts
git commit -m "feat(P2.2): add database query logging"
```

---

### Task P2.3: Create Config Backup Script

**Files:**
- Create: `scripts/backup-config.sh`

- [ ] **Step 1: Create config backup script**

Create `scripts/backup-config.sh`:

```bash
#!/bin/bash
# scripts/backup-config.sh - Backup configuration files

BACKUP_DIR="/backups/config"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

# Backup Caddyfile
if [ -f "Caddyfile" ]; then
    cp Caddyfile "$BACKUP_DIR/Caddyfile.$TIMESTAMP"
fi

# Backup docker-compose.yml
if [ -f "docker-compose.yml" ]; then
    cp docker-compose.yml "$BACKUP_DIR/docker-compose.yml.$TIMESTAMP"
fi

# Backup backend env (exclude secrets)
if [ -f "backend/.env" ]; then
    grep -v -E "(PASSWORD|SECRET|KEY)" backend/.env > "$BACKUP_DIR/backend.env.$TIMESTAMP"
fi

# Archive Caddy config
if [ -d "caddy/data" ]; then
    tar -czf "$BACKUP_DIR/caddy_config.$TIMESTAMP.tar.gz" caddy/data/ 2>/dev/null || true
fi

# Cleanup old backups (keep 30 days)
find "$BACKUP_DIR" -name "*.gz" -mtime +30 -delete
find "$BACKUP_DIR" -name "*.yml" -mtime +30 -delete
find "$BACKUP_DIR" -name "*.env*" -mtime +30 -delete

echo "Config backup created: $TIMESTAMP"
```

- [ ] **Step 2: Make executable and test**

```bash
chmod +x scripts/backup-config.sh
./scripts/backup-config.sh
ls -la /backups/config/
```

- [ ] **Step 3: Commit**

```bash
git add scripts/backup-config.sh
git commit -m "feat(P2.3): add config backup script"
```

---

### Task P2.4: Implement Structured Logging (JSON)

**Files:**
- Modify: `backend/src/main.ts`

- [ ] **Step 1: Create JSON logger utility**

Create `backend/src/common/utils/logger.ts`:

```typescript
import { LoggerService, Injectable, Scope } from '@nestjs/common';

export interface LogEntry {
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  context?: string;
  [key: string]: unknown;
}

@Injectable({ scope: Scope.TRANSIENT })
export class JsonLogger implements LoggerService {
  constructor(private context?: string) {}

  private format(entry: Partial<LogEntry>): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      level: entry.level,
      message: entry.message,
      context: entry.context || this.context,
      ...entry,
    });
  }

  log(message: string, context?: string) {
    console.log(this.format({ level: 'info', message, context }));
  }

  error(message: string, trace?: string, context?: string) {
    console.error(this.format({ level: 'error', message, context, trace }));
  }

  warn(message: string, context?: string) {
    console.warn(this.format({ level: 'warn', message, context }));
  }

  debug(message: string, context?: string) {
    console.debug(this.format({ level: 'debug', message, context }));
  }

  verbose(message: string, context?: string) {
    console.log(this.format({ level: 'debug', message, context }));
  }
}
```

- [ ] **Step 2: Update main.ts to use JSON logging**

Modify `backend/src/main.ts`:

```typescript
// Add after existing imports
import { JsonLogger } from './common/utils/logger';

// Replace console with JSON logging
const logger = new JsonLogger('Bootstrap');

logger.log('Application starting...');
```

- [ ] **Step 3: Test JSON logging**

```bash
docker compose logs nestjs-api --tail=20 | grep -E '^\{'
```

Expected: JSON formatted log entries

- [ ] **Step 4: Commit**

```bash
git add backend/src/common/utils/logger.ts backend/src/main.ts
git commit -m "feat(P2.4): add structured JSON logging"
```

---

## PHASE 3 & 4: LOW PRIORITY & FUTURE

---

### Task P3.1: Add Caching Headers

**Files:**
- Modify: `Caddyfile`

- [ ] **Step 1: Add cache headers to Caddyfile**

Add to `Caddyfile` inside the frontend handle block:

```caddy
@assets {
    file
    path *.js *.css *.png *.jpg *.ico *.woff2
}
header @assets Cache-Control "public, max-age=31536000, immutable"
```

- [ ] **Step 2: Commit**

```bash
git add Caddyfile
git commit -m "feat(P3.1): add caching headers for static assets"
```

---

### Task P3.2: Sentry Integration Setup

**Files:**
- Create: `docs/SENTRY_SETUP.md`

- [ ] **Step 1: Document Sentry setup**

```markdown
# Sentry Integration Setup

## 1. Create Sentry Project
- Go to sentry.io
- Create new project (Node.js)

## 2. Get DSN
Copy the DSN URL

## 3. Configure Environment
```bash
SENTRY_DSN=https://xxx@o123.ingest.sentry.io/456
```

## 4. Verify
Check Sentry dashboard for test errors
```

- [ ] **Step 2: Commit**

```bash
git add docs/SENTRY_SETUP.md
git commit -m "docs(P3.2): add Sentry setup documentation"
```

---

### Task P4.x: Kubernetes & GitOps (Future)

These are long-term items - create placeholder docs only:

- [ ] `docs/KUBERNETES_SETUP.md` - Placeholder for future K8s migration
- [ ] `docs/GITOPS_SETUP.md` - Placeholder for ArgoCD setup

---

## BONUS: JWT Auth Fix (User Request)

---

### Task BONUS-1: Unlimited JWT Expiry for Kasir PIN

**Files:**
- Modify: `backend/src/auth/application/services/auth.service.ts`

- [ ] **Step 1: Find and replace 20h with unlimited**

In `auth.service.ts`, find all occurrences of `'20h'` and `72000`, replace:

```typescript
// OLD (in login method around line 188)
expiresIn: '20h',

// NEW
expiresIn: '365d',  // 1 year - effectively unlimited with admin control
```

```typescript
// OLD (around line 196)
maxAge: 72000,  // 20 hours

// NEW  
maxAge: 31536000,  // 1 year in seconds (effectively unlimited)
```

**NOTE:** Search for all 3 locations:
1. `login()` method - JWT generation
2. `login()` method - cookie maxAge
3. `changePin()` method - JWT generation + cookie

- [ ] **Step 2: Update constants file**

Modify `backend/src/common/utils/constants.ts`:

```typescript
// Add new constant
export const JWT_KASIR_EXPIRES_SECONDS = 365 * 24 * 60 * 60; // 1 year

// Or use '365d' directly
```

- [ ] **Step 3: Test login**

```bash
# Login as kasir
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"kasir1","pin":"123456"}' \
  -v

# Check cookie maxAge in response headers
```

Expected: Cookie should have max-age=31536000

- [ ] **Step 4: Commit**

```bash
git add backend/src/auth/application/services/auth.service.ts backend/src/common/utils/constants.ts
git commit -m "fix(auth): set kasir PIN token to unlimited expiry (admin controlled)"
```

---

## Verification Checklist

After all tasks:

- [ ] Health check works after 30+ minutes
- [ ] Backup script runs successfully
- [ ] All 8 secrets documented
- [ ] Monitoring script detects issues
- [ ] Runbook is comprehensive
- [ ] Throttle logging shows warnings
- [ ] Midtrans E2E test completed
- [ ] Error pages render correctly
- [ ] Slow queries are logged
- [ ] Config backup works
- [ ] JSON logging is working
- [ ] Kasir token is effectively unlimited

---

## Execution Options

**Plan complete and saved to `docs/superpowers/plans/2026-06-19-action-plan-implementation.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
