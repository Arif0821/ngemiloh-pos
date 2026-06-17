# Superpowers Skills — Panduan Lengkap

> **Versi:** 5.1.0
> **Tanggal:** 2026-06-16
> **Sumber:** Claude Code Superpowers Plugin

---

## Daftar Isi

1. [using-superpowers — Skill Utama](#1-superpowersusing-superpowers--skill-utama)
2. [brainstorming — Desain Sebelum Kode](#2-superpowersbrainstorming--desain-sebelum-kode)
3. [writing-plans — Rencana Implementasi](#3-superpowerswriting-plans--rencana-implementasi)
4. [subagent-driven-development — Eksekusi dengan Subagent](#4-superpowerssubagent-driven-development--eksekusi-dengan-subagent)
5. [executing-plans — Eksekusi Batch](#5-superpowersexecuting-plans--eksekusi-batch)
6. [test-driven-development (TDD) — Test Dulu](#6-superpowertest-driven-development-tdd--test-dulu)
7. [systematic-debugging — Debugging Sistematis](#7-superpowerssystematic-debugging--debugging-sistematis)
8. [verification-before-completion — Bukti Sebelum Klaim](#8-superpowersverification-before-completion--bukti-sebelum-klaim)
9. [receiving-code-review — Menanggapi Review](#9-superpowersreceiving-code-review--menanggapi-review)
10. [requesting-code-review — Minta Review](#10-superpowersrequesting-code-review--minta-review)
11. [finishing-a-development-branch — Menyelesaikan Work](#11-superpowersfinishing-a-development-branch--menyelesaikan-work)
12. [using-git-worktrees — Isolasi Workspace](#12-superpowersusing-git-worktrees--isolasi-workspace)
13. [dispatching-parallel-agents — Parallel Investigation](#13-superpowersdispatching-parallel-agents--parallel-investigation)
14. [writing-skills — Membuat Skill Baru](#14-superpowerswriting-skills--membuat-skill-baru)
15. [Alur Kerja Lengkap](#15-alur-kerja-lengkap-superpowers)

---

## 1. `superpowers:using-superpowers` — Skill Utama

**Deskripsi:** Wajib di-load di awal setiap percakapan. Mengelola skill registry dan mendeteksi skill mana yang relevan untuk tugas saat ini.

### Aturan Besi

> **Invoke skill jika ada kemungkinan 1% skill tersebut berlaku.** Jangan menebak, jangan melewati langkah ini.

```
Pesan masuk
    ↓
Cek: "Apakah skill ini berlaku?"
    ↓ (ya)               ↓ (tidak)
Invoke Skill tool    → Respond
    ↓
Announce: "Using [skill] to [purpose]"
    ↓
Follow skill exactly
```

### Tanda-Tanda Rationalization (Harus STOP)

| Pikiran | Kenyataan |
|---------|----------|
| "Ini terlalu sederhana" | Pertanyaan = tugas, cek skill |
| "Saya perlu konteks dulu" | Cek skill Duluan |
| "Saya tahu artinya" | Mengetahui konsep ≠ menggunakan skill |
| "Ini tidak butuh skill formal" | Jika skill ada, gunakan |
| "Saya akan kerjakan dulu" | Cek skill SEBELUM bertindak |
| "Terlalu overkill" | Skill yang ada ada untuk alasan bagus |

### Skill Priority Order

Ketika multiple skills berlaku:

1. **Process skills first** (brainstorming, debugging) — tentukan HOW
2. **Implementation skills second** (frontend-design, dll) — guia execution

Contoh:
- "Let's build X" → brainstorming → writing-plans
- "Fix this bug" → systematic-debugging → verification-before-completion

### Skill Types

| Tipe | Penjelasan | Contoh |
|------|-----------|--------|
| **Rigid** | Follow exactly, don't adapt away discipline | TDD, debugging |
| **Flexible** | Adapt principles to context | patterns |

### User Instructions Priority

1. **User's explicit instructions** (CLAUDE.md, direct requests) — highest priority
2. **Superpowers skills** — override default system behavior where they conflict
3. **Default system prompt** — lowest priority

---

## 2. `superpowers:brainstorming` — Desain Sebelum Kode

**Deskripsi:** Use this before any creative work — creating features, building components, adding functionality, or modifying behavior. Explores user intent, requirements and design before implementation.

**Kapan WAJIB digunakan:**
- Membuat fitur baru
- Membangun komponen UI
- Menambahkan functionality
- Memodifikasi behavior yang ada

### HARD-GATE

> **DILARANG invoke skill implementasi, menulis kode, atau scaffold project sebelum desain PRESENTED dan DISETUJUI user.**

### Proses 9 Langkah

```
1. Eksplorasi konteks proyek
   → check files, docs, recent commits

2. Tawarkan Visual Companion (jika topik visual)
   → pesan TERPISAH dari pertanyaan lain

3. Ajukan pertanyaan klarifikasi
   → SATU PERTANYAAN PER PESAN

4. Propose 2-3 pendekatan
   → dengan trade-offs + rekomendasi

5. Presentasi desain
   → per section, minta persetujuan user

6. Tulis design doc
   → simpan ke docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md

7. Spec self-review
   → cek placeholder, kontradiksi, ambiguity

8. User review spec
   → minta approval sebelum lanjut

9. Invoke writing-plans skill
   → terminal state, HANYA skill ini yang diinvoke setelah brainstorming
```

### Flowchart

```
┌─────────────────────┐
│Explore project context│
└──────────┬──────────┘
           ↓
    ┌──────┴──────┐
    │Visual questions│
    │    ahead?    │
    └──────┬──────┘
      yes ↓   no ↓
  ┌──────────┐  ┌────────────────┐
  │ Offer    │  │Ask clarifying  │
  │ Visual   │→ │questions       │
  │Companion │  └───────┬────────┘
  └──────────┘          ↓
                 Propose 2-3 approaches
                          ↓
                 Present design sections
                          ↓
              ┌───────────┴───────────┐
              │   User approves       │
              │   design?             │
              └───────────┬───────────┘
           no ↓          ↓ yes
         Revise    ┌─────────────┐
      design       │Write design │
      sections     │doc          │
                   └──────┬──────┘
                          ↓
              ┌───────────┴───────────┐
              │   User reviews       │
              │   spec?              │
              └───────────┬───────────┘
        changes ↓         ↓ approved
        requested  ┌──────┴──────┐
        ┌────────→│Invoke        │
        │         │writing-plans │
        └─────────│(TERMINAL)    │
                  └─────────────┘
```

### Prinsip Kunci

| Prinsip | Penjelasan |
|---------|-----------|
| **One question at a time** | Jangan overwhelming dengan banyak pertanyaan |
| **Multiple choice preferred** | Lebih mudah dijawab daripada open-ended |
| **YAGNI ruthlessly** | Hapus fitur yang tidak perlu dari semua desain |
| **Explore alternatives** | Selalu propose 2-3 pendekatan sebelum memutuskan |
| **Incremental validation** | Presentasi desain, minta approval sebelum lanjut |
| **Be flexible** | Kembali klarifikasi jika ada yang tidak masuk akal |
| **Design for isolation** | Pecah sistem jadi unit kecil, tanggung jawab jelas |

### Memahami Ide

- Check project state terlebih dahulu
- Jika request mendeskripsikan multiple independent subsystems, FLAG SEGERA
- Tawarkan dekomposisi sebelum refine details
- Ajukan pertanyaan satu per satu
- Fokus: purpose, constraints, success criteria

### Design Document

- Write ke `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
- Commit ke git setelah approved

### Spec Self-Review

Setelah menulis spec, cek dengan fresh eyes:

1. **Placeholder scan** — ada "TBD", "TODO", incomplete sections?
2. **Internal consistency** — sections saling bertentangan?
3. **Scope check** — focused cukup untuk single plan?
4. **Ambiguity check** — requirement bisa diinterpretasi 2 cara?

Fix inline, no re-review needed.

### Visual Companion

Tool berbasis browser untuk mockup, diagram, visual options.

**Offering:**
> "Some of what we're working on might be easier to explain if I can show it to you in a web browser. I can put together mockups, diagrams, comparisons, and other visuals as we go. This feature is still new and can be token-intensive. Want to try it? (Requires opening a local URL)"

**Rules:**
- Offer HARUS dalam pesan terpisah
- Jangan gabung dengan pertanyaan lain
- Gunakan **browser** untuk: mockups, layouts, diagrams, visual comparisons
- Gunakan **terminal** untuk: requirements questions, conceptual choices, tradeoff lists

### Anti-Pattern

> **"This Is Too Simple To Need A Design"**

Every project goes through this process. A todo list, a single-function utility, a config change — all of them. "Simple" projects are where unexamined assumptions cause the most wasted work.

---

## 3. `superpowers:writing-plans` — Rencana Implementasi

**Deskripsi:** Use when you have a spec or requirements for a multi-step task, before touching code.

**Kapan:** Setelah brainstorming selesai dan desain disetujui.

### Format Wajib Header

```markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

---
```

### File Structure

Sebelum mendefinisikan tasks, petakan files yang akan di-create atau modify:

- Design units dengan clear boundaries
- Prefer smaller, focused files over large ones
- Files that change together should live together
- Follow established patterns in existing codebases

### Bite-Sized Task Granularity

**Setiap step = satu action (2-5 menit):**

```markdown
- [ ] **Step 1: Write the failing test**
- [ ] **Step 2: Run it to make sure it fails**
- [ ] **Step 3: Implement the minimal code**
- [ ] **Step 4: Run the tests and make sure they pass**
- [ ] **Step 5: Commit**
```

### Task Structure

```markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

- [ ] **Step 1: Write the failing test**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

- [ ] **Step 3: Write minimal implementation**

```python
def function(input):
    return expected
```

- [ ] **Step 4: Run test to verify it passes**
Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```

### NO PLACEHOLDERS

Plan failures — **never write these:**
- "TBD", "TODO", "implement later", "fill in details"
- "Add appropriate error handling" / "add validation"
- "Write tests for the above" (without actual test code)
- "Similar to Task N" (repeat the code)
- Steps describing what without showing how

### Self-Review Checklist

1. **Spec coverage** — skim spec, can you point to task implementing each requirement?
2. **Placeholder scan** — search for "TBD", "TODO", dll
3. **Type consistency** — names match across all tasks?

### Execution Handoff

```markdown
Plan complete and saved to `docs/superpowers/plans/<filename>.md`.

Two execution options:

1. Subagent-Driven (recommended) — I dispatch a fresh subagent per task,
   review between tasks, fast iteration

2. Inline Execution — Execute tasks in this session using executing-plans,
   batch execution with checkpoints

Which approach?
```

---

## 4. `superpowers:subagent-driven-development` — Eksekusi dengan Subagent

**Deskripsi:** Use when executing implementation plans with independent tasks in the current session.

**Keunggulan vs Executing Plans:**
- Same session (no context switch)
- Fresh subagent per task (no context pollution)
- Two-stage review: spec compliance → code quality
- Continuous execution (tidak pause antar task)

### When to Use

```
┌─────────────────────────┐
│Have implementation plan?│
└───────────┬─────────────┘
          yes ↓   no ↓
    ┌──────────┴───────┐
    │Tasks mostly     │
    │independent?     │
    └────────┬────────┘
      yes ↓    no ↓
  ┌──────────┴──────┐
  │Stay in this    │  Manual execution
  │session?        │  or brainstorm
  └────┬───────────┘  first
    yes ↓  no ↓
subagent-  executing-
driven    plans
```

### Proses Per Task

```
Dispatch implementer subagent
         ↓
  Ada pertanyaan?
    ↓ yes      ↓ no
Jawab,      Implementer implements,
re-dispatch tests, commits, self-reviews
         ↓
Dispatch spec reviewer subagent
         ↓
  Spec compliant?
    ↓ no          ↓ yes
Implementer   Dispatch code quality
fixes         reviewer subagent
    ↓               ↓
  re-review    Approved?
              ↓ no       ↓ yes
           Implementer Mark task
           fixes        complete
              ↓
           re-review
```

### Continuous Execution

> **Jangan pause untuk check-in dengan user.** Eksekusi semua task tanpa berhenti. Alasan untuk berhenti: BLOCKED status yang tidak bisa diselesaikan, ambiguity yang mencegah progress, atau semua task selesai.

### Model Selection

| Task Type | Model | Contoh |
|-----------|-------|--------|
| Mechanical | Fast, cheap | 1-2 files, clear spec |
| Integration | Standard | Multi-file coordination |
| Architecture/Review | Most capable | Broad understanding needed |

**Task complexity signals:**
- Touches 1-2 files with complete spec → cheap model
- Touches multiple files with integration → standard model
- Requires design judgment or broad codebase understanding → most capable

### Implementer Status Handling

| Status | Arti | Action |
|--------|------|--------|
| `DONE` | Complete | Proceed to spec compliance review |
| `DONE_WITH_CONCERNS` | Complete but flagged doubts | Read concerns, address if correctness/scope issue |
| `NEEDS_CONTEXT` | Missing information | Provide context, re-dispatch |
| `BLOCKED` | Cannot complete | Assess blocker, re-dispatch with changes or escalate |

### Two-Stage Review

**Stage 1: Spec Compliance Review**
- Apakah code match spec?
- Apakah semua requirements terpenuhi?
- Apakah ada extra yang tidak diminta?

**Stage 2: Code Quality Review**
- Correctness, readability, architecture, security, performance
- Applied AFTER spec compliance is approved

### Advantages

- Subagents follow TDD naturally
- Fresh context per task (no confusion)
- Parallel-safe (subagents don't interfere)
- Questions surfaced BEFORE work begins (not after)
- Two-stage review catches different types of issues

### Integration

**Required workflow skills:**
- `superpowers:using-git-worktrees` — ensures isolated workspace
- `superpowers:writing-plans` — creates the plan
- `superpowers:requesting-code-review` — code review template
- `superpowers:finishing-a-development-branch` — complete development after all tasks

**Subagents should use:**
- `superpowers:test-driven-development` — TDD for each task

---

## 5. `superpowers:executing-plans` — Eksekusi Batch

**Deskripsi:** Use when you have a written implementation plan to execute in a separate session with review checkpoints.

**Announce:** "I'm using the executing-plans skill to implement this plan."

### Proses

```
Step 1: Load and Review Plan
  → Read plan file
  → Review critically — identify questions/concerns
  → If concerns: Raise with human partner before starting
  → If no concerns: Create TodoWrite and proceed

Step 2: Execute Tasks
  → For each task:
      Mark as in_progress
      Follow each step exactly
      Run verifications as specified
      Mark as completed

Step 3: Complete Development
  → Invoke finishing-a-development-branch
  → Verify tests → Present options → Execute choice
```

### When to STOP and Ask for Help

- Hit blocker (missing dependency, test fails, instruction unclear)
- Plan has critical gaps preventing starting
- Verification fails repeatedly

### When to Revisit Earlier Steps

- Partner updates the plan based on feedback
- Fundamental approach needs rethinking

### Remember

- Review plan critically first
- Follow plan steps exactly
- Don't skip verifications
- Reference skills when plan says to
- Stop when blocked, don't guess
- Never start on main/master without explicit consent

---

## 6. `superpowers:test-driven-development` (TDD) — Test Dulu

**Deskripsi:** Use when implementing any feature or bugfix, before writing implementation code.

**Kapan:** Setiap kali implementasi fitur atau bugfix.

### Hukum Besi

```
NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST
```

**No exceptions:**
- Don't keep code as "reference"
- Don't "adapt" it while writing tests
- Don't look at it
- Delete means delete

### Siklus Red-Green-Refactor

```
┌─────────────┐      ┌─────────────┐      ┌─────────────┐
│    RED      │      │   GREEN     │      │  REFACTOR   │
│Write failing│      │ Write       │      │ Clean up    │
│test         │      │ minimal code│      │             │
└──────┬──────┘      └──────┬──────┘      └──────┬──────┘
       ↓                    ↓                    ↓
  ┌────┴────┐          ┌────┴────┐          ┌────┴────┐
  │Verify   │          │Verify   │          │Stay     │
  │fails    │          │passes   │          │green    │
  │correctly│          │         │          │         │
  └────┬────┘          └────┬────┘          └────┬────┘
       ↓                    ↓                    ↓
     YES → GREEN          PASS → REFACTOR       REPEAT
     NO  → RED
```

### RED — Write Failing Test

```typescript
// ✅ GOOD
test('retries failed operations 3 times', async () => {
  let attempts = 0;
  const operation = () => {
    attempts++;
    if (attempts < 3) throw new Error('fail');
    return 'success';
  };
  const result = await retryOperation(operation);
  expect(result).toBe('success');
  expect(attempts).toBe(3);
});

// ❌ BAD — vague name, tests mock not code
test('retry works', async () => {
  const mock = jest.fn()
    .mockRejectedValueOnce(new Error())
    .mockRejectedValueOnce(new Error())
    .mockResolvedValueOnce('success');
  await retryOperation(mock);
  expect(mock).toHaveBeenCalledTimes(3);
});
```

**Requirements:**
- Satu behavior
- Nama jelas
- Real code (no mocks unless unavoidable)

### Verify RED — Watch It Fail

**MANDATORY.** Never skip.

```bash
npm test path/to/test.test.ts
```

Confirm:
- Test fails (not errors)
- Failure message is expected
- Fails because feature missing (not typos)

**Test passes?** You're testing existing behavior. Fix test.

### GREEN — Minimal Code

```typescript
// ✅ GOOD — just enough to pass
async function retryOperation<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === 2) throw e;
    }
  }
  throw new Error('unreachable');
}

// ❌ BAD — over-engineered
async function retryOperation<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    backoff?: 'linear' | 'exponential';
    onRetry?: (attempt: number) => void;
  }
): Promise<T> { /* YAGNI */ }
```

Don't add features, refactor other code, or "improve" beyond the test.

### REFACTOR — Clean Up

After green only:
- Remove duplication
- Improve names
- Extract helpers

Keep tests green. Don't add behavior.

### Common Rationalizations (STOP!)

| Excuse | Reality |
|--------|--------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing. |
| "Tests after achieve same goals" | Tests-after = "what does this do?" Tests-first = "what should this do?" |
| "Deleting work is wasteful" | Sunk cost fallacy. Keeping unverified code is technical debt. |
| "TDD will slow me down" | TDD faster than debugging. Pragmatic = test-first. |
| "Manual test faster" | Manual doesn't prove edge cases. |

### Verification Checklist

Before marking work complete:

- [ ] Every new function/method has a test
- [ ] Watched each test fail before implementing
- [ ] Each test failed for expected reason
- [ ] Wrote minimal code to pass each test
- [ ] All tests pass
- [ ] Output pristine (no errors, warnings)
- [ ] Tests use real code (mocks only if unavoidable)
- [ ] Edge cases and errors covered

---

## 7. `superpowers:systematic-debugging` — Debugging Sistematis

**Deskripsi:** Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes.

### Hukum Besi

```
NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST
```

> **Violating the letter of this process is violating the spirit of debugging.**

### 4 Fase

#### Phase 1: Root Cause Investigation

**BEFORE attempting ANY fix:**

1. **Read Error Messages Carefully**
   - Read stack traces completely
   - Note line numbers, file paths, error codes

2. **Reproduce Consistently**
   - Can you trigger it reliably?
   - What are the exact steps?
   - Does it happen every time?
   - If not reproducible → gather more data, don't guess

3. **Check Recent Changes**
   - What changed that could cause this?
   - Git diff, recent commits
   - New dependencies, config changes

4. **Gather Evidence in Multi-Component Systems**

   ```bash
   # For EACH component boundary:
   # - Log what data enters component
   # - Log what data exits component
   # - Verify environment/config propagation

   # Example (multi-layer system):
   echo "=== Secrets available: ==="
   echo "IDENTITY: ${IDENTITY:+SET}${IDENTITY:-UNSET}"

   echo "=== Env vars in build script: ==="
   env | grep IDENTITY || echo "IDENTITY not in environment"

   echo "=== Keychain state: ==="
   security list-keychains
   security find-identity -v
   ```

5. **Trace Data Flow**
   - Where does bad value originate?
   - What called this with bad value?
   - Keep tracing up until you find the source
   - Fix at source, not at symptom

#### Phase 2: Pattern Analysis

1. **Find Working Examples**
   - Locate similar working code in same codebase
   - What works that's similar to what's broken?

2. **Compare Against References**
   - Read reference implementation COMPLETELY
   - Don't skim - read every line

3. **Identify Differences**
   - What's different between working and broken?
   - List every difference, however small

4. **Understand Dependencies**
   - What other components does this need?
   - What settings, config, environment?

#### Phase 3: Hypothesis and Testing

1. **Form Single Hypothesis**
   - "I think X is the root cause because Y"
   - Write it down
   - Be specific, not vague

2. **Test Minimally**
   - Make the SMALLEST possible change
   - One variable at a time

3. **Verify Before Continuing**
   - Did it work? Yes → Phase 4
   - Didn't work? Form NEW hypothesis

4. **When You Don't Know**
   - Say "I don't understand X"
   - Don't pretend to know
   - Ask for help

#### Phase 4: Implementation

1. **Create Failing Test Case** — MUST have before fixing
2. **Implement Single Fix** — ONE change at a time
3. **Verify Fix** — Test passes now? No other tests broken?
4. **If Fix Doesn't Work** — Return to Phase 1 with new information
5. **If 3+ Fixes Failed** — Question architecture (see below)

### If 3+ Fixes Failed: Question Architecture

**Pattern indicating architectural problem:**
- Each fix reveals new shared state/coupling/problem in different place
- Fixes require "massive refactoring" to implement
- Each fix creates new symptoms elsewhere

**STOP and question fundamentals:**
- Is this pattern fundamentally sound?
- Are we "sticking with it through sheer inertia"?
- Should we refactor architecture vs. continue fixing symptoms?

### Red Flags (STOP!)

- "Quick fix for now, investigate later"
- "Just try changing X and see if it works"
- "Add multiple changes, run tests"
- **"One more fix attempt" (when already tried 2+)**
- Each fix reveals new problem in different place

**ALL of these mean: STOP. Return to Phase 1.**

### Quick Reference

| Phase | Key Activities | Success Criteria |
|-------|---------------|-----------------|
| **1. Root Cause** | Read errors, reproduce, check changes | Understand WHAT and WHY |
| **2. Pattern** | Find working examples, compare | Identify differences |
| **3. Hypothesis** | Form theory, test minimally | Confirmed or new hypothesis |
| **4. Implementation** | Create test, fix, verify | Bug resolved, tests pass |

---

## 8. `superpowers:verification-before-completion` — Bukti Sebelum Klaim

**Deskripsi:** Use when about to claim work is complete, fixed, or passing, before committing or creating PRs.

### Hukum Besi

```
NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE
```

### The Gate Function

```
BEFORE claiming any status:

1. IDENTIFY: What command proves this claim?
2. RUN: Execute the FULL command (fresh, complete)
3. READ: Full output, check exit code, count failures
4. VERIFY: Does output confirm the claim?
   - If NO: State actual status with evidence
   - If YES: State claim WITH evidence
5. ONLY THEN: Make the claim

Skip any step = lying, not verifying
```

### Examples

```
✅ BENAR:
[Run test command]
[See: 34/34 pass]
"All tests pass"

❌ SALAH:
"Should pass now" / "Looks correct" / "Looks good"
```

```
✅ BENAR:
[Run build]
[See: exit 0]
"Build passes"

❌ SALAH:
"Linter passed" (linter ≠ compiler)
```

### Common Failures

| Claim | Requires | Not Sufficient |
|-------|----------|----------------|
| Tests pass | Test command output: 0 failures | Previous run, "should pass" |
| Linter clean | Linter output: 0 errors | Partial check |
| Build succeeds | Build command: exit 0 | Linter passing, logs look good |
| Bug fixed | Test original symptom: passes | Code changed, assumed fixed |
| Regression test works | Red-green cycle verified | Test passes once |

### Red Flags

- Using "should", "probably", "seems to"
- Expressing satisfaction before verification
- About to commit/push/PR without verification
- Trusting agent success reports
- **ANY wording implying success without having run verification**

---

## 9. `superpowers:receiving-code-review` — Menanggapi Review

**Deskripsi:** Use when receiving code review feedback, before implementing suggestions, especially if feedback seems unclear or technically questionable.

### Prinsip

- Technical verification, not emotional performance
- Verify before implementing
- Ask before assuming
- Technical correctness over social comfort

### Proses

```
1. READ: Complete feedback without reacting
2. UNDERSTAND: Restate requirement in own words (or ask)
3. VERIFY: Check against codebase reality
4. EVALUATE: Technically sound for THIS codebase?
5. RESPOND: Technical acknowledgment or reasoned pushback
6. IMPLEMENT: One item at a time, test each
```

### Yang DILARANG

```
❌ "You're absolutely right!"
❌ "Great point!" / "Excellent feedback!"
❌ "Let me implement that now"
❌ "Thanks for catching that!"

✅ "Fixed. [Brief description of what changed]"
✅ "Good catch - [specific issue]. Fixed in [location]."
✅ [Just fix it and show in the code]
```

### Handling Unclear Feedback

```
IF any item is unclear:
  STOP — do not implement anything yet
  ASK for clarification on unclear items

WHY: Items may be related. Partial understanding = wrong implementation.
```

### YAGNI Check

```
IF reviewer suggests "implementing properly":
  grep codebase for actual usage

  IF unused: "This endpoint isn't called. Remove it (YAGNI)?"
  IF used: Then implement properly
```

### When to Push Back

- Suggestion breaks existing functionality
- Reviewer lacks full context
- Violates YAGNI (unused feature)
- Technically incorrect for this stack
- Legacy/compatibility reasons exist
- Conflicts with architectural decisions

### How to Push Back

- Use technical reasoning, not defensiveness
- Ask specific questions
- Reference working tests/code
- Involve human partner if architectural

### Implementation Order

```
FOR multi-item feedback:
  1. Clarify anything unclear FIRST
  2. Then implement in this order:
     - Blocking issues (breaks, security)
     - Simple fixes (typos, imports)
     - Complex fixes (refactoring, logic)
  3. Test each fix individually
  4. Verify no regressions
```

---

## 10. `superpowers:requesting-code-review` — Minta Review

**Deskripsi:** Use when completing tasks, implementing major features, or before merging to verify work meets requirements.

### When to Request

**Mandatory:**
- After each task in subagent-driven development
- After completing major feature
- Before merge to main

**Optional but valuable:**
- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing complex bug

### How to Request

```bash
# 1. Get git SHAs
BASE_SHA=$(git rev-parse HEAD~1)
HEAD_SHA=$(git rev-parse HEAD)

# 2. Dispatch code reviewer subagent
# Use Task tool with general-purpose type
```

### Template Placeholders

- `{DESCRIPTION}` — Brief summary of what you built
- `{PLAN_OR_REQUIREMENTS}` — What it should do
- `{BASE_SHA}` — Starting commit
- `{HEAD_SHA}` — Ending commit

### Act on Feedback

- Fix Critical issues immediately
- Fix Important issues before proceeding
- Note Minor issues for later
- Push back if reviewer is wrong (with reasoning)

---

## 11. `superpowers:finishing-a-development-branch` — Menyelesaikan Work

**Deskripsi:** Use when implementation is complete, all tests pass, and you need to decide how to integrate the work.

### Core Principle

> Verify tests → Detect environment → Present options → Execute choice → Clean up.

### Proses

```
Step 1: Verify Tests
  → Run project's test suite
  → If tests fail: STOP, fix before proceeding

Step 2: Detect Environment
  → Normal repo? Worktree? Detached HEAD?
  → Determines which menu to show

Step 3: Determine Base Branch
  → git merge-base HEAD main/master
  → Or ask user

Step 4: Present Options

Step 5: Execute Choice

Step 6: Cleanup Workspace
```

### 4 Opsi Menu (Normal Repo)

```
1. Merge back to <base-branch> locally
2. Push and create a Pull Request
3. Keep the branch as-is (I'll handle it later)
4. Discard this work

Type 'discard' to confirm for Option 4.
```

### 3 Opsi Menu (Detached HEAD)

```
1. Push as new branch and create a Pull Request
2. Keep as-is (I'll handle it later)
3. Discard this work

Type 'discard' to confirm for Option 3.
```

### Quick Reference Table

| Option | Merge | Push | Keep Worktree | Cleanup Branch |
|--------|-------|------|---------------|----------------|
| 1. Merge locally | yes | - | - | yes |
| 2. Create PR | - | yes | yes | - |
| 3. Keep as-is | - | - | yes | - |
| 4. Discard | - | - | - | yes (force) |

### Cleanup Rules

- **Option 1 & 4:** Cleanup worktree
- **Option 2 & 3:** Preserve worktree (user butuh untuk iterate)
- Selalu `cd` ke main repo root sebelum `git worktree remove`
- Run `git worktree prune` setelah removal

### Red Flags

**Never:**
- Proceed with failing tests
- Merge without verifying tests on result
- Delete work without confirmation
- Force-push without explicit request
- Remove a worktree before confirming merge success
- Clean up worktrees you didn't create

---

## 12. `superpowers:using-git-worktrees` — Isolasi Workspace

**Deskripsi:** Use when starting feature work that needs isolation from current workspace or before executing implementation plans.

### Core Principle

> Detect existing isolation first. Then use native tools. Then fall back to git. Never fight the harness.

### Step 0: Detect Existing Isolation

```bash
GIT_DIR=$(git rev-parse --git-dir)
GIT_COMMON=$(git rev-parse --git-common-dir)
BRANCH=$(git branch --show-current)
```

| SITUATION | ACTION |
|-----------|--------|
| `GIT_DIR != GIT_COMMON` (not submodule) | Already in worktree, skip creation |
| In a submodule | Treat as normal repo |
| Normal repo | Step 1: Create isolated workspace |

### Step 1: Create Isolated Workspace

**1a. Native Worktree Tools (preferred)**

Check for tools like `EnterWorktree`, `WorktreeCreate`, `/worktree` command, atau `--worktree` flag.

**1b. Git Worktree Fallback**

Hanya jika tidak ada native tool.

**Directory Selection Priority:**
1. Declared preference in instructions
2. `.worktrees/` (preferred)
3. `worktrees/`
4. `~/.config/superpowers/worktrees/$project/`
5. Default: `.worktrees/`

**Safety Verification:**
```bash
git check-ignore -q .worktrees 2>/dev/null || git check-ignore -q worktrees 2>/dev/null
# If NOT ignored → add to .gitignore, commit, then proceed
```

### Step 3: Project Setup

```bash
# Auto-detect
if [ -f package.json ]; then npm install; fi
if [ -f Cargo.toml ]; then cargo build; fi
if [ -f requirements.txt ]; then pip install -r requirements.txt; fi
if [ -f pyproject.toml ]; then poetry install; fi
if [ -f go.mod ]; then go mod download; fi
```

### Step 4: Verify Clean Baseline

```bash
npm test / cargo test / pytest / go test ./...
```

- **Tests fail:** Report, ask whether to proceed
- **Tests pass:** Report ready

### Report Format

```
Worktree ready at <full-path>
Tests passing (<N> tests, 0 failures)
Ready to implement <feature-name>
```

---

## 13. `superpowershell:dispatching-parallel-agents` — Parallel Investigation

**Deskripsi:** Use when facing 2+ independent tasks that can be worked on without shared state or sequential dependencies.

### When to Use

```
┌──────────────────────┐
│Multiple failures?    │
└──────────┬───────────┘
         yes ↓   no ↓
   ┌────────┴────────┐
   │Are they         │
   │independent?     │
   └────────┬────────┘
     yes ↓    no ↓
┌─────────┴───────┐
│Can they work in │
│parallel?       │
└────┬───────┬────┘
 yes ↓   no ↓
Parallel  Sequential
dispatch  agents
```

**Use when:**
- 3+ test files failing with different root causes
- Multiple subsystems broken independently
- Each problem can be understood without context from others
- No shared state between investigations

**Don't use when:**
- Failures are related (fix one might fix others)
- Need full system context
- Exploratory debugging
- Shared state between investigations

### The Pattern

```
1. Identify Independent Domains
   → Group failures by what's broken

2. Create Focused Agent Tasks
   → Specific scope
   → Clear goal
   → Constraints

3. Dispatch in Parallel

4. Review and Integrate
   → Read each summary
   → Verify fixes don't conflict
   → Run full test suite
```

### Agent Prompt Structure

```markdown
Fix the failing tests in <file>:

1. "test name" - [expected behavior]
2. "test name" - [expected behavior]

Your task:
1. Read the test file and understand what each test verifies
2. Identify root cause
3. Fix

Do NOT [specific constraints]

Return: Summary of what you found and what you fixed.
```

### Common Mistakes

| Mistake | Fix |
|---------|-----|
| "Fix all the tests" | ✅ "Fix <specific file>" |
| No context provided | ✅ Paste error messages and test names |
| No constraints | ✅ "Do NOT change production code" |
| Vague output | ✅ "Return summary of root cause" |

---

## 14. `superpowers:writing-skills` — Membuat Skill Baru

**Deskripsi:** Use when creating new skills, editing existing skills, or verifying skills work before deployment.

### Prinsip

> **Creating skills IS Test-Driven Development applied to process documentation.**

**TDD Mapping:**

| TDD Concept | Skill Creation |
|-------------|----------------|
| Test case | Pressure scenario with subagent |
| Test fails (RED) | Agent violates rule without skill |
| Test passes (GREEN) | Agent complies with skill present |
| Refactor | Close loopholes |

### Hukum Besi

```
NO SKILL WITHOUT A FAILING TEST FIRST
```

**No exceptions:**
- Not for "simple additions"
- Not for "just adding a section"
- Don't keep untested changes as "reference"

### Skill Types

| Tipe | Penjelasan | Contoh |
|------|-----------|--------|
| **Technique** | Concrete method with steps | condition-based-waiting |
| **Pattern** | Way of thinking about problems | flatten-with-flags |
| **Reference** | API docs, guides | pptx documentation |

### SKILL.md Structure

```markdown
---
name: skill-name-with-hyphens
description: Use when [specific triggering conditions] — NOT what it does
---

# Skill Name

## Overview
## When to Use
## Core Pattern (for techniques/patterns)
## Quick Reference
## Common Mistakes
```

### Deskripsi CSO Rules

**✅ GOOD:**
```yaml
description: Use when executing implementation plans with independent tasks
```

**❌ BAD:**
```yaml
description: Use for TDD - write test first, watch it fail, write minimal code
```

**Rules:**
- Start with "Use when..."
- Third person
- Just triggering conditions, NOT workflow summary
- Include specific symptoms, situations, contexts
- Max 500 characters if possible

### RED-GREEN-REFACTOR for Skills

```
RED: Run baseline scenario WITHOUT skill
  → Document exact rationalizations agents use

GREEN: Write minimal skill addressing those rationalizations
  → Verify agents now comply

REFACTOR: Agent found new rationalization?
  → Add explicit counter
  → Re-test until bulletproof
```

### Bulletproofing Against Rationalization

```markdown
| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing. |

## Red Flags

- Code before test
- "I already manually tested it"
- "Tests after achieve the same purpose"
- "It's about spirit not ritual"

**All of these mean: Delete code. Start over with TDD.**

---

## 15. Alur Kerja Lengkap Superpowers

```
┌─────────────────────────────────────────────────────────┐
│                      TASK MASUK                         │
└─────────────────────────┬───────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│ 2. using-superpowers: Cek skill yang berlaku           │
└─────────────────────────┬───────────────────────────────┘
                          ↓
     ┌──────────────────────────────────────────────┐
     │ Jika: Kreativitas/Fitur Baru                  │
     │ 3. brainstorming                             │
     │    ↓                                         │
     │ 4. writing-plans                             │
     │    ↓                                         │
     │ 5. subagent-driven-development                │
     │    ↓                                         │
     │ 6. systematic-debugging (jika ada bug)        │
     │    ↓                                         │
     │ 7. verification-before-completion            │
     │    ↓                                         │
     │ 8. requesting-code-review                     │
     │    ↓                                         │
     │ 9. receiving-code-review (jika ada feedback) │
     │    ↓                                         │
     │ 10. finishing-a-development-branch           │
     └──────────────────────────────────────────────┘
```

### Skill Priority Order Summary

| Konteks | Skill Pertama | Skill Berikutnya |
|---------|--------------|----------------|
| Feature baru | `brainstorming` | `writing-plans` |
| Bug/Error | `systematic-debugging` | `verification-before-completion` |
| Multi-task plan | `subagent-driven-development` | `finishing-a-development-branch` |
| Code review masuk | `receiving-code-review` | (implement) |
| Siap merge | `finishing-a-development-branch` | - |
| Isolasi workspace | `using-git-worktrees` | - |
| Multi independent issues | `dispatching-parallel-agents` | per-issue debugging |

---

## Reference: Command Cheat Sheet

### Git Worktree

```bash
# Detect isolation
GIT_DIR=$(git rev-parse --git-dir)
GIT_COMMON=$(git rev-parse --git-common-dir)

# Create worktree
git worktree add .worktrees/<branch-name> -b <branch-name>

# Remove worktree (ALWAYS cd to main repo first)
cd <main-repo-root>
git worktree remove .worktrees/<branch-name>
git worktree prune

# Check current branch
git branch --show-current
```

### Running Tests

```bash
# Node.js
npm test

# Rust
cargo test

# Python
pytest / python -m pytest

# Go
go test ./...
```

### Git Commits

```bash
# Stage specific files
git add <file1> <file2>

# Commit with message
git commit -m "feat: add feature description"

# Push and create PR
git push -u origin <branch-name>
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
<description>

## Test Plan
- [ ] verification steps
EOF
)"
```

---

*Generated from Superpowers v5.1.0 — Claude Code Plugin*
