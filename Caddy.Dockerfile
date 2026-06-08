# ── Ngemiloh POS - Caddy Reverse Proxy ────────────────────────
# Menggunakan mirror.gcr.io agar konsisten dengan service lain
# dan menghindari TLS timeout ke registry-1.docker.io

FROM mirror.gcr.io/library/caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
