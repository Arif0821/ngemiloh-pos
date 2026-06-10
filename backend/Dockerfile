# ============================================================
# Stage 1: Build (Always uses NODE_ENV=development)
# devDependencies MUST be installed regardless of Coolify's build args
# ============================================================
FROM mirror.gcr.io/library/node:20-alpine AS builder

# HARDCODE: Never let Coolify override this - devDependencies required for build
ENV NODE_ENV=development
ENV NODE_OPTIONS="--max-old-space-size=512"

WORKDIR /app

# Copy dependency manifest terlebih dahulu (untuk cache layer)
COPY package.json package-lock.json* ./

# KRITIS: Selalu gunakan --include=dev secara eksplisit
# Ini tetap menginstall devDependencies meskipun NODE_ENV=production
# Retry logic untuk handle transient network errors
RUN npm install --include=dev --retry 3 --fetch-retry-mintimeout 20000 --fetch-retry-maxtimeout 120000 || \
    npm install --include=dev --retry 3 --retry-delay 5

# Copy source code & Prisma schema
COPY prisma ./prisma
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

# Generate Prisma Client & Build NestJS
RUN npx prisma generate && \
    echo "=== Running nest build ===" && \
    npm run build && \
    echo "=== Checking dist output ===" && \
    find /app/dist -name "*.js" | head -20 && \
    echo "=== Checking for main.js locations ===" && \
    (test -f /app/dist/main.js && echo "/app/dist/main.js EXISTS!" || echo "/app/dist/main.js NOT FOUND") && \
    (test -f /app/dist/src/main.js && echo "/app/dist/src/main.js EXISTS!" || echo "/app/dist/src/main.js NOT FOUND")

# ============================================================
# Stage 2: Production Runtime
# ============================================================
FROM mirror.gcr.io/library/node:20-alpine AS production

ENV NODE_ENV=production
WORKDIR /app

# Copy package files for reference (not for install)
COPY package.json package-lock.json* ./

# Copy entire node_modules from builder - this includes ALL dependencies
# including express, nestjs, and all production dependencies
COPY --from=builder /app/node_modules ./node_modules

# Copy Prisma schema + generated client dari builder
COPY --from=builder /app/prisma ./prisma

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy tsconfig.json - dibutuhkan oleh ts-node untuk migration
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Buat direktori penyimpanan
RUN mkdir -p /var/storage/ngemiloh

EXPOSE 3000

# Copy dan set executable startup script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Seed boleh gagal, tapi server TETAP jalan (tidak restart loop)
CMD ["/app/docker-entrypoint.sh"]
