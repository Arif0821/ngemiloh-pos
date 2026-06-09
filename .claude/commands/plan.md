# Planning and Task Breakdown Command
# Use: /plan <feature/requirement>

## Purpose
Decompose requirements into small, verifiable tasks.

## Usage
```
/plan Implement QRIS payment
/plan Add offline sync feature
/plan Setup monitoring dashboard
```

## Process
1. **Understand the goal** - What does success look like?
2. **Identify boundaries** - What's in scope vs out of scope?
3. **Break into slices** - Thin vertical slices first
4. **Define acceptance criteria** - How do we know it's done?
5. **Order by risk** - Highest risk first

## Output Format
```markdown
## Tasks for [Feature]

### Must Have
- [ ] Task 1
- [ ] Task 2

### Should Have
- [ ] Task 3

### Nice to Have
- [ ] Task 4

## Dependencies
- Task 2 depends on Task 1
```
