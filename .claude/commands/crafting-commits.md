---
description: Generate conventional commit message for all changes
allowed-tools: Bash(git status:*), Bash(git diff:*), Bash(git log:*), Bash(git add:*), Bash(git commit:*), Bash(git push:*)
---

Generate a conventional commit message for the session's changes, then stage all changes, commit, and push.

## Behavior
1. Inspect all staged and unstaged changes
2. Summarize what changed and why
3. Stage all unstaged changes with `git add -A`
4. Commit with the generated message
5. Push to origin

## Output format
Emit only commit message in code fences, no extra prose:

```
<type>(<scope>): <summary>

<body>

- <bullet describing change>
- <bullet describing change>

Affected: <file1>, <file2>, ...
Test Plan:
- <how you verified>
Revert plan:
- <how to undo safely>
```

## Allowed types
feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert

## Conventions
- Subject ≤ 50 chars, imperative mood
- Wrap body at ~72 chars
- Use `BREAKING CHANGE:` in body when applicable
