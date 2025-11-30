# NANA POC Implementation Plan

## 1. Objectives & Scope
- Deliver a working proof-of-concept that ingests a user-provided PDF and produces:
  - A dual-pane study environment: PDF page on the left, AI-generated notes on the right.
  - Inline highlight-to-command actions (elaborate, simplify, analogy, diagram instructions).
  - On-demand quizzes (triggered by the user) that adapt to the learner’s background and recent performance.
  - A consolidated Markdown export containing the curated notes.
- Out of scope: premium features (web recs, mind maps, gamification, advanced search, provenance UI), handwriting OCR, and multi-user persistence.

## 2. System Architecture Overview
- **Frontend (likely React/Vite or Next.js)**
  - Upload PDF and collect user profile via structured dropdowns (see Section 2.1).
  - Render PDF per page (pdf.js) with navigation controls.
  - Notes pane showing generated content for the selected page; supports text selection + action menu.
  - **Related Notes panel**: shows 2–3 embedding-similar note blocks from other pages for cross-topic linking.
  - Inline command modal/toolbar to pick elaboration type.
  - Quiz panel that surfaces generated questions, captures answers, and updates topic mastery.
  - Consolidated view + download button for Markdown file.
- **Backend/API Layer (FastAPI/Flask or lightweight Node server)**
  - Handles PDF upload, orchestrates Gemini API calls, and returns structured responses.
  - Performs chunking + embeddings + vector similarity search for retrieval.
  - Maintains temporary JSON storage per session (filesystem or in-memory cache) keyed by upload session ID.
  - Accepts user profile + topic mastery in requests to condition generation.

### 2.1 User Profile Schema
Collected via dropdowns on first use; stored client-side and passed to backend with each request.

| Field | Options | Prompt Effect |
|-------|---------|---------------|
| **Prior Expertise** | Data Science/ML, Software Engineering, Statistics, Domain Novice | Shapes analogies & assumed vocabulary |
| **Math Comfort** | No equations (words/intuition only), Light notation ok, Equation-heavy is fine | Controls formalism level |
| **Detail Level** | Concise (bullets only), Balanced (paragraphs + bullets), Comprehensive (textbook depth) | Sets verbosity |
| **Primary Goal** | Exam prep, Deep understanding, Quick reference | Prioritizes actionability vs. theory |

Optional: short free-text field for additional context (e.g., "NLP researcher, new to signal processing").

### 2.2 Topic Mastery Tracking (Closed-Loop)
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
- Topics are inferred from page content / chunk labels during quiz generation.

## 3. PDF Processing & Retrieval Pipeline
1. **Upload**: user selects PDF; backend stores it in a temp directory.
2. **Gemini Document Parsing**: send PDF to Gemini document-processing endpoint to extract text per page + structural metadata.
3. **Chunking**:
   - Split each page into semantic chunks (~200-300 tokens) with overlap to preserve context.
   - Keep references to page number and character offsets for citation.
4. **Embedding Generation**:
   - Use Gemini text-embedding model on each chunk (include page number + background as optional conditioning).
   - Store vectors and metadata in an in-memory vector index (e.g., FAISS or a simple cosine-sim search over numpy arrays given POC scale).
5. **Retrieval**:
   - When a page is opened or a user confirms an inline command (not just highlight), perform similarity search using:
     - Query built from page title/summary + optional user-selected text.
     - Apply filters to prioritize matching page and adjacent pages.
   - Return top-k chunks (k≈5) with scores for grounding the generation prompt.

## 4. Generation Flows (Gemini Text API)
- **Notes Generation Prompt**:
  - Inputs: user profile (prior expertise, math comfort, detail level, goal), topic mastery scores, selected page metadata, retrieved chunk texts, previous notes context (optional).
  - Prompt adjusts verbosity, analogy domain, and depth based on profile + mastery.
  - Output format: structured JSON (title, bullet notes, topic_labels[], citations list referencing chunk IDs).
- **Inline Command Prompt**:
  - Same inputs plus action type (elaborate/simplify/analogy/diagram instructions) and user-selected text.
  - Model returns a replacement snippet and refreshed citation list.
- **Quiz Generation Prompt**:
  - Inputs: user profile, topic mastery scores, retrieved chunks, recent incorrect answers.
  - Low-mastery topics get more foundational questions; high-mastery topics get application/synthesis questions.
  - Output: N questions (mix of MCQ/short answer) with correct answers, rationales, topic_label, and citation refs.
  - Model also returns updated mastery adjustments (delta scores) based on expected difficulty.
- **Related Notes Retrieval**:
  - After notes are generated, embed the note block and query against all other note embeddings in the session.
  - Return top 2–3 similar notes from different pages to display in the Related Notes panel.


## 5. Frontend UX Details
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

## 6. Local Storage Strategy
- Use browser storage for:
  - Session ID, user profile (dropdown selections + free-text context).
  - Topic mastery scores (updated after each quiz).
  - Cached note responses per page.
  - Quiz history per page/topic.
- Backend stores minimal JSON in `/tmp/nana_sessions/<session-id>.json` (writable root) containing chunk embeddings and retrieval metadata to avoid recomputing while session active.
- No persistent database; clearing browser data resets the experience.

## 7. Evaluation Hooks & Metrics
- **Retrieval Quality**: log retrieved chunk IDs per request; offline script can compare against a labeled relevance list to compute Precision@k / nDCG@k.
- **Grounding**: enforce citations in every generated block; track citation coverage (%) and flag empty citations.
- **Quiz Effectiveness**: store quiz outcomes (correct/incorrect + timestamps) to compute per-topic accuracy improvements after remediation.
- **Latency**: measure time from user action to received response for notes and quizzes; surface in console/logs for tuning.
- **User Feedback**: lightweight SUS-style slider or thumbs-up/down per note block to collect qualitative signal.

## 8. Implementation Phases & Tasks
> Each phase lists the primary libraries/tools plus the reasoning behind the steps so future SWE can reproduce decisions quickly.

1. **Environment & Skeleton Setup**
   - *Libraries*: `FastAPI`, `uvicorn`, `httpx`, `pydantic` on backend; `React` + `Vite`, `TypeScript`, `Tailwind` (or CSS modules) on frontend; `pdfjs-dist` for rendering; `zustand` or `Redux Toolkit` for client state.
   - *Steps*: create repo structure (`frontend/`, `backend/`, `docs/`), configure `.venv` and install packages via `uv pip`. Set up `.env` template for Gemini API key and local file paths.
   - *Reasoning*: establishing a clear scaffold prevents ad-hoc script sprawl, while FastAPI + React is a well-known pairing that accelerates iteration and onboarding.

2. **PDF Upload & Parsing Service**
   - *Libraries*: `python-multipart` for FastAPI uploads, Google Gemini SDK (`google.generativeai`), local temp storage utilities.
   - *Steps*: implement `/upload` endpoint that stores PDF under `/tmp/nana_sessions/<session-id>/source.pdf`, calls Gemini document-processing API, and saves returned page-wise text/metadata to JSON.
   - *Reasoning*: centralizing parsing ensures consistent inputs for chunking/retrieval and avoids pushing raw PDFs back to the client.

3. **Chunking & Embedding Pipeline**
   - *Libraries*: `nltk` or `tiktoken` for token estimation, Gemini embedding endpoint (`text-embedding-004`), `numpy` for vector math.
   - *Steps*: build chunker utility (200–300 token windows with 20% overlap), annotate each chunk with page IDs/citation offsets, embed via Gemini, and persist vectors plus metadata in a session JSON file.
   - *Reasoning*: deterministic chunking + embeddings enable reproducible retrieval and citation mapping; storing alongside metadata avoids re-embedding during the session.

4. **Vector Retrieval Service**
   - *Libraries*: `faiss-cpu` (if allowed) or a lightweight cosine similarity helper using `numpy`.
   - *Steps*: load vectors from session JSON into memory on request; implement `/retrieve` endpoint that accepts page number + optional highlight text, builds a query vector (average of embedding of query text + page title), filters by nearby pages, and returns top-k chunk payloads.
   - *Reasoning*: a dedicated retrieval layer isolates similarity logic so prompt builders can rely on high-precision context.

5. **Prompt Orchestration & Notes Generation API**
   - *Libraries*: internal prompt repository (see Section 11), FastAPI routers, `pydantic` schemas for request/response validation.
   - *Steps*: implement `/notes` endpoint that 1) fetches retrieved chunks, 2) loads the appropriate prompt template, 3) calls Gemini text endpoint, 4) validates JSON structure (title, bullets, citations) before returning to the client.
   - *Reasoning*: separating prompt configs from code simplifies iteration and enforces consistent generation outputs for notes vs. other actions.

6. **Frontend Dual-Pane Experience**
   - *Libraries*: `pdfjs-dist` viewer component, `react-query` (or `tanstack/query`) for data fetching, `Tailwind` for layout.
   - *Steps*: implement upload/profile screen, page navigation, note render component with skeleton states, and local storage syncing via `zustand` or `localforage`.
   - *Reasoning*: building the UX early enables rapid manual validation of backend responses and ensures the PDF navigation constraints are well-understood.

7. **Inline Highlight Command Actions**
   - *Libraries*: `selection-api` utilities, small headless UI component (e.g., `@headlessui/react`) for context menus/modals.
   - *Steps*: capture text selections in the notes pane, present command menu, collect tone/depth adjustments, call `/notes/actions` endpoint (which uses the inline command prompt), and patch the note block while keeping citation references.
   - *Reasoning*: centralizing all edits through the prompt API avoids diverging logic between initial notes and refinements, ensuring consistent grounding.

8. **Quiz Generation & Mastery Tracking**
   - *Libraries*: form components, optional chart lib (`recharts`) for mastery visualization.
   - *Steps*: add “Generate Quiz” button per page; endpoint uses quiz prompt template referencing current retrieval context + background + recent incorrect answers; frontend renders MCQ/free-response inputs, evaluates answers client-side using the returned key, and updates mastery JSON in local storage.
   - *Reasoning*: user-triggered quizzes align with requirement (no hardcoding) while mastery tracking showcases the closed-loop behavior even without a server DB.

9. **Consolidated Markdown Export**
   - *Libraries*: `remark`/`markdown-it` for preview (optional).
   - *Steps*: maintain normalized note objects per page; aggregation service stitches them into Markdown with headings and citations; provide download via Blob + anchor click.
   - *Reasoning*: Markdown keeps export simple, human-readable, and easy to convert to PDF later, meeting the printable doc requirement with minimal complexity.

10. **Evaluation Logging & Telemetry**
    - *Libraries*: simple logging middleware (e.g., `structlog`) or JSON logging, browser `navigator.sendBeacon` for async telemetry.
    - *Steps*: log retrieval scores, prompt IDs used, latency metrics, quiz outcomes; provide endpoint to download logs for offline metric computation.
    - *Reasoning*: capturing metrics now enables future quantitative evaluation without re-instrumenting flows.

11. **Polish, QA & Documentation**
    - *Libraries*: `pytest` for backend unit tests, Playwright (optional) for smoke tests, linting via `ruff`/`eslint`.
    - *Steps*: run manual QA with diverse PDFs, verify background prompt injection respects char limits, ensure all prompts exist in repository, document setup/run instructions.
    - *Reasoning*: a final pass cements reliability and makes handoff easier for future engineers.

## 9. Risks & Mitigations
- **Gemini Latency/Cost**: cache per-page outputs and reuse when possible.
- **Large PDFs**: no hard page limit; mitigate with:
  - Progress indicator during upload/processing.
  - Lazy embedding: embed pages on-demand when user navigates (not all upfront).
  - Aggressive caching per session to avoid recomputation.
  - Warn user if processing will take >30s based on page count estimate.
- **Citation Drift**: include chunk IDs directly in prompts; validate responses before displaying.
- **Browser Storage Limits**: warn users when hitting threshold; allow manual export to JSON for safekeeping if needed.

## 10. Next Steps
- Confirm tech stack choices (React + FastAPI?) and start scaffolding repositories.
- Secure Gemini API credentials and set environment variables.
- Begin with parsing + retrieval pipeline since it underpins all downstream features.

## 11. Prompt-Centric Functionality
- **Central Repository**: maintain `/prompts/` directory (YAML/JSON) describing each prompt, variables (background, page, tone), citation policy, and response schema. Backend loads these templates at startup to avoid scattering prompt text through code.
- **Functionalities Requiring Prompts**:
  1. *Notes Generation*: builds the initial per-page study notes referencing retrieved chunks and user background.
  2. *Inline Commands*: elaboration, simplification, analogy, and diagram-description prompts reuse shared context but toggle instruction blocks for desired transformation.
  3. *Quiz Generation*: produces user-triggered quizzes plus rationales and remediation hints; leverages recent wrong answers to adjust difficulty.
  4. *Remediation Suggestions*: optional micro-prompts invoked when quizzes detect weaknesses, guiding the user back to specific sections.
  5. *Consolidated Markdown Refinement*: lightweight prompt to summarize or smooth concatenated notes before export (if needed for readability).
- **Why a Repository**: 
  - Ensures traceability and easier iteration/testing of prompt text.
  - Allows future SWE to version prompts independently from code releases.
  - Enables automated linting (e.g., schema validation) and experimentation with prompt variants without redeploying core logic.
