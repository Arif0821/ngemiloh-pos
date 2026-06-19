# PostgreSQL with upgraded OpenSSL for CVE fixes
# Based on postgres:17-alpine with Alpine edge/main for OpenSSL 3.5.7
FROM mirror.gcr.io/library/postgres:17-alpine

# Security: Update openssl to fix CVE-2026-34182 and related CVEs
# Using Alpine edge/main for latest patched openssl (3.5.7-r0)
RUN apk add --no-cache -X https://dl-cdn.alpinelinux.org/alpine/edge/main openssl
