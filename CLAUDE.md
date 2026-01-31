# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NANA (Not Another Note-Taking App) is an AI-powered study assistant that transforms PDFs into personalized learning notes using Google's Gemini API. It uses a two-phase pipeline:
- **Phase 1 (Upload)**: Entire PDF sent to Gemini to extract text and structure per page
- **Phase 2 (Study)**: Lightweight text payloads sent per page for notes generation with user profile adaptation

## Development Commands

### Quick Start
```bash
./dev.sh                  # Starts backend (8000) + frontend (5173), opens browser
```

### Backend (Python/FastAPI)
```bash
source .venv/bin/activate         # Activate venv (use .fish for fish shell)
uv pip install -e .               # Install dependencies (always use uv, not pip)
cd backend && python -m app.main  # Run backend only
pytest                            # Run tests
pytest -v                         # Verbose tests
ruff check .                      # Lint
ruff format .                     # Format (100-char lines)
```

### Frontend (React/Vite)
```bash
cd frontend
npm install                       # Install dependencies
npm run dev                       # Dev server (port 5173)
npm run build                     # Production build
npm run lint                      # ESLint
```

### Environment Setup
Create `.env` in project root:
```bash
GOOGLE_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-3-flash-preview  # Optional, defaults to gemini-3-flash-preview
```

## Architecture

### Data Flow
```
User → UploadPage (profile + PDF) → POST /api/upload → Gemini extracts pages
     → StudyPage (dual-pane) → POST /api/notes (per page) → Gemini generates notes
     → Notes cached in Zustand + localStorage
```

### Backend (`backend/app/`)
- `main.py` - FastAPI app entry, CORS config, router registration
- `routers/upload.py` - PDF upload, sends to Gemini for extraction
- `routers/notes.py` - Notes generation with user profile context
- `schemas.py` - Pydantic models (PageContent, UserProfile, NotesResponse, etc.)
- `debug.py` - DebugLogger for LLM interaction logging to `debug/` folder

### Frontend (`frontend/src/`)
- `pages/UploadPage.tsx` - Profile setup (4 dropdowns) + drag-drop file upload
- `pages/StudyPage.tsx` - Dual-pane layout, eager sequential notes generation
- `stores/pdfStore.ts` - PDF blob, parsed pages, notes cache (persisted)
- `stores/userStore.ts` - User profile, topic mastery (persisted)
- `components/PDFViewer.tsx` - react-pdf rendering with thumbnails/zoom
- `components/NotesPanel.tsx` - Notes display with importance color-coding
- `api/client.ts` - API client functions with AbortSignal support

### Prompts (`prompts/`)
- `notes_generation.md` - Per-page notes template with mastery adaptation
- `inline_commands/` - Templates for elaborate, simplify, analogy

## Key Design Decisions

1. **No Embedding/RAG**: Gemini's 1M token context allows direct context passing
2. **Client-Side State Only**: Stateless backend; all data in Zustand + localStorage
3. **Eager Sequential Generation**: Notes auto-generated per-page with progress tracking
4. **Structured Outputs**: Gemini's `response_schema` guarantees valid JSON responses

## Tech Stack

- **Backend**: FastAPI, Uvicorn, google-genai SDK, Pydantic
- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Zustand, react-pdf, TanStack Query
- **AI**: Google Gemini API (gemini-3-flash-preview)

## Code Style

- **Python**: ruff for linting/formatting, 100-char line limit, snake_case
- **TypeScript**: ESLint, PascalCase for components, camelCase for functions
- **Imports**: stdlib first, then third-party, then local

## Development Rules

- Always use `uv pip install` (not `pip install`)
- No autonomous commits - propose with conventional commit format, user reviews
- All LLM interactions logged to `debug/` folder (gitignored)
- POC project - avoid over-engineering, document simpler alternatives
- **UI/UX changes require Playwright testing** - After implementing or modifying UI/UX features, run the Playwright MCP testing workflow defined in `.claude/skills/playwright-testing.md`
- **Run quality check before committing** - Before any git commit or beads update, run `/quality` to review all changes with "fresh eyes" and fix any issues found

## Landing the Plane (Session Completion)

**When ending a work session**, remind the user of pending items and **wait for explicit approval** before any git operations.

**SESSION END CHECKLIST** (propose to user, don't auto-execute):

1. **Summarize changes** - Show `git status` and `git diff --stat` for review
2. **File issues for remaining work** - Propose issues for anything that needs follow-up
3. **Run quality check** - Run `/quality` to review changes before proposing commits
4. **Run quality gates** (if code changed) - Tests, linters, builds
5. **Propose commit message** - Use `$craft` to generate conventional commit message
6. **Wait for user approval** - User reviews and explicitly approves commit/push
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- **NEVER commit or push without explicit user approval**
- Propose commits with `$craft`, wait for user to say "commit" or "push"
- If user says "done" or "let's wrap up", show the checklist above and wait for approval
- Run `/quality` before proposing any commits
- The user owns all git operations - Claude proposes, user approves