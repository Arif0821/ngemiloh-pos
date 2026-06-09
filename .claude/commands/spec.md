# Spec-Driven Development Command
# Use: /spec <feature/requirement>

## Purpose
Define requirements and acceptance criteria before writing code.

## Usage
```
/spec Create payment webhook spec
/spec Document offline sync behavior
/spec Define order validation rules
```

## Spec Template
```markdown
## Feature: [Name]

### User Story
As a [role], I want [goal] so that [benefit].

### Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2

### Edge Cases
- [ ] What happens if [condition]?

### API Contract
```
POST /api/endpoint
Request: { ... }
Response: { ... }
Error: { code, message }
```

### Dependencies
- Feature A must be done first
```
