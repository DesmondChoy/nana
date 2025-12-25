Your study notes that study you.

# Pain Points

- Lecture notes are one size fits all - rarely match individual gaps or preferred styles.
- Existing tools summarize but rarely **adapt per learner**, **stay in lockstep with reading**, or **close the loop** with assessments.
- Opportunity: a **closed-loop learning copilot** that answers, “*What is the most effective way to explain this specific concept to this specific learner—right now?*”

# How It works

1. **User Profile (UP)**: Background, knowledge gaps, style preferences, language/level—collected via dropdowns before notes generation. UP conditions all subsequent LLM calls.
2. **Lecture Materials (LM):** Parse PDF via Gemini; extract text + metadata per page. No chunking/embedding—Gemini's 1M token context window allows direct context passing.
3. **Study Notes (SN):** Eager sequential generation **conditioned on UP**—after upload, generate notes for all pages automatically. Each LLM call receives:
   - Current page text + previous page (for continuity)
   - **User profile** (prior expertise, math comfort, detail level, goal)
   - Topic mastery scores (if available from prior quizzes)

   Notes are tailored to the learner: a "Domain Novice" gets more analogies; "Equation-heavy is fine" enables formal notation. Cached client-side for instant navigation.
4. **Dual-Pane UX:** Left = PDF page, right = pre-generated notes for current page (synchronized with navigation).
   - Provide **inline editing/commands** (elaborate, simplify, create diagram)—also conditioned on UP.
   - *(Deferred)* "Related" panel surfaces past SN for conceptual links.
5. **Consolidated Export:** Single batch LLM call synthesizes all page notes into polished, printable Markdown—**conditioned on UP** for consistent tone/depth.
6. **Assessment Loop:** User-triggered quizzes; results update topic mastery scores in UP, which condition future note generations and quiz difficulty. 

## Key Features

- **Profile-conditioned notes**: Every generation adapts to the learner's expertise, math comfort, detail preference, and learning goal.
- **Side-by-side dynamic notes** that follow the learner's page navigation (pre-generated, instant display).
- **Two outputs with different strategies:**
  - *Dual-pane notes*: Eager per-page generation with previous page context—ready for lecture, tailored to UP.
  - *Consolidated export*: Single batch synthesis—polished printable document, consistent with UP settings.
- **Highlight-to-command** editing (elaborate, simplify, add analogies/diagrams)—transformations respect UP preferences.
- **Knowledge tracing lite:** quizzes trigger targeted remediation; mastery scores feed back into note generation.
- *(Deferred)* **Cross-topic linking:** references to past SNs to build a concept map.
- *(Deferred)* **Versioning & provenance:** every SN cites source spans and generation settings.

## Premium Features

- Web Content + Recommendation Systems,
- Clustering -> Mindmap (Cross-topic linking)
- Gamification for daily compounding
- Active Recall (Beyond flash cards?)
- Semantic Search
- Versioning & provenance

# Target Users & Personas

- **Graduate Students (POC focus):** juggling coursework, research, and jobs; need fast comprehension and tailored depth. Typically have domain expertise in one area (e.g., DS/ML) but are learning adjacent fields.
- *(Future) Instructors/TAs:* want learner-aware handouts and analytics on difficult concepts.
- *(Future) Professional Learners:* corporate training, certifications, and upskilling.


# AI/ML/DL Components

## POC Architecture (Direct Context)

### Architecture & Data Flow
To balance cost, speed, and accuracy, NANA uses a two-phase approach for handling documents:

1.  **Phase 1: One-Time Extraction**
    *   **The "Heavy Lift":** When you upload a PDF, the **entire file** is sent to Gemini Flash once.
    *   **The Goal:** Extract raw text, tables, and document structure. We let the multimodal model handle the parsing complexity instead of relying on brittle Python libraries like `pypdf`.
    *   **The Result:** A clean, structured JSON representation of every page is returned and stored in the frontend state.

2.  **Phase 2: Sequential Generation**
    *   **The "Focused Study":** When generating notes, we **do not** re-upload the PDF.
    *   **The Payload:** We only send a small text payload: the **Current Page Text** + **Previous Page Context** (for continuity).
    *   **The Benefit:** This makes generation fast and cheap, while still maintaining enough context for high-quality, flow-aware study notes.

- **Profile‑conditioned generation**: Tailor tone/level/depth using learner profile passed to each LLM call. (Reasoning Systems – LLMs; Cognitive Systems – NLG)
- **Previous-page context**: Include N-1 page text for continuity (no N+1 lookahead to avoid notes referencing unseen content)—no chunking/embedding needed due to Gemini's 1M token context window.
- **Structured Outputs**: Gemini's native `response_schema` enforces valid JSON, reducing parsing errors.
- **Mastery-adaptive generation**: Quiz results update topic mastery scores; future notes/quizzes conditioned on mastery level.

## Deferred / Future Components
- *(Deferred)* Retrieval fusion (dense + lexical): combine embeddings with BM25 via Reciprocal Rank Fusion—useful if scaling beyond single-PDF context.
- *(Deferred)* Rerank fusion (neural + lexical): cross‑encoder scores for precision—applicable for multi-document scenarios.
- *(Deferred)* Command NLU (intent + slots): map highlight commands to structured actions. POC uses explicit button actions instead.
- *(Deferred)* Feature‑level fusion for mastery: fuse quiz correctness, response time, dwell/scroll into mastery classifier. POC uses simple score tracking.
- *(Deferred)* Knowledge‑neural fusion for links: merge knowledge‑graph edges with embedding similarity for cross-topic linking.
- *(Optional)* Handwriting + text fusion: CNN OCR with language‑model cleanup.
- *(Optional)* Temporal alignment fusion: align audio/slide timestamps via DTW.
---


# Evaluation & Success Metrics

> **POC scope:** Formal evaluation deferred. POC will log data to enable future analysis but will not implement pre/post quizzes or SUS instruments.

- *(Deferred)* Learning gains: pre/post concept quizzes; report Cohen's d with 95% CI; target d >= 0.5.
- **POC:** Grounding & retrieval quality: log retrieved chunk IDs; track citation coverage (target >= 90%) and flag empty citations.
- *(Deferred)* UX & efficiency: SUS >= 80 and >= 20% reduction in time-to-understanding vs. baseline.
