# PostgreSQL with security fixes - Remove vulnerable gosu
# Based on postgres:17-alpine
FROM mirror.gcr.io/library/postgres:17-alpine

# Security: Update openssl to fix CVE-2026-34182 and related CVEs
RUN apk add --no-cache -X https://dl-cdn.alpinelinux.org/alpine/edge/main openssl

# Security: Remove vulnerable gosu (Go 1.24.6 with 36+ CVEs)
# Replace with su-exec (pure shell, no Go dependencies = no CVEs)
# gosu is only used for privilege dropping, su-exec provides same functionality
RUN apk add --no-cache su-exec \
    && rm -f /usr/local/bin/gosu \
    && ln -sf /usr/bin/su-exec /usr/local/bin/gosu
