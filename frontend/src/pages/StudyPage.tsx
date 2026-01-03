import { useEffect, useCallback, useRef, useState } from 'react';
import { usePDFStore, useUserStore } from '../stores';
import PDFViewer from '../components/PDFViewer';
import NotesPanel from '../components/NotesPanel';
import GenerationProgress from '../components/GenerationProgress';
import ThemeToggle from '../components/ThemeToggle';
import { generateNotes, logCacheHits } from '../api/client';
import { generateMarkdownExport, downloadMarkdown, getExportFilename } from '../utils';
import { useToast } from '../hooks/useToast';

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
  const uploadState = usePDFStore((state) => state.uploadState);
  const clearUploadError = usePDFStore((state) => state.clearUploadError);

  const profile = useUserStore((state) => state.profile);
  const clearProfile = useUserStore((state) => state.clearProfile);
  const failedPages = usePDFStore((state) => state.failedPages);
  const markPageFailed = usePDFStore((state) => state.markPageFailed);
  const clearPageFailure = usePDFStore((state) => state.clearPageFailure);
  const addExpansion = usePDFStore((state) => state.addExpansion);
  const removeExpansion = usePDFStore((state) => state.removeExpansion);
  const getExpansionsForPage = usePDFStore((state) => state.getExpansionsForPage);

  // Track if we've logged cache hits for this PDF to avoid duplicate logs
  const cacheHitsLoggedRef = useRef<string | null>(null);

  // Track header shadow on scroll
  const [headerShadow, setHeaderShadow] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // Mobile tab state
  const [mobileActiveTab, setMobileActiveTab] = useState<'pdf' | 'notes'>('notes');

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

  // Export functionality
  const { toast } = useToast();

  const isExportReady = parsedPDF
    ? Object.keys(notesCache).length >= parsedPDF.total_pages
    : false;

  const handleExport = useCallback(() => {
    if (!parsedPDF || !isExportReady) return;

    const markdown = generateMarkdownExport({ parsedPDF, notesCache });
    const filename = getExportFilename(parsedPDF.original_filename);
    downloadMarkdown(markdown, filename);

    toast.success(`Exported ${filename}`);
  }, [parsedPDF, notesCache, isExportReady, toast]);

  const handleGoBack = useCallback(() => {
    clearUploadError();
    clearPDF();
  }, [clearUploadError, clearPDF]);

  // Show loading overlay when upload is in progress
  if (uploadState.isUploading || uploadState.error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 transition-colors">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 max-w-md w-full mx-4 text-center border border-gray-100 dark:border-gray-700">
          {uploadState.error ? (
            // Error state
            <>
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-600 dark:text-red-400"
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
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Upload Failed
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">{uploadState.error}</p>
              <button
                onClick={handleGoBack}
                className="px-6 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                Go Back
              </button>
            </>
          ) : (
            // Loading state
            <>
              <div className="w-12 h-12 mx-auto mb-4 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Processing Your PDF
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Extracting text and structure from your document...
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (!parsedPDF || !profile) {
    return null;
  }

  const currentNotes = notesCache[currentPage];
  const currentPageContent = parsedPDF?.pages[currentPage - 1];
  const currentExpansions = getExpansionsForPage(currentPage);

  return (
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900 transition-colors">
      {/* Header */}
      <header
        className={`bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between transition-shadow duration-200 ${
          headerShadow ? 'shadow-md' : ''
        }`}
      >
        <div className="flex items-center gap-4 min-w-0">
          <h1 className="font-semibold text-gray-900 dark:text-gray-100 flex-shrink-0">NANA</h1>
          <span className="text-sm text-gray-500 dark:text-gray-400 truncate hidden sm:block">
            {parsedPDF.original_filename}
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {generationProgress.isGenerating && (
            <GenerationProgress
              completed={generationProgress.completedPages}
              total={parsedPDF.total_pages}
            />
          )}

          <ThemeToggle />

          {/* Export button - desktop */}
          <button
            onClick={handleExport}
            disabled={!isExportReady}
            className={`text-sm transition-colors hidden sm:block ${
              isExportReady
                ? 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }`}
            title={isExportReady ? 'Export all notes as Markdown' : 'Generate all notes first'}
          >
            Export Notes
          </button>

          {/* Export button - mobile */}
          <button
            onClick={handleExport}
            disabled={!isExportReady}
            className={`sm:hidden p-2 transition-colors ${
              isExportReady
                ? 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
            }`}
            title={isExportReady ? 'Export all notes as Markdown' : 'Generate all notes first'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>

          <button
            onClick={handleReset}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors hidden sm:block"
          >
            Upload New PDF
          </button>

          {/* Mobile: icon button for reset */}
          <button
            onClick={handleReset}
            className="sm:hidden p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
            title="Upload New PDF"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Content - Desktop: Dual Pane, Mobile: Tab-based */}
      <main
        ref={mainRef}
        className="flex-1 flex overflow-hidden"
        onScroll={(e) => {
          const scrollTop = (e.target as HTMLElement).scrollTop;
          setHeaderShadow(scrollTop > 0);
        }}
      >
        {/* Desktop Layout */}
        <div className="hidden md:flex flex-1">
          {/* Left Pane - PDF Viewer */}
          <div className="w-1/2 bg-gray-200 dark:bg-gray-950 overflow-hidden border-r border-gray-300 dark:border-gray-700">
            <PDFViewer
              pdfUrl={pdfFileUrl}
              totalPages={parsedPDF.total_pages}
              currentPage={currentPage}
              onPageChange={handlePageChange}
            />
          </div>

          {/* Right Pane - Notes */}
          <div className="w-1/2 bg-white dark:bg-gray-800 overflow-auto">
            <NotesPanel
              pageNumber={currentPage}
              notes={currentNotes?.notes ?? null}
              isGenerating={generationProgress.isGenerating && !currentNotes}
              hasFailed={failedPages.has(currentPage)}
              onRetry={() => handleRetryPage(currentPage)}
              expansions={currentExpansions}
              onAddExpansion={(selectedText, response) =>
                addExpansion(currentPage, selectedText, response)
              }
              onRemoveExpansion={(expansionId) =>
                removeExpansion(currentPage, expansionId)
              }
              pageContent={currentPageContent}
              userProfile={profile}
              sessionId={parsedPDF.session_id}
            />
          </div>
        </div>

        {/* Mobile Layout - Tab-based */}
        <div className="md:hidden flex-1 flex flex-col">
          {/* Content area */}
          <div className="flex-1 overflow-hidden">
            {mobileActiveTab === 'pdf' ? (
              <div className="h-full bg-gray-200 dark:bg-gray-950">
                <PDFViewer
                  pdfUrl={pdfFileUrl}
                  totalPages={parsedPDF.total_pages}
                  currentPage={currentPage}
                  onPageChange={handlePageChange}
                />
              </div>
            ) : (
              <div className="h-full bg-white dark:bg-gray-800 overflow-auto">
                <NotesPanel
                  pageNumber={currentPage}
                  notes={currentNotes?.notes ?? null}
                  isGenerating={generationProgress.isGenerating && !currentNotes}
                  hasFailed={failedPages.has(currentPage)}
                  onRetry={() => handleRetryPage(currentPage)}
                  expansions={currentExpansions}
                  onAddExpansion={(selectedText, response) =>
                    addExpansion(currentPage, selectedText, response)
                  }
                  onRemoveExpansion={(expansionId) =>
                    removeExpansion(currentPage, expansionId)
                  }
                  pageContent={currentPageContent}
                  userProfile={profile}
                  sessionId={parsedPDF.session_id}
                />
              </div>
            )}
          </div>

          {/* Mobile Tab Bar */}
          <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 flex">
            <button
              onClick={() => setMobileActiveTab('pdf')}
              className={`flex-1 py-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                mobileActiveTab === 'pdf'
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              PDF
            </button>
            <button
              onClick={() => setMobileActiveTab('notes')}
              className={`flex-1 py-3 flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                mobileActiveTab === 'notes'
                  ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Notes
            </button>
          </div>
        </div>
      </main>

      {/* Footer - Page Navigation */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-center gap-4">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                     text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700
                     disabled:opacity-50 disabled:cursor-not-allowed
                     hover:bg-gray-50 dark:hover:bg-gray-600
                     active:scale-[0.98] transition-all duration-150
                     min-w-[44px] min-h-[44px] flex items-center justify-center"
          title="Previous page (← or ↑)"
        >
          <span className="hidden sm:inline">← Previous</span>
          <span className="sm:hidden">←</span>
        </button>

        <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[100px] text-center">
          Page {currentPage} of {parsedPDF.total_pages}
        </span>

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= parsedPDF.total_pages}
          className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                     text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700
                     disabled:opacity-50 disabled:cursor-not-allowed
                     hover:bg-gray-50 dark:hover:bg-gray-600
                     active:scale-[0.98] transition-all duration-150
                     min-w-[44px] min-h-[44px] flex items-center justify-center"
          title="Next page (→ or ↓)"
        >
          <span className="hidden sm:inline">Next →</span>
          <span className="sm:hidden">→</span>
        </button>
      </footer>
    </div>
  );
}
