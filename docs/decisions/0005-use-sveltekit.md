# ADR-0005: Use SvelteKit for Frontend

## Status
Accepted

## Date
2024-01-10

## Context
We needed a frontend framework that:
- Has excellent performance
- Provides SSR and routing
- Works well with TypeScript
- Has small bundle size
- Has reactive state management

## Decision
Use SvelteKit 2 with Svelte 5 (Runes).

## Alternatives Considered

### Next.js (React)
- Pros: Large ecosystem, good docs, SSR/SSG
- Cons: Larger bundle, React complexity, hydration issues

### Nuxt (Vue)
- Pros: Good DX, Vue composition API
- Cons: Vue learning curve, smaller ecosystem

### SvelteKit
- Pros: Smallest bundle, best performance, great DX
- Cons: Smaller community, newer project

## Consequences
- Svelte 5 Runes provide excellent reactivity
- Server-side rendering improves initial load
- File-based routing is intuitive
- Adapter-node for containerized deployment