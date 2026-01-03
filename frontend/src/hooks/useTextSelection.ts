import { useState, useEffect, useCallback, type RefObject } from 'react';

export interface TextSelection {
  text: string;
  rect: DOMRect;
}

/**
 * Hook to detect text selection within a container element.
 * Returns the selected text and its bounding rectangle for positioning a toolbar.
 */
export function useTextSelection(
  containerRef: RefObject<HTMLElement | null>
): TextSelection | null {
  const [selection, setSelection] = useState<TextSelection | null>(null);

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

    setSelection({
      text: selectedText,
      rect,
    });
  }, [containerRef]);

  useEffect(() => {
    // Handle mouseup - this is when a selection is finalized after click-and-drag
    // Use setTimeout to let the browser finalize the selection before we read it
    const handleMouseUp = () => {
      setTimeout(() => {
        handleSelectionChange();
      }, 0);
    };

    // Handle selectionchange - this fires when:
    // 1. User makes a keyboard selection (Shift+arrows)
    // 2. Selection is cleared (collapsed)
    // 3. During mouse drag (intermediate events - we ignore these)
    const handleSelectionChangeEvent = () => {
      const windowSelection = window.getSelection();

      // If selection is collapsed (cleared), update state to hide toolbar
      if (!windowSelection || windowSelection.isCollapsed) {
        setSelection(null);
        return;
      }

      // For non-collapsed selections, only process on mouseup (not during drag)
      // The mouseup handler will call handleSelectionChange with the final selection
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('selectionchange', handleSelectionChangeEvent);

    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('selectionchange', handleSelectionChangeEvent);
    };
  }, [handleSelectionChange]);

  // Return selection with a clear method
  return selection;
}

/**
 * Hook to clear selection programmatically.
 */
export function useClearSelection() {
  return useCallback(() => {
    window.getSelection()?.removeAllRanges();
  }, []);
}
