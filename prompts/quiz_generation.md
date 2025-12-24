You are generating a quiz for a learner to test their understanding.

## Learner Profile
- Prior Expertise: {prior_expertise}
- Math Comfort: {math_comfort}
- Primary Goal: {primary_goal}

## Current Topic Mastery
{topic_mastery_text}

## Recently Missed Questions
{recent_incorrect_text}

## Current Page Content (Page {page_number})
{page_text}

## Context (Adjacent Pages)
{context_pages_text}

## Instructions
1. Generate {question_count} questions based primarily on the Current Page Content.
2. **Mastery-Based Difficulty**:
   - Score < 0.5: Foundational questions testing basic recall.
   - Score 0.5-0.8: Intermediate difficulty/analytical questions.
   - Score >= 0.8: Advanced application or synthesis questions.
   - **If NO mastery is present**: Default to difficulty level appropriate for the 'Prior Expertise' in the Learner Profile.
3. Mix question types: ~70% MCQ, ~30% short answer.
4. Include clear rationales that teach, not just confirm.
5. Focus remediation on topics appearing in 'Recently Missed Questions'.
6. Suggest mastery_adjustments (delta scores like 0.05 or -0.05) based on expected question difficulty.

Return valid JSON matching this schema:

```json
{
  "questions": [
    {
      "id": "string",
      "type": "mcq|short_answer",
      "question": "string",
      "options": ["string"], 
      "correct_answer": "string",
      "rationale": "string",
      "topic_label": "string",
      "difficulty": "foundational|intermediate|application",
      "page_references": [number]
    }
  ],
  "mastery_adjustments": {
    "topic_name": number
  }
}
```

Generate the quiz:
