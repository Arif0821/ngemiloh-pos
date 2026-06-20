# ============================================================
# Stage 1: Build Frontend (SvelteKit)
# NODE_ENV=production required for static prerendering
# ============================================================
FROM mirror.gcr.io/library/node:20-alpine AS builder

# Build SvelteKit requires NODE_ENV=production for proper prerendering
ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512"

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
# Retry logic untuk handle transient network errors
RUN npm install --include=dev --retry 3 --fetch-retry-mintimeout 20000 --fetch-retry-maxtimeout 120000 || \
    npm install --include=dev --retry 3 --retry-delay 5

COPY frontend/ .
RUN npm run build

# ============================================================
# Stage 2: Caddy Production (Alpine 3.24)
# ============================================================
FROM mirror.gcr.io/library/caddy:2-alpine

# Security: Update openssl to fix CVE-2026-34182 and related CVEs
# Using Alpine edge/main for latest patched openssl (3.5.7-r0)
# Alpine 3.24 base = better package ecosystem
RUN apk upgrade -U --available -X https://dl-cdn.alpinelinux.org/alpine/edge/main && \
    apk add --no-cache openssl

COPY ../Caddyfile /etc/caddy/Caddyfile

# Copy error pages
COPY ../caddy/error_pages /etc/caddy/error_pages

# Copy hasil build frontend ke Caddy
COPY --from=builder /app/build /srv

# Note: Base image (caddy:2-alpine) already includes HEALTHCHECK