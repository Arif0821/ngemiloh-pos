# PRD MASTER INDEX v8.1 - NGEMILOH POS
**Master Index to Modular PRD Documentation**

| Metadata | Value |
|----------|-------|
| Version | 8.1 |
| Date | 2026-06-25 |
| Status | ACTIVE |
| Document Type | Master Index |

---

> ⚠️ **IMPORTANT: This is the NEW modular PRD structure.**
> The original monolithic document has been split into focused modules.
> **Please update your bookmarks and references.**

---

## 📚 Documentation Structure

```
PRD v2/
├── PRD_MASTER_INDEX.md      ← YOU ARE HERE
├── PRD_SPEC.md              ← Feature specifications
├── PRD_STATUS.md            ← Issue tracker & progress
├── PRD_API_CONTRACT.md      ← API specifications
├── PRD_RED_TEAM.md          ← Security findings
├── archive/                 ← Archived content from v8.0
│   └── ARCHIVE_INDEX.md
└── docs/
    └── decisions/           ← Architectural Decision Records (5 ADRs)
        ├── 0001-use-nestjs.md
        ├── 0002-use-prisma-orm.md
        ├── 0003-authentication-strategy.md
        ├── 0004-offline-first-architecture.md
        └── 0005-use-sveltekit.md
    └── guides/
        ├── RUNBOOK.md           ← Operations guide
        └── BACKUP.md           ← Backup & restore guide
```

---

## 🎯 Quick Navigation

### For Product/Design Team

| Need | Go To | Section |
|------|-------|---------|
| Feature requirements | [PRD_SPEC.md](./PRD_SPEC.md) | Section 4 |
| Business rules | [PRD_SPEC.md](./PRD_SPEC.md) | Section 2-3 |
| User stories | [PRD_SPEC.md](./PRD_SPEC.md) | Section 4 |
| Success metrics | [PRD_SPEC.md](./PRD_SPEC.md) | Section 1.4 |

### For Frontend Team

| Need | Go To | Section |
|------|-------|---------|
| API integration | [PRD_API_CONTRACT.md](./PRD_API_CONTRACT.md) | All |
| Page structure | [PRD_SPEC.md](./PRD_SPEC.md) | Not included |
| Component specs | Code only | - |

### For Backend Team

| Need | Go To | Section |
|------|-------|---------|
| API endpoints | [PRD_API_CONTRACT.md](./PRD_API_CONTRACT.md) | All |
| Database schema | `backend/prisma/schema.prisma` | - |
| Business logic | [PRD_SPEC.md](./PRD_SPEC.md) | Section 2-3 |

### For QA Team

| Need | Go To | Section |
|------|-------|---------|
| Test status | [PRD_STATUS.md](./PRD_STATUS.md) | All |
| Go-live checklist | [PRD_STATUS.md](./PRD_STATUS.md) | Section 6 |
| Known issues | [PRD_STATUS.md](./PRD_STATUS.md) | Section 2 |

### For DevOps Team

| Need | Go To | Section |
|------|-------|---------|
| Deployment | [docs/guides/RUNBOOK.md](../docs/guides/RUNBOOK.md) | - |
| Backup | [docs/guides/BACKUP.md](../docs/guides/BACKUP.md) | - |
| Security fixes | [PRD_STATUS.md](./PRD_STATUS.md) | Section 2 |

### For Security/Audit

| Need | Go To | Section |
|------|-------|---------|
| Security issues | [PRD_STATUS.md](./PRD_STATUS.md) | Section 2 |
| Authentication | [PRD_API_CONTRACT.md](./PRD_API_CONTRACT.md) | Section 3 |
| Rate limits | [PRD_API_CONTRACT.md](./PRD_API_CONTRACT.md) | Section 15 |

---

## 📊 Status Summary

### Implementation Progress

| Metric | Value |
|--------|-------|
| Overall Issues | 20 |
| Implemented | 19 (95%) |
| In Progress | 0 |
| Pending | 1 (#8 BOM Cost - Owner) |

### Issues by Severity

| Severity | Total | Done | Pending |
|----------|-------|------|---------|
| **CRITICAL** | 5 | 4 | 1 |
| **HIGH** | 8 | 8 | 0 |
| **MEDIUM** | 5 | 5 | 0 |
| **LOW** | 2 | 2 | 0 |

**For detailed status:** See [PRD_STATUS.md](./PRD_STATUS.md)

---

## 🔗 Cross-Document References

### PRD_SPEC.md Links

| Section | Description | External Links |
|---------|-------------|----------------|
| 1. Executive Summary | Project overview | - |
| 2. Business Model | Franchise structure, roles, profit share | - |
| 3. Loyalty Program | Tier structure, points calculation | - |
| 4. Feature Requirements | Core features by category | - |
| 5. Data Model | ERD, entities, enums | - |
| 6. Non-Functional | Performance, security, scalability | - |
| 7. Constraints | Technical & business constraints | - |
| 8. Out of Scope | Explicitly excluded features | - |
| 9. Glossary | Term definitions | - |
| 10. References | Links to other docs | |

### PRD_STATUS.md Links

| Section | Description |
|---------|-------------|
| 1. Quick Summary | Progress overview |
| 2. Issue Tracker | All 20 issues with status |
| 3. Implemented Issues | Details of 5 done |
| 4. Pending by Phase | Phase 1-3 breakdown |
| 5. Feature Flags | Flag registry |
| 6. Go-Live Checklist | Pre/launch/post checklist |
| 7. Rollback Procedures | How to rollback fixes |
| 8. Timeline | 6-week estimate |
| 9. Dependencies | Issue dependencies |

### PRD_API_CONTRACT.md Links

| Section | Description |
|---------|-------------|
| 1. Overview | Design principles, auth |
| 2. Public Endpoints | Member, products |
| 3. Authentication | Login, OTP, refresh |
| 4. Orders | POS operations |
| 5. Members | Loyalty operations |
| 6. Admin Members | Member management |
| 7. Products | Admin CRUD |
| 8. Inventory | BOM, stock, waste |
| 9. Finance | Dashboard, shifts, profit |
| 10. Users | Cashier management |
| 11. Discounts | Promo management |
| 12. System | Health, flags, audit |
| 13. Export | CSV export |
| 14-16 | Errors, rate limits, pagination |

---

## 📅 Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 8.1 | 2026-06-25 | Tim Engineering | Split monolithic PRD into modular docs |
| 8.0 | 2026-06-19 | Tim Engineering | Initial comprehensive PRD |

---

## 🔄 Migration Checklist

If you're updating references from old PRD:

- [ ] Bookmark `PRD_MASTER_INDEX.md` as main entry point
- [ ] Reference `PRD_SPEC.md` for feature requirements
- [ ] Reference `PRD_API_CONTRACT.md` for API details
- [ ] Reference `PRD_STATUS.md` for issue tracking
- [ ] Delete old references to monolithic PRD

---

## ❓ Questions?

| Topic | Contact |
|-------|---------|
| Product/Features | Product Team |
| API Integration | Backend Team |
| Deployment | DevOps Team |
| Testing | QA Team |
| Security | Security Team |

---

## 📋 Appendix: Document Metrics

| Document | Lines | Focus |
|----------|-------|-------|
| `PRD_MASTER_INDEX.md` | ~150 | This file - Navigation |
| `PRD_SPEC.md` | ~400 | What to build |
| `PRD_STATUS.md` | ~300 | Progress tracking |
| `PRD_API_CONTRACT.md` | ~600 | How to integrate |
| **Total Modular** | **~1,450** | Compared to 1,500+ monolithic |

**Benefits:**
- Each doc fits in one review session
- Git-friendly smaller diffs
- Teams can work independently
- Clear ownership per doc

---

*This is the master index for NGEMILOH POS v8.1 modular documentation*
*Last Updated: 2026-06-25*
