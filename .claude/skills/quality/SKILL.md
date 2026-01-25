---
description: Review recent code changes with "fresh eyes" and fix any issues found. Use before commits to catch bugs that accumulate during implementation.
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git show:*), Read, Edit, Glob, Grep
---

Review all code changes with "fresh eyes" before committing. This catches bugs that accumulate during implementation when focus is on making things work.

## Why This Matters

During implementation, we focus on "does it work?" and can miss:
- Logic errors that compile but behave incorrectly
- Missing error handling for edge cases
- Type mismatches or implicit conversions
- Dead code or unused imports
- Integration issues between components

## Process

### 1. Identify Changed Files

```bash
git status
git diff HEAD --name-only
```

### 2. Read ENTIRE Files (Not Just Diffs)

For each changed file, read the **complete file** to understand full context. Diffs show what changed but hide the surrounding code that may be affected.

### 3. Review Checklist

For each file, check:

**Logic & Correctness**
- [ ] Does the logic match the intended behavior?
- [ ] Are edge cases handled (null, empty, boundary values)?
- [ ] Are error conditions caught and handled appropriately?

**Type Safety**
- [ ] Are types consistent throughout the call chain?
- [ ] Are there implicit type conversions that could fail?

**Integration**
- [ ] Do function signatures match their call sites?
- [ ] Are API contracts (request/response shapes) consistent?
- [ ] Do state updates flow correctly between components?

**Code Hygiene**
- [ ] Remove dead code, unused imports, commented-out code
- [ ] Remove debug statements (console.log, print, etc.)
- [ ] Are variable names clear and consistent?

### 4. Fix Issues Immediately

When you find an issue:
1. Fix it using the Edit tool
2. Document what you fixed in the summary

Do NOT just flag issues—fix them. Only flag issues that require human judgment (design decisions, unclear requirements).

### 5. Report Summary

After reviewing all files, provide:

```
## Quality Review Summary

**Files Reviewed:** <list>

**Issues Fixed:**
- <file>: <what was fixed and why>

**Issues for Human Review:** (if any)
- <file>: <issue that requires human decision>

**Confidence:** <High/Medium/Low> - <brief explanation>
```

## When to Run

- Before any `git commit`
- Before any `bd sync` or `bd close`
- When requested with `/quality`
