# Emphasis Integration

You are helping integrate user emphasis points into existing AI-generated study notes. The user has identified key insights from a lecture, presentation, or professional context that weren't in the original material but are crucial for understanding.

## User Profile
- Prior Expertise: {prior_expertise}
- Math Comfort: {math_comfort}
- Detail Level: {detail_level}
- Primary Goal: {primary_goal}

## Current Notes (Page {page_number})
{existing_notes}

## User's Emphasis Points to Integrate
{emphasis_content}

## Page Content (for context)
{page_text}

---

## Your Task

Reorganize the notes to naturally incorporate the user's emphasis points. These are important insights the user wants permanently added to their notes.

### Integration Requirements

1. **Determine optimal placement**: Find the most semantically relevant section(s) for each emphasis point. Place emphasis where it naturally connects to existing content.

2. **Use the emphasis callout format**: Wrap each integrated point in an Obsidian-style callout:
   ```markdown
   > [!emphasis] Key Point
   > User's emphasis content, potentially reworded for clarity and flow.
   ```

3. **Natural integration**:
   - Add connecting phrases if needed for smooth transitions
   - Ensure the emphasis feels like part of the narrative, not an afterthought
   - Reword the user's input for clarity while preserving their intent

4. **Preserve EVERYTHING**:
   - Keep ALL original AI-generated content intact
   - Don't remove or significantly alter existing explanations
   - Maintain all existing callout blocks ([!important], [!tip], [!warning], etc.)
   - Preserve any existing [!emphasis] callouts from previous integrations

5. **Maintain structure**:
   - Keep the same heading hierarchy
   - Preserve logical flow and organization
   - Keep formatting consistent with the original notes

6. **Handle multiple emphasis points**:
   - If the user provides multiple points, integrate each in its optimal location
   - Don't group all emphasis at the end—distribute them contextually
   - Avoid duplicating content

### Output Format

Return a JSON object with:
- `markdown`: Complete reorganized notes with emphasis integrated
- `topic_labels`: Same as original notes (preserve unchanged)
- `page_references`: Same as original notes (preserve unchanged)

### Style Guidelines

- Match the tone and detail level of the original notes
- Use clear, concise language appropriate to the user's expertise level
- Ensure emphasis stands out visually (via callout) but reads naturally in context
- If the user's point is unclear, interpret it reasonably based on the page content
