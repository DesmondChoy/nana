import { useState } from 'react';
import type { NotesResponse } from '../types';

interface NotesPanelProps {
  pageNumber: number;
  notes: NotesResponse | null;
  isGenerating: boolean;
  hasFailed?: boolean;
  onRetry?: () => void;
}

export default function NotesPanel({
  pageNumber,
  notes,
  isGenerating,
  hasFailed = false,
  onRetry,
}: NotesPanelProps) {
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    if (!onRetry) return;
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  if (isGenerating || isRetrying) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">
            {isRetrying ? 'Retrying' : 'Generating'} notes for page {pageNumber}...
          </p>
        </div>
      </div>
    );
  }

  if (hasFailed) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 mb-4">
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
          <p className="text-gray-700 font-medium mb-2">
            Failed to generate notes for page {pageNumber}
          </p>
          <p className="text-gray-500 text-sm mb-4">
            There was an error connecting to the AI service.
          </p>
          {onRetry && (
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
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
      <div className="h-full flex items-center justify-center text-gray-500">
        <p>Notes will appear here once generated</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">
        Notes for Page {pageNumber}
      </h2>

      <div className="space-y-6">
        {notes.sections.map((section, sectionIdx) => (
          <div key={sectionIdx} className="bg-gray-50 rounded-lg p-4">
            {/* Section Title */}
            <h3 className="font-semibold text-gray-900 mb-2">{section.title}</h3>

            {/* Summary */}
            <p className="text-gray-700 mb-3">{section.summary}</p>

            {/* Bullet Points */}
            <ul className="space-y-2">
              {section.bullets.map((bullet, bulletIdx) => (
                <li
                  key={bulletIdx}
                  className={`flex items-start gap-2 ${
                    bullet.importance === 'key'
                      ? 'text-gray-900 font-medium'
                      : bullet.importance === 'supporting'
                      ? 'text-gray-700'
                      : 'text-gray-600 text-sm'
                  }`}
                >
                  <span
                    className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${
                      bullet.importance === 'key'
                        ? 'bg-blue-500'
                        : bullet.importance === 'supporting'
                        ? 'bg-gray-400'
                        : 'bg-gray-300'
                    }`}
                  />
                  <span>{bullet.text}</span>
                </li>
              ))}
            </ul>

            {/* Topic Labels */}
            {section.topic_labels.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200 flex flex-wrap gap-2">
                {section.topic_labels.map((label, labelIdx) => (
                  <span
                    key={labelIdx}
                    className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}

            {/* Page References */}
            {section.page_references.length > 0 && (
              <div className="mt-2 text-xs text-gray-500">
                Referenced pages: {section.page_references.join(', ')}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
