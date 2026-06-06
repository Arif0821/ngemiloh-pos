# ── Stage 1: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Production (serve static files via Caddy) ───────
# Frontend build output will be mounted by docker-compose
# This stage just produces the /app/build folder
FROM node:20-alpine AS production

WORKDIR /app
COPY --from=builder /app/build ./build
