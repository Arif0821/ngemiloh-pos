# ── Stage 1: Build ────────────────────────────────────────────
FROM node:20-alpine AS builder

# Install build tools untuk native modules (bcrypt, sharp)
RUN apk add --no-cache python3 make g++ vips-dev

# PENTING: Pastikan devDependencies terinstal untuk build
ENV NODE_ENV=development

WORKDIR /app

# Copy dependency files first (for Docker cache efficiency)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source code & Prisma schema
COPY prisma ./prisma
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

# Generate Prisma Client
RUN npx prisma generate

# Build NestJS (tampilkan error lengkap jika gagal)
RUN npm run build

# ── Stage 2: Production ──────────────────────────────────────
FROM node:20-alpine AS production

# Install runtime dependencies untuk native modules
RUN apk add --no-cache vips

ENV NODE_ENV=production
WORKDIR /app

# Install only production dependencies
COPY package.json package-lock.json ./
RUN apk add --no-cache python3 make g++ && \
    npm ci --omit=dev && \
    apk del python3 make g++

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
