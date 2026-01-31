import { useEffect, useRef, useState } from 'react';
import type { InlineCommandType } from '../types';

interface SelectionToolbarProps {
  selectionRect: DOMRect;
  containerRef: React.RefObject<HTMLElement | null>;
  onCommand: (command: InlineCommandType) => void;
  isLoading?: boolean;
  loadingCommand?: InlineCommandType | null;
  visible?: boolean;
  onCancel?: () => void;
}

const LOADING_MESSAGES: Record<InlineCommandType, string> = {
  elaborate: 'Elaborating...',
  simplify: 'Simplifying...',
  analogy: 'Creating analogy...',
};

const COMMANDS: { type: InlineCommandType; icon: string; label: string }[] = [
  { type: 'elaborate', icon: '📝', label: 'Elaborate' },
  { type: 'simplify', icon: '✨', label: 'Simplify' },
  { type: 'analogy', icon: '🔗', label: 'Analogy' },
];

export default function SelectionToolbar({
  selectionRect,
  containerRef,
  onCommand,
  isLoading = false,
  loadingCommand = null,
  visible = true,
  onCancel,
}: SelectionToolbarProps) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    // Skip positioning if toolbar is hidden or selection rect is invalid
    if (!visible || !toolbarRef.current || !containerRef.current) return;
    if (selectionRect.width === 0 && selectionRect.height === 0) return;

    const container = containerRef.current;
    const containerRect = container.getBoundingClientRect();
    const toolbarRect = toolbarRef.current.getBoundingClientRect();

    // Position toolbar above the selection, centered horizontally
    let left = selectionRect.left + selectionRect.width / 2 - toolbarRect.width / 2;
    let top = selectionRect.top - toolbarRect.height - 8; // 8px gap

    // Convert to position relative to container
    left = left - containerRect.left + container.scrollLeft;
    top = top - containerRect.top + container.scrollTop;

    // Keep toolbar within container bounds
    const maxLeft = container.scrollWidth - toolbarRect.width - 8;
    left = Math.max(8, Math.min(left, maxLeft));

    // If toolbar would go above container, position it below the selection
    if (top < container.scrollTop) {
      top =
        selectionRect.bottom -
        containerRect.top +
        container.scrollTop +
        8;
    }

    setPosition({ top, left });
  }, [selectionRect, containerRef, visible]);

  // Prevent mousedown on toolbar from clearing the text selection
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <div
      ref={toolbarRef}
      className={`absolute z-50 flex gap-1 bg-white dark:bg-gray-700 rounded-lg shadow-lg border border-gray-200 dark:border-gray-600 p-1 select-none ${
        visible ? 'animate-slide-down opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      style={{
        top: position.top,
        left: position.left,
      }}
      onMouseDown={handleMouseDown}
    >
      {isLoading && loadingCommand ? (
        <div className="flex items-center gap-3 px-4 py-2">
          <div className="relative flex items-center justify-center">
            <div className="absolute h-6 w-6 rounded-full bg-blue-400 dark:bg-blue-500 animate-ping opacity-50" />
            <div className="h-6 w-6 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse" />
          </div>
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300 animate-pulse">
            {LOADING_MESSAGES[loadingCommand]}
          </span>
          {onCancel && (
            <button
              onClick={onCancel}
              onMouseDown={handleMouseDown}
              className="ml-1 p-1.5 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200
                         hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
              title="Cancel"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      ) : (
        COMMANDS.map(({ type, icon, label }) => (
          <button
            key={type}
            onClick={() => onCommand(type)}
            onMouseDown={handleMouseDown}
            tabIndex={-1}
            className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium
                       transition-all duration-150
                       bg-gray-50 dark:bg-gray-600 text-gray-700 dark:text-gray-200
                       hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:text-blue-700 dark:hover:text-blue-300
                       active:scale-95
                       min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0"
            title={label}
          >
            <span className="text-base">{icon}</span>
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))
      )}
    </div>
  );
}
