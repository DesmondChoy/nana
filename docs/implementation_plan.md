# NANA POC Implementation Plan

> **Current Status**: Phase 3 complete. Notes Generation API implemented with Pydantic Structured Outputs and Direct Context.
>
> **Next Up**: Phase 4 - Frontend Dual-Pane Experience.

## Objectives & Scope
- Deliver a working proof-of-concept that ingests a user-provided PDF and produces:
  - A dual-pane study environment: PDF page on the left, AI-generated notes on the right.
  - Inline highlight-to-command actions (elaborate, simplify, analogy, diagram instructions).
  - On-demand quizzes (triggered by the user) that adapt to the learner’s background and recent performance.
  - A consolidated Markdown export containing the curated notes.
- Out of scope: premium features (web recs, mind maps, gamification, advanced search, provenance UI), handwriting OCR, and multi-user persistence.

## System Architecture Overview
- **Frontend (likely React/Vite or Next.js)**
  - Upload PDF and collect user profile via structured dropdowns (see User Profile Schema below).
  - Render PDF per page (pdf.js) with navigation controls.
  - Notes pane showing generated content for the selected page; supports text selection + action menu.
  - **Related Notes panel** (deferred to v2): cross-topic linking via keyword matching or LLM-identified relationships.
  - Inline command modal/toolbar to pick elaboration type.
  - Quiz panel that surfaces generated questions, captures answers, and updates topic mastery.
  - Consolidated view + download button for Markdown file.
- **Backend/API Layer (FastAPI)**
  - Stateless: sends PDF inline to Gemini 3 Flash, returns parsed page content for client to store.
  - Orchestrates Gemini API calls for parsing and generation.
  - Accepts user profile + topic mastery in requests to condition generation.
  - **No embedding pipeline**: Gemini's large context window (1M tokens) allows sending full page content + adjacent pages directly, eliminating the need for chunking/retrieval.

### User Profile Schema
Collected via dropdowns on first use; stored client-side and passed to backend with each request.

| Field | Options | Prompt Effect |
|-------|---------|---------------|
| **Prior Expertise** | Data Science/ML, Software Engineering, Statistics, Domain Novice | Shapes analogies & assumed vocabulary |
| **Math Comfort** | No equations (words/intuition only), Light notation ok, Equation-heavy is fine | Controls formalism level |
| **Detail Level** | Concise (bullets only), Balanced (paragraphs + bullets), Comprehensive (textbook depth) | Sets verbosity |
| **Primary Goal** | Exam prep, Deep understanding, Quick reference | Prioritizes actionability vs. theory |

Optional: short free-text field for additional context (e.g., "NLP researcher, new to signal processing").

### Topic Mastery Tracking (Closed-Loop)
Stored client-side; updated after each quiz; passed to backend to condition future notes and quizzes.

```json
{
  "topic_mastery": {
    "transformer_architecture": { "score": 0.9, "attempts": 2, "last_updated": "..." },
    "retrieval_augmented_generation": { "score": 0.4, "attempts": 3, "last_updated": "..." }
  }
}
```

- **Low mastery (< 0.5)**: notes include more examples, simpler language, more analogies; quizzes focus on fundamentals.
- **High mastery (≥ 0.8)**: notes are concise summaries with advanced details; quizzes include harder application questions.
- Topics are inferred from page content during quiz generation.

## PDF Processing Pipeline (Simplified)
1. **Upload & Parse**: user selects PDF; backend sends it inline to Gemini 3 Flash, which extracts text per page + structural metadata (has_images, has_tables) in a single call.
2. **Client Storage**: parsed pages stored client-side; no server-side file persistence.
3. **Context Assembly** (replaces chunking/embedding/retrieval):
   - When generating notes for page N, send: current page text + adjacent pages (N-1, N+1) for context.
   - Gemini's 1M token context window can handle entire PDFs; no chunking or vector search needed.
   - For inline commands: send selected text + full page context.
   - For quizzes: send relevant page(s) content + user mastery scores.

> **Rationale**: A typical 100-page academic PDF is ~50-100K tokens, well within Gemini's context limit. The RAG pattern (chunk → embed → retrieve) solves a constraint that doesn't exist here. Direct context passing is simpler, faster, and eliminates retrieval failure modes.

## Generation Flows (Gemini Text API)
- **Notes Generation Prompt**:
  - Inputs: user profile (prior expertise, math comfort, detail level, goal), topic mastery scores, current page text + adjacent pages for context, previous notes context (optional).
  - Prompt adjusts verbosity, analogy domain, and depth based on profile + mastery.
  - Output format: structured JSON (title, bullet notes, topic_labels[], page references).
- **Inline Command Prompt**:
  - Inputs: user profile, action type (elaborate/simplify/analogy/diagram instructions), user-selected text, full page context.
  - Model returns a replacement snippet with page references.
- **Quiz Generation Prompt**:
  - Inputs: user profile, topic mastery scores, page content, recent incorrect answers.
  - Low-mastery topics get more foundational questions; high-mastery topics get application/synthesis questions.
  - Output: N questions (mix of MCQ/short answer) with correct answers, rationales, topic_label, and page refs.
  - Model also returns updated mastery adjustments (delta scores) based on expected difficulty.


## Frontend UX Details
- **Upload & Profile Step**:
  - Four dropdown selectors for user profile (Prior Expertise, Math Comfort, Detail Level, Primary Goal).
  - Optional free-text field for additional context.
  - Upload button; show progress indicator during processing (especially for large PDFs).
- **Dual-Pane Layout**:
  - Left: pdf.js viewer with page thumbnails and navigation.
  - Right: note cards per page; show loading skeleton while generation runs.
  - **Related Notes panel** (collapsible): displays 2-3 note snippets from other pages with high embedding similarity; clicking navigates to that page.
- **Inline Commands**:
  - User highlights text; contextual menu pops up with options (Elaborate, Simplify, Analogy, Diagram).
  - Selecting an option triggers regeneration of that note section.
- **Quiz Panel**:
  - Button "Generate Quiz for this Page/Section."
  - Questions render sequentially with answer inputs.
  - After submission: show correct answers + rationales, update topic mastery scores, and display mastery indicator per topic.
- **Consolidated View**:
  - Tab that aggregates accepted notes across pages into Markdown preview.
  - "Download Markdown" button triggers file download.

## Local Storage Strategy
- Use browser storage for:
  - Gemini file reference (`gemini_file_name`), user profile (dropdown selections + free-text context).
  - Topic mastery scores (updated after each quiz).
  - Cached note responses per page.
  - Quiz history per page/topic.
- Backend is stateless; parsed PDF content is stored client-side. No server-side persistence.
- No persistent database; clearing browser data resets the experience.

## Evaluation Hooks & Metrics
- **Grounding**: enforce page references in every generated block; track citation coverage (%) and flag missing references.
- **Quiz Effectiveness**: store quiz outcomes (correct/incorrect + timestamps) to compute per-topic accuracy improvements after remediation.
- **Latency**: measure time from user action to received response for notes and quizzes; surface in console/logs for tuning.
- **User Feedback**: lightweight SUS-style slider or thumbs-up/down per note block to collect qualitative signal.

## Implementation Phases & Tasks
> Each phase lists the primary libraries/tools plus the reasoning behind the steps so future SWE can reproduce decisions quickly.

- [x] 1. **Environment & Skeleton Setup**
   - *Libraries*: `FastAPI`, `uvicorn`, `httpx`, `pydantic` on backend; `React` + `Vite`, `TypeScript`, `Tailwind` (or CSS modules) on frontend; `pdfjs-dist` for rendering; `zustand` or `Redux Toolkit` for client state.
   - *Steps*: create repo structure (`frontend/`, `backend/`, `docs/`), configure `.venv` and install packages via `uv pip`. Set up `.env` template for Gemini API key and local file paths.
   - *Reasoning*: establishing a clear scaffold prevents ad-hoc script sprawl, while FastAPI + React is a well-known pairing that accelerates iteration and onboarding.
   - ✅ *Done*: Backend structure (`backend/app/`), `pyproject.toml`, prompt templates (`prompts/*.md`).

- [x] 2. **PDF Upload & Parsing Service**
   - *Libraries*: `python-multipart` for FastAPI uploads, Google Gemini SDK (`google-genai`).
   - *Steps*: implement `/upload` endpoint that sends PDF inline to Gemini 3 Flash (`gemini-3-flash-preview`), extracts page-wise text + metadata (has_images, has_tables) in a single call, returns structured `ParsedPDF` response.
   - *Reasoning*: inline upload (no Files API) simplifies architecture—single API call for upload + parse, no file reference management, no 48-hour expiration concerns.
   - ✅ *Done*: Upload + parsing complete. Returns `{original_filename, total_pages, pages: [{page_number, text, has_images, has_tables}]}`.

- [x] 3. **Notes Generation API**
   - *Libraries*: internal prompt repository (see Prompt-Centric Functionality), FastAPI routers, `pydantic` schemas for request/response validation.
   - *Steps*: implement `/notes` endpoint that 1) accepts page content + adjacent pages + user profile + mastery scores, 2) loads the notes generation prompt template, 3) calls Gemini text endpoint **configured with `response_schema` (Pydantic model) to strictly enforce the output format**, 4) returns the validated object to the client.
   - *Reasoning*: direct context passing (no chunking/retrieval) leverages Gemini's large context window. **Using Gemini's native Structured Outputs guarantees valid JSON, reducing parsing errors and code complexity.**
   - ✅ *Done*: Implemented `schemas.py`, `routers/notes.py`, updated `prompts/notes_generation.md` and registered router in `main.py`. Added tests in `backend/tests/`.

- [ ] 4. **Frontend Dual-Pane Experience**
   - *Libraries*: `pdfjs-dist` viewer component, `react-query` (or `tanstack/query`) for data fetching, `Tailwind` for layout.
   - *Steps*: implement upload/profile screen, page navigation, note render component with skeleton states, and local storage syncing via `zustand` or `localforage`.
   - *Reasoning*: building the UX early enables rapid manual validation of backend responses and ensures the PDF navigation constraints are well-understood.

- [ ] 5. **Inline Highlight Command Actions**
   - *Libraries*: `selection-api` utilities, small headless UI component (e.g., `@headlessui/react`) for context menus/modals.
   - *Steps*: capture text selections in the notes pane, present command menu, collect tone/depth adjustments, call `/notes/actions` endpoint (which uses the inline command prompt), and patch the note block while keeping page references.
   - *Reasoning*: centralizing all edits through the prompt API avoids diverging logic between initial notes and refinements, ensuring consistent grounding.

- [ ] 6. **Quiz Generation & Mastery Tracking**
   - *Libraries*: form components, optional chart lib (`recharts`) for mastery visualization.
   - *Steps*: add "Generate Quiz" button per page; endpoint uses quiz prompt template referencing page content + user profile + mastery + recent incorrect answers; frontend renders MCQ/free-response inputs, evaluates answers client-side using the returned key, and updates mastery JSON in local storage.
   - *Reasoning*: user-triggered quizzes align with requirement (no hardcoding) while mastery tracking showcases the closed-loop behavior even without a server DB.
   - ✅ *Progress*: Updated `prompts/quiz_generation.md` to align with Direct Context architecture.

- [ ] 7. **Consolidated Markdown Export**
   - *Libraries*: `remark`/`markdown-it` for preview (optional).
   - *Steps*: maintain normalized note objects per page; aggregation service stitches them into Markdown with headings and page references; provide download via Blob + anchor click.
   - *Reasoning*: Markdown keeps export simple, human-readable, and easy to convert to PDF later, meeting the printable doc requirement with minimal complexity.

- [ ] 8. **Evaluation Logging & Telemetry**
    - *Libraries*: simple logging middleware (e.g., `structlog`) or JSON logging, browser `navigator.sendBeacon` for async telemetry.
    - *Steps*: log prompt IDs used, latency metrics, quiz outcomes; provide endpoint to download logs for offline metric computation.
    - *Reasoning*: capturing metrics now enables future quantitative evaluation without re-instrumenting flows.

- [ ] 9. **Polish, QA & Documentation**
    - *Libraries*: `pytest` for backend unit tests, Playwright (optional) for smoke tests, linting via `ruff`/`eslint`.
    - *Steps*: run manual QA with diverse PDFs, verify background prompt injection respects char limits, ensure all prompts exist in repository, document setup/run instructions.
    - *Reasoning*: a final pass cements reliability and makes handoff easier for future engineers.

## Risks & Mitigations
- **Gemini Latency/Cost**: cache per-page outputs and reuse when possible.
- **Large PDFs**: no hard page limit; mitigate with:
  - Progress indicator during upload/processing.
  - Aggressive caching per session to avoid recomputation.
  - Warn user if processing will take >30s based on page count estimate.
- **Context Length**: For extremely large PDFs (500+ pages), may need to limit context to current page + adjacent pages only. Gemini's 1M token limit provides ample headroom for typical academic PDFs.
- **Browser Storage Limits**: warn users when hitting threshold; allow manual export to JSON for safekeeping if needed.

## Next Steps
- Begin Phase 4: Frontend scaffolding and dual-pane experience.
- Implement backend endpoint for Phase 6 (Quiz Generation).

## Prompt-Centric Functionality
- **Central Repository**: maintain `/prompts/` directory (YAML/JSON) describing each prompt, variables (background, page, tone), citation policy, and response schema. Backend loads these templates at startup to avoid scattering prompt text through code.
- **Functionalities Requiring Prompts**:
  1. *Notes Generation*: builds the initial per-page study notes using page content and user background.
  2. *Inline Commands*: elaboration, simplification, analogy, and diagram-description prompts reuse shared context but toggle instruction blocks for desired transformation.
  3. *Quiz Generation*: produces user-triggered quizzes plus rationales and remediation hints; leverages recent wrong answers to adjust difficulty.
  4. *Remediation Suggestions*: optional micro-prompts invoked when quizzes detect weaknesses, guiding the user back to specific sections.
  5. *Consolidated Markdown Refinement*: lightweight prompt to summarize or smooth concatenated notes before export (if needed for readability).
- **Why a Repository**: 
  - Ensures traceability and easier iteration/testing of prompt text.
  - Allows future SWE to version prompts independently from code releases.
  - Enables automated linting (e.g., schema validation) and experimentation with prompt variants without redeploying core logic.
