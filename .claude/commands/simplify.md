# Code Simplification Command
# Use: /simplify <optional file/function>

## Purpose
Reduce complexity while preserving exact behavior. Make code easier to read, understand, and debug.

## Usage
```
/simplify
/simplify orders.service.ts
/simplify Refactor the batch processing logic
```

## 5 Principles
1. **Preserve Behavior** - Same inputs → Same outputs, same side effects
2. **Follow Conventions** - Match project's style
3. **Efficiency** - No redundant computation
4. **Altitude** - Right abstraction depth
5. **Testing** - Existing tests still pass

## Red Flags
- Deep nesting (>3 levels)
- Repeated code patterns
- Magic numbers without constants
- Over-engineered abstractions
- Dead code / commented-out logic
