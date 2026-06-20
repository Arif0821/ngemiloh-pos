# PostgreSQL with security fixes
# Based on postgres:17-alpine
FROM mirror.gcr.io/library/postgres:17-alpine

# Security: Update openssl to fix CVE-2026-34182 and related CVEs
# OpenSSL upgraded from 3.5.6-r0 to 3.5.7-r0
RUN apk add --no-cache -X https://dl-cdn.alpinelinux.org/alpine/edge/main openssl

# Note: Remaining CVEs (36 in golang/stdlib) are from gosu binary
# gosu uses Go runtime which has CVEs in Go 1.24.6
# Risk: LOW - gosu only runs at container startup, not in production workload
# Fix: Waiting for Go team to release Go 1.24.13+ with CVE patches
