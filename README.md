# NANA

**NANA** (Not Another Note-Taking App) - An AI-powered study assistant that transforms PDFs into personalized learning notes.

## Features

- 📄 **Smart PDF Processing** - Two-phase pipeline extracts content once, generates notes efficiently
- 🧮 **LaTeX Math Rendering** - Displays mathematical notation beautifully using KaTeX
- 📝 **Markdown Notes** - Rich formatting with Obsidian-style callouts (note, warning, tip, etc.)
- 🔍 **Inline Commands** - Select text to elaborate, simplify, or get analogies tailored to your background
- 📤 **Export Notes** - Download all generated notes as a single markdown file with table of contents
- 🌓 **Dark Mode** - Toggle theme with system preference detection
- ↔️ **Resizable Layout** - Drag divider to adjust PDF/notes split (double-click to reset)
- ⌨️ **Keyboard Navigation** - Arrow keys for quick page navigation while studying
- 🔄 **Error Recovery** - Automatic retry for failed note generation
- 🎯 **Personalized Learning** - Adapts to your study level, learning style, and topic mastery

## Quick Start

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

Create a `.env` file in the **project root**:

```bash
# .env
GOOGLE_API_KEY=your_google_api_key_here

# Optional: Override default model
# GEMINI_MODEL=gemini-3-flash-preview
```

Get your API key from [Google AI Studio](https://aistudio.google.com/apikey).

## Project Structure

```
nana/
├── dev.sh              # Development launcher script
├── .env                # Environment variables (create this)
├── backend/            # FastAPI backend
│   └── app/
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
2.  **Phase 2 (Study):** When generating notes, we don't re-upload the file. Instead, we send a lightweight text payload (Current Page + Previous Page Context + User Profile) to generate focused study materials in markdown format with callouts and LaTeX math support.

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
- `←` or `↑` - Previous page
- `→` or `↓` - Next page

(Shortcuts are disabled when typing in input fields)
