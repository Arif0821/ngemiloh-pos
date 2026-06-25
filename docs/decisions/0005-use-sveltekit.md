# ADR-0005: Use SvelteKit for Frontend

## Status
Accepted

## Date
2024-01-10

## Last Updated
2026-06-25

## Context
We needed a frontend framework that:
- Has excellent performance (POS load < 2 seconds)
- Provides SSR and routing
- Works well with TypeScript
- Has small bundle size
- Has reactive state management with Svelte 5 Runes

## Decision
Use SvelteKit 2 with Svelte 5 Runes.

## Implementation Details

### Core Stack
- **Framework:** SvelteKit 2.x
- **Language:** Svelte 5 with Runes ($state, $derived, $effect)
- **Build:** Vite
- **Adapter:** @sveltejs/adapter-node (containerized deployment)
- **Local DB:** Dexie.js 4.x (IndexedDB wrapper)
- **Styling:** Tailwind CSS 4

### Svelte 5 Runes Usage

```typescript
// Reactive state with $state
let cart = $state<CartItem[]>([]);
let currentShift = $state<Shift | null>(null);

// Derived values with $derived
let cartTotal = $derived(
  cart.reduce((sum, item) => sum + item.price * item.qty, 0)
);

// Effects with $effect
$effect(() => {
  if (currentShift) {
    syncOrders();
  }
});
```

### File-Based Routing

```
src/routes/
├── (pos)/           # POS authenticated routes
│   ├── +layout.svelte       # POS layout with shift check
│   ├── +page.svelte         # Main POS screen
│   ├── products/            # Product management
│   └── receipt/[id]/       # Receipt view
├── (admin)/          # Admin dashboard routes
│   ├── +layout.server.ts    # Admin auth guard
│   ├── dashboard/          # KPI dashboard
│   ├── orders/             # Order history
│   ├── products/           # Product CRUD
│   ├── inventory/          # Stock management
│   ├── members/            # Member management
│   ├── finance/            # Shift, profit share
│   └── settings/           # System settings
├── (auth)/           # Public auth routes
│   ├── login/             # PIN / password login
│   └── logout/
└── api/               # Server-side API routes (optional)
```

### Layout Server Load

Auth checks done in `+layout.server.ts` — prevents unauthorized access server-side:

```typescript
// (pos)/+layout.server.ts
export const load = async ({ locals }) => {
  const user = locals.user;
  if (!user) throw redirect(303, '/login');
  return { user };
};
```

### Offline Stores

Stores use Dexie.js for persistence and Svelte 5 Runes for reactivity:

```typescript
// pos.store.svelte.ts
import { db } from '$lib/db';

class PosStore {
  cart = $state<CartItem[]>([]);
  orders = $state<Order[]>([]);

  async loadOrders() {
    this.orders = await db.orders.toArray();
  }

  async syncPending() {
    const pending = await db.orders.where('sync_status').equals('pending').toArray();
    // ... sync to server
  }
}
```

## Alternatives Considered

### Next.js (React)
- Pros: Large ecosystem, good docs, SSR/SSG
- Cons: Larger bundle, React complexity, hydration issues
- Decision: Rejected — bundle size too large for POS performance target

### Nuxt (Vue)
- Pros: Good DX, Vue composition API
- Cons: Vue learning curve, smaller ecosystem, Vue 3 runes vs Svelte 5 comparison
- Decision: Rejected — Svelte 5 Runes more elegant

### SvelteKit
- Pros: Smallest bundle, best performance, great DX, Svelte 5 Runes
- Cons: Smaller community, newer project
- Decision: **Selected** — performance is critical for POS

## Consequences

- Svelte 5 Runes provide fine-grained reactivity with minimal overhead
- Small bundle size meets < 2 second load target for POS
- Server-side routing guards simplify auth checks
- Dexie.js provides offline data persistence
- File-based routing is intuitive and scales well
- adapter-node enables containerized deployment with Caddy reverse proxy
