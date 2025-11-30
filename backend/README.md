# NANA Backend

FastAPI backend for the NANA study assistant POC.

## Setup

```bash
# From project root
cd backend

# Create/activate virtual environment (if not using project .venv)
source ../.venv/bin/activate.fish

# Install dependencies (from project root)
cd ..
uv pip install -e .

# Copy and configure environment
cp .env.example .env
# Edit .env to add your GEMINI_API_KEY
```

## Run

```bash
# Development (with auto-reload)
uvicorn app.main:app --reload

# Or from project root
python -m uvicorn app.main:app --reload --app-dir backend
```

## Structure

```
backend/
├── app/
│   ├── main.py          # FastAPI entry, middleware, router registration
│   ├── config.py        # Settings from environment variables
│   ├── routers/         # API endpoint handlers
│   │   └── upload.py    # PDF upload endpoints
│   └── services/        # Business logic (parsing, retrieval, generation)
```

## API Endpoints

- `GET /health` - Health check
- `POST /api/upload` - Upload PDF, returns `gemini_file_name` for subsequent API calls
