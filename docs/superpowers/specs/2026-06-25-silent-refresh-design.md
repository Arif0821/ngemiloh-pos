# Silent Refresh JWT Implementation Design

**Date:** 2026-06-25
**Status:** Approved
**PRD Reference:** Section 18, Issue #2 - JWT 365 Days for Kasir

## Context

JWT tokens untuk kasir di-reduce dari 365 hari menjadi 8 jam (PRD Section 18). Backend sudah mengimplementasi endpoint `/api/v1/auth/refresh` untuk silent refresh. Frontend perlu mengimplementasi client-side silent refresh agar kasir tidak perlu re-login setiap 8 jam.

## Goals

1. Kasir bisa kerja shift panjang (8 jam) tanpa re-login manual
2. Kompromi keamanan: token di-reduce jadi 8 jam, tapi auto-refresh
3. Graceful degradation: jika refresh gagal, retry sebelum force logout
4. Coverage: semua authenticated pages (POS + Admin)

## Architecture

### Centralized Auth Store

```typescript
// src/lib/stores/auth.store.svelte.ts
export const auth_store = {
  // State
  token_expiry: $state<Date | null>(null),
  
  // Methods
  init_silent_refresh(role: string): void,
  refresh_token(): Promise<void>,
  clear_refresh_timer(): void,
  force_logout(): Promise<void>,
}
```

**Why centralized?**
- Single source of truth untuk auth state
- Reusable di semua authenticated layouts
- Easy to test dan debug
- No duplication di setiap page

## Silent Refresh Flow

```
1. User login → role returned
2. init_silent_refresh(role) dipanggil
   ├── Decode JWT (client-side) untuk dapat exp claim
   ├── Hitung: refresh_time = exp - 60 minutes
   └── Set setTimeout untuk call refresh_token()
3. refresh_token() dipanggil saat timer fire
   ├── POST /api/v1/auth/refresh
   ├── Jika success → cookies updated, reset timer dengan exp baru
   ├── Jika 401 (unauthorized) → Retry setelah 60s, max 3x
   └── Jika 3x gagal → force_logout()
4. Page unmount / logout → clearTimeout (prevent memory leak)
```

### JWT Decode (Client-side)

```typescript
function decode_jwt(token: string): { exp: number } | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload;
  } catch {
    return null;
  }
}
```

**Note:** Decode TANPA verifikasi signature. Verifikasi tetap di backend. Ini aman karena:
- Kita hanya membaca `exp` claim, tidak memproses data sensitif
- Jika token invalid, refresh API akan reject dengan 401

## Error Handling

### Retry Logic

| Attempt | Action | Delay |
|---------|--------|-------|
| 1 fail | Retry | 60s |
| 2 fail | Retry | 60s |
| 3 fail | Force logout | - |

### Edge Cases

| Scenario | Handling |
|----------|----------|
| Token expired saat check | Refresh gagal → retry logic |
| Backend down | Retry 3x, lalu logout |
| User offline | Skip refresh, retry when online |
| Tab background | Timer tetap jalan |
| Multiple tabs | Masing-masing punya timer sendiri |
| Logout sebelum timer | clearTimeout di logout handler |

## File Changes

### NEW: src/lib/stores/auth.store.svelte.ts

Centralized auth store dengan:
- `init_silent_refresh(role)` - inisialisasi timer
- `refresh_token()` - panggil refresh API
- `clear_refresh_timer()` - cleanup on unmount
- `force_logout()` - logout + redirect

### MODIFY: src/routes/+layout.svelte (root)

Import auth_store, init silent refresh on mount.

### MODIFY: src/routes/pos/+page.svelte

Panggil `auth_store.init_silent_refresh('kasir')` setelah login success.

### MODIFY: src/routes/admin/+layout.svelte

Panggil `auth_store.init_silent_refresh('superadmin')` setelah auth verified.

## Implementation Notes

1. **No dependency on localStorage token** - Baca dari httpOnly cookie via `document.cookie`
2. **Browser timer throttling** - setTimeout tidak di-throttle seperti requestAnimationFrame
3. **Memory leak prevention** - Selalu clearTimeout di cleanup
4. **Multiple tabs** - Masing-masing tab punya timer sendiri, tidak ada cross-tab sync (YAGNI)

## Security Considerations

| Concern | Mitigation |
|---------|------------|
| Token theft via XSS | CSRF token juga di-refresh, httpOnly cookies |
| Refresh token stolen | Rate limited di backend, short-lived |
| Token replay | Blocklist via Redis di backend |
| Tab sniffing | Tidak ada sensitif data di URL atau localStorage |

## Out of Scope

- Web Workers untuk background refresh (overkill)
- Tab visibility change detection (unnecessary complexity)
- Cross-tab session sync (not needed, each tab has own timer)
