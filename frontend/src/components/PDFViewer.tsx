import { useState, useCallback, useRef, useEffect } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Configure PDF.js worker from CDN
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface PDFViewerProps {
  pdfUrl: string | null;
  totalPages: number;
  currentPage: number;
  onPageChange: (page: number) => void;
  highlightTerm?: string | null;
}

export default function PDFViewer({
  pdfUrl,
  totalPages,
  currentPage,
  onPageChange,
  highlightTerm,
}: PDFViewerProps) {
  const [pageWidth, setPageWidth] = useState<number>(600);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const thumbnailRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const pdfContainerRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = useCallback(() => {
    setIsLoading(false);
    setError(null);
  }, []);

  const onDocumentLoadError = useCallback((err: Error) => {
    setIsLoading(false);
    setError(err.message);
  }, []);

  // Smooth scroll to active thumbnail when page changes
  useEffect(() => {
    const activeThumb = thumbnailRefs.current[currentPage - 1];
    if (activeThumb && sidebarRef.current) {
      activeThumb.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentPage]);

  // Highlight search term in PDF text layer (supports cross-span matching)
  useEffect(() => {
    if (!pdfContainerRef.current) return;

    // Small delay to ensure text layer is rendered after page change
    const timer = setTimeout(() => {
      const container = pdfContainerRef.current;
      if (!container) return;

      const textLayer = container.querySelector('.textLayer');
      if (!textLayer) return;

      // Clear existing highlights by restoring original text
      const existingMarks = textLayer.querySelectorAll('mark[data-search-highlight]');
      existingMarks.forEach((mark) => {
        const parent = mark.parentNode;
        if (parent) {
          parent.replaceChild(document.createTextNode(mark.textContent || ''), mark);
          parent.normalize(); // Merge adjacent text nodes
        }
      });

      // If no highlight term, we're done
      if (!highlightTerm) return;

      // Helper to escape regex special characters (e.g., "C++", "$100")
      const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Get all non-empty spans with their text content
      const spans = Array.from(textLayer.querySelectorAll('span')).filter(
        (span) => span.textContent && span.textContent.length > 0
      );

      // Build combined text and track span boundaries
      // Each entry: { span, startIndex, endIndex, text }
      const spanInfo: { span: Element; startIndex: number; endIndex: number; text: string }[] = [];
      let combinedText = '';

      spans.forEach((span) => {
        const text = span.textContent || '';
        const startIndex = combinedText.length;
        combinedText += text;
        spanInfo.push({
          span,
          startIndex,
          endIndex: combinedText.length,
          text,
        });
      });

      // Find all matches in the combined text
      const regex = new RegExp(escapeRegex(highlightTerm), 'gi');
      const matches: { start: number; end: number; text: string }[] = [];
      let match;

      while ((match = regex.exec(combinedText)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0],
        });
      }

      if (matches.length === 0) return;

      // For each span, determine which portions need highlighting
      // A match may span multiple spans, so we track highlight ranges per span
      const spanHighlights = new Map<Element, { start: number; end: number }[]>();

      matches.forEach((m) => {
        // Find all spans that overlap with this match
        spanInfo.forEach((info) => {
          // Check if this span overlaps with the match
          if (m.start < info.endIndex && m.end > info.startIndex) {
            // Calculate the local highlight range within this span
            const localStart = Math.max(0, m.start - info.startIndex);
            const localEnd = Math.min(info.text.length, m.end - info.startIndex);

            if (!spanHighlights.has(info.span)) {
              spanHighlights.set(info.span, []);
            }
            spanHighlights.get(info.span)!.push({ start: localStart, end: localEnd });
          }
        });
      });

      // Apply highlights to each affected span
      spanHighlights.forEach((ranges, span) => {
        const text = span.textContent || '';

        // Merge overlapping ranges and sort by start position
        const mergedRanges = mergeRanges(ranges);

        // Build the new content with highlights
        const fragment = document.createDocumentFragment();
        let lastEnd = 0;

        mergedRanges.forEach((range) => {
          // Add text before this highlight
          if (range.start > lastEnd) {
            fragment.appendChild(document.createTextNode(text.slice(lastEnd, range.start)));
          }

          // Add the highlighted portion
          const mark = document.createElement('mark');
          mark.setAttribute('data-search-highlight', 'true');
          mark.className = 'bg-yellow-300 dark:bg-yellow-500/60 rounded px-0.5';
          mark.textContent = text.slice(range.start, range.end);
          fragment.appendChild(mark);

          lastEnd = range.end;
        });

        // Add remaining text after last highlight
        if (lastEnd < text.length) {
          fragment.appendChild(document.createTextNode(text.slice(lastEnd)));
        }

        // Replace span contents
        span.textContent = '';
        span.appendChild(fragment);
      });

      // Helper function to merge overlapping ranges
      function mergeRanges(ranges: { start: number; end: number }[]): { start: number; end: number }[] {
        if (ranges.length === 0) return [];

        // Sort by start position
        const sorted = [...ranges].sort((a, b) => a.start - b.start);
        const merged: { start: number; end: number }[] = [sorted[0]];

        for (let i = 1; i < sorted.length; i++) {
          const last = merged[merged.length - 1];
          const current = sorted[i];

          if (current.start <= last.end) {
            // Overlapping or adjacent - merge
            last.end = Math.max(last.end, current.end);
          } else {
            // Non-overlapping - add new range
            merged.push(current);
          }
        }

        return merged;
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [highlightTerm, currentPage]);

  // Show fallback if no PDF URL
  if (!pdfUrl) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 dark:text-gray-400">
        <div className="text-center">
          <p className="mb-2">PDF viewer unavailable</p>
          <p className="text-sm">Re-upload the PDF to enable visual rendering</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Thumbnail sidebar - hidden on mobile */}
      <div
        ref={sidebarRef}
        className="hidden md:block w-20 bg-gray-200 dark:bg-gray-800 p-2 overflow-y-auto flex-shrink-0 border-r border-gray-300 dark:border-gray-700"
      >
        {Array.from({ length: totalPages }, (_, idx) => (
          <button
            key={idx + 1}
            ref={(el) => { thumbnailRefs.current[idx] = el; }}
            onClick={() => onPageChange(idx + 1)}
            className={`w-full mb-2 p-2 text-xs font-medium rounded-md transition-all duration-150 ${
              currentPage === idx + 1
                ? 'bg-blue-500 text-white ring-2 ring-blue-400 ring-offset-1 dark:ring-offset-gray-800 scale-105'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600'
            }`}
          >
            {idx + 1}
          </button>
        ))}
      </div>

      {/* Main PDF content */}
      <div className="flex-1 overflow-auto p-2 sm:p-4 bg-gray-100 dark:bg-gray-900">
        <div ref={pdfContainerRef} className="flex justify-center">
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">Loading PDF...</p>
                </div>
              </div>
            }
            error={
              <div className="flex items-center justify-center h-96">
                <div className="text-center text-red-600 dark:text-red-400">
                  <p className="font-medium">Failed to load PDF</p>
                  <p className="text-sm mt-1">{error}</p>
                </div>
              </div>
            }
          >
            <Page
              pageNumber={currentPage}
              width={pageWidth}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              loading={
                <div className="flex items-center justify-center h-96 w-[600px] bg-white dark:bg-gray-800 rounded-lg shadow-md">
                  <div className="animate-pulse text-gray-400 dark:text-gray-500">Loading page...</div>
                </div>
              }
            />
          </Document>
        </div>

        {/* Zoom controls */}
        {!isLoading && !error && (
          <div className="fixed bottom-20 left-4 md:left-24 z-50 flex items-center gap-1 sm:gap-2 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-1.5 sm:p-2">
            <button
              onClick={() => setPageWidth((w) => Math.max(300, w - 100))}
              className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 px-3 py-2 text-sm font-medium rounded-md
                         text-gray-700 dark:text-gray-200
                         hover:bg-gray-100 dark:hover:bg-gray-700
                         active:scale-95 transition-all duration-150"
              title="Zoom out"
            >
              −
            </button>
            <span className="text-sm font-medium text-gray-600 dark:text-gray-300 min-w-[50px] sm:min-w-[60px] text-center">
              {Math.round((pageWidth / 600) * 100)}%
            </span>
            <button
              onClick={() => setPageWidth((w) => Math.min(1200, w + 100))}
              className="min-w-[44px] min-h-[44px] sm:min-w-0 sm:min-h-0 px-3 py-2 text-sm font-medium rounded-md
                         text-gray-700 dark:text-gray-200
                         hover:bg-gray-100 dark:hover:bg-gray-700
                         active:scale-95 transition-all duration-150"
              title="Zoom in"
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
