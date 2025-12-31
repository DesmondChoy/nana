import { useEffect, useCallback, useRef } from 'react';
import { usePDFStore, useUserStore } from '../stores';
import PDFViewer from '../components/PDFViewer';
import NotesPanel from '../components/NotesPanel';
import GenerationProgress from '../components/GenerationProgress';
import { generateNotes, logCacheHits } from '../api/client';

export default function StudyPage() {
  const parsedPDF = usePDFStore((state) => state.parsedPDF);
  const pdfFileUrl = usePDFStore((state) => state.pdfFileUrl);
  const currentPage = usePDFStore((state) => state.currentPage);
  const setCurrentPage = usePDFStore((state) => state.setCurrentPage);
  const notesCache = usePDFStore((state) => state.notesCache);
  const cacheNotes = usePDFStore((state) => state.cacheNotes);
  const generationProgress = usePDFStore((state) => state.generationProgress);
  const setGenerationProgress = usePDFStore((state) => state.setGenerationProgress);
  const clearPDF = usePDFStore((state) => state.clearPDF);

  const profile = useUserStore((state) => state.profile);
  const clearProfile = useUserStore((state) => state.clearProfile);
  const failedPages = usePDFStore((state) => state.failedPages);
  const markPageFailed = usePDFStore((state) => state.markPageFailed);
  const clearPageFailure = usePDFStore((state) => state.clearPageFailure);

  // Track if we've logged cache hits for this PDF to avoid duplicate logs
  const cacheHitsLoggedRef = useRef<string | null>(null);

  // Eager sequential notes generation
  useEffect(() => {
    if (!parsedPDF || !profile) return;

    // Check if all pages are already cached - nothing to generate
    const currentCache = usePDFStore.getState().notesCache;
    const cachedCount = Object.keys(currentCache).length;
    if (cachedCount >= parsedPDF.total_pages) {
      return;
    }

    // AbortController to cancel in-flight requests on cleanup
    const abortController = new AbortController();

    const generateAllNotes = async () => {
      // Yield to next tick before starting any API calls.
      // This allows StrictMode's cleanup to abort BEFORE we send HTTP requests.
      // Without this, the fetch() call is made synchronously and the request
      // is already on the wire before abort() is called.
      await new Promise((resolve) => setTimeout(resolve, 0));
      if (abortController.signal.aborted) return;

      setGenerationProgress({ isGenerating: true, completedPages: 0 });

      // Log cache hits once per document (before starting generation loop)
      if (cacheHitsLoggedRef.current !== parsedPDF.original_filename) {
        // Access latest cache via getState() to avoid stale closure
        const currentCache = usePDFStore.getState().notesCache;
        const cachedPageNumbers = Object.keys(currentCache)
          .map(Number)
          .filter((p) => p >= 1 && p <= parsedPDF.total_pages);

        if (cachedPageNumbers.length > 0) {
          logCacheHits({
            documentName: parsedPDF.original_filename,
            cachedPages: cachedPageNumbers,
            totalPages: parsedPDF.total_pages,
          });
        }
        cacheHitsLoggedRef.current = parsedPDF.original_filename;
      }

      for (let i = 0; i < parsedPDF.pages.length; i++) {
        // Check if aborted before starting each page
        if (abortController.signal.aborted) break;

        const pageNum = i + 1;
        
        // Access latest cache via getState()
        const currentCache = usePDFStore.getState().notesCache;

        // Skip if already cached
        if (currentCache[pageNum]) {
          if (!abortController.signal.aborted) {
            setGenerationProgress({ completedPages: Object.keys(currentCache).length });
          }
          continue;
        }

        const currentPageContent = parsedPDF.pages[i];
        const previousPageContent = i > 0 ? parsedPDF.pages[i - 1] : undefined;

        // Get context from previous page's generated notes (markdown format)
        const previousNotes = currentCache[pageNum - 1];
        const previousNotesContext = previousNotes?.notes.markdown;

        try {
          const notes = await generateNotes({
            currentPage: currentPageContent,
            previousPage: previousPageContent,
            userProfile: profile,
            topicMastery: useUserStore.getState().topicMastery, // Use latest mastery
            previousNotesContext,
            filename: parsedPDF.original_filename,
            sessionId: parsedPDF.session_id,
            signal: abortController.signal,
          });

          if (!abortController.signal.aborted) {
            cacheNotes(pageNum, notes);
          }
        } catch (error) {
          // Don't log AbortError - it's expected when cleanup cancels requests
          if (error instanceof Error && error.name === 'AbortError') {
            break;
          }
          console.error(`Failed to generate notes for page ${pageNum}:`, error);
          // Mark page as failed so user can retry
          if (!abortController.signal.aborted) {
            markPageFailed(pageNum);
          }
          // Continue with next page on error
        }
      }

      if (!abortController.signal.aborted) {
        setGenerationProgress({ isGenerating: false });
      }
    };

    // Start generation (cache check was already done at the top of this effect)
    generateAllNotes();

    return () => {
      // Cancel any in-flight requests when effect cleanup runs.
      // Combined with the setTimeout(0) at the start of generateAllNotes(),
      // this ensures StrictMode's first effect is aborted BEFORE making API calls.
      abortController.abort();
    };
  }, [parsedPDF, profile, setGenerationProgress, cacheNotes, markPageFailed]);

  const handlePageChange = useCallback(
    (page: number) => {
      if (parsedPDF && page >= 1 && page <= parsedPDF.total_pages) {
        setCurrentPage(page);
      }
    },
    [parsedPDF, setCurrentPage]
  );

  // Retry failed page generation
  const handleRetryPage = useCallback(
    async (pageNum: number) => {
      if (!parsedPDF || !profile) return;

      // Clear failure status and show generating state
      clearPageFailure(pageNum);

      const pageIndex = pageNum - 1;
      const currentPageContent = parsedPDF.pages[pageIndex];
      const previousPageContent = pageIndex > 0 ? parsedPDF.pages[pageIndex - 1] : undefined;

      // Get context from previous page's generated notes (markdown format)
      const currentCache = usePDFStore.getState().notesCache;
      const previousNotes = currentCache[pageNum - 1];
      const previousNotesContext = previousNotes?.notes.markdown;

      try {
        const notes = await generateNotes({
          currentPage: currentPageContent,
          previousPage: previousPageContent,
          userProfile: profile,
          topicMastery: useUserStore.getState().topicMastery,
          previousNotesContext,
          filename: parsedPDF.original_filename,
          sessionId: parsedPDF.session_id,
        });
        cacheNotes(pageNum, notes);
      } catch (error) {
        console.error(`Retry failed for page ${pageNum}:`, error);
        markPageFailed(pageNum);
      }
    },
    [parsedPDF, profile, cacheNotes, clearPageFailure, markPageFailed]
  );

  // Keyboard navigation (arrow keys)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if user is typing in an input field
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        event.preventDefault();
        handlePageChange(currentPage - 1);
      } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        event.preventDefault();
        handlePageChange(currentPage + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, handlePageChange]);

  const handleReset = useCallback(() => {
    clearPDF();
    clearProfile();
  }, [clearPDF, clearProfile]);

  if (!parsedPDF || !profile) {
    return null;
  }

  const currentNotes = notesCache[currentPage];

  return (
    <div className="h-screen flex flex-col bg-gray-100">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="font-semibold text-gray-900">NANA</h1>
          <span className="text-sm text-gray-500">{parsedPDF.original_filename}</span>
        </div>

        <div className="flex items-center gap-4">
          {generationProgress.isGenerating && (
            <GenerationProgress
              completed={generationProgress.completedPages}
              total={parsedPDF.total_pages}
            />
          )}

          <button
            onClick={handleReset}
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Upload New PDF
          </button>
        </div>
      </header>

      {/* Main Content - Dual Pane */}
      <main className="flex-1 flex overflow-hidden">
        {/* Left Pane - PDF Viewer */}
        <div className="w-1/2 border-r bg-gray-200 overflow-hidden">
          <PDFViewer
            pdfUrl={pdfFileUrl}
            totalPages={parsedPDF.total_pages}
            currentPage={currentPage}
            onPageChange={handlePageChange}
          />
        </div>

        {/* Right Pane - Notes */}
        <div className="w-1/2 bg-white overflow-auto">
          <NotesPanel
            pageNumber={currentPage}
            notes={currentNotes?.notes ?? null}
            isGenerating={generationProgress.isGenerating && !currentNotes}
            hasFailed={failedPages.has(currentPage)}
            onRetry={() => handleRetryPage(currentPage)}
          />
        </div>
      </main>

      {/* Footer - Page Navigation */}
      <footer className="bg-white border-t px-4 py-2 flex items-center justify-center gap-4">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="px-3 py-1 rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          title="Previous page (← or ↑)"
        >
          ← Previous
        </button>

        <span className="text-sm text-gray-600">
          Page {currentPage} of {parsedPDF.total_pages}
        </span>

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= parsedPDF.total_pages}
          className="px-3 py-1 rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          title="Next page (→ or ↓)"
        >
          Next →
        </button>
      </footer>
    </div>
  );
}
