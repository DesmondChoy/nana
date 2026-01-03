interface ResizeDividerProps {
  onMouseDown: (e: React.MouseEvent) => void;
  onDoubleClick: () => void;
  isDragging: boolean;
}

export default function ResizeDivider({
  onMouseDown,
  onDoubleClick,
  isDragging,
}: ResizeDividerProps) {
  return (
    <div
      className={`
        relative w-1 flex-shrink-0 cursor-col-resize
        transition-colors duration-150
        ${isDragging
          ? 'bg-blue-500'
          : 'bg-gray-300 dark:bg-gray-700 hover:bg-blue-400 dark:hover:bg-blue-500'
        }
      `}
      onMouseDown={onMouseDown}
      onDoubleClick={onDoubleClick}
      title="Drag to resize panes. Double-click to reset."
    >
      {/* Wider hit area for easier grabbing */}
      <div className="absolute inset-y-0 -left-1 -right-1" />

      {/* Visual grip indicator in the center */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-1 opacity-50">
        <div className="w-1 h-1 rounded-full bg-gray-500 dark:bg-gray-400" />
        <div className="w-1 h-1 rounded-full bg-gray-500 dark:bg-gray-400" />
        <div className="w-1 h-1 rounded-full bg-gray-500 dark:bg-gray-400" />
      </div>
    </div>
  );
}
