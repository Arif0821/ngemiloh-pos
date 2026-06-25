# PRD Archive - v8.0 Content

This folder contains content that was archived from PRD v8.0 monolithic document.

## Why Archived?

The original PRD v8.0 was a single 1500+ line document containing:
- Specifications
- Implementation details
- API documentation
- Status tracking
- Architecture details

This mix made the document hard to:
- Read and maintain
- Track changes
- Review specific sections
- Separate spec from status

## Archive Contents

| File | Description | Reason Archived |
|------|-------------|----------------|
| `ARCHIVE_INDEX.md` | This file | - |

## What Was Moved

### To `PRD_SPEC.md`
- Executive Summary
- Business Model
- Feature Requirements
- Data Model (simplified)
- Non-Functional Requirements

### To `PRD_STATUS.md`
- Critical Issues Tracker
- Implementation Progress
- Go-Live Checklist
- Rollback Procedures

### To `PRD_API_CONTRACT.md`
- API Endpoints (detailed)
- Request/Response formats
- Error codes
- Rate limits

### To `docs/decisions/`
- Architectural Decision Records (already existed)

## Original Document

The original monolithic PRD is preserved at:
`PRD_NGEMILOH_POS_v8.0_MASTER_INDONESIAN.md`

This can be deleted after all teams update their references.

## Benefits of Modular Docs

| Before (Monolithic) | After (Modular) |
|---------------------|-----------------|
| 1500+ lines | 300-400 lines per doc |
| Mixed concerns | Clear separation |
| Hard to track changes | Git-friendly diffs |
| One person reviews all | Teams can focus |
| Single point of failure | Independent updates |

## Migration Guide

For teams transitioning from monolithic PRD:

1. **Product/Design** → Reference `PRD_SPEC.md`
2. **Frontend** → Reference `PRD_API_CONTRACT.md`
3. **QA** → Reference `PRD_STATUS.md`
4. **DevOps** → Reference `PRD_STATUS.md` + `docs/guides/`
5. **Security** → Reference `PRD_RED_TEAM.md`

## Questions?

Contact: Tim Engineering
Date: 2026-06-25
