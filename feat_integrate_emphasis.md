# Feature Specification: Emphasis Integration

**Issue:** #4 - Integrating Personal Notes with AI-Generated Notes

**Status:** Approved for Implementation

---

## Overview

Users often encounter important points during lectures, presentations, or professional study sessions that aren't in the source material but need to be integrated into their notes. While users can manually edit notes, this feature enables AI-assisted reorganization where user emphasis is naturally woven into the existing AI-generated content with clear visual distinction.

---

## User Problem

**Current Limitation:**
- AI-generated notes are based solely on PDF content
- During lectures/presentations, important verbal insights arise that aren't in slides
- Manually editing notes is tedious and doesn't reorganize content naturally
- Need: Add key points and have AI reorganize for smooth flow

**User Workflow:**
1. AI generates notes from PDF page
2. User attends lecture/presentation on that material
3. Professor/presenter emphasizes key points not in slides
4. User wants to add these points and have them integrated naturally

---

## Solution: "Emphasis" Feature

### Core Functionality

**Add Button:** "Emphasis" button next to existing "Edit" button in NotesPanel toolbar

**Interaction Flow:**
1. User clicks "Emphasis" → Expandable box appears above notes content
2. User types key points/insights into textarea
3. User can close box (content preserved) or click "Integrate"
4. On "Integrate": Backend reorganizes notes with emphasis woven in
5. Box closes, content clears, integrated notes display with visual distinction

---

## UX Specifications

### 1. Emphasis Box Placement
**Choice:** Inline expandable (above notes content, below toolbar)

**Rationale:**
- Stays in context (no modal interruption)
- Works on mobile and desktop
- Can see notes while typing if needed

### 2. Draft Persistence
**Choice:** Persist per-page in pdfStore

**Behavior:**
- Draft saved per page number
- Survives page navigation (e.g., Page 5 → Page 6 → back to Page 5)
- Cleared only when:
  - User clicks "Integrate" (successful)
  - User manually deletes content
  - User leaves study session
- Draft included in "Export Notes" as separate section (not integrated)

**Storage:**
```typescript
// In pdfStore.ts
emphasisDrafts: Record<number, string>
```

### 3. Multiple Integrations
**Behavior:** Each "Integrate" action re-reorganizes the entire notes

**Scenario:**
- Initial: AI notes generated
- Action 1: User adds emphasis → Integrates → Notes reorganized with first emphasis
- Action 2: User adds more emphasis later → Integrates → Notes re-reorganized with both emphases

**Implication:** Backend must handle cumulative integrations without duplication

### 4. Visual Distinction
**Choice:** Use distinct callout blocks

**Format:**
```markdown
## Section Title

[AI-generated content...]

> [!emphasis] Key Point
> User's emphasis content woven in naturally

[AI-generated content continues...]
```

**Alternatives Considered:**
- `[!emphasis]` - Clear label
- `[!important]` - Also clear, more universal

**Styling:** Distinct color (e.g., yellow/orange) vs AI callouts (blue/purple)

### 5. Integration Scope
**Choice:** Integrate Emphasis ONLY (not Elaborate/Simplify expansions)

**Rationale:**
- **Emphasis** = Permanent core additions to main notes
- **Elaborate/Simplify** = Optional deep-dives for exploration
- Integrating expansions would defeat their purpose (drill-down details)
- Users may want to keep expansions collapsible/removable

---

## UI Components

### NotesPanel Header (Updated)

**Current:**
```
┌──────────────────────────────────────────┐
│ Notes for Page 5                  [Edit] │
└──────────────────────────────────────────┘
```

**New:**
```
┌──────────────────────────────────────────┐
│ Notes for Page 5        [Emphasis] [Edit]│
└──────────────────────────────────────────┘
```

### Emphasis Box (Collapsed State)
Default state - button available, box not visible

### Emphasis Box (Expanded State)
```
┌──────────────────────────────────────────┐
│ Notes for Page 5        [Emphasis▼] [Edit]│
├──────────────────────────────────────────┤
│ 💡 Select any text to elaborate...       │
│                                           │
│ ┌────────────────────────────────────┐   │
│ │ ✨ Add Emphasis                    │   │
│ │ ┌────────────────────────────────┐ │   │
│ │ │ Type key points to highlight   │ │   │
│ │ │ or integrate with notes...     │ │   │
│ │ │                                │ │   │
│ │ └────────────────────────────────┘ │   │
│ │                                    │   │
│ │              [Close] [Integrate]   │   │
│ └────────────────────────────────────┘   │
│                                           │
│ [AI-generated notes display below...]    │
└──────────────────────────────────────────┘
```

### Integration Loading State
```
┌──────────────────────────────────────────┐
│ ┌────────────────────────────────────┐   │
│ │ 🔄 Integrating emphasis...         │   │
│ │ [Spinner animation]                │   │
│ └────────────────────────────────────┘   │
└──────────────────────────────────────────┘
```

### Success State
- Box closes automatically
- Content cleared
- Brief toast notification: "✓ Emphasis integrated"
- Notes panel shows updated content with `[!emphasis]` callouts

### Error State
- Box remains open
- Content preserved (not cleared)
- Error message displayed
- User can retry or close

---

## Technical Implementation

### Frontend Changes

#### 1. Update NotesPanel.tsx

**New Props:**
```typescript
interface NotesPanelProps {
  // ... existing props
  onIntegrateEmphasis?: (emphasisContent: string) => Promise<void>;
}
```

**New State:**
```typescript
const [emphasisBoxOpen, setEmphasisBoxOpen] = useState(false);
const [emphasisContent, setEmphasisContent] = useState('');
const [isIntegrating, setIsIntegrating] = useState(false);
```

**New Handlers:**
```typescript
const handleToggleEmphasis = () => {
  setEmphasisBoxOpen(!emphasisBoxOpen);
  // Load draft from store if exists
};

const handleCloseEmphasis = () => {
  setEmphasisBoxOpen(false);
  // Preserve content - don't clear
};

const handleIntegrate = async () => {
  if (!emphasisContent.trim() || !notes || !onIntegrateEmphasis) return;

  setIsIntegrating(true);
  try {
    await onIntegrateEmphasis(emphasisContent);
    setEmphasisContent(''); // Clear after success
    setEmphasisBoxOpen(false);
  } catch (error) {
    console.error('Failed to integrate emphasis:', error);
    // Keep box open, content preserved
  } finally {
    setIsIntegrating(false);
  }
};
```

#### 2. Update pdfStore.ts

**New State:**
```typescript
interface PDFState {
  // ... existing state
  emphasisDrafts: Record<number, string>; // pageNumber -> draft content

  // ... existing actions
  setEmphasisDraft: (pageNumber: number, content: string) => void;
  getEmphasisDraft: (pageNumber: number) => string;
  clearEmphasisDraft: (pageNumber: number) => void;
}
```

**Persistence:**
```typescript
partialize: (state) => ({
  // ... existing persisted fields
  emphasisDrafts: state.emphasisDrafts,
}),
```

#### 3. Add API Client Function (frontend/src/api/client.ts)

```typescript
export async function integrateEmphasis(params: {
  pageNumber: number;
  existingNotes: string;
  emphasisContent: string;
  pageContent: PageContent;
  userProfile: UserProfile;
  sessionId?: string;
}): Promise<NotesResponse> {
  const response = await fetch(`${API_BASE_URL}/integrate-emphasis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    throw new Error(`Integration failed: ${response.statusText}`);
  }

  return response.json();
}
```

#### 4. Wire Up in StudyPage.tsx

```typescript
const handleIntegrateEmphasis = async (emphasisContent: string) => {
  const currentNotes = pdfStore.getNotesForPage(currentPage);
  if (!currentNotes || !parsedPDF) return;

  const response = await integrateEmphasis({
    pageNumber: currentPage,
    existingNotes: currentNotes.notes.markdown,
    emphasisContent,
    pageContent: parsedPDF.pages[currentPage - 1],
    userProfile: userStore.profile,
    sessionId: parsedPDF.session_id,
  });

  // Update notes in store
  pdfStore.cacheNotes(currentPage, response);

  // Clear emphasis draft
  pdfStore.clearEmphasisDraft(currentPage);
};
```

### Backend Changes

#### 1. Add Schema (backend/app/schemas.py)

```python
class IntegrateEmphasisRequest(BaseModel):
    """Request payload for integrating user emphasis into existing notes."""
    page_number: int
    existing_notes: str = Field(..., description="Current AI-generated markdown")
    emphasis_content: str = Field(..., description="User's emphasis to integrate")
    page_content: PageContent = Field(..., description="Page context for relevance")
    user_profile: UserProfile
    session_id: Optional[str] = None

# Response uses existing NotesResponse model
```

#### 2. Add Endpoint (backend/app/routers/notes.py)

```python
@router.post("/integrate-emphasis", response_model=NotesResponse)
async def integrate_emphasis(
    request: IntegrateEmphasisRequest,
    settings: Settings = Depends(get_settings),
    client: genai.Client = Depends(get_gemini_client),
) -> NotesResponse:
    """
    Integrate user's emphasis into existing AI-generated notes.

    Takes current notes + user emphasis, reorganizes content to naturally
    weave in the emphasis with clear visual distinction ([!emphasis] callouts).
    """
    try:
        prompt_template = load_prompt_template("integrate_emphasis.md")
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Fill prompt
    filled_prompt = prompt_template.format(
        prior_expertise=request.user_profile.prior_expertise,
        math_comfort=request.user_profile.math_comfort,
        detail_level=request.user_profile.detail_level,
        primary_goal=request.user_profile.primary_goal,
        existing_notes=request.existing_notes,
        emphasis_content=request.emphasis_content,
        page_number=request.page_content.page_number,
        page_text=request.page_content.text,
    )

    debug_logger = DebugLogger()
    start_time = time.time()

    try:
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=filled_prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=NotesResponse,
                temperature=0.2,
            ),
        )

        debug_logger.log_interaction(
            name="integrate_emphasis",
            prompt=filled_prompt,
            response=response,
            start_time=start_time,
            end_time=time.time(),
            session_id=request.session_id,
        )
    except Exception as e:
        end_time = time.time()
        debug_logger.log_interaction(
            name="integrate_emphasis",
            prompt=filled_prompt,
            response=None,
            start_time=start_time,
            end_time=end_time,
            error=str(e),
            session_id=request.session_id,
        )
        raise HTTPException(status_code=500, detail=f"Gemini API error: {e}")

    parsed = response.parsed
    if not isinstance(parsed, NotesResponse):
        raise HTTPException(
            status_code=500,
            detail="Gemini response did not match expected schema"
        )

    return parsed
```

#### 3. Create Prompt Template (backend/prompts/integrate_emphasis.md)

```markdown
You are helping integrate user emphasis into AI-generated study notes.

## User Profile
- Prior Expertise: {prior_expertise}
- Math Comfort: {math_comfort}
- Detail Level: {detail_level}
- Primary Goal: {primary_goal}

## Current Notes (AI-generated)
{existing_notes}

## User's Emphasis to Integrate
{emphasis_content}

## Page Content (for context)
Page {page_number}:
{page_text}

---

## Task

Reorganize the notes to naturally incorporate the user's emphasis. The emphasis represents key points from a lecture, presentation, or professional context that weren't in the original material but are crucial for understanding.

### Requirements

1. **Determine optimal placement**: Find the most relevant section(s) to insert the emphasis based on semantic relevance

2. **Wrap in callout block**: Format emphasis using Obsidian-style callout:
   ```markdown
   > [!emphasis] Key Point
   > [User's emphasis content, potentially reworded for clarity]
   ```

3. **Natural integration**:
   - Adjust surrounding text for smooth transitions
   - Add connecting phrases if needed (e.g., "This relates to...", "Importantly, ...")
   - Ensure the emphasis feels like part of the narrative, not an afterthought

4. **Preserve original content**:
   - Keep ALL AI-generated content intact
   - Don't remove or significantly alter existing explanations
   - Maintain existing callout blocks ([!important], [!tip], etc.)

5. **Maintain structure**:
   - Keep the same heading hierarchy
   - Preserve logical flow and organization
   - Keep topic_labels and page_references unchanged

6. **Multiple emphasis handling**:
   - If notes already contain previous [!emphasis] callouts, preserve them
   - Add new emphasis in the appropriate location
   - Don't duplicate content

### Output Format

Return a JSON object with:
- `markdown`: Complete reorganized notes with emphasis integrated
- `topic_labels`: Same as original (unchanged)
- `page_references`: Same as original (unchanged)

### Style Guidelines

- Use clear, concise language matching the user's detail level
- Maintain the academic/professional tone of the original notes
- Ensure emphasis stands out visually but reads naturally in context
```

---

## Export Notes Behavior

When user exports notes to markdown file:

**Format:**
```markdown
# Page 5 Notes

[Integrated AI notes with [!emphasis] callouts...]

---

## Emphasis Draft (Not Yet Integrated)

[Any unsaved emphasis draft content...]

---

## Expansions

### Elaborate: "Selected text here"
[Elaboration content...]

### Simplify: "Selected text here"
[Simplification content...]
```

**Rationale:** Users can see what they've drafted but haven't integrated yet

---

## Edge Cases & Error Handling

### 1. Empty Emphasis Content
**Behavior:** "Integrate" button disabled if textarea is empty or only whitespace

### 2. Integration API Failure
**Behavior:**
- Show error toast with retry option
- Keep emphasis box open
- Preserve content for retry
- Don't clear draft from store

### 3. Navigating Away During Integration
**Behavior:**
- Request continues in background
- On return to page, show loading state or result
- Handle with proper async state management

### 4. Multiple Rapid Integrations
**Behavior:**
- Disable "Integrate" button while request in flight
- Queue not needed (one integration at a time per page)

### 5. Emphasis Draft Conflicts
**Scenario:** User has draft on Page 5, leaves session, returns, PDF re-uploaded
**Behavior:**
- If same PDF (by filename/hash): Preserve draft
- If different PDF: Clear all drafts (new study session)

### 6. Very Long Emphasis Content
**Behavior:**
- No hard limit on frontend
- Backend might fail if context exceeds token limit
- Show appropriate error message to user

---

## Testing Checklist

### Manual Testing
- [ ] Emphasis button appears next to Edit button
- [ ] Click opens expandable box above notes
- [ ] Textarea accepts input and preserves it
- [ ] Close button keeps content (doesn't clear)
- [ ] Integrate button disabled when empty
- [ ] Integration shows loading state
- [ ] Integrated notes display with [!emphasis] callouts
- [ ] Draft persists when navigating between pages
- [ ] Draft clears after successful integration
- [ ] Draft preserved on integration failure
- [ ] Export includes unintegrated drafts
- [ ] Mobile responsive design works

### Backend Testing
- [ ] POST /integrate-emphasis returns NotesResponse
- [ ] Emphasis woven in appropriate locations
- [ ] [!emphasis] callout format correct
- [ ] Original content fully preserved
- [ ] Multiple integrations don't duplicate
- [ ] Debug logs created properly
- [ ] Error handling works for API failures

### E2E Testing (Playwright)
- [ ] Full workflow: Upload → Generate notes → Add emphasis → Integrate
- [ ] Draft persistence across page navigation
- [ ] Error recovery flow
- [ ] Export includes draft section

---

## Future Enhancements (Out of Scope)

1. **Batch Integration**: Integrate multiple pages' emphasis at once
2. **Emphasis History**: Undo/redo for integrations
3. **Smart Suggestions**: AI suggests where emphasis should go before integrating
4. **Voice Input**: Dictate emphasis during live lectures
5. **Collaborative Emphasis**: Share emphasis with classmates/colleagues
6. **Emphasis Categories**: Tag emphasis by type (definition, example, warning, etc.)

---

## Success Metrics

**User Engagement:**
- % of users who use Emphasis feature vs Edit feature
- Average emphasis integrations per study session
- Draft save rate (how often users save drafts without integrating)

**Quality:**
- User feedback on integration quality
- Re-integration rate (users integrating multiple times per page)
- Emphasis content length distribution

---

## Implementation Timeline

**Phase 1: MVP (This Spec)**
- Core Emphasis feature with integration
- Draft persistence
- Export support

**Phase 2: Enhancements (Future)**
- Undo capability
- Better mobile UX
- Batch operations

---

**Document Version:** 1.0
**Last Updated:** 2026-01-11
**Status:** Ready for Implementation
