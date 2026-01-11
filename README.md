# NANA

**NANA** (Not Another Note-Taking App) - An AI-powered study assistant that transforms PDFs into personalized learning notes.

## Features

- 📄 **Smart PDF Processing** - Two-phase pipeline extracts content once, generates notes efficiently
- 🧮 **LaTeX Math Rendering** - Displays mathematical notation beautifully using KaTeX
- 📝 **Markdown Notes** - Rich formatting with Obsidian-style callouts (note, warning, tip, etc.)
- 🔍 **Inline Commands** - Select text to elaborate, simplify, or get analogies tailored to your background
- ✨ **Emphasis Integration** - Add key points from lectures/presentations that AI weaves into notes
- 🔎 **Text Search** - Find text across notes with result highlighting
- 📤 **Export/Import Notes** - Export notes as Markdown with YAML frontmatter; import to restore notes later
- 🌓 **Dark Mode** - Toggle theme with system preference detection
- ↔️ **Resizable Layout** - Drag divider to adjust PDF/notes split (double-click to reset)
- ⌨️ **Keyboard Navigation** - Arrow keys for quick page navigation while studying
- 🔄 **Error Recovery** - Automatic retry for failed note generation
- 🎯 **Personalized Learning** - Adapts to your study level, learning style, and topic mastery

## Try It Online

**Live Demo**: https://nana-app.up.railway.app/

The app uses a BYOK (Bring Your Own Key) model—you'll need a free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey). Enter your key once and it's saved in your browser for future sessions.

## Model

NANA is powered by [Gemini 3 Flash](https://ai.google.dev/gemini-api/docs/gemini-3) (`gemini-3-flash-preview`).

📖 [API Documentation](https://ai.google.dev/gemini-api/docs) · 💰 [Pricing](https://ai.google.dev/gemini-api/docs/pricing) · 🔑 [Get API Key](https://aistudio.google.com/apikey)

## FAQ

### 1. If I upload the same PDF again, what will happen?

**It depends on whether your notes are fully cached:**

| Scenario | What Happens | API Calls |
|----------|--------------|-----------|
| **Complete cache** (all pages have notes) | Instant load — skips Gemini API entirely | 0 |
| **Partial cache** (some notes generated) | Resumes from where you left off | Only for missing pages |
| **Different file** (same name, but modified) | Fresh upload — cache cleared | Full extraction + all pages |

**How it works:** When you re-upload a PDF, the app checks three things:
1. **Filename** — Does it match the cached file?
2. **File size** — Is it exactly the same byte count?
3. **Last modified timestamp** — Was the file changed?

If all three match AND all notes are cached, you'll see "Complete session cached!" on the upload page and clicking "Start Learning" navigates instantly with zero network requests.

> **Note:** Notes are stored in your browser's localStorage. Clearing browser data will remove the cache.

### 2. Can I backup and restore my notes?

**Yes! Use the Export/Import feature:**

| Action | How | What it does |
|--------|-----|--------------|
| **Export** | Click "Export Notes" on Study page | Downloads a `.md` file with all notes + YAML frontmatter |
| **Import** | Click "Import notes" on Upload page | Restores notes from a previously exported file |

**The export file includes:**
- All generated notes in Markdown format
- A content hash (SHA-256) to verify PDF matching
- Original filename, page count, and export timestamp

**When importing:**
- If the content hash matches your current PDF → notes import instantly
- If there's a mismatch (different PDF) → you'll see a warning but can still proceed

> **Tip:** Export your notes before clearing browser data to preserve your work!

### 3. What happens to my API key?

**Your API key stays private and is never stored on our servers.**

| Aspect | What Happens |
|--------|--------------|
| **Storage** | Saved only in your browser's localStorage |
| **Transmission** | Sent via HTTPS header with each API request |
| **Server handling** | Used once to call Google's API, then discarded |
| **Logging** | Never logged or recorded on the server |

The backend acts as a pass-through: it receives your key, makes the Gemini API call, and returns the result. Your key exists on the server only for the duration of each request (milliseconds), and is never written to disk or logs.

> **Tip:** You can clear your saved key anytime by clicking "Change API Key" in the app, or by clearing your browser's localStorage.

---

## Quick Start (Local Development)

```bash
# 1. Clone and enter the project
cd nana

# 2. Set up environment (see below)

# 3. Run the app
./dev.sh
```

This starts both backend and frontend, then opens your browser to `http://localhost:5173`.

Press `Ctrl+C` to stop all services.

## Prerequisites

- Python 3.11+
- Node.js 18+
- [uv](https://docs.astral.sh/uv/) package manager

## Setup

### 1. Install Dependencies

```bash
# Create virtual environment and install Python dependencies
uv venv
source .venv/bin/activate  # or .venv/bin/activate.fish for fish shell
uv pip install -e .

# Install frontend dependencies
cd frontend
npm install
cd ..
```

### 2. Configure Environment

Create a `.env` file in the **project root** (optional for local dev):

```bash
# .env
GOOGLE_API_KEY=your_google_api_key_here  # Optional: can also enter key in UI

# Optional: Override default model
# GEMINI_MODEL=gemini-3-flash-preview
```

Get your API key from [Google AI Studio](https://aistudio.google.com/apikey).

> **Note**: You can skip the `.env` file and enter your API key directly in the app's UI instead. The key is validated and stored in your browser's localStorage.

## Project Structure

```
nana/
├── dev.sh              # Development launcher script
├── .env                # Environment variables (create this)
├── backend/
│   ├── prompts/        # LLM prompt templates
│   │   ├── notes_generation.md
│   │   └── inline_commands/
│   └── app/            # FastAPI backend
│       ├── main.py     # App entry point
│       ├── config.py   # Settings management
│       └── routers/    # API endpoints
├── frontend/           # React + Vite frontend
│   └── src/
├── debug/              # LLM prompt/response logs (auto-generated)
└── materials/          # Sample PDFs for testing
```

## System Architecture

NANA uses a two-phase AI pipeline to optimize performance and cost:

1.  **Phase 1 (Upload):** The entire PDF is sent to Gemini Flash once. The model extracts text, structure, and layout, returning a clean JSON representation of every page.
2.  **Phase 2 (Study):** When generating notes, we don't re-upload the file. Instead, we send a lightweight text payload to generate focused study materials in markdown format with callouts and LaTeX math support:
    - Current page text
    - Previous page text (for continuity)
    - User profile (expertise, goals, preferences)
    - Topic mastery scores (adapts difficulty)
    - Previous notes summary (avoids repetition)

```text
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           NANA: PDF DATA FLOW ARCHITECTURE                       │
├──────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 1: INITIAL EXTRACTION (ONE-TIME)                                           │
│                                                                                  │
│   [User]          [Frontend]          [Backend]          [Gemini Flash]          │
│     │                 │                   │                    │                 │
│     │──(Upload PDF)──>│                   │                    │                 │
│     │                 │──(POST /upload)──>│                    │                 │
│     │                 │     [Binary]      │──(Entire PDF File)─>│                 │
│     │                 │                   │   + Text Prompt     │                 │
│     │                 │                   │                    │                 │
│     │                 │                   │<─(JSON: All Pages)─┤                 │
│     │                 │<───(Parsed JSON)──│                    │                 │
│     │                 │                   │                    │                 │
│                                                                                  │
├──────────────────────────────────────────────────────────────────────────────────┤
│ PHASE 2: SEQUENTIAL NOTE GENERATION (PER PAGE)                                   │
│                                                                                  │
│   [User]          [Frontend]          [Backend]          [Gemini Flash]          │
│     │                 │                   │                    │                 │
│     │──(Gen Page N)──>│                   │                    │                 │
│     │                 │──(POST /notes)───>│                    │                 │
│     │                 │   [TEXT ONLY]     │──(Prompt Payload)──>│                 │
│     │                 │  - Page N Text    │  - Text Content     │                 │
│     │                 │  - Page N-1 Text  │  - User Profile     │                 │
│     │                 │  - Topic Mastery  │  - Prev Notes       │                 │
│     │                 │                   │                    │                 │
│     │                 │<──(Study Notes)───│<───(JSON Notes)────┤                 │
│     │<──(View Notes)──│                   │                    │                 │
│     │                 │                   │                    │                 │
└──────────────────────────────────────────────────────────────────────────────────┘
```

## Development

### Logs

When running with `./dev.sh`, logs are written to:
- `backend.log` - FastAPI server logs
- `frontend.log` - Vite dev server logs
- `debug/` - LLM prompts and responses saved as Markdown files, grouped by session ID (with token counts and timing)

View logs in real-time:
```bash
tail -f backend.log
tail -f frontend.log
```

### API Documentation

With the backend running, visit `http://localhost:8000/docs` for interactive API docs.

### Keyboard Shortcuts

While studying in the dual-pane view:
- `←` / `→` - Previous/Next page
- `↑` / `↓` - Scroll notes panel
- `Cmd+F` / `Ctrl+F` - Open text search

(Arrow shortcuts are disabled when typing in input fields)

## Open Source

<a href="https://github.com/DesmondChoy/nana">
  <img src="https://img.shields.io/badge/GitHub-DesmondChoy%2Fnana-181717?logo=github" alt="GitHub">
</a>
<a href="https://github.com/DesmondChoy/nana/blob/main/LICENSE">
  <img src="https://img.shields.io/badge/License-MIT-blue" alt="MIT License">
</a>

This project is open source and available under the [MIT License](LICENSE).
