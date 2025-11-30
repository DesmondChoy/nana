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

## Action: DIAGRAM

Describe how to create a diagram that explains this concept. Include:
- Diagram type (flowchart, sequence, architecture, entity-relationship, etc.)
- Key components/nodes to include
- Relationships/arrows between components
- Any labels or annotations needed

Format as step-by-step instructions for creating the diagram.

## Instructions
1. Describe a diagram that visualizes the selected text
2. Maintain accuracy - cite chunk IDs for any claims
3. Be specific about components and relationships
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
