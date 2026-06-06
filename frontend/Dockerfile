# ── Stage 1: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder

# PENTING: Set NODE_ENV=development agar npm ci menginstal devDependencies
# (vite, svelte-kit, typescript, dll) yang dibutuhkan saat build
ENV NODE_ENV=development

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .
RUN npm run build

# ── Stage 2: Production (hanya menyimpan hasil build) ────────
FROM node:20-alpine AS production

WORKDIR /app
COPY --from=builder /app/build ./build

# Container ini hanya berfungsi menyediakan file build
# Caddy akan membaca dari volume yang di-share
CMD ["echo", "Frontend build complete"]
