# NANA Backend

FastAPI backend for the NANA study assistant POC.

## Quick Start

The easiest way to run the full application (backend + frontend):

```bash
# From project root
./dev.sh
```

This starts both services, opens your browser to `http://localhost:5173`, and logs output to `backend.log` and `frontend.log`.

Press `Ctrl+C` to stop all services.

## Prerequisites

- Python 3.11+
- Node.js 18+ (for frontend)
- [uv](https://docs.astral.sh/uv/) package manager

## Environment Setup

Create a `.env` file in the **project root** (not in `backend/`):

```bash
# /path/to/nana/.env
GOOGLE_API_KEY=your_google_api_key_here

# Optional: Override default model
# GEMINI_MODEL=gemini-3-flash-preview
```

Get your API key from [Google AI Studio](https://aistudio.google.com/apikey).

## Manual Setup

```bash
# From project root
cd backend

# Activate virtual environment
source ../.venv/bin/activate.fish  # or .venv/bin/activate for bash

# Install dependencies (from project root)
cd ..
uv pip install -e .
```

## Run Backend Only

```bash
# From backend/ directory
cd backend

# Option 1: Direct Python
python -m app.main

# Option 2: With auto-reload (development)
uvicorn app.main:app --reload
```

Backend runs on `http://localhost:8000`.

## Project Structure

```
backend/
├── app/
│   ├── main.py          # FastAPI entry, middleware, router registration
│   ├── config.py        # Settings from environment variables
│   ├── routers/         # API endpoint handlers
│   │   ├── upload.py    # PDF upload and parsing
│   │   └── notes.py     # Notes generation
│   └── services/        # Business logic
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/upload` | POST | Upload PDF, returns parsed page content |
| `/api/notes` | POST | Generate notes for a page |

API documentation available at `http://localhost:8000/docs` when running.
