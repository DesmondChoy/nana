# Playwright MCP Testing Guide

This document provides a systematic checklist for visually testing and inspecting the NANA app using Playwright MCP.

---

## Instructions for LLM Agents

**IMPORTANT**: If you are an LLM (Large Language Model) reading this document, you MUST follow these instructions:

1. **Use the Checklist System**: This document contains structured checklists that you must work through systematically. Do NOT skip items or test ad-hoc.

2. **Track Progress**: Use your task/todo management tools to track which checklist items have been completed. Mark items as you complete them.

3. **Sequential Testing**: Work through the phases in order (Phase 1 → Phase 2 → Phase 3 → etc.). Within each phase, complete all checklist items before moving to the next phase.

4. **Document Everything**: For each checklist item:
   - Take a `browser_snapshot` or `browser_take_screenshot` as evidence
   - Note whether the item passed or failed
   - If failed, stop and follow the Bug Handling Workflow below

5. **Report Format**: When reporting results, use this format:
   ```
   ✅ [Item description] - PASSED
   ❌ [Item description] - FAILED: [brief description of issue]
   ```

6. **Per-Page Testing**: For Phase 2, you must test at least 3-5 pages including the first page, a middle page, and the last page. Use the checklist template for EACH page tested.

---

## Prerequisites

1. Start the development servers:
   ```bash
   ./dev.sh
   ```

2. Ensure Playwright MCP is configured in Claude Code

3. **Test PDFs are located in `materials/` folder:**
   - `S-PRMLS Day1a.pdf` - 21 pages, covers foundational ML concepts
   - `S-PRMLS Day4b.pdf` - 10 pages, covers Transformers (smaller, faster for testing)

---

## Bug Handling Workflow

**IMPORTANT FOR LLM AGENTS**: When any bug or visual error is detected during testing, you MUST follow this workflow exactly. Do NOT continue testing until the bug is fixed and verified.

1. **STOP testing immediately** - Do not continue to the next checklist item
2. **Document the bug** - Note the page number, steps to reproduce, and expected vs actual behavior
3. **Fix the bug** - Make the necessary code changes
4. **Restart the servers**:
   ```bash
   # Kill existing servers
   pkill -f "uvicorn"; pkill -f "vite"

   # Restart
   ./dev.sh
   ```
5. **Verify the fix with Playwright MCP**:
   - Navigate back to the same page/state where the bug occurred
   - Confirm the bug is resolved
   - Take a screenshot or snapshot as evidence
6. **Resume testing** from where you left off

This ensures bugs are caught and fixed immediately rather than accumulating a backlog of issues.

---

## Getting Started with Playwright MCP

### Navigation Commands
```
# Navigate to the app
mcp__playwright__browser_navigate → url: "http://localhost:5173"

# Take a snapshot (preferred over screenshot for accessibility)
mcp__playwright__browser_snapshot

# Take a screenshot for visual inspection
mcp__playwright__browser_take_screenshot

# Click an element (use ref from snapshot)
mcp__playwright__browser_click → element: "description", ref: "e123"

# Run custom JavaScript for complex interactions
mcp__playwright__browser_run_code → code: "async (page) => { ... }"
```

### Useful Patterns
```javascript
// Select text programmatically
await page.evaluate(() => {
  const element = document.querySelector('selector');
  const range = document.createRange();
  range.selectNodeContents(element);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
});

// Check for element visibility
await page.locator('text=Some Text').isVisible();

// Wait for element
await page.waitForSelector('selector');
```

---

## Testing Workflow

### Phase 1: Upload Page Testing

#### Initial Load
- [ ] Page loads without console errors
- [ ] "NANA" heading is visible
- [ ] All 4 profile dropdowns render correctly
- [ ] Upload area is visible and interactive

#### Profile Selection
- [ ] Each dropdown has correct options
- [ ] Selections persist (stored in localStorage)
- [ ] "Start Learning" button is disabled until PDF is uploaded

#### PDF Upload
- [ ] Drag-and-drop area responds to hover
- [ ] File picker opens on click
- [ ] Uploaded file name and size display correctly
- [ ] "Start Learning" button enables after upload
- [ ] Processing indicator shows during PDF parsing

---

### Phase 2: Study Page - Per-Page Checklist

**Repeat this checklist for each page of generated notes (sample at least 3-5 pages including first, middle, and last):**

#### Page: ___ of ___

##### Layout & Navigation
- [ ] PDF viewer displays on the left pane
- [ ] Notes panel displays on the right pane
- [ ] Current page number matches between PDF and notes
- [ ] Page thumbnail buttons (1, 2, 3...) are clickable and highlight current page
- [ ] "Previous" button works (disabled on page 1)
- [ ] "Next" button works (disabled on last page)
- [ ] Keyboard navigation works (Arrow Left/Right)

##### PDF Viewer
- [ ] PDF page renders clearly
- [ ] Zoom controls (+/-) work correctly
- [ ] Zoom percentage displays accurately
- [ ] PDF content is readable at default zoom

##### Notes Panel - Content Quality
- [ ] Notes title shows "Notes for Page X"
- [ ] AI-generated content corresponds to PDF content on that page
- [ ] No hallucinated information (content not in PDF)
- [ ] Appropriate level of detail for user profile settings
- [ ] Topic labels at bottom are relevant to page content
- [ ] Page references are accurate

##### Notes Panel - Scrolling
- [ ] Notes panel scrolls independently of PDF viewer
- [ ] Scroll position resets when navigating to new page
- [ ] Long notes are fully accessible via scroll
- [ ] Scroll works with mouse wheel
- [ ] Scroll works with trackpad gestures

##### Markdown Formatting
- [ ] **Headers** (H1, H2, H3) render with correct hierarchy and styling
- [ ] **Bold text** renders correctly
- [ ] *Italic text* renders correctly
- [ ] `Inline code` renders with background highlighting
- [ ] Code blocks render with syntax highlighting (if applicable)
- [ ] Bullet lists render with proper indentation
- [ ] Numbered lists render with proper sequence
- [ ] Tables render with borders and proper alignment
- [ ] Links are clickable and styled

##### Callout Blocks (Obsidian-style)
- [ ] Callouts render with colored left border
- [ ] Callout icons display correctly (📋, 💡, ⚠️, ℹ️, etc.)
- [ ] Callout titles are bold and properly colored
- [ ] Callout content is readable
- [ ] Different callout types have distinct colors:
  - [ ] Abstract (purple)
  - [ ] Note/Info (blue)
  - [ ] Tip (green)
  - [ ] Warning (orange)
  - [ ] Danger/Bug (red)
  - [ ] Example (slate)
  - [ ] Question (yellow)

##### Mathematical Notation (KaTeX)
- [ ] Inline math ($...$) renders correctly
- [ ] Display math ($$...$$) renders correctly and centered
- [ ] Greek letters render (θ, α, β, etc.)
- [ ] Fractions render correctly
- [ ] Subscripts and superscripts render
- [ ] Summation/integral symbols render
- [ ] No raw LaTeX code visible (e.g., `\theta` should show θ)
- [ ] Math inside callouts renders without duplication

##### Text Selection & Toolbar
- [ ] Hint text about selection is visible
- [ ] Click-and-drag selects text
- [ ] Selection toolbar appears near selected text
- [ ] All 3 buttons visible: Elaborate, Simplify, Analogy
- [ ] Toolbar positioned correctly (above or below selection)
- [ ] Toolbar doesn't overflow container bounds

##### Inline Commands (if testing)
- [ ] Clicking command button shows loading spinner
- [ ] API call completes without error
- [ ] Expansion block appears below notes
- [ ] Expansion shows correct command type icon/label
- [ ] Expansion content is relevant to selected text
- [ ] "Remove expansion" button works
- [ ] Multiple expansions can coexist

---

### Phase 3: Cross-Page Functionality

#### Page Navigation Consistency
- [ ] Switching pages updates both PDF and notes
- [ ] Notes cache works (revisiting a page shows cached notes instantly)
- [ ] Failed pages show retry button
- [ ] Progress indicator accurate during initial generation

#### Persistence (localStorage)
- [ ] Refresh browser → notes cache preserved
- [ ] Refresh browser → current page preserved
- [ ] Refresh browser → user profile preserved
- [ ] Refresh browser → expansions preserved
- [ ] "Clear cache" on upload page works

#### Expansion Persistence
- [ ] Navigate away from page with expansion
- [ ] Navigate back → expansion still visible
- [ ] Refresh browser → expansion still visible

---

### Phase 4: Error Handling

- [ ] Invalid PDF upload shows error message
- [ ] Network error during notes generation shows retry option
- [ ] API timeout handled gracefully
- [ ] Console shows no unhandled promise rejections

---

### Phase 5: Performance

- [ ] Initial page load < 3 seconds
- [ ] Page navigation feels instant (cached notes)
- [ ] No visible lag when scrolling notes
- [ ] No memory leaks (check browser dev tools after extended use)

---

## Quick Smoke Test Checklist

For rapid testing, verify these critical paths:

1. [ ] App loads at localhost:5173
2. [ ] Can upload PDF and reach study page
3. [ ] Notes generate for page 1
4. [ ] Can navigate to page 2 and back
5. [ ] Can select text and see toolbar
6. [ ] Can execute one inline command successfully
7. [ ] Notes scroll and display markdown correctly
8. [ ] No console errors throughout

---

## Reporting Issues

When documenting bugs, include:
1. **Page number** where issue occurred
2. **Steps to reproduce**
3. **Expected behavior**
4. **Actual behavior**
5. **Screenshot or snapshot** (use `mcp__playwright__browser_take_screenshot`)
6. **Console messages** (use `mcp__playwright__browser_console_messages`)

---

## Notes

- Playwright's mouse simulation may not perfectly replicate human interaction for text selection
- Use `browser_run_code` for complex JavaScript interactions
- Always take a `browser_snapshot` before clicking to get accurate element refs
- The `browser_snapshot` tool is preferred over screenshots for accessibility testing

---

## Checklist Summary for LLM Agents

When instructed to perform Playwright testing, follow this workflow:

```
1. Start dev servers (./dev.sh)
2. Navigate to http://localhost:5173
3. Work through phases sequentially:

   PHASE 1: Upload Page Testing
   └── Initial Load (4 items)
   └── Profile Selection (3 items)
   └── PDF Upload (5 items)

   PHASE 2: Study Page - Per-Page Testing (repeat for 3-5 pages)
   └── Layout & Navigation (7 items)
   └── PDF Viewer (4 items)
   └── Notes Panel - Content Quality (6 items)
   └── Notes Panel - Scrolling (5 items)
   └── Markdown Formatting (9 items)
   └── Callout Blocks (8 items)
   └── Mathematical Notation (8 items)
   └── Text Selection & Toolbar (6 items)
   └── Inline Commands (7 items)

   PHASE 3: Cross-Page Functionality
   └── Page Navigation Consistency (4 items)
   └── Persistence (5 items)
   └── Expansion Persistence (3 items)

   PHASE 4: Error Handling (4 items)

   PHASE 5: Performance (4 items)

4. For each item: test → document result (✅/❌) → if failed, STOP and fix
5. Provide final summary report with all results
```

**Total checklist items**: ~90 items (varies based on pages tested)

**Minimum testing time estimate**: Allow for iterative testing as bugs may require fixes and re-verification.
