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

## Action: ANALOGY

Explain the following concept using an analogy tailored to the learner's background:

- For Software Engineering: use programming analogies (functions, classes, APIs, version control)
- For Data Science/ML: use data science analogies (models, pipelines, features, training)
- For Statistics: use statistical analogies (distributions, sampling, inference)
- For Domain Novice: use everyday real-world analogies

## Instructions
1. Create an analogy that explains the selected text
2. Maintain accuracy - cite chunk IDs for any claims
3. Match the learner's expertise domain
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
