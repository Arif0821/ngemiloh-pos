# ============================================================
# Stage 1: Builder - Compile TypeScript
# Using node:20-alpine (LTS) - standardized across all Dockerfiles and CI
# ============================================================
FROM --platform=linux/amd64 node:20-alpine AS builder

# Set build arguments for better caching
ARG NODE_ENV=development
ENV NODE_ENV=${NODE_ENV}
ENV NPM_CONFIG_LOGLEVEL=warn

WORKDIR /app

# Copy dependency manifest first (for cache layer)
COPY package.json package-lock.json* ./

# Install dependencies including devDependencies for build
RUN npm ci --include=dev --ignore-scripts && \
    echo "=== Dependencies installed ==="

# Copy source code & Prisma schema
COPY prisma ./prisma
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src

# Generate Prisma Client & Build NestJS
RUN npx prisma generate && \
    npm run build && \
    echo "=== Build complete ==="

# ============================================================
# Stage 2: Production Runtime - Alpine Linux (Minimal)
# ============================================================
FROM --platform=linux/amd64 node:20-alpine AS production

# Metadata
LABEL maintainer="Ngemiloh POS"
LABEL description="Ngemiloh POS - NestJS Backend API"

# Security: Minimal image - only openssl for health checks
# No global npm packages - use local dependencies from builder stage
RUN apk add --no-cache \
    openssl \
    && rm -rf /var/cache/apk/*

# Health check using node built-in (no external dependencies needed)
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "const http=require('http');http.get('http://localhost:3000/health',(r)=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

# Create non-root user with known UID/GID for volume mounts
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

# Set environment variables
ENV NODE_ENV=production
ENV STORAGE_PATH=/var/storage/ngemiloh
ENV TZ=Asia/Jakarta
ENV NPM_CONFIG_LOGLEVEL=warn

# Copy package files for production dependencies
COPY --from=builder --chown=appuser:appgroup /app/package.json /app/package-lock.json* ./

# Install ONLY production dependencies (omit devDependencies)
# Note: We keep npm for migrations
RUN npm ci --omit=dev --ignore-scripts --legacy-peer-deps && \
    echo "=== Production dependencies installed ==="

# Copy Prisma schema from builder
COPY --from=builder --chown=appuser:appgroup /app/prisma ./prisma
COPY --from=builder --chown=appuser:appgroup /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=appuser:appgroup /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=appuser:appgroup /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=appuser:appgroup /app/node_modules/.bin ./node_modules/.bin

# Generate Prisma client for this platform (Alpine/musl)
# This must run in production stage to get correct platform binaries
RUN npx prisma generate && \
    echo "=== Prisma client generated ==="

# Copy built application
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist

# Copy ts-node and typescript from builder for seeding
COPY --from=builder --chown=appuser:appgroup /app/node_modules/ts-node ./node_modules/ts-node
COPY --from=builder --chown=appuser:appgroup /app/node_modules/ts-node/dist ./node_modules/ts-node/dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules/.bin/ts-node ./node_modules/.bin/ts-node
COPY --from=builder --chown=appuser:appgroup /app/node_modules/typescript ./node_modules/typescript
COPY --from=builder --chown=appuser:appgroup /app/node_modules/.bin/tsc ./node_modules/.bin/tsc
COPY --from=builder --chown=appuser:appgroup /app/node_modules/tsconfig-paths ./node_modules/tsconfig-paths

# Copy tsconfig for seed
COPY --from=builder --chown=appuser:appgroup /app/tsconfig.json ./tsconfig.json

# Copy startup script
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Create storage directory with proper permissions
RUN mkdir -p /var/storage/ngemiloh && \
    chown -R appuser:appgroup /app /var/storage/ngemiloh

# Expose port
EXPOSE 3000

# Switch to non-root user
USER appuser

# Default command - run entrypoint script
CMD ["/app/docker-entrypoint.sh"]
