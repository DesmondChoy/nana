# NANA

**NANA** (Not Another Note-Taking App) - An AI-powered study assistant that transforms PDFs into personalized learning notes.

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

## Development

### Logs

When running with `./dev.sh`, logs are written to:
- `backend.log` - FastAPI server logs
- `frontend.log` - Vite dev server logs
- `debug/` - LLM prompts and responses saved as Markdown files (with token counts and timing)

View logs in real-time:
```bash
tail -f backend.log
tail -f frontend.log
```

### API Documentation

With the backend running, visit `http://localhost:8000/docs` for interactive API docs.
