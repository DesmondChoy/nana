import { useState, useRef, useEffect, useCallback } from 'react';
import type { Expansion, InlineCommandType } from '../types';
import MarkdownRenderer from './MarkdownRenderer';

// Styling per command type with dark mode support
const EXPANSION_STYLES: Record<
  InlineCommandType,
  { bg: string; border: string; icon: string; label: string; textColor: string }
> = {
  elaborate: {
    bg: 'bg-blue-50 dark:bg-blue-900/30',
    border: 'border-blue-300 dark:border-blue-500',
    icon: '📝',
    label: 'Elaboration',
    textColor: 'text-blue-800 dark:text-blue-200',
  },
  simplify: {
    bg: 'bg-green-50 dark:bg-green-900/30',
    border: 'border-green-300 dark:border-green-500',
    icon: '✨',
    label: 'Simplified',
    textColor: 'text-green-800 dark:text-green-200',
  },
  analogy: {
    bg: 'bg-purple-50 dark:bg-purple-900/30',
    border: 'border-purple-300 dark:border-purple-500',
    icon: '🔗',
    label: 'Analogy',
    textColor: 'text-purple-800 dark:text-purple-200',
  },
};

interface ExpansionBlockProps {
  expansion: Expansion;
  isEditMode?: boolean;
  onRemove?: () => void;
  onUpdate?: (selectedText: string, content: string) => void;
}

export default function ExpansionBlock({
  expansion,
  isEditMode = false,
  onRemove,
  onUpdate,
}: ExpansionBlockProps) {
  const style = EXPANSION_STYLES[expansion.command_type];

  // Combine selected_text and content with separator for editing
  const combinedText = `${expansion.selected_text}\n---\n${expansion.content}`;
  const [editedText, setEditedText] = useState(combinedText);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Sync editedText when expansion changes (e.g., new expansion added)
  useEffect(() => {
    const newCombined = `${expansion.selected_text}\n---\n${expansion.content}`;
    setEditedText(newCombined);
  }, [expansion.selected_text, expansion.content]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Parse combined text back into selected_text and content
  const parseEditedText = useCallback(
    (text: string): { selectedText: string; content: string } => {
      const separatorIndex = text.indexOf('\n---\n');
      if (separatorIndex === -1) {
        // No separator found - treat entire text as content, keep original selected_text
        return { selectedText: expansion.selected_text, content: text };
      }
      return {
        selectedText: text.slice(0, separatorIndex),
        content: text.slice(separatorIndex + 5), // 5 = '\n---\n'.length
      };
    },
    [expansion.selected_text]
  );

  // Handle textarea changes with debounced save
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setEditedText(newValue);

      // Clear existing timeout
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      // Debounce save (500ms) - same as main notes
      saveTimeoutRef.current = setTimeout(() => {
        const { selectedText, content } = parseEditedText(newValue);
        onUpdate?.(selectedText, content);
      }, 500);
    },
    [onUpdate, parseEditedText]
  );

  return (
    <div
      className={`${style.bg} ${style.border} border-l-4 rounded-r-lg p-4 my-4 animate-fade-in`}
    >
      {/* Header - always visible for context */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span>{style.icon}</span>
          <span className={`font-semibold ${style.textColor}`}>{style.label}</span>
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors p-1 min-w-[44px] min-h-[44px] flex items-center justify-center"
            title="Remove expansion"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {isEditMode && onUpdate ? (
        /* Edit mode: single textarea with separator */
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 italic">
            Original quote above separator (---), expansion content below
          </p>
          <textarea
            value={editedText}
            onChange={handleTextChange}
            className="w-full min-h-[200px] p-3 rounded-lg border border-gray-300 dark:border-gray-600
                       bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100
                       font-mono text-sm resize-y focus:outline-none focus:ring-2
                       focus:ring-blue-500 dark:focus:ring-blue-400"
            placeholder="Selected text&#10;---&#10;Expansion content (Markdown supported)..."
          />
        </div>
      ) : (
        /* View mode: styled display */
        <>
          {/* Original text reference */}
          <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 italic border-l-2 border-gray-300 dark:border-gray-600 pl-2">
            "{expansion.selected_text.slice(0, 100)}
            {expansion.selected_text.length > 100 ? '...' : ''}"
          </div>

          {/* Content */}
          <div className="text-gray-700 dark:text-gray-300">
            <MarkdownRenderer content={expansion.content} />
          </div>
        </>
      )}
    </div>
  );
}
