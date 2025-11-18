Your study notes that study you.

# Pain Points

- Lecture notes are one size fits all - rarely match individual gaps or preferred styles.
- Existing tools summarize but rarely **adapt per learner**, **stay in lockstep with reading**, or **close the loop** with assessments.
- Opportunity: a **closed-loop learning copilot** that answers, “*What is the most effective way to explain this specific concept to this specific learner—right now?*”

# How It works

1. **User Profile (UP)**: Background, knowledge gaps, style preferences, language/level.  
2. **Lecture Materials (LM):** parse slides, PDFs, notes; chunk semantically; embed and index.  
3. **Study Notes (SN):** LLM uses UP + retrieved LM chunks to produce notes.  
4. **Dual-Pane UX:** left = LM, right = context-synchronized SN; “Related” panel surfaces past SN for conceptual links.  
   Provide **inline editing/commands** (elaborate, simplify, create diagram).
   Manual handwriting --> Pattern recognition
5. **Assessment Loop:** quick quizzes; results update UP and future generations. 

## Key Features

- **Side-by-side dynamic notes** that follow the learner’s scroll position.
- **Two outputs:** in-flow companion and **consolidated** printable doc.
- **Highlight-to-command** editing (elaborate, simplify, add analogies/diagrams).
- **Knowledge tracing lite:** quizzes trigger targeted remediation.
- **Cross-topic linking:** references to past SNs to build a concept map.
- **Versioning & provenance:** every SN cites source spans and generation settings.

## Premium Features

- Web Content + Recommendation Systems,
- Clustering -> Mindmap (Cross-topic linking)
- Gamification for daily compounding
- Active Recall (Beyond flash cards?)
- Semantic Search
- Versioning & provenance

# Target Users & Personas

- **Masters Students (primary):** juggling coursework, research, and jobs; need fast comprehension and tailored depth.
- **Instructors/TAs (secondary):** want learner-aware handouts and analytics on difficult concepts.
- **Professional Learners (secondary):** corporate training, certifications, and upskilling.


# AI/ML/DL Components

- Retrieval fusion (dense + lexical): combine embeddings with BM25 via
  Reciprocal Rank Fusion to maximize recall while staying on-topic. (PRMLS –
  Transformers; PSPR – IR)
- Rerank fusion (neural + lexical): cross‑encoder scores combined with lexical
  scores using learned weights/min‑max normalization for precision. (PRMLS – DL)
- Profile‑conditioned, citation‑guarded generation: tailor tone/level using the
  learner profile; require citations to retrieved spans. (Reasoning Systems –
  LLMs; Cognitive Systems – NLG)
- Command NLU (intent + slots): map highlight commands to structured actions
  and parameters. (Cognitive Systems – NLU)
- Feature‑level fusion for mastery: fuse quiz correctness, response time,
  dwell/scroll, and edit types into a mastery classifier (logistic/NB). (PSPR –
  Supervised Evaluation)
- Decision‑level fusion for adaptation: weighted voting between mastery model,
  heuristic rules, and instructor constraints to choose depth/examples/quiz
  difficulty. (Reasoning Systems – Hybrid/Co‑operating Experts)
- Knowledge‑neural fusion for links: merge knowledge‑graph edges (co‑occurrence,
  prerequisites) with embedding similarity to surface related concepts.
  (Reasoning Systems – Knowledge Graphs; PRMLS – Embeddings)
- Self‑consistency/prompt ensemble: generate multiple candidate explanations
  and select via a small verifier or ranker. (Reasoning Systems – Competing
  Experts)
- Optional – Handwriting + text fusion: CNN OCR with language‑model cleanup to
  align handwritten notes to slides. (CNNs)
- Optional – Temporal alignment fusion: align audio/slide timestamps and note
  positions via DTW for better sync. (ISSM – DTW)
---

# Evaluation & Success Metrics

- Learning gains (primary): pre/post concept quizzes; report Cohen’s d with
  95% CI; target d ≥ 0.5 on the module. (PSPR)
- Grounding & retrieval quality: Precision@k / nDCG@k on a small gold set;
  citation coverage ≥ 90% and hallucination rate ≤ 5% on spot‑checks. (Cognitive
  Systems, PRMLS)
- UX & efficiency: SUS ≥ 80 and ≥ 20% reduction in time‑to‑understanding vs.
  baseline tasks. (Cognitive Systems)
