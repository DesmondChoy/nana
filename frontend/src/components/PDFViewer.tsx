import { useState, useCallback } from 'react';
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
}

export default function PDFViewer({
  pdfUrl,
  totalPages,
  currentPage,
  onPageChange,
}: PDFViewerProps) {
  const [pageWidth, setPageWidth] = useState<number>(600);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const onDocumentLoadSuccess = useCallback(() => {
    setIsLoading(false);
    setError(null);
  }, []);

  const onDocumentLoadError = useCallback((err: Error) => {
    setIsLoading(false);
    setError(err.message);
  }, []);

  // Show fallback if no PDF URL
  if (!pdfUrl) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <p className="mb-2">PDF viewer unavailable</p>
          <p className="text-sm">Re-upload the PDF to enable visual rendering</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      {/* Thumbnail sidebar */}
      <div className="w-20 bg-gray-300 p-2 overflow-y-auto flex-shrink-0">
        {Array.from({ length: totalPages }, (_, idx) => (
          <button
            key={idx + 1}
            onClick={() => onPageChange(idx + 1)}
            className={`w-full mb-2 p-2 text-xs rounded transition-colors ${
              currentPage === idx + 1
                ? 'bg-blue-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            {idx + 1}
          </button>
        ))}
      </div>

      {/* Main PDF content */}
      <div className="flex-1 overflow-auto p-4">
        <div className="flex justify-center">
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading={
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-gray-600">Loading PDF...</p>
                </div>
              </div>
            }
            error={
              <div className="flex items-center justify-center h-96">
                <div className="text-center text-red-600">
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
                <div className="flex items-center justify-center h-96 w-[600px] bg-white">
                  <div className="animate-pulse text-gray-400">Loading page...</div>
                </div>
              }
            />
          </Document>
        </div>

        {/* Zoom controls */}
        {!isLoading && !error && (
          <div className="fixed bottom-20 right-8 flex items-center gap-2 bg-white rounded-lg shadow-lg p-2">
            <button
              onClick={() => setPageWidth((w) => Math.max(300, w - 100))}
              className="px-3 py-1 text-sm rounded hover:bg-gray-100"
              title="Zoom out"
            >
              −
            </button>
            <span className="text-sm text-gray-600 min-w-[60px] text-center">
              {Math.round((pageWidth / 600) * 100)}%
            </span>
            <button
              onClick={() => setPageWidth((w) => Math.min(1200, w + 100))}
              className="px-3 py-1 text-sm rounded hover:bg-gray-100"
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
