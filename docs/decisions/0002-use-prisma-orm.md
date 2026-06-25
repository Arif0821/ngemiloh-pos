# ADR-0002: Use Prisma ORM

## Status
Accepted

## Date
2024-01-15

## Last Updated
2026-06-25

## Context
We needed an ORM that:
- Works well with TypeScript
- Provides type safety for database operations
- Has good migration support
- Supports PostgreSQL
- Has good DX (developer experience)

## Decision
Use Prisma ORM v5.22+ with PostgreSQL 17.

## Implementation Details

### Core Stack
- **ORM:** Prisma v5.22+ (@prisma/client + prisma CLI)
- **Database:** PostgreSQL 17 (Scram-SHA-256 auth)
- **Schema:** Single `schema.prisma` with migrations tracked in `prisma/migrations/`
- **Client:** Generated type-safe client via `prisma generate`

### Schema Design
```
30+ models including:
- Core: User, Shift, Order, OrderItem
- Inventory: Product, Category, RawMaterial, StockMovement, BOM
- Finance: ProfitShareLog, CashReconciliation, Opname
- Members: Member, PointTransaction, TierHistory
- Payment: PaymentTransaction
- System: AuditLog, FeatureFlag, SysFlag
```

### Transaction Patterns
- `prisma.$transaction()` for multi-table writes (e.g., order + stock deduction)
- `SELECT ... FOR UPDATE` (via `$queryRaw`) for idempotent state transitions
- Isolation level `READ COMMITTED` default; `REPEATABLE READ` for financial reports

## Alternatives Considered

### TypeORM
- Pros: More features, supports more databases
- Cons: TypeScript support feels bolted-on, complex API

### Drizzle ORM
- Pros: Lightweight, SQL-like syntax, very fast
- Cons: Smaller community, newer project

### Knex.js + raw SQL
- Pros: Full control, SQL-like
- Cons: No type safety, manual query building

## Consequences
- Excellent type safety with generated types
- Easy migrations with `prisma migrate deploy`
- Prisma Studio for database visualization
- Good performance for our use case
- Generated client provides full autocomplete
- Transaction support for financial data integrity