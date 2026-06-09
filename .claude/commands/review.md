# Code Review and Quality Command
# Use: /review <optional description>

## Purpose
Multi-axis review before merging any change. Reviews code across 5 dimensions.

## Usage
```
/review
/review Review the orders service implementation
/review Check auth middleware for security issues
```

## 5 Axes Review
1. **Correctness** - Does it do what it claims?
2. **Readability** - Can another engineer understand it?
3. **Architecture** - Does it fit the system design?
4. **Security** - Any vulnerabilities?
5. **Performance** - Any bottlenecks?

## Quick Reference
- Tests pass? Test quality good?
- Names descriptive?
- Error paths handled?
- Dependencies correct?
- No accidental complexity?
