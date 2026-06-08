# ── Stage 1: Build ────────────────────────────────────────────
FROM mirror.gcr.io/library/node:20-alpine AS builder

# PENTING: Pastikan devDependencies terinstal untuk build
ENV NODE_ENV=development
ENV NODE_OPTIONS="--max-old-space-size=512"

WORKDIR /app

# Copy dependency files first (for Docker cache efficiency)
COPY package.json ./

# Copy source code & Prisma schema
COPY prisma ./prisma
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

# Jalankan install, generate, dan build dalam 1 layer sekaligus untuk menghemat RAM ekstrim
RUN npm ci && npx prisma generate && npm run build

# ── Stage 2: Production ──────────────────────────────────────
FROM mirror.gcr.io/library/node:20-alpine AS production

ENV NODE_ENV=production
WORKDIR /app

# Install only production dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy Prisma schema + generated client from builder
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy built application
COPY --from=builder /app/dist ./dist

# ts-node needed for prisma seed
RUN npm install -g ts-node typescript tsconfig-paths

# Create storage directory
RUN mkdir -p /var/storage/ngemiloh

# Expose port
EXPOSE 3000

# Run migrations, seed, then start
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/main.js"]
