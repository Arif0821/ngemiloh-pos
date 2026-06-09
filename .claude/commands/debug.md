# Debugging and Error Recovery Command
# Use: /debug <description of the bug/error>

## Purpose
Systematic root-cause debugging when tests fail, builds break, or behavior doesn't match expectations.

## Usage
```
/debug The webhook tests are failing with signature validation errors
/debug CI pipeline fails with PostgreSQL connection error
/debug Order creation returns wrong total amount
```

## Process (6 Steps)
1. Reproduce the failure
2. Localize (find which layer: UI/API/DB/Build/Test)
3. Reduce to minimal failing case
4. Fix the root cause (not symptoms)
5. Guard against recurrence (add test)
6. Verify end-to-end

## Quick Reference
```bash
# Run specific failing test
npm test -- --grep "test name"

# Run with verbose output
npm test -- --verbose

# Run in isolation
npm test -- --testPathPattern="file-name" --runInBand
```
