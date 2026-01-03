import type { Expansion, InlineCommandType } from '../types';
import MarkdownRenderer from './MarkdownRenderer';

// Styling per command type
const EXPANSION_STYLES: Record<
  InlineCommandType,
  { bg: string; border: string; icon: string; label: string }
> = {
  elaborate: {
    bg: 'bg-blue-50',
    border: 'border-blue-300',
    icon: '📝',
    label: 'Elaboration',
  },
  simplify: {
    bg: 'bg-green-50',
    border: 'border-green-300',
    icon: '✨',
    label: 'Simplified',
  },
  analogy: {
    bg: 'bg-purple-50',
    border: 'border-purple-300',
    icon: '🔗',
    label: 'Analogy',
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
      className={`${style.bg} ${style.border} border-l-4 rounded-r-lg p-4 my-4`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span>{style.icon}</span>
          <span className="font-semibold text-gray-700">{style.label}</span>
        </div>
        {onRemove && (
          <button
            onClick={onRemove}
            className="text-gray-400 hover:text-gray-600 transition-colors p-1"
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
      <div className="text-xs text-gray-500 mb-3 italic border-l-2 border-gray-300 pl-2">
        "{expansion.selected_text.slice(0, 100)}
        {expansion.selected_text.length > 100 ? '...' : ''}"
      </div>

      {/* Content */}
      <div className="text-gray-700">
        <MarkdownRenderer content={expansion.content} />
      </div>
    </div>
  );
}
