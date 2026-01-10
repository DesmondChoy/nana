import { useEffect, useCallback } from 'react';
import type { ImportValidation } from '../utils/importMarkdown';

interface ImportWarningModalProps {
  isOpen: boolean;
  validation: ImportValidation;
  currentPageCount: number;
  onProceed: () => void;
  onCancel: () => void;
}

export function ImportWarningModal({
  isOpen,
  validation,
  currentPageCount,
  onProceed,
  onCancel,
}: ImportWarningModalProps) {
  // Handle Escape key to close modal
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCancel();
      }
    },
    [onCancel]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen || !validation.frontmatter) return null;

  const { frontmatter, hashMatches, pageCountMatches } = validation;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md w-full mx-4 border border-gray-100 dark:border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Warning Icon */}
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
          <svg
            className="w-6 h-6 text-amber-600 dark:text-amber-400"
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

        {/* Title */}
        <h2
          id="modal-title"
          className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4 text-center"
        >
          Import Mismatch
        </h2>

        {/* Mismatch Details */}
        <div className="text-left space-y-3 mb-4">
          {!hashMatches && (
            <div className="flex items-start gap-2">
              <span className="text-amber-600 dark:text-amber-400 mt-0.5">⚠</span>
              <div>
                <p className="text-amber-700 dark:text-amber-300 font-medium">
                  Content mismatch
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  The notes were exported from a different PDF file.
                </p>
              </div>
            </div>
          )}
          {!pageCountMatches && (
            <div className="flex items-start gap-2">
              <span className="text-amber-600 dark:text-amber-400 mt-0.5">⚠</span>
              <div>
                <p className="text-amber-700 dark:text-amber-300 font-medium">
                  Page count mismatch
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Expected {currentPageCount} pages, but the notes have{' '}
                  {frontmatter.total_pages} pages.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* File Details */}
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-3 mb-6 text-sm">
          <p className="text-gray-700 dark:text-gray-300">
            <span className="font-medium">Original file:</span>{' '}
            {frontmatter.original_filename}
          </p>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            <span className="font-medium">Exported:</span>{' '}
            {new Date(frontmatter.exported_at).toLocaleString()}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 justify-center">
          <button
            onClick={onCancel}
            className="px-6 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Cancel
          </button>
          <button
            onClick={onProceed}
            className="px-6 py-2.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium"
          >
            Import Anyway
          </button>
        </div>
      </div>
    </div>
  );
}
