import { useState, useEffect, useLayoutEffect, useCallback, useRef, type RefObject } from 'react';

export interface TextSelection {
  text: string;
  rect: DOMRect;
}

// Internal interface that includes data for selection restoration
interface SelectionState {
  text: string;
  rect: DOMRect;
  // Store character offsets for reconstruction after React re-render
  startOffset: number;
  endOffset: number;
}

/**
 * Get character offset of a point within a container element.
 * Walks through all text nodes and calculates cumulative offset.
 */
function getCharacterOffset(container: Node, targetNode: Node, targetOffset: number): number {
  let offset = 0;
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);

  let node = walker.nextNode();
  while (node) {
    if (node === targetNode) {
      return offset + targetOffset;
    }
    offset += node.textContent?.length || 0;
    node = walker.nextNode();
  }
  return offset;
}

/**
 * Find text node and offset for a character position within a container.
 */
function getNodeAndOffsetFromCharOffset(container: Node, charOffset: number): { node: Node; offset: number } | null {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
  let currentOffset = 0;

  let node = walker.nextNode();
  while (node) {
    const length = node.textContent?.length || 0;
    if (currentOffset + length >= charOffset) {
      return { node, offset: charOffset - currentOffset };
    }
    currentOffset += length;
    node = walker.nextNode();
  }
  return null;
}

/**
 * Hook to detect text selection within a container element.
 * Returns the selected text and its bounding rectangle for positioning a toolbar.
 *
 * Uses useLayoutEffect to restore the browser selection after React re-renders,
 * preventing the visual highlight from disappearing.
 */
export function useTextSelection(
  containerRef: RefObject<HTMLElement | null>
): TextSelection | null {
  const [selection, setSelection] = useState<SelectionState | null>(null);
  // Track if we need to restore selection after render
  const shouldRestoreRef = useRef(false);
  // Prevent selectionchange handler from clearing selection during restoration
  const isRestoringRef = useRef(false);

  const handleSelectionChange = useCallback(() => {
    const windowSelection = window.getSelection();

    // No selection or empty selection
    if (!windowSelection || windowSelection.isCollapsed) {
      setSelection(null);
      return;
    }

    const selectedText = windowSelection.toString().trim();
    if (!selectedText) {
      setSelection(null);
      return;
    }

    // Check if selection is within our container
    const container = containerRef.current;
    if (!container) {
      setSelection(null);
      return;
    }

    const range = windowSelection.getRangeAt(0);
    const commonAncestor = range.commonAncestorContainer;

    // Check if the selection is inside our container
    const isInContainer =
      container.contains(commonAncestor) ||
      (commonAncestor.nodeType === Node.TEXT_NODE &&
        container.contains(commonAncestor.parentNode));

    if (!isInContainer) {
      setSelection(null);
      return;
    }

    // Get the bounding rect of the selection
    const rect = range.getBoundingClientRect();

    // Calculate character offsets for reconstruction after React re-render
    // FIX: Use startOffset + text length instead of calculating endOffset from range.endContainer
    // This fixes the bug where triple-click would create incorrect offsets because
    // range.endContainer extends beyond the visible selection
    const startOffset = getCharacterOffset(container, range.startContainer, range.startOffset);
    const endOffset = startOffset + selectedText.length;

    // Mark that we need to restore the selection after render
    shouldRestoreRef.current = true;
    // Prevent selectionchange handler from clearing during state update and restoration
    isRestoringRef.current = true;

    setSelection({
      text: selectedText,
      rect,
      startOffset,
      endOffset,
    });
  }, [containerRef]);

  // Restore the selection after React's DOM updates but before browser paint
  // This prevents the visual highlight from disappearing during re-render
  useLayoutEffect(() => {
    if (selection && shouldRestoreRef.current) {
      shouldRestoreRef.current = false;

      const container = containerRef.current;
      const windowSelection = window.getSelection();

      if (container && windowSelection) {
        try {
          // Reconstruct the selection using character offsets
          // This works even after React replaces DOM nodes during re-render
          const startPoint = getNodeAndOffsetFromCharOffset(container, selection.startOffset);
          const endPoint = getNodeAndOffsetFromCharOffset(container, selection.endOffset);

          if (startPoint && endPoint) {
            // Prevent selectionchange handler from clearing during restoration
            isRestoringRef.current = true;

            const range = document.createRange();
            range.setStart(startPoint.node, startPoint.offset);
            range.setEnd(endPoint.node, endPoint.offset);

            windowSelection.removeAllRanges();
            windowSelection.addRange(range);

            // Use setTimeout to clear the flag after the selectionchange event fires
            setTimeout(() => {
              isRestoringRef.current = false;
            }, 0);
          } else {
            isRestoringRef.current = false;
          }
        } catch {
          // Selection restoration failed - let it clear naturally
          isRestoringRef.current = false;
        }
      }
    }
  }, [selection, containerRef]);

  useEffect(() => {
    // Handle mouseup - this is when a selection is finalized after click-and-drag
    // Use setTimeout to let the browser finalize the selection before we read it
    const handleMouseUp = () => {
      setTimeout(() => {
        handleSelectionChange();
      }, 0);
    };

    // Handle touchend - this is when a touch selection is finalized on mobile
    // On iOS/Android, the browser handles long-press to select natively.
    // When the user lifts their finger, we can read the selection.
    const handleTouchEnd = () => {
      // Use a longer timeout for touch as mobile browsers may need more time
      // to finalize the selection after the user lifts their finger
      setTimeout(() => {
        handleSelectionChange();
      }, 100);
    };

    // Handle selectionchange - this fires when:
    // 1. User makes a keyboard selection (Shift+arrows)
    // 2. Selection is cleared (collapsed)
    // 3. During mouse drag (intermediate events - we ignore these)
    // 4. When we restore selection in useLayoutEffect (ignore these)
    // 5. On mobile when selection handles are dragged (use this for live updates)
    const handleSelectionChangeEvent = () => {
      // Skip if we're in the middle of restoring the selection
      if (isRestoringRef.current) {
        return;
      }

      const windowSelection = window.getSelection();

      // If selection is collapsed (cleared), update state to hide toolbar
      if (!windowSelection || windowSelection.isCollapsed) {
        setSelection(null);
        return;
      }

      // On touch devices, selectionchange fires when user drags selection handles
      // We can use this to update the toolbar position in real-time
      // Check if we're on a touch device by detecting if touch events are supported
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      if (isTouchDevice) {
        // For touch devices, update selection on every selectionchange
        // This provides better UX as the toolbar follows the selection handles
        handleSelectionChange();
      }
      // For non-touch devices, only process on mouseup (not during drag)
      // The mouseup handler will call handleSelectionChange with the final selection
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('touchend', handleTouchEnd);
    document.addEventListener('selectionchange', handleSelectionChangeEvent);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('selectionchange', handleSelectionChangeEvent);
    };
  }, [handleSelectionChange]);

  // Return selection without the internal offset properties
  return selection ? { text: selection.text, rect: selection.rect } : null;
}

/**
 * Hook to clear selection programmatically.
 */
export function useClearSelection() {
  return useCallback(() => {
    window.getSelection()?.removeAllRanges();
  }, []);
}
