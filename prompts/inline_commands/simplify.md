You are transforming study notes for a learner.

## Learner Profile
- Prior Expertise: {prior_expertise}
- Math Comfort: {math_comfort}
- Detail Level: {detail_level}

## Selected Text
"{selected_text}"

## Surrounding Context
{surrounding_context}

## Retrieved Context
{retrieved_chunks_text}

## Action: SIMPLIFY

Simplify the following text for easier understanding. Use simpler vocabulary and shorter sentences. Break down complex concepts into digestible parts.

If the learner prefers no equations (math_comfort = "No equations"), replace any mathematical notation with plain English explanations.

## Instructions
1. Apply the simplification to the selected text
2. Maintain accuracy - cite chunk IDs for any claims
3. Match the learner's profile preferences
4. Return valid JSON:

```json
{
  "transformed_text": "string",
  "citations": [
    {"chunk_id": "string", "page": number}
  ]
}
```

Generate the transformation:
