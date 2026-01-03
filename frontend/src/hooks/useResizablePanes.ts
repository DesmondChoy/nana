import { useState, useCallback, useEffect, useRef } from 'react';

const STORAGE_KEY = 'nana-pane-split';
const DEFAULT_WIDTH = 50;
const MIN_WIDTH = 25;
const MAX_WIDTH = 75;

interface UseResizablePanesOptions {
  defaultWidth?: number;
  minWidth?: number;
  maxWidth?: number;
  storageKey?: string;
}

interface UseResizablePanesReturn {
  leftWidthPercent: number;
  isDragging: boolean;
  handleMouseDown: (e: React.MouseEvent) => void;
  handleDoubleClick: () => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function useResizablePanes(
  options: UseResizablePanesOptions = {}
): UseResizablePanesReturn {
  const {
    defaultWidth = DEFAULT_WIDTH,
    minWidth = MIN_WIDTH,
    maxWidth = MAX_WIDTH,
    storageKey = STORAGE_KEY,
  } = options;

  // Initialize from localStorage or default
  const [leftWidthPercent, setLeftWidthPercent] = useState<number>(() => {
    if (typeof window === 'undefined') return defaultWidth;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed >= minWidth && parsed <= maxWidth) {
        return parsed;
      }
    }
    return defaultWidth;
  });

  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Persist to localStorage when width changes
  useEffect(() => {
    localStorage.setItem(storageKey, leftWidthPercent.toString());
  }, [leftWidthPercent, storageKey]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDoubleClick = useCallback(() => {
    setLeftWidthPercent(defaultWidth);
  }, [defaultWidth]);

  // Handle mouse move and mouse up globally
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const mouseX = e.clientX - containerRect.left;

      // Calculate percentage
      let newPercent = (mouseX / containerWidth) * 100;

      // Clamp to bounds
      newPercent = Math.max(minWidth, Math.min(maxWidth, newPercent));

      setLeftWidthPercent(newPercent);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    // Add listeners with passive: false to prevent scrolling during drag
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, minWidth, maxWidth]);

  return {
    leftWidthPercent,
    isDragging,
    handleMouseDown,
    handleDoubleClick,
    containerRef,
  };
}
