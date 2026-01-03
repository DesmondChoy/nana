You are transforming study notes into a visual diagram for a learner.

## Learner Profile
- Prior Expertise: {prior_expertise}
- Math Comfort: {math_comfort}
- Detail Level: {detail_level}

## Selected Text
"{selected_text}"

## Full Page Context (Page {page_number})
{page_text}

## Action: DIAGRAM

Generate a Mermaid.js diagram that visualizes the concept in the selected text.

### Mermaid Diagram Guidelines
1. Choose the most appropriate diagram type:
   - `flowchart TD` (top-down) or `flowchart LR` (left-right) for processes, workflows, decision trees
   - `sequenceDiagram` for interactions between entities over time
   - `classDiagram` for class structures and relationships
   - `stateDiagram-v2` for state machines and transitions
   - `erDiagram` for entity relationships
   - `mindmap` for hierarchical concept maps

2. Keep the diagram focused and readable:
   - Maximum 8-10 nodes for flowcharts
   - Use clear, concise labels
   - Group related items with subgraphs when helpful

3. Use proper Mermaid syntax:
   - Node IDs should be simple alphanumeric (no spaces or special characters)
   - Text labels go in brackets: `A[Label Text]` or `A(Rounded Label)`
   - Arrows: `-->` for directed, `---` for undirected, `-.->` for dotted

### Example Output Formats

For a flowchart:
```
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Action 1]
    B -->|No| D[Action 2]
    C --> E[End]
    D --> E
```

For a sequence diagram:
```
sequenceDiagram
    participant A as Client
    participant B as Server
    A->>B: Request
    B-->>A: Response
```

## Instructions
1. Analyze the selected text and determine the best diagram type
2. Create valid Mermaid.js syntax that visualizes the concept
3. Ensure all claims are grounded in the page context
4. Return ONLY the Mermaid diagram code in the content field (no markdown code fences)

Generate the Mermaid diagram:
