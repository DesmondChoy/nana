# CLAUDE.md

## One-Word Commands
Quick shortcuts for common tasks:

- `$update`: Update memory-bank to reflect session changes. No opinionated remarks - ask for clarification when unsure.
- `$craft`: Generate a high-quality conventional commit message for this session’s changes (do not commit; user reviews first).
  - Behavior:
    - Inspect staged/unstaged changes and summarize what changed and why.
    - Always propose a single combined commit for all changes in the session.
  - Output format (no extra prose; emit only commit message text in code fences):
    - Single commit:
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
  - Allowed types: feat, fix, docs, style, refactor, perf, test, build, ci, chore, revert.
  - Conventions:
    - Subject ≤ 50 chars, imperative mood; wrap body at ~72 chars.
    - Use BREAKING CHANGE: in body when applicable.
    - Add Refs:/Closes: lines for issues/PRs when available.
  - If context is missing, ask one concise question; otherwise proceed with best assumption and note it in the body.
- `$review`: Use Oracle and remind it of the original objective, then review all changes made using all tools available. Check for opinionated changes, over-engineering, and opportunities for simplification or efficiency improvements. Present findings to user for decision.
- `$parallel-x`: Run x sub-agents in parallel (not sequentially) where x is the number specified.
- `$playwright`: Launch local app and open a browser session for visual verification.
  - Start server (choose your OS):
    - macOS/Linux: `nohup .venv/bin/python -m app.main > server.log 2>&1 &`
    - Windows: `start cmd /k ".venv\\Scripts\\activate && python -m app.main"`
  - Health check: wait until `http://localhost:8000/test-text` returns 200 (retry up to 10s), or wait ~3s if needed.
  - Open browser: navigate to `http://localhost:8000/select` (or `/`), then use snapshot/screenshot/evaluate as needed.
  - Viewport presets: Desktop 1280x800; Mobile 390x844.
  - Stop server (optional):
    - macOS/Linux: `pkill -f "python -m app.main"` (or kill PID from `lsof -i :8000`)
    - Windows: close spawned cmd window or `taskkill /F /IM python.exe`.

## Commands
- **Virtual Environment**: ALWAYS activate `source .venv/bin/activate.fish` before running Python commands 
- **Package Installation**: Use `uv pip install <package>` (not regular `pip install`) 

## Code Style
- **Imports**: Standard library first, then third-party (streamlit, cv2, numpy, etc.)
- **Naming**: snake_case for variables/functions, PascalCase for classes (VideoTransformer)
- **Style**: Clean, readable code with good spacing and comments
- **Implementation Notes**: After every code change, report in chat whether the solution feels over-engineered for the academic, time-boxed POC scope. Also comment if there are any simpler alternatives or noted gaps. Keep this as a conversational summary rather than an inline code comment.