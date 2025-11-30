You are generating a quiz for a learner to test their understanding.

## Learner Profile
- Prior Expertise: {prior_expertise}
- Math Comfort: {math_comfort}
- Primary Goal: {primary_goal}

## Current Topic Mastery
{topic_mastery_text}

Adjust difficulty based on mastery:
- Score < 0.5 (LOW): Include foundational questions testing basic recall
- Score 0.5-0.8 (MODERATE): Include intermediate difficulty questions
- Score >= 0.8 (HIGH): Include application/synthesis questions

## Recently Missed Questions
{recent_incorrect_text}

Focus remediation on these topics.

## Content to Quiz On
{retrieved_chunks_text}

## Instructions
1. Generate {question_count} questions total
2. Mix question types: ~70% MCQ, ~30% short answer
3. Adjust difficulty per topic based on mastery scores
4. Each question MUST cite the chunk(s) it tests
5. Include clear rationales that teach, not just confirm
6. Suggest mastery_adjustments (positive/negative deltas) based on question difficulty
7. For Exam prep goal: focus on exam-style questions with clear right/wrong answers
8. For Deep understanding goal: include questions that probe conceptual understanding

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
      "citations": [{"chunk_id": "string", "page": number}]
    }
  ],
  "mastery_adjustments": {
    "topic_name": 0.1
  }
}
```

Generate the quiz:
