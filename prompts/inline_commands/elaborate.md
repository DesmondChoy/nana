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

## Action: ELABORATE

Expand on the following text with more detail and examples. Make it comprehensive while matching the learner's profile. Add concrete examples relevant to their expertise domain.

## Instructions
1. Apply the elaboration to the selected text
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
