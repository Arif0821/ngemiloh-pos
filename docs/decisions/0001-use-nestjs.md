# ADR-0001: Use NestJS as Backend Framework

## Status
Accepted

## Date
2024-01-15

## Last Updated
2026-06-25

## Context
We needed a backend framework that provides:
- TypeScript-first with strong typing
- Dependency injection out of the box
- Modular architecture for scalability
- Built-in support for common patterns (guards, interceptors, pipes)
- Good testing infrastructure

## Decision
Use NestJS 11.x as the backend framework.

## Implementation Details

### Core Stack
- **Runtime:** Node.js 20 LTS
- **Framework:** NestJS 11.x
- **API Style:** REST with typed DTOs and guards
- **Validation:** class-validator + class-transformer
- **Logging:** Pino (via NestJS built-in logger)

### Architecture Pattern
```
src/
├── auth/           # Authentication (JWT, PIN, OTP)
├── orders/        # Order processing, QRIS, void
├── products/      # Product & category management
├── inventory/     # Stock, BOM, FEFO batch tracking
├── finance/       # Shift, profit share, reconciliation
├── members/       # Loyalty, points, tiers
├── payment/       # Midtrans gateway, webhooks
└── flags/        # Feature flags (GrowthBook)
```

### Guards Used
- `JwtAuthGuard` — validates JWT access token
- `RolesGuard` — role-based access (KASIR, SUPERADMIN)
- `AuditLoggerGuard` — logs all admin mutations to audit_log
- `RateLimitGuard` — per-IP + per-user rate limiting

## Alternatives Considered

### Express.js (raw)
- Pros: Lightweight, flexible, widely used
- Cons: Need to set up DI manually, no enforced structure, more boilerplate

### Fastify
- Pros: Very fast, similar to Express
- Cons: Smaller ecosystem, less NestJS integration

### AdonisJS
- Pros: Built-in DI, similar to NestJS concepts
- Cons: Smaller community, less TypeScript-native

## Consequences
- Team needs to learn NestJS concepts (modules, providers, controllers)
- Strong opinionated structure enables consistency
- Good integration with Prisma and other libraries
- Easy to add new features as modules
- Guards provide reusable cross-cutting concerns (auth, audit, rate-limit)