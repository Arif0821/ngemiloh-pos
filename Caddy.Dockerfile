# ── Stage 1: Build Frontend ─────────────────────────────────────
FROM mirror.gcr.io/library/node:20-alpine AS builder

# PENTING: Hardcode NODE_ENV=development di sini agar devDependencies tetap terinstall.
ARG NODE_ENV=development
ENV NODE_ENV=development
ENV NODE_OPTIONS="--max-old-space-size=512"

WORKDIR /app
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --include=dev

COPY frontend/ .
RUN npm run build

# ── Stage 2: Caddy ────────────────────────────────────────────
FROM mirror.gcr.io/library/caddy:2-alpine

COPY Caddyfile /etc/caddy/Caddyfile

# Copy hasil build frontend ke Caddy
COPY --from=builder /app/build /srv
