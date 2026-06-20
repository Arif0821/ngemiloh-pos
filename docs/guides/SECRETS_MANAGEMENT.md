# Secrets Management

This document describes how secrets are managed in the POS Nabil deployment.

## Overview

POS Nabil uses Docker Secrets for secure secret management in production. All secrets are stored as files in the `secrets/` directory and mounted into containers at runtime.

## Required Secrets (8 Total)

All secrets are defined in `docker-compose.yml` under the `secrets:` section and mounted to containers via the Docker secrets mechanism.

| Secret | File | Purpose | Used By |
|--------|------|---------|---------|
| `db_password` | `secrets/db_password.txt` | PostgreSQL admin password | postgres, nestjs-api |
| `redis_password` | `secrets/redis_password.txt` | Redis authentication | redis, nestjs-api |
| `jwt_access_secret` | `secrets/jwt_access_secret.txt` | JWT access token signing (min 32 chars) | nestjs-api |
| `pin_pepper_secret` | `secrets/pin_pepper_secret.txt` | Pepper for PIN hashing | nestjs-api |
| `csrf_secret` | `secrets/csrf_secret.txt` | CSRF token generation | nestjs-api |
| `midtrans_server_key_sandbox` | `secrets/midtrans_server_key_sandbox.txt` | Midtrans sandbox payments | nestjs-api |
| `midtrans_server_key_production` | `secrets/midtrans_server_key_production.txt` | Midtrans production payments | nestjs-api |
| `email_app_password` | `secrets/email_app_password.txt` | SMTP/app password for email service | nestjs-api |

## Secret File Locations

```
c:\POS_Nabil\
└── secrets/
    ├── db_password.txt
    ├── redis_password.txt
    ├── jwt_access_secret.txt
    ├── pin_pepper_secret.txt
    ├── csrf_secret.txt
    ├── midtrans_server_key_sandbox.txt
    ├── midtrans_server_key_production.txt
    └── email_app_password.txt
```

## How Secrets Work

### Docker Secrets Architecture

1. **Definition**: Secrets are declared in `docker-compose.yml` under the `secrets:` section (lines 23-39)
2. **File-based**: Each secret points to a file in `./secrets/` directory
3. **Mounting**: Docker mounts secrets at `/run/secrets/<secret_name>` inside containers
4. **Access**: Services read secrets from mounted files at runtime

### Container Usage

| Service | Secrets Accessed | Purpose |
|---------|-----------------|---------|
| `postgres` | `db_password` | POSTGRES_PASSWORD_FILE |
| `redis` | `redis_password` | Redis requirepass |
| `nestjs-api` | All 8 secrets | Various environment variables and service configuration |

### NestJS API Secret Loading

The `nestjs-api` service uses `*_FILE` environment variables that point to Docker secret mounts:

```
JWT_ACCESS_SECRET_FILE=/run/secrets/jwt_access_secret
PIN_PEPPER_SECRET_FILE=/run/secrets/pin_pepper_secret
CSRF_SECRET_FILE=/run/secrets/csrf_secret
MIDTRANS_SERVER_KEY_SANDBOX_FILE=/run/secrets/midtrans_server_key_sandbox
MIDTRANS_SERVER_KEY_PRODUCTION_FILE=/run/secrets/midtrans_server_key_production
EMAIL_APP_PASSWORD_FILE=/run/secrets/email_app_password
```

The application reads these files at startup to load sensitive configuration.

## Initial Setup

### 1. Create Secrets Directory

```bash
mkdir -p secrets
cd secrets
```

### 2. Generate All Secrets

```bash
# Generate each secret (32+ bytes for cryptographic keys)
openssl rand -base64 32 > db_password.txt
openssl rand -base64 32 > redis_password.txt
openssl rand -base64 32 > jwt_access_secret.txt
openssl rand -base64 32 > pin_pepper_secret.txt
openssl rand -base64 32 > csrf_secret.txt
openssl rand -base64 32 > midtrans_server_key_sandbox.txt
openssl rand -base64 32 > midtrans_server_key_production.txt
openssl rand -base64 32 > email_app_password.txt
```

### 3. Set Permissions (Linux/macOS)

```bash
chmod 400 secrets/*.txt
```

On Windows, ensure the files are not publicly shared and have restricted access.

### 4. Add Midtrans Keys

Midtrans keys must be actual keys from your Midtrans dashboard:

```bash
# Sandbox key from https://dashboard.sandbox.midtrans.com
echo "your-sandbox-server-key" > secrets/midtrans_server_key_sandbox.txt

# Production key from https://dashboard.midtrans.com
echo "your-production-server-key" > secrets/midtrans_server_key_production.txt
```

### 5. Add Email App Password

For Gmail, generate an App Password at https://myaccount.google.com/apppasswords:

```bash
echo "your-gmail-app-password" > secrets/email_app_password.txt
```

## Verification Checklist

Run this checklist after initial setup or after any secret rotation:

- [ ] All 8 secrets files exist in `secrets/` directory
- [ ] Secret files are not empty
- [ ] Permissions are restricted (400 on Linux/macOS)
- [ ] `docker-compose.yml` references all secrets
- [ ] `docker compose config` passes without errors
- [ ] All containers start successfully
- [ ] PostgreSQL accepts connections
- [ ] Redis authenticates correctly
- [ ] JWT tokens can be generated and verified
- [ ] PIN login works
- [ ] CSRF protection functions
- [ ] Midtrans sandbox payments work
- [ ] Email sending works

## Secret Rotation Procedure

### When to Rotate

- Suspected compromise
- After team member leaves
- As part of regular security maintenance (quarterly)
- Before major infrastructure changes

### Rotation Steps

1. **Generate new secret**

   ```bash
   openssl rand -base64 32 > secrets/<secret_name>.txt.new
   ```

2. **Verify new secret is valid** (test format/length if applicable)

   ```bash
   # Check length for cryptographic keys
   wc -c secrets/<secret_name>.txt.new
   # Should be > 40 bytes (32 bytes base64 encoded)
   ```

3. **Atomic swap**

   ```bash
   mv secrets/<secret_name>.txt.new secrets/<secret_name>.txt
   ```

4. **Restart affected containers**

   ```bash
   # For most secrets, restart the API
   docker compose restart nestjs-api

   # For database password, restart everything
   docker compose restart

   # For Redis password, restart Redis first, then API
   docker compose restart redis
   docker compose restart nestjs-api
   ```

5. **Verify application works**

   - Check container logs: `docker compose logs -f nestjs-api`
   - Test authentication flows
   - Verify database connections

6. **Document the rotation**

   - Note the date in operations log
   - Update this document if procedures change

## Security Best Practices

### DO

- Use cryptographically random secrets (minimum 32 bytes / 256 bits)
- Store secrets outside of version control
- Restrict file permissions (chmod 400)
- Rotate secrets regularly
- Use unique secrets per environment (dev/staging/production)
- Verify secrets after rotation
- Use separate secrets for each service when possible

### DON'T

- Commit secrets to git
- Use default or example values in production
- Share secrets via unencrypted channels
- Hardcode secrets in source code
- Use short or weak secrets
- Reuse secrets across environments
- Log secret values

## Environment-Specific Secrets

### Development

For local development, you may use simpler secrets but still follow the file structure:

```bash
# .env file (not committed)
JWT_ACCESS_SECRET=dev-only-secret-not-for-production
```

### Production

Production secrets MUST:

- Be cryptographically random
- Be at least 32 bytes
- Be stored only in the `secrets/` directory
- Have restricted permissions
- Be rotated regularly

## Troubleshooting

### Container can't read secret

```bash
# Check secret file exists
ls -la secrets/

# Check file permissions
ls -l secrets/*.txt

# Verify secret is defined in docker-compose
grep -A 10 "^secrets:" docker-compose.yml
```

### Authentication failures after rotation

1. Verify secret file content is correct
2. Ensure container was restarted after rotation
3. Check for old cached values in environment
4. Review container logs for specific errors

### Database connection issues

Database password rotation requires:

1. Update `secrets/db_password.txt`
2. Update PostgreSQL password: `ALTER USER ngemiloh WITH PASSWORD 'new_password';`
3. Restart all services: `docker compose restart`

## Related Documentation

- [docker-compose.yml](https://github.com/your-repo/docker-compose.yml) - Secret definitions
- [audit-report-2026-06-18.md](./audit-report-2026-06-18.md) - Security audit findings
- [Technical Debt Register](./Technical_Debt_Register.md) - Technical debt tracking
