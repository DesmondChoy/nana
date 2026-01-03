import { useState, useRef, useCallback } from 'react';
import type { NotesResponse, InlineCommandType, Expansion, PageContent, UserProfile } from '../types';
import MarkdownRenderer from './MarkdownRenderer';
import SelectionToolbar from './SelectionToolbar';
import ExpansionBlock from './ExpansionBlock';
import { useTextSelection, useClearSelection } from '../hooks/useTextSelection';
import { executeInlineCommand } from '../api/client';

interface NotesPanelProps {
  pageNumber: number;
  notes: NotesResponse | null;
  isGenerating: boolean;
  hasFailed?: boolean;
  onRetry?: () => void;
  // For inline commands
  expansions?: Expansion[];
  onAddExpansion?: (selectedText: string, response: { content: string; command_type: InlineCommandType }) => void;
  onRemoveExpansion?: (expansionId: string) => void;
  pageContent?: PageContent;
  userProfile?: UserProfile;
  sessionId?: string;
}

// Skeleton loader component
function NotesSkeleton() {
  return (
    <div className="p-4 sm:p-6 animate-fade-in">
      {/* Title skeleton */}
      <div className="h-6 w-48 skeleton rounded mb-6" />

      {/* Hint skeleton */}
      <div className="h-4 w-64 skeleton rounded mb-6" />

      {/* Content skeletons - mimics markdown structure */}
      <div className="space-y-4">
        {/* Heading */}
        <div className="h-5 w-3/4 skeleton rounded" />

        {/* Paragraph lines */}
        <div className="space-y-2">
          <div className="h-4 w-full skeleton rounded" />
          <div className="h-4 w-full skeleton rounded" />
          <div className="h-4 w-5/6 skeleton rounded" />
        </div>

        {/* Callout block skeleton */}
        <div className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 py-2 space-y-2">
          <div className="h-4 w-24 skeleton rounded" />
          <div className="h-4 w-full skeleton rounded" />
          <div className="h-4 w-4/5 skeleton rounded" />
        </div>

        {/* More paragraph lines */}
        <div className="space-y-2">
          <div className="h-4 w-full skeleton rounded" />
          <div className="h-4 w-3/4 skeleton rounded" />
        </div>

        {/* Subheading */}
        <div className="h-5 w-1/2 skeleton rounded mt-6" />

        {/* List items skeleton */}
        <div className="space-y-2 pl-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 skeleton rounded-full" />
            <div className="h-4 w-full skeleton rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 skeleton rounded-full" />
            <div className="h-4 w-5/6 skeleton rounded" />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 skeleton rounded-full" />
            <div className="h-4 w-4/5 skeleton rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function NotesPanel({
  pageNumber,
  notes,
  isGenerating,
  hasFailed = false,
  onRetry,
  expansions = [],
  onAddExpansion,
  onRemoveExpansion,
  pageContent,
  userProfile,
  sessionId,
}: NotesPanelProps) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [isExecutingCommand, setIsExecutingCommand] = useState(false);
  const [executingCommandType, setExecutingCommandType] = useState<InlineCommandType | null>(null);
  const notesContainerRef = useRef<HTMLDivElement>(null);
  const selection = useTextSelection(notesContainerRef);
  const clearSelection = useClearSelection();

  const handleRetry = async () => {
    if (!onRetry) return;
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  const handleCommand = useCallback(
    async (command: InlineCommandType) => {
      if (!selection || !pageContent || !userProfile || !onAddExpansion) return;

      setIsExecutingCommand(true);
      setExecutingCommandType(command);
      try {
        const response = await executeInlineCommand({
          commandType: command,
          selectedText: selection.text,
          pageNumber: pageNumber,
          pageText: pageContent.text,
          userProfile: userProfile,
          sessionId: sessionId,
        });

        onAddExpansion(selection.text, response);
        clearSelection();
      } catch (error) {
        console.error('Failed to execute inline command:', error);
        // Could add error toast here
      } finally {
        setIsExecutingCommand(false);
        setExecutingCommandType(null);
      }
    },
    [selection, pageContent, userProfile, sessionId, pageNumber, onAddExpansion, clearSelection]
  );

  // Show skeleton loader while generating
  if (isGenerating || isRetrying) {
    return <NotesSkeleton />;
  }

  if (hasFailed) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <div className="text-red-500 dark:text-red-400 mb-4">
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <p className="text-gray-700 dark:text-gray-200 font-medium mb-2">
            Failed to generate notes for page {pageNumber}
          </p>
          <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
            There was an error connecting to the AI service.
          </p>
          {onRetry && (
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!notes) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400 p-6">
        <p>Notes will appear here once generated</p>
      </div>
    );
  }

  // Check if we can enable inline commands
  const canUseInlineCommands = !!(pageContent && userProfile && onAddExpansion);

  return (
    <div className="p-4 sm:p-6 relative animate-fade-in" ref={notesContainerRef}>
      <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
        Notes for Page {pageNumber}
      </h2>

      {/* Hint for inline commands */}
      {canUseInlineCommands && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
          💡 Select any text to elaborate, simplify, or create an analogy
        </p>
      )}

      {/* Selection Toolbar - always rendered but hidden when no selection to avoid DOM changes disrupting browser selection */}
      {canUseInlineCommands && (
        <SelectionToolbar
          selectionRect={selection?.rect ?? new DOMRect()}
          containerRef={notesContainerRef}
          onCommand={handleCommand}
          isLoading={isExecutingCommand}
          loadingCommand={executingCommandType}
          visible={!!selection || isExecutingCommand}
        />
      )}

      {/* Markdown content with callout support */}
      <MarkdownRenderer content={notes.markdown} />

      {/* Expansions */}
      {expansions.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">
            Expansions ({expansions.length})
          </h3>
          {expansions.map((expansion) => (
            <ExpansionBlock
              key={expansion.id}
              expansion={expansion}
              onRemove={
                onRemoveExpansion
                  ? () => onRemoveExpansion(expansion.id)
                  : undefined
              }
            />
          ))}
        </div>
      )}

      {/* Topic labels as badges */}
      {notes.topic_labels && notes.topic_labels.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-wrap gap-2">
            {notes.topic_labels.map((label, idx) => (
              <span
                key={idx}
                className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 px-2 py-1 rounded"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Page references */}
      {notes.page_references && notes.page_references.length > 0 && (
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Referenced pages: {notes.page_references.join(', ')}
        </div>
      )}
    </div>
  );
}
