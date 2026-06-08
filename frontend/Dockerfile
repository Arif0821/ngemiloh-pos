# ── Stage 1: Build ────────────────────────────────────────────
FROM mirror.gcr.io/library/node:20-alpine AS builder

ENV NODE_ENV=development
ENV NODE_OPTIONS="--max-old-space-size=512"

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY . .
RUN npm run build

# ── Stage 2: Production ──────────────────────────────────────
FROM mirror.gcr.io/library/node:20-alpine AS production

ENV NODE_ENV=production

WORKDIR /app
COPY --from=builder /app/build ./build

# Container ini berfungsi menyediakan file build ke shared volume
CMD ["sh", "-c", "mkdir -p /app/shared_build && cp -a /app/build/. /app/shared_build/ && echo 'Frontend build copied to shared volume'"]
