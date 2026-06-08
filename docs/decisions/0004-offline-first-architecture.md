# ADR-0004: Offline-First POS Architecture

## Status
Accepted

## Date
2024-02-01

## Context
The POS system needs to handle:
- Intermittent network connectivity in stores
- Continuous operation during outages
- Sync when connection restored
- No data loss during offline periods

## Decision
Implement offline-first architecture with IndexedDB and sync queue.

### Architecture
```
┌─────────────────┐     ┌─────────────────┐
│   SvelteKit     │────▶│   IndexedDB     │
│   Frontend      │     │   (Dexie.js)   │
└────────┬────────┘     └─────────────────┘
         │                       │
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────┐
│           Sync Queue                      │
│   - Pending orders                      │
│   - Products cache                      │
│   - Cart persistence                    │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│   NestJS API    │
│   (when online) │
└─────────────────┘
```

### Sync Strategy
1. All operations write to IndexedDB first
2. If online, also send to server
3. If offline, queue for later sync
4. On reconnect, batch sync pending operations
5. Conflict resolution: server timestamp wins

### Limitations
- QRIS payments disabled offline
- Real-time features unavailable
- Stock checks use cached data

## Consequences
- Users can continue selling during outages
- Need to handle sync conflicts gracefully
- Local storage limits on mobile devices
- QRIS requires online connectivity