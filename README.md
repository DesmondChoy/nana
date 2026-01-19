# NANA

**AI-powered study assistant that transforms PDFs into personalized learning notes.**

[![GitHub](https://img.shields.io/badge/GitHub-DesmondChoy%2Fnana-181717?logo=github)](https://github.com/DesmondChoy/nana)
[![License](https://img.shields.io/badge/License-MIT-blue)](https://github.com/DesmondChoy/nana/blob/main/LICENSE)

NANA uses a BYOK (Bring Your Own Key) model powered by [Gemini 3 Flash](https://ai.google.dev/gemini-api/docs/gemini-3). Upload any PDF, and it generates adaptive study notes tailored to your expertise level and learning style.

## ⚡ Quick Start

**Try it:** [Live Demo](https://nana-app.up.railway.app/) | **Get API key:** [Google AI Studio](https://aistudio.google.com/apikey)

```bash
# Local development
./dev.sh    # Starts backend (8000) + frontend (5173), opens browser
```

## 🛠 Features

* **Smart PDF Processing:** Two-phase pipeline extracts content once, generates notes efficiently.
* **LaTeX & Markdown:** KaTeX math rendering with Obsidian-style callouts (note, warning, tip).
* **Inline Commands:** Select text to elaborate, simplify, or get analogies tailored to your background.
* **Emphasis Integration:** Add key points from lectures that AI weaves into generated notes.
* **Personalized Learning:** Adapts to your study level, learning style, and topic mastery.
* **Export/Import:** Backup notes as Markdown with YAML frontmatter; restore anytime.

## 📖 How It Works

NANA uses a two-phase AI pipeline to optimize performance and cost:

1. **Phase 1 (Upload):** Entire PDF sent to Gemini once to extract text, structure, and layout.
2. **Phase 2 (Study):** Lightweight text payloads generate focused notes with user context.

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

## 📦 Installation

**Requirements:** Python 3.11+, Node.js 18+, [uv](https://docs.astral.sh/uv/)

| Step | Command |
|------|---------|
| Clone | `git clone https://github.com/DesmondChoy/nana.git && cd nana` |
| Backend | `uv venv && source .venv/bin/activate && uv pip install -e .` |
| Frontend | `cd frontend && npm install && cd ..` |
| Run | `./dev.sh` |

**Environment (optional):** Create `.env` in project root with `GOOGLE_API_KEY=your_key`. Or enter your key directly in the app UI.

## 🔧 Development

| Command | Action |
|---------|--------|
| `./dev.sh` | Start backend + frontend, open browser |
| `pytest` | Run backend tests |
| `ruff check . && ruff format .` | Lint and format Python |
| `cd frontend && npm run lint` | Lint frontend |

**Logs:** `backend.log`, `frontend.log`, `debug/` (LLM prompts/responses)

**API Docs:** http://localhost:8000/docs (when backend running)

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` / `→` | Previous / Next page |
| `↑` / `↓` | Scroll notes panel |
| `Cmd+F` | Open text search |

## ❓ FAQ

**Q: What happens if I re-upload the same PDF?**
Cached notes load instantly. If the file changed (size or timestamp), it re-processes.

**Q: Can I backup my notes?**
Yes! Export as Markdown via "Export Notes" on Study page. Import on Upload page to restore.

**Q: Is my API key secure?**
Your key stays in browser localStorage, never stored on the server. It's sent via HTTPS and used only for the duration of each API call.

## 📝 Project Structure

```
nana/
├── dev.sh                 # Development launcher
├── backend/
│   ├── app/               # FastAPI backend
│   └── prompts/           # LLM prompt templates
├── frontend/src/          # React + Vite frontend
├── debug/                 # LLM logs (auto-generated)
└── materials/             # Sample PDFs
```

## 📚 Resources

📖 [API Documentation](https://ai.google.dev/gemini-api/docs) | 💰 [Pricing](https://ai.google.dev/gemini-api/docs/pricing) | 🔑 [Get API Key](https://aistudio.google.com/apikey)

---

This project is open source and available under the [MIT License](LICENSE).
