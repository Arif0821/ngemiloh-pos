# Shipping and Launch Command
# Use: /ship <optional description>

## Purpose
Prepare production deployments with confidence. Pre-launch checklist and rollback plan.

## Usage
```
/ship
/ship Deploy to Coolify VPS
/ship Prepare staging deployment
```

## Pre-Launch Checklist
### Code Quality
- [ ] All tests pass
- [ ] Build succeeds
- [ ] Lint and type check pass
- [ ] Code reviewed

### Security
- [ ] No secrets in code
- [ ] Input validation on endpoints
- [ ] Auth/authz in place
- [ ] Security headers configured
- [ ] Rate limiting on auth endpoints

### Infrastructure
- [ ] Environment variables set
- [ ] Database migrations ready
- [ ] DNS/SSL configured
- [ ] Health check endpoint working
- [ ] Rollback plan documented

### Monitoring
- [ ] Error reporting configured
- [ ] Logs flowing
- [ ] Dashboard set up
