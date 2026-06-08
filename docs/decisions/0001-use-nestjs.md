# ADR-0001: Use NestJS as Backend Framework

## Status
Accepted

## Date
2024-01-15

## Context
We needed a backend framework that provides:
- TypeScript-first with strong typing
- Dependency injection out of the box
- Modular architecture for scalability
- Built-in support for common patterns (guards, interceptors, pipes)
- Good testing infrastructure

## Decision
Use NestJS as the backend framework.

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