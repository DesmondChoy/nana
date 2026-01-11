/**
 * EmphasisBox - Collapsible inline box for adding emphasis points
 *
 * Allows users to type key points from lectures/presentations
 * that will be integrated into the AI-generated notes.
 */

interface EmphasisBoxProps {
  draft: string;
  onDraftChange: (value: string) => void;
  onIntegrate: () => Promise<void>;
  onClose: () => void;
  isIntegrating: boolean;
}

export default function EmphasisBox({
  draft,
  onDraftChange,
  onIntegrate,
  onClose,
  isIntegrating,
}: EmphasisBoxProps) {
  const canIntegrate = draft.trim().length > 0 && !isIntegrating;

  return (
    <div className="mb-4 rounded-lg border border-amber-200 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/20 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-amber-200 dark:border-amber-700">
        <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200 font-medium">
          <span>✨</span>
          <span>Add Emphasis</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-amber-200 dark:hover:bg-amber-800 text-amber-600 dark:text-amber-400 transition-colors"
          title="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        <textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="Type key points from the lecture or presentation that you want integrated into the notes..."
          className="w-full h-24 px-3 py-2 rounded-lg border border-amber-200 dark:border-amber-600
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                     placeholder-gray-400 dark:placeholder-gray-500
                     focus:outline-none focus:ring-2 focus:ring-amber-400 dark:focus:ring-amber-500
                     resize-y min-h-[6rem]"
          disabled={isIntegrating}
        />

        {/* Footer with buttons */}
        <div className="flex justify-end gap-2 mt-3">
          <button
            onClick={onClose}
            disabled={isIntegrating}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-600
                       text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Close
          </button>
          <button
            onClick={async () => {
              try {
                await onIntegrate();
                onClose(); // Auto-close on success
              } catch {
                // Error already handled in parent, keep box open
              }
            }}
            disabled={!canIntegrate}
            className="px-3 py-1.5 text-sm rounded-lg
                       bg-amber-500 hover:bg-amber-600 dark:bg-amber-600 dark:hover:bg-amber-700
                       text-white font-medium
                       disabled:opacity-50 disabled:cursor-not-allowed transition-colors
                       flex items-center gap-2"
          >
            {isIntegrating ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                <span>Integrating...</span>
              </>
            ) : (
              <>
                <span>Integrate</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
