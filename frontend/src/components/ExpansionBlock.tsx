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
  onRemove?: () => void;
}

export default function ExpansionBlock({
  expansion,
  onRemove,
}: ExpansionBlockProps) {
  const style = EXPANSION_STYLES[expansion.command_type];

  return (
    <div
      className={`${style.bg} ${style.border} border-l-4 rounded-r-lg p-4 my-4 animate-fade-in`}
    >
      {/* Header */}
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

      {/* Original text reference */}
      <div className="text-xs text-gray-500 dark:text-gray-400 mb-3 italic border-l-2 border-gray-300 dark:border-gray-600 pl-2">
        "{expansion.selected_text.slice(0, 100)}
        {expansion.selected_text.length > 100 ? '...' : ''}"
      </div>

      {/* Content */}
      <div className="text-gray-700 dark:text-gray-300">
        <MarkdownRenderer content={expansion.content} />
      </div>
    </div>
  );
}
