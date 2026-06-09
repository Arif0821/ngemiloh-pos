# Security Review Command
# Use: /security <optional focus>

## Purpose
Security-first review. Threat modeling and vulnerability assessment.

## Usage
```
/security
/security Review authentication flow
/security Check webhook handlers for injection
/security Audit payment processing
```

## Process (STRIDE Framework)
| Threat | Ask | Mitigation |
|--------|-----|------------|
| **S**poofing | Can impersonate user? | Authentication, signature verification |
| **T**ampering | Can alter data? | Parameterized queries, HTTPS |
| **R**epudiation | Can deny action? | Audit logging |
| **I**nformation disclosure | Can leak data? | Encryption, field allowlists |
| **D**enial of service | Can overwhelm system? | Rate limiting, timeouts |
| **E**levation of privilege | Can gain unauthorized rights? | Authorization checks |

## Always Check
- Input validation at boundaries
- Parameterized queries (no SQL injection)
- Auth/authz enforcement
- Secrets not in code
- Security headers configured
