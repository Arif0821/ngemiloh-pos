# ── Stage 1: Build ────────────────────────────────────────────
FROM mirror.gcr.io/library/node:20-alpine AS builder

ENV NODE_ENV=development
ENV NODE_OPTIONS="--max-old-space-size=512"

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

RUN npx prisma generate
RUN npm run build

# ── Stage 2: Production ──────────────────────────────────────
FROM mirror.gcr.io/library/node:20-alpine AS production

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/dist ./dist

# Install prisma CLI & ts-node globally for migration & seed
RUN npm install -g prisma ts-node typescript tsconfig-paths

RUN mkdir -p /var/storage/ngemiloh
EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/main.js"]
