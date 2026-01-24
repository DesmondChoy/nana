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

  // Highlight search term in PDF text layer
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

      // Find all text spans in the text layer
      const spans = textLayer.querySelectorAll('span');

      // Helper to escape regex special characters (e.g., "C++", "$100")
      const escapeRegex = (str: string) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      spans.forEach((span) => {
        const text = span.textContent || '';
        if (!text) return;

        // Use regex to find ALL occurrences (case-insensitive, global)
        const regex = new RegExp(escapeRegex(highlightTerm), 'gi');
        const parts: (string | { match: string })[] = [];
        let lastIndex = 0;
        let match;

        while ((match = regex.exec(text)) !== null) {
          if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index));
          }
          parts.push({ match: match[0] });
          lastIndex = regex.lastIndex;
        }

        if (lastIndex < text.length) {
          parts.push(text.slice(lastIndex));
        }

        // Only modify DOM if we found matches
        if (parts.some((p) => typeof p === 'object')) {
          const fragment = document.createDocumentFragment();
          parts.forEach((part) => {
            if (typeof part === 'string') {
              fragment.appendChild(document.createTextNode(part));
            } else {
              const mark = document.createElement('mark');
              mark.setAttribute('data-search-highlight', 'true');
              mark.className = 'bg-yellow-300 dark:bg-yellow-500/60 rounded px-0.5';
              mark.textContent = part.match;
              fragment.appendChild(mark);
            }
          });
          span.textContent = '';
          span.appendChild(fragment);
        }
      });
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
