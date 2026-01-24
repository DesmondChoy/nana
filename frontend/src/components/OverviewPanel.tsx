import type { DocumentOverview } from '../types';
import MarkdownRenderer from './MarkdownRenderer';

interface OverviewPanelProps {
  overview: DocumentOverview | null;
  isLoading?: boolean;
}

// Friendly display names for visualization types
const VISUALIZATION_LABELS: Record<string, string> = {
  ascii_diagram: 'Diagram',
  table: 'Table',
  concept_map: 'Concept Map',
  outline: 'Outline',
  timeline: 'Timeline',
};

// Friendly display names for document types
const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  academic_paper: 'Academic Paper',
  presentation: 'Presentation',
  textbook: 'Textbook',
  manual: 'Manual',
  report: 'Report',
  other: 'Document',
};

export default function OverviewPanel({ overview, isLoading }: OverviewPanelProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800">
        <div className="w-12 h-12 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Generating document overview...</p>
      </div>
    );
  }

  // No overview available
  if (!overview) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-gray-400 dark:text-gray-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
            No Overview Available
          </h3>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Navigate to page 1 to start reading the document.
          </p>
        </div>
      </div>
    );
  }

  const visualizationLabel =
    VISUALIZATION_LABELS[overview.visualization_type] || overview.visualization_type;
  const documentTypeLabel =
    DOCUMENT_TYPE_LABELS[overview.document_type] || overview.document_type;

  return (
    <div className="h-full overflow-auto bg-white dark:bg-gray-800">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header with badges */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            Document Overview
          </h1>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200">
              {documentTypeLabel}
            </span>
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200">
              {visualizationLabel}
            </span>
          </div>
        </div>

        {/* Divider */}
        <hr className="border-gray-200 dark:border-gray-700 mb-6" />

        {/* Overview content */}
        <div className="overview-content">
          <MarkdownRenderer content={overview.content} />
        </div>

        {/* Footer hint */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
            Use{' '}
            <kbd className="px-1.5 py-0.5 text-xs font-mono bg-gray-100 dark:bg-gray-700 rounded">
              →
            </kbd>{' '}
            or click{' '}
            <span className="font-medium">Next</span> to start reading
          </p>
        </div>
      </div>
    </div>
  );
}
