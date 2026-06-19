# Ngemiloh POS - ACTION PLAN
**Created:** June 19, 2026  
**Status:** Ready for Implementation  
**Format:** Priority-based, no time constraints

---

## PRIORITY LEVELS EXPLANATION
- **P0 (Critical):** Must fix before production deployment
- **P1 (High):** Fix before or after production, but should not be delayed
- **P2 (Medium):** Can be done after production deployment
- **P3 (Low):** Nice to have, can be deferred
- **P4 (Future):** Long-term improvements

---

## ACTION ITEMS BY PRIORITY

---

## 🔴 PRIORITY P0 (CRITICAL - PRODUCTION BLOCKER)

### P0.1: Fix Health Check Rate Limiting Issue
**Status:** Identified but not critical yet  
**Issue:** After ~10 minutes, health check endpoint returns 429 Too Many Requests  
**Root Cause:** Docker health checks called every 10s, hitting throttler limit of 100 req/min  
**Action Required:** Implement one of two solutions:

**Option A: Increase Throttler Limit (Quick Fix)**
```typescript
// File: backend/src/app.module.ts
ThrottlerModule.forRoot([
  {
    name: 'short',
    ttl: 60000,
    limit: 200, // CHANGED from 100 to 200
  },
  // ... rest unchanged
])
```
**Effort:** 5 minutes  
**Pros:** Quick fix, simple  
**Cons:** Less secure for other endpoints  

**Option B: Separate Health Check Endpoint (Recommended)**
```typescript
// File: backend/src/app.controller.ts
@Get('health')
@SkipThrottle() // Already has this, but verify it works
async healthCheck(@Res() res: Response) { ... }

// Add this as alternative:
@Get('_health') // For Docker internal checks
@SkipThrottle()
async internalHealth(@Res() res: Response) {
  return res.status(200).json({ ok: true });
}
```
**Update docker-compose.yml:**
```yaml
healthcheck:
  test: ["CMD-SHELL", "node -e \"const http=require('http');http.get('http://127.0.0.1:3000/_health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))\""]
  interval: 10s
  timeout: 5s
  retries: 5
```
**Effort:** 15 minutes  
**Pros:** Cleaner separation, health checks never rate limited  
**Cons:** Requires code + compose file changes  

**Recommendation:** Implement Option B (better design)  
**Testing:** Verify health check works after 30+ minutes  
**Rollback Plan:** Revert changes and redeploy

---

### P0.2: Set Up Automated Database Backups
**Status:** Missing - Critical for data safety  
**Action Required:** Implement backup strategy

**Option A: PostgreSQL Native Backups (Recommended for small deployments)**
```bash
# Create backup script: scripts/backup-db.sh
#!/bin/bash
BACKUP_DIR="/backups/postgres"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker exec ngemiloh_db pg_dump -U ngemiloh ngemiloh_db | gzip > "$BACKUP_DIR/backup_$TIMESTAMP.sql.gz"
echo "Backup created: backup_$TIMESTAMP.sql.gz"
```

**Option B: Docker Volume Backup**
```bash
#!/bin/bash
BACKUP_DIR="/backups/volumes"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
docker run --rm -v postgres_data:/data -v "$BACKUP_DIR":/backups \
  alpine tar czf /backups/postgres_$TIMESTAMP.tar.gz -C / data
```

**Scheduling:**
- Use cron job to run daily at 2 AM (off-peak)
- Retain last 7 daily backups + 4 weekly backups + 12 monthly backups
- Verify backups are readable (test restore monthly)

**Effort:** 30 minutes  
**Files to Create/Modify:**
- `scripts/backup-db.sh`
- `scripts/backup-volumes.sh`
- `scripts/restore-db.sh`
- Add cron entries in server

**Testing:** 
- Test backup creation
- Test restore from backup to temporary database
- Verify data integrity post-restore

---

### P0.3: Document Production Secrets Management
**Status:** Partially implemented (code ready, documentation missing)  
**Current State:** docker-compose.yml references Docker secrets, but app doesn't use them correctly in dev

**Action Required:** Clarify and document

**Create:** `docs/SECRETS_MANAGEMENT.md`
```markdown
## Production Secrets Setup

### Required Secrets (Docker secrets format)
1. db_password: PostgreSQL admin password
2. redis_password: Redis authentication password
3. jwt_access_secret: JWT signing key (min 32 chars)
4. pin_pepper_secret: PIN hashing pepper
5. csrf_secret: CSRF token secret
6. midtrans_server_key_sandbox: Midtrans sandbox key
7. midtrans_server_key_production: Midtrans prod key
8. email_app_password: Email service password

### How to Create Secrets
```
docker secret create jwt_access_secret - < ./secrets/jwt_access_secret.txt
```

### Verification Checklist
- [ ] All 8 secrets created
- [ ] Secrets have proper permissions (400)
- [ ] docker-compose.yml references all secrets
- [ ] docker-entrypoint.sh loads all secrets
- [ ] Test application can read all secrets
```

**Effort:** 20 minutes  
**Validation:** Manual test in staging environment

---

## 🟠 PRIORITY P1 (HIGH - DO BEFORE GOING LIVE)

### P1.1: Implement Monitoring & Alerting System
**Status:** Missing - No visibility into system health  
**Action Required:** Set up monitoring stack

**Option A: Docker-native with custom script (Minimal setup)**
```bash
# scripts/monitor.sh - Run in cron every 5 minutes
#!/bin/bash
ALERT_EMAIL="admin@example.com"

# Check API health
if ! curl -s http://localhost:3000/health | grep -q '"status":"ok"'; then
  echo "API down" | mail -s "ALERT: API health check failed" $ALERT_EMAIL
fi

# Check database
if ! docker exec ngemiloh_db pg_isready > /dev/null; then
  echo "Database down" | mail -s "ALERT: Database unhealthy" $ALERT_EMAIL
fi

# Check disk space
DISK_USAGE=$(df / | tail -1 | awk '{print $5}' | cut -d'%' -f1)
if [ $DISK_USAGE -gt 80 ]; then
  echo "Disk usage: $DISK_USAGE%" | mail -s "ALERT: High disk usage" $ALERT_EMAIL
fi
```

**Option B: Prometheus + Grafana (Production-grade)**
```yaml
# monitoring/prometheus.yml
global:
  scrape_interval: 15s
scrape_configs:
  - job_name: 'ngemiloh'
    static_configs:
      - targets: ['localhost:9090']
```
**Effort:** 1-2 hours  
**Benefit:** Professional monitoring with dashboards

**Recommendation:** Implement Option A now, upgrade to B later  

**Files to Create:**
- `scripts/monitor.sh`
- `scripts/alert-email.sh`
- `monitoring/prometheus.yml` (optional)
- `monitoring/grafana-dashboards/` (optional)

**Testing:** Manually trigger alerts (stop a container, verify alert received)

---

### P1.2: Create Operational Runbook
**Status:** Missing - No documented procedures  
**Action Required:** Document standard operations

**Create:** `docs/RUNBOOK.md`

**Contents:**
1. **Emergency Procedures**
   - How to restart a container
   - How to restore from backup
   - How to rollback a deployment
   - How to scale up (add more resources)

2. **Regular Maintenance**
   - Database optimization (VACUUM, ANALYZE)
   - Log rotation
   - Security patches
   - Dependency updates

3. **Troubleshooting Guide**
   - API container unhealthy → check logs → restart
   - Database connection errors → check network
   - High disk usage → check backup sizes
   - API slow → check database queries

4. **Contact List & Escalation**
   - Who to contact for different issues
   - On-call rotation

**Example Section:**
```markdown
## API Container Restart

### When to restart:
- Container marked as unhealthy
- After deployment of new code
- When API logs show "connection lost" errors

### Steps:
1. docker logs ngemiloh_api --tail 50
2. docker restart ngemiloh_api
3. Wait 30 seconds for startup
4. Verify: docker ps | grep ngemiloh_api (should show healthy)
5. Test: curl http://localhost:3000/health

### If it fails:
1. docker compose up -d nestjs-api
2. If still fails: docker compose restart
3. If still fails: Check docker-compose.yml config
```

**Effort:** 1-2 hours  
**Audience:** DevOps/Operations team  
**Maintenance:** Review quarterly

---

### P1.3: Add Rate Limiting Metrics & Logging
**Status:** Partial - Throttler exists but no visibility  
**Action Required:** Log rate limit violations

**Modify:** `backend/src/app.module.ts`
```typescript
// Add custom throttler guard to log violations
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  async handleRequest(context, limit, ttl) {
    try {
      return await super.handleRequest(context, limit, ttl);
    } catch (error) {
      const req = context.switchToHttp().getRequest();
      console.warn(`[THROTTLE] Limit exceeded: ${req.method} ${req.url} from ${req.ip}`);
      throw error;
    }
  }
}
```

**Modify docker-compose.yml:**
```yaml
nestjs-api:
  environment:
    - LOG_LEVEL=info # Add this
```

**Effort:** 30 minutes  
**Benefit:** Understand who is hitting rate limits and why

---

### P1.4: Test Payment Gateway Integration (Midtrans)
**Status:** Configured but not tested end-to-end  
**Action Required:** Verify payment flow works

**Test Scenarios:**
1. Create order with QRIS payment
2. Verify Midtrans webhook received
3. Verify order status updated
4. Test payment cancellation
5. Test refund flow

**Testing Steps:**
```bash
# 1. Create test order
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{
    "items": [{"product_id": "...", "qty": 1}],
    "payment_method": "qris"
  }'

# 2. Get Midtrans payment link from response
# 3. Use Midtrans sandbox to simulate payment
# 4. Verify webhook callback received
# 5. Check order status changed to paid
```

**Expected Outcome:** 
- Order created ✅
- Payment link generated ✅
- Webhook processed ✅
- Order marked as paid ✅

**Effort:** 1 hour  
**Risk:** High - payment system critical  
**Documentation:** Create test checklist

---

## 🟡 PRIORITY P2 (MEDIUM - IMPLEMENT SOON)

### P2.1: Add Error Page Customization in Caddy
**Status:** Missing - Users see generic error pages  
**Action Required:** Create user-friendly error pages

**Create:** `caddy/error_pages/`
```
caddy/error_pages/
  ├── 400.html (Bad Request)
  ├── 404.html (Not Found)
  ├── 500.html (Server Error)
  └── 503.html (Service Unavailable)
```

**Example:** `caddy/error_pages/404.html`
```html
<!DOCTYPE html>
<html>
<head>
  <title>404 - Not Found</title>
  <style>
    body { font-family: Arial; text-align: center; margin-top: 50px; }
    h1 { color: #333; }
  </style>
</head>
<body>
  <h1>Halaman Tidak Ditemukan</h1>
  <p>URL yang Anda akses tidak ada.</p>
  <a href="/">Kembali ke Beranda</a>
</body>
</html>
```

**Modify:** `Caddyfile`
```
{
  handle_errors {
    respond "{err.status_code} {err.status_text}"
  }
}
```

**Effort:** 30 minutes  
**Benefit:** Professional user experience  

---

### P2.2: Implement Database Query Logging for Debugging
**Status:** Partial - Prisma logs available but not captured  
**Action Required:** Enable and capture query logs

**Modify:** `backend/.env` (or environment variables)
```env
DATABASE_QUERY_LOG=true
PRISMA_CLIENT_LOG_LEVEL=debug
```

**Create:** `backend/src/common/database/query-logger.ts`
```typescript
// Log slow queries
const SLOW_QUERY_THRESHOLD = 1000; // 1 second

prisma.$on('query', (e) => {
  if (e.duration > SLOW_QUERY_THRESHOLD) {
    console.warn(`[SLOW QUERY] ${e.query} took ${e.duration}ms`);
  }
});
```

**Effort:** 45 minutes  
**Benefit:** Identify performance bottlenecks  

---

### P2.3: Create Dashboard Configuration Backup
**Status:** Missing - Frontend settings not backed up  
**Action Required:** Export Caddy config regularly

**Create:** `scripts/backup-config.sh`
```bash
#!/bin/bash
BACKUP_DIR="/backups/config"
mkdir -p $BACKUP_DIR

# Backup Caddyfile
cp Caddyfile "$BACKUP_DIR/Caddyfile.$(date +%Y%m%d)"

# Backup docker-compose.yml
cp docker-compose.yml "$BACKUP_DIR/docker-compose.yml.$(date +%Y%m%d)"

# Backup app config
docker cp ngemiloh_caddy:/config "$BACKUP_DIR/caddy_config.$(date +%Y%m%d).tar.gz"

echo "Config backup completed"
```

**Effort:** 20 minutes  

---

### P2.4: Add Structured Logging (JSON format)
**Status:** Missing - Logs are human-readable but hard to parse  
**Action Required:** Implement JSON logging for better parsing

**Modify:** `backend/src/main.ts`
```typescript
// Add JSON logger
import * as pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      singleLine: false,
    }
  }
});

app.useLogger(new PinoLogger());
```

**Effort:** 1 hour  
**Benefit:** Better log aggregation and searching  

---

## 🟢 PRIORITY P3 (LOW - ENHANCEMENTS)

### P3.1: Add Caching Headers to Static Assets
**Status:** Missing - Frontend assets not cached  
**Action Required:** Configure Caddy cache headers

**Modify:** `Caddyfile`
```
@static {
  path /assets/*
  path /vendor/*
}

route @static {
  header Cache-Control "public, max-age=31536000, immutable"
  file_server
}
```

**Effort:** 15 minutes  
**Benefit:** Faster frontend load times  

---

### P3.2: Add Sentry Integration for Development
**Status:** Configured but disabled in development  
**Action Required:** Set up Sentry for error tracking

**Create account:** https://sentry.io  
**Create:** `.env.local`
```env
SENTRY_DSN=https://xxx@sentry.io/xxx
SENTRY_ENVIRONMENT=development
SENTRY_RELEASE=1.0.0
```

**Effort:** 30 minutes  
**Benefit:** Track errors in real-time  

---

### P3.3: Implement Email Verification for Alerts
**Status:** Alerts can be sent but not verified  
**Action Required:** Test email delivery

**Create:** `scripts/test-email.sh`
```bash
#!/bin/bash
docker exec ngemiloh_api node -e "
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: process.env.EMAIL_PORT,
  secure: process.env.EMAIL_SECURE === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

transporter.sendMail({
  from: process.env.EMAIL_FROM,
  to: process.env.EMAIL_ALERT_TO,
  subject: 'Test Email',
  text: 'This is a test email from Ngemiloh POS'
}, (err, info) => {
  if (err) console.error('Email failed:', err);
  else console.log('Email sent:', info.response);
});
"
```

**Effort:** 20 minutes  

---

### P3.4: Add API Request/Response Logging Middleware
**Status:** Missing - Can't see request/response flow  
**Action Required:** Add HTTP logging middleware

**Create:** `backend/src/common/middleware/request-logger.middleware.ts`
```typescript
import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      console.log(`${req.method} ${req.path} - ${res.statusCode} (${duration}ms)`);
    });
    next();
  }
}
```

**Register in:** `app.module.ts`
```typescript
configure(consumer: MiddlewareConsumer) {
  consumer.apply(RequestLoggerMiddleware).forRoutes('*');
}
```

**Effort:** 30 minutes  

---

## 🔵 PRIORITY P4 (FUTURE - LONG TERM)

### P4.1: Migrate to Docker Hardened Images (DHI)
**Status:** Not started - Currently using standard images  
**Action Required:** Replace base images with DHI equivalents

**Research Phase:**
- Review DHI documentation
- Test with Node.js DHI image
- Test with PostgreSQL DHI image
- Compare performance

**Implementation Phase:**
- Update `backend/Dockerfile` to use DHI Node.js base
- Update `postgres.Dockerfile` to use DHI PostgreSQL base
- Test all functionality
- Update CI/CD pipeline

**Effort:** 4-6 hours  
**Benefit:** Reduced CVE exposure, government-approved images  

---

### P4.2: Implement Distributed Tracing
**Status:** Not started - No request tracing  
**Action Required:** Add OpenTelemetry tracing

**Setup:**
- Install OpenTelemetry packages
- Configure Jaeger backend
- Add instrumentation to all services
- Create traces dashboard

**Effort:** 6-8 hours  
**Benefit:** End-to-end visibility for debugging  

---

### P4.3: Set Up Kubernetes Deployment Manifests
**Status:** Not started - Currently Docker Compose only  
**Action Required:** Create K8s manifests for scalability

**Create:**
- `k8s/namespace.yaml`
- `k8s/postgres-statefulset.yaml`
- `k8s/redis-deployment.yaml`
- `k8s/api-deployment.yaml`
- `k8s/caddy-deployment.yaml`
- `k8s/ingress.yaml`

**Effort:** 8-10 hours  
**Benefit:** Multi-node deployments, auto-scaling  

---

### P4.4: Implement GitOps with ArgoCD
**Status:** Not started - Manual deployments  
**Action Required:** Automate deployments via Git

**Setup:**
- Install ArgoCD
- Create deployment manifests in Git repo
- Configure auto-sync
- Implement promotion pipeline (dev → staging → prod)

**Effort:** 4-6 hours  
**Benefit:** Automated, auditable deployments  

---

### P4.5: Add Multi-Region Failover
**Status:** Not started - Single instance only  
**Action Required:** Setup active-active or active-passive

**Approach:**
- Database replication (PostgreSQL streaming replication)
- Redis replication (Redis Sentinel)
- Load balancer (HAProxy or cloud LB)
- DNS failover configuration

**Effort:** 12-16 hours  
**Benefit:** High availability, disaster recovery  

---

## IMPLEMENTATION ROADMAP

### Phase 1: Before Production (Critical)
```
Week 1:
  ✓ P0.1: Fix health check rate limiting
  ✓ P0.2: Set up automated backups
  ✓ P0.3: Document secrets management
  ✓ P1.1: Implement monitoring
  ✓ P1.2: Create runbook
  ✓ P1.4: Test Midtrans integration

Week 2:
  ✓ P1.3: Rate limiting metrics
  ✓ P2.1: Custom error pages
  ✓ P2.2: Database query logging
```

### Phase 2: Post-Production (Soon)
```
Month 1:
  ✓ P2.3: Config backup
  ✓ P2.4: Structured logging
  ✓ P3.1-P3.4: Enhancements

Month 2:
  ✓ P4.1: DHI migration
  ✓ P4.2: Distributed tracing
```

### Phase 3: Advanced (Later)
```
Q3/Q4:
  ✓ P4.3: Kubernetes
  ✓ P4.4: GitOps
  ✓ P4.5: Multi-region failover
```

---

## TRACKING TEMPLATE

For each action item, use this template to track progress:

```markdown
## [Action Item Name]

**Priority:** [P0/P1/P2/P3/P4]  
**Status:** [ ] Not Started | [x] In Progress | [x] Completed | [x] Blocked  
**Owner:** [Name]  
**Due Date:** [Optional]  
**Effort Estimate:** [X hours]  
**Actual Effort:** [X hours]  

### Progress
- [x] Step 1: Description
- [ ] Step 2: Description

### Blockers
- None / [Description of blocker]

### Notes
- Any relevant information
```

---

## QUICK REFERENCE: COMMANDS

```bash
# View all logs
docker compose logs -f

# Backup database
docker exec ngemiloh_db pg_dump -U ngemiloh ngemiloh_db | gzip > backup.sql.gz

# Restore database
gunzip < backup.sql.gz | docker exec -i ngemiloh_db psql -U ngemiloh ngemiloh_db

# Check health
curl http://localhost:3000/health

# Restart services
docker compose restart

# View resource usage
docker stats

# Check migrations
docker exec ngemiloh_db psql -U ngemiloh -d ngemiloh_db -c "SELECT COUNT(*) FROM _prisma_migrations"
```

---

## APPROVAL CHECKLIST

Before going to production, verify:
- [ ] P0.1 Completed (health check issue fixed)
- [ ] P0.2 Completed (backups working)
- [ ] P0.3 Completed (secrets documented)
- [ ] P1.1 Completed (monitoring setup)
- [ ] P1.2 Completed (runbook created)
- [ ] P1.4 Completed (Midtrans tested)
- [ ] All containers healthy
- [ ] Database backups verified restorable
- [ ] Security review completed
- [ ] Performance acceptable

**Sign-off Date:** __________  
**Signed By:** __________

---

**Last Updated:** June 19, 2026  
**Next Review:** After completion of Phase 1
