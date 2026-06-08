# ── Stage 1: Build ────────────────────────────────────────────
FROM mirror.gcr.io/library/node:20-alpine AS builder

# PENTING: Hardcode NODE_ENV=development di sini.
# Coolify menyuntikkan ARG NODE_ENV=production secara otomatis.
# Kita HARUS override dengan ENV setelah ARG agar devDependencies tetap terinstall.
ARG NODE_ENV=development
ENV NODE_ENV=development
ENV NODE_OPTIONS="--max-old-space-size=512"

WORKDIR /app

# Copy dependency manifest terlebih dahulu (untuk cache layer)
COPY package.json package-lock.json* ./

# KRITIS: Selalu gunakan --include=dev secara eksplisit
# agar tidak terpengaruh oleh NODE_ENV apapun yang disuntikkan Coolify
RUN npm install --include=dev

# Copy source code & Prisma schema
COPY prisma ./prisma
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

# Generate Prisma Client & Build NestJS
RUN npx prisma generate
RUN npm run build

# ── Stage 2: Production ──────────────────────────────────────
FROM mirror.gcr.io/library/node:20-alpine AS production

ENV NODE_ENV=production
WORKDIR /app

# Install production dependencies
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# Copy Prisma schema + generated client dari builder
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Copy built application
COPY --from=builder /app/dist ./dist

# Copy tsconfig.json — dibutuhkan oleh ts-node untuk menjalankan prisma seed
COPY --from=builder /app/tsconfig.json ./tsconfig.json

# Install tools yang dibutuhkan saat runtime untuk migration & seed
RUN npm install -g prisma ts-node typescript tsconfig-paths

# Buat direktori penyimpanan
RUN mkdir -p /var/storage/ngemiloh
EXPOSE 3000

# Copy dan set executable startup script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Gunakan entrypoint script yang tahan banting
# Seed boleh gagal, tapi server TETAP jalan (tidak restart loop)
CMD ["/app/docker-entrypoint.sh"]
