# Incident Response Playbook - NGEMILOH POS

> **Effective Date:** 2026-06-26  
> **Owner:** Tech Lead / DevOps  
> **Review Cycle:** Quarterly (every 3 months)

---

## Table of Contents

1. [Severity Classification](#1-severity-classification)
2. [Initial Assessment Checklist](#2-initial-assessment-checklist)
3. [Response Procedures](#3-response-procedures)
4. [Escalation Matrix](#4-escalation-matrix)
5. [Communication Templates](#5-communication-templates)
6. [Post-Incident Review](#6-post-incident-review)
7. [Contact Information](#7-contact-information)

---

## 1. Severity Classification

### Severity Levels & SLA

| Severity | Definition | Response Time | Resolution Target | Example Incidents |
|----------|------------|---------------|------------------|------------------|
| **P1 - Critical** | Total system outage, data loss, security breach, or revenue impact > Rp 5.000.000/hour | **15 minutes** | 4 hours | Payment gateway down, database corruption, total system outage |
| **P2 - High** | Major feature unavailable, significant degradation, partial data loss risk | **30 minutes** | 8 hours | QRIS processing slow, Redis down (with fallback), auth issues, payment processing failures |
| **P3 - Medium** | Partial outage affecting single outlet, performance degradation, non-critical feature broken | **2 hours** | 24 hours | UI bug minor, single outlet issue, webhook DLQ growing, receipt printer issues |
| **P4 - Low** | Minor issues, cosmetic bugs, non-blocking problems | **8 hours** | 72 hours | Logging issues, non-critical feature not working, slow report generation |

### P1-Critical Criteria (Any ONE triggers P1)

```
□ Total system downtime (>30 minutes)
□ Data breach or suspected breach
□ Database corruption or data loss
□ Payment processing completely failed
□ Revenue impact > Rp 5.000.000/hour
□ Security incident (unauthorized access, injection)
□ >50% outlets affected simultaneously
```

### P2-High Criteria (Any ONE triggers P2)

```
□ Core feature (payment/orders) partially degraded
□ Redis/Single point of failure down with fallback active
□ Authentication/Authorization failures
□ Webhook processing backlog > 1000 items
□ 25-50% outlets affected
□ Revenue impact > Rp 1.000.000/hour
```

---

## 2. Initial Assessment Checklist

Execute within first **5 minutes** of incident detection:

### 2.1 Identify & Classify

```
□ [ ] Incident detected at: __________ (timestamp)
□ [ ] Reporter: __________ (name/role/outlet)
□ [ ] Severity assigned: P___ (Initial: _____ Final: _____)
□ [ ] Incident commander assigned: __________
```

### 2.2 Initial Diagnosis (Answer ALL)

```bash
# System Health Check
□ [ ] Is the backend API responding? (curl/ping health endpoint)
□ [ ] Is the database accessible? (Prisma connection status)
□ [ ] Is Redis responding? (redis-cli ping)
□ [ ] Are workers (BullMQ) processing jobs?
□ [ ] Is the frontend accessible? (CDN/cloudflare status)

# Payment Systems
□ [ ] Is payment gateway responding?
□ [ ] Are QRIS transactions failing?
□ [ ] Is webhook DLQ growing?

# User Impact
□ [ ] Number of outlets affected: __________
□ [ ] Estimated users impacted: __________
□ [ ] Current revenue impact: __________
```

### 2.3 Capture Evidence

```
□ [ ] Screenshots of error messages
□ [ ] Log files (last 100 lines before incident)
□ [ ] Database query results if relevant
□ [ ] API response samples
□ [ ] Timestamps of first error occurrence
□ [ ] Transaction IDs affected (if applicable)
```

---

## 3. Response Procedures

### 3.1 P1 - Critical Incident Response

#### Immediate Actions (0-15 minutes)

```
1. ACKNOWLEDGE incident in monitoring channel
2. ASSEMBLE response team (see Escalation Matrix)
3. INITIATE incident timeline documentation
4. EXECUTE immediate containment
```

**Containment Playbook:**

| If Problem Is | Immediate Action |
|---------------|------------------|
| Database unresponsive | Enable read-only mode, activate DB replica |
| Payment gateway down | Switch to fallback gateway (if configured) |
| Data corruption suspected | STOP all writes, preserve logs |
| Security breach | ISOLATE affected systems, revoke tokens |
| Complete outage | Activate disaster recovery procedure |

```typescript
// Emergency Database Isolation (if corruption suspected)
await prisma.$executeRaw`SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE datname = 'pos_nabil' AND pid <> pg_backend_pid()`;
```

#### Communication Requirements

- **Internal**: Update every 15 minutes to #incident-response channel
- **External**: Initial acknowledgment within 30 minutes
- **Stakeholders**: Direct call to Tech Lead and Owner within 15 minutes

### 3.2 P2 - High Incident Response

#### Immediate Actions (0-30 minutes)

```
1. ACKNOWLEDGE incident
2. DIAGNOSE root cause
3. IMPLEMENT workaround if available
4. ESCALATE if not resolved in 30 minutes
```

**Workaround Playbook for P2:**

| Scenario | Workaround |
|----------|------------|
| Redis down | Switch to in-memory fallback (degraded mode) |
| QRIS slow | Enable cash payment fallback temporarily |
| Auth issues | Allow offline mode for logged-in sessions |
| Webhook DLQ growing | Pause processing, clear old items, reprocess |

```bash
# Check Redis fallback status
redis-cli ping || echo "FALLBACK_ACTIVATED"

# Check BullMQ queue health
curl http://localhost:3000/health/queues

# Emergency: Pause webhook processing
curl -X POST http://localhost:3000/webhook/pause
```

### 3.3 P3 - Medium Incident Response

#### Immediate Actions (0-2 hours)

```
1. ACKNOWLEDGE within SLA
2. INVESTIGATE root cause
3. CREATE Jira/issue ticket
4. RESOLVE or ESCALATE to P2 if impact increases
```

### 3.4 P4 - Low Incident Response

#### Immediate Actions (0-8 hours)

```
1. CREATE tracking ticket
2. SCHEDULE fix for next sprint/prioritized work
3. MONITOR for any escalation triggers
```

---

## 4. Escalation Matrix

### 4.1 Response Team Structure

```
┌─────────────────────────────────────────────────────────────┐
│                    INCIDENT COMMANDER                        │
│              (Overall coordination & comms)                  │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  BACKEND    │      │  FRONTEND   │      │   DBA /     │
│  DEVELOPER  │      │  DEVELOPER  │      │   DEVOPS    │
│  (Primary)  │      │  (Primary)  │      │  (Primary)  │
└─────────────┘      └─────────────┘      └─────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│  BACKEND    │      │  FRONTEND   │      │   DBA /     │
│  DEVELOPER  │      │  DEVELOPER  │      │   DEVOPS    │
│  (Backup)   │      │  (Backup)   │      │  (Backup)   │
└─────────────┘      └─────────────┘      └─────────────┘
```

### 4.2 Escalation Timeline

| Time | P1 Action | P2 Action | P3 Action |
|------|-----------|-----------|-----------|
| 0 min | Acknowledge, assemble team | Acknowledge | Acknowledge |
| 15 min | Owner notified | Tech Lead notified | - |
| 30 min | All stakeholders update | Escalation check | Tech Lead notified |
| 1 hour | Status page update | Owner notified | Status page update |
| 4 hours | Resolution target | Resolution target | - |
| 8 hours | Escalate to external support | Resolution target | Resolution target |
| 24 hours | - | - | Resolution target |

### 4.3 Contact Escalation Priority

```
P1 → Backend Dev → Frontend Dev → DBA/DevOps → Tech Lead → Owner → External Support
P2 → Backend Dev → DBA/DevOps → Tech Lead → Owner
P3 → Backend/Frontend Dev (assigned) → Tech Lead (if no progress)
P4 → Assignee (as scheduled)
```

---

## 5. Communication Templates

### 5.1 Internal Communication

#### P1 Initial Alert

```markdown
🚨 **P1 INCIDENT ALERT**

**Incident:** [Brief description]
**Time Detected:** [HH:MM timezone]
**Severity:** P1 - CRITICAL
**Incident Commander:** [Name]
**Impact:**
  - Outlets affected: [X/Y]
  - Estimated users: [Number]
  - Revenue impact: [Amount/hour]

**Current Status:** Investigating
**Next Update:** [HH:MM +15 min]

**Action Required:**
- [ ] All relevant developers check in
- [ ] DBA prepare for database snapshot
- [ ] DevOps check infrastructure status
```

#### P1 Status Update (Every 15 minutes)

```markdown
📊 **P1 STATUS UPDATE #[N]**

**Time:** [HH:MM timezone]
**Duration:** [X hours Y minutes]

**Status:** 🟡 Investigating / 🔴 Identified / 🟢 Mitigating / ✅ Resolved

**What we know:**
- [Root cause identified/not yet identified]
- [What is/isn't working]

**What we're doing:**
- [Current actions being taken]

**Impact:**
- Outlets affected: [X/Y]
- Transactions affected: [Number]
- Revenue impact: [Amount]

**Next Update:** [HH:MM]
```

#### P2/P3 Initial Alert

```markdown
⚠️ **P2/P3 INCIDENT**

**Incident:** [Brief description]
**Time Detected:** [HH:MM timezone]
**Severity:** P2/P3
**Assignee:** [Name]

**Impact:**
  - Outlets affected: [X/Y]
  - Feature affected: [Name]

**Status:** Investigating
**ETA for Update:** [HH:MM]
```

### 5.2 External Communication (Stakeholders)

#### Initial Customer-Facing Update (P1)

```markdown
Dear NGEMILOH Partners,

We are currently experiencing a service disruption affecting [payment processing/system availability].

**Status:** Investigating
**Impact:** [Brief description of user impact]
**Start Time:** [Date, HH:MM timezone]

Our technical team is actively working to resolve this issue. We will provide updates every 30 minutes.

We apologize for any inconvenience caused. For urgent matters, please contact [emergency contact].

Thank you for your patience.

- NGEMILOH Tech Team
```

#### Resolution Notification

```markdown
Dear NGEMILOH Partners,

**Update:** [Service/Feature] is now restored.

**Incident Summary:**
- Duration: [X hours Y minutes]
- Impact: [What was affected]
- Root Cause: [Brief explanation]

**Actions Taken:**
- [Action 1]
- [Action 2]

We apologize for the disruption and have implemented measures to prevent recurrence.

For questions, please contact [contact].

- NGEMILOH Tech Team
```

### 5.3 Customer Communication (End Users)

#### POS Machine Down

```markdown
Mohon maaf, sistem sedang dalam pemeliharaan.

Jika Anda kasir:
1. Catat transaksi secara manual di buku catatan
2. Hubungi supervisor untuk konfirmasi

Estimasi perbaikan: [Waktu]

Terima kasih atas kesabarannya.
- Tim NGEMILOH
```

#### QRIS Payment Unavailable

```markdown
Mohon maaf, pembayaran QRIS sedang tidak tersedia.

Opsi pembayaran sementara:
- Cash
- [Fallback method]

Silakan hubungi kasir untuk bantuan.

Estimasi perbaikan: [Waktu]

Terima kasih.
```

---

## 6. Post-Incident Review

### 6.1 Post-Incident Review Template

```markdown
# Post-Incident Review (PIR)

**Incident ID:** INC-[YYYY]-[###]
**Date:** [Date of incident]
**Severity:** P[N]
**Duration:** [X hours Y minutes]
**Date of Review:** [Review date]

---

## 1. Incident Summary

**What happened?**
[Brief description of the incident]

**Impact:**
- Outlets affected: [X/Y]
- Users impacted: [Number]
- Transactions affected: [Number]
- Revenue impact: [Amount]

---

## 2. Timeline

| Time | Action | Owner |
|------|--------|-------|
| HH:MM | [Event] | [Person] |
| HH:MM | [Event] | [Person] |
| HH:MM | [Event] | [Person] |
| HH:MM | Resolution | - |

---

## 3. Root Cause Analysis

**Primary Cause:**
[Detailed explanation of what caused the incident]

**Contributing Factors:**
1. [Factor 1]
2. [Factor 2]
3. [Factor 3]

**Why did it happen? (5 Whys)**
- Why 1: [Answer]
- Why 2: [Answer]
- Why 3: [Answer]
- Why 4: [Answer]
- Why 5: [Root cause]

---

## 4. Resolution Summary

**Immediate Fix:**
[What was done to resolve the incident]

**Workarounds Applied:**
- [Workaround 1]
- [Workaround 2]

---

## 5. Lessons Learned

**What went well?**
1. [Positive point 1]
2. [Positive point 2]

**What could be improved?**
1. [Improvement 1]
2. [Improvement 2]

**Action Items**

| Action | Owner | Priority | Due Date |
|--------|-------|----------|----------|
| [Action 1] | [Name] | High | [Date] |
| [Action 2] | [Name] | Medium | [Date] |

---

## 6. Follow-up Questions

- [ ] Have all action items been completed?
- [ ] Have preventative measures been implemented?
- [ ] Have monitoring/alerting been updated?
- [ ] Has this PIR been reviewed with stakeholders?

**Reviewed by:** [Names]
**Date reviewed:** [Date]
```

### 6.2 Action Item Tracking

```markdown
## Action Item Status

| # | Action | Owner | Priority | Status | Completed |
|---|--------|-------|----------|--------|-----------|
| 1 | [Action] | [Name] | High | ✅ Done | [Date] |
| 2 | [Action] | [Name] | Medium | 🔄 WIP | - |
| 3 | [Action] | [Name] | Low | ⏳ Pending | - |
```

---

## 7. Contact Information

### 7.1 Primary Response Team

| Role | Name | Phone | Email | Slack |
|------|------|-------|-------|-------|
| **Tech Lead / IC Primary** | [TBD] | [+62-xxx-xxxx-xxxx] | techlead@ngemiloh.id | @techlead |
| **Backend Developer Primary** | [TBD] | [+62-xxx-xxxx-xxxx] | backend@ngemiloh.id | @backend |
| **Frontend Developer Primary** | [TBD] | [+62-xxx-xxxx-xxxx] | frontend@ngemiloh.id | @frontend |
| **DBA / DevOps Primary** | [TBD] | [+62-xxx-xxxx-xxxx] | devops@ngemiloh.id | @devops |

### 7.2 Backup Response Team

| Role | Name | Phone | Email | Slack |
|------|------|-------|-------|-------|
| **Backend Developer Backup** | [TBD] | [+62-xxx-xxxx-xxxx] | backend2@ngemiloh.id | @backend2 |
| **Frontend Developer Backup** | [TBD] | [+62-xxx-xxxx-xxxx] | frontend2@ngemiloh.id | @frontend2 |
| **DBA / DevOps Backup** | [TBD] | [+62-xxx-xxxx-xxxx] | devops2@ngemiloh.id | @devops2 |

### 7.3 Management & Stakeholders

| Role | Name | Phone | Email | Slack |
|------|------|-------|-------|-------|
| **Owner** | [TBD] | [+62-xxx-xxxx-xxxx] | owner@ngemiloh.id | @owner |
| **Business Manager** | [TBD] | [+62-xxx-xxxx-xxxx] | manager@ngemiloh.id | @manager |

### 7.4 External Support

| Service | Provider | Contact | SLA |
|---------|----------|---------|-----|
| **Cloud Hosting** | [Provider] | [Contact] | 24/7 |
| **Database (Managed)** | [Provider] | [Contact] | 24/7 |
| **Payment Gateway** | [Provider] | [Contact] | 24/7 |
| **Domain Registrar** | [Provider] | [Contact] | Business hours |
| **SSL Certificate** | [Provider] | [Contact] | Business hours |

---

## Appendix A: Emergency Commands

### Database Operations

```bash
# Check database connection
psql -h $DB_HOST -U $DB_USER -d pos_nabil -c "SELECT 1;"

# Check active connections
psql -h $DB_HOST -U $DB_USER -d pos_nabil -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'pos_nabil';"

# Emergency: Terminate all connections (use with caution!)
psql -h $DB_HOST -U $DB_USER -d pos_nabil -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'pos_nabil' AND pid <> pg_backend_pid();"

# Backup database immediately
pg_dump -h $DB_HOST -U $DB_USER -d pos_nabil -F c -b -v -f /backups/emergency_$(date +%Y%m%d_%H%M%S).dump
```

### Redis Operations

```bash
# Check Redis connection
redis-cli -h $REDIS_HOST ping

# Check memory usage
redis-cli -h $REDIS_HOST info memory

# Emergency: Flush all keys (USE WITH EXTREME CAUTION!)
redis-cli -h $REDIS_HOST FLUSHALL ASYNC

# Check blocked clients
redis-cli -h $REDIS_HOST client list | grep -c "cmd=blpop"
```

### Application Operations

```bash
# Check application health
curl http://localhost:3000/health

# Check all queue statuses
curl http://localhost:3000/health/queues

# Restart application (via PM2)
pm2 restart all

# Rollback to previous version
pm2 stop all && git checkout [previous-tag] && npm run build && pm2 start all

# Emergency: Enable maintenance mode
touch /app/maintenance.lock && pm2 restart all
```

---

## Appendix B: Runbook References

| Incident Type | Runbook Location |
|---------------|------------------|
| Database down | [BACKUP.md](./BACKUP.md) |
| Payment gateway failure | [PAYMENT_TESTING.md](./PAYMENT_TESTING.md) |
| Full system outage | [RUNBOOK.md](./RUNBOOK.md) |
| Security incident | Contact Tech Lead immediately |

---

## Appendix C: Monitoring & Alerting

### Key Metrics to Monitor

| Metric | Warning Threshold | Critical Threshold |
|--------|------------------|-------------------|
| API Response Time (p95) | > 500ms | > 2000ms |
| Error Rate | > 1% | > 5% |
| Queue Depth (BullMQ) | > 100 | > 500 |
| Database Connections | > 80% | > 95% |
| Redis Memory | > 70% | > 90% |
| CPU Usage | > 70% | > 90% |
| Disk Usage | > 75% | > 90% |

### Alert Channels

| Severity | Channel | Notification |
|----------|---------|--------------|
| P1 | #incident-response + SMS | Immediate |
| P2 | #incident-response | Immediate |
| P3 | #monitoring | Next business hour |
| P4 | #monitoring | Daily digest |

---

*Document Version: 1.0*  
*Last Updated: 2026-06-26*  
*Next Review: 2026-09-26*
