# ============================================================
# Stage 1: Build
# ============================================================
FROM node:20-slim AS builder

# HARDCODE: Never let Coolify override this - devDependencies required for build
ENV NODE_ENV=development
ENV NODE_OPTIONS="--max-old-space-size=512"
# FIX KRITIS-02: Skip binary checksum verification
ENV PRISMA_SKIP_POSTINSTALL_GENERATE=1
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1

# Install curl for healthchecks and debugging
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    curl \
    && rm -rf /var/lib/apt/lists/*

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
RUN npx prisma generate && npm run build

# ============================================================
# Stage 2: Production Runtime (Debian for Prisma compatibility)
# ============================================================
FROM node:20-slim AS production

ENV NODE_ENV=production
WORKDIR /app

# Install OpenSSL and other dependencies for Prisma
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies
RUN npm install --omit=dev --legacy-peer-deps && \
    echo "=== Verifying express installed ===" && \
    test -d node_modules/express && echo "express OK" || npm install express --save --legacy-peer-deps

# Copy Prisma schema + generated client dari builder
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy tsconfig.json - dibutuhkan oleh ts-node untuk migration
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Install Prisma CLI dari project dependencies (pakai versi dari package-lock.json, BUKAN versi global terbaru)
# Symlink di .bin -> ../prisma/build/index.js resolve ke /app/node_modules/prisma/
COPY --from=builder /app/node_modules/.bin /app/node_modules/.bin
COPY --from=builder /app/node_modules/prisma /app/node_modules/prisma
COPY --from=builder /app/node_modules/@prisma /app/node_modules/@prisma
# ts-node untuk seed - copy modules yang diperlukan saja
COPY --from=builder /app/node_modules/ts-node /app/node_modules/ts-node
COPY --from=builder /app/node_modules/.prisma /app/node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma /app/node_modules/@prisma

# Buat direktori penyimpanan
RUN mkdir -p /var/storage/ngemiloh

EXPOSE 3000

# Copy dan set executable startup script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Seed boleh gagal, tapi server TETAP jalan (tidak restart loop)
CMD ["/app/docker-entrypoint.sh"]
