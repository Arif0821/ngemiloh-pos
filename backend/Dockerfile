# ============================================================
# Stage 1: Builder - Compile TypeScript
# Using node:22-alpine (LTS) - fewer CVEs than node:20
# ============================================================
FROM --platform=linux/amd64 node:22-alpine AS builder

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
# Stage 2: Production Runtime - Alpine Linux (Minimal + Shell)
# ============================================================
FROM --platform=linux/amd64 node:22-alpine AS production

# Metadata
LABEL maintainer="Ngemiloh POS"
LABEL description="Ngemiloh POS - NestJS Backend API"

# Security: Install only what's needed
# Note: curl has unfixed CVEs, but we need it for health checks
# Consider using distroless image in future for zero CVEs
RUN apk add --no-cache \
    openssl \
    && rm -rf /var/cache/apk/*

# Health check using node built-in (no curl needed)
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
# Note: We intentionally use npm here even though it has CVEs in its bundled deps,
# because we remove npm after installation - it's only used at build time
RUN npm ci --omit=dev --ignore-scripts --legacy-peer-deps && \
    echo "=== Production dependencies installed ===" && \
    # Remove npm CLI and its bundled dependencies to eliminate base image CVE exposure
    # npm is not needed at runtime - we only use 'node' to run the application
    rm -rf /usr/local/lib/node_modules/npm && \
    echo "=== npm CLI removed ==="

# Copy Prisma schema + generated client from builder
COPY --from=builder --chown=appuser:appgroup /app/prisma ./prisma
COPY --from=builder --chown=appuser:appgroup /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=appuser:appgroup /app/node_modules/@prisma ./node_modules/@prisma

# Copy built application
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist

# Copy tsconfig.json - needed by ts-node for migrations
COPY --from=builder --chown=appuser:appgroup /app/tsconfig.json ./tsconfig.json

# Install Prisma CLI for migrations (needed at runtime for seeding)
COPY --from=builder --chown=appuser:appgroup /app/node_modules/.bin ./node_modules/.bin
COPY --from=builder --chown=appuser:appgroup /app/node_modules/prisma ./node_modules/prisma

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
