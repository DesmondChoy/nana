import { useEffect, useRef, useState } from 'react';
import type { InlineCommandType } from '../types';

interface SelectionToolbarProps {
  selectionRect: DOMRect;
  containerRef: React.RefObject<HTMLElement | null>;
  onCommand: (command: InlineCommandType) => void;
  isLoading?: boolean;
  visible?: boolean;
}

const COMMANDS: { type: InlineCommandType; icon: string; label: string }[] = [
  { type: 'elaborate', icon: '📝', label: 'Elaborate' },
  { type: 'simplify', icon: '✨', label: 'Simplify' },
  { type: 'analogy', icon: '🔗', label: 'Analogy' },
  { type: 'diagram', icon: '📊', label: 'Diagram' },
];

export default function SelectionToolbar({
  selectionRect,
  containerRef,
  onCommand,
  isLoading = false,
  visible = true,
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
      className={`absolute z-50 flex gap-1 bg-white rounded-lg shadow-lg border border-gray-200 p-1 select-none transition-opacity duration-100 ${
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      style={{
        top: position.top,
        left: position.left,
      }}
      onMouseDown={handleMouseDown}
    >
      {COMMANDS.map(({ type, icon, label }) => (
        <button
          key={type}
          onClick={() => onCommand(type)}
          onMouseDown={handleMouseDown}
          disabled={isLoading}
          tabIndex={-1}
          className={`
            flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium
            transition-colors duration-150
            ${
              isLoading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-gray-50 text-gray-700 hover:bg-blue-100 hover:text-blue-700'
            }
          `}
          title={label}
        >
          <span>{icon}</span>
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
      {isLoading && (
        <div className="flex items-center px-2">
          <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
        </div>
      )}
    </div>
  );
}
