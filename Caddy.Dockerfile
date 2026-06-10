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
# Stage 2: Caddy Production
# ============================================================
FROM mirror.gcr.io/library/caddy:2-alpine

COPY Caddyfile /etc/caddy/Caddyfile

# Copy hasil build frontend ke Caddy
COPY --from=builder /app/build /srv