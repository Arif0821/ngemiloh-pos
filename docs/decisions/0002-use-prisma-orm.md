# ADR-0002: Use Prisma ORM

## Status
Accepted

## Date
2024-01-15

## Context
We needed an ORM that:
- Works well with TypeScript
- Provides type safety for database operations
- Has good migration support
- Supports PostgreSQL
- Has good DX (developer experience)

## Decision
Use Prisma ORM with PostgreSQL.

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
- Easy migrations with Prisma Migrate
- Prisma Studio for database visualization
- Good performance for our use case
- Generated client provides full autocomplete