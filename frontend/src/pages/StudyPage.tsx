import { useEffect, useCallback, useRef, useState } from 'react';
import { usePDFStore, useUserStore } from '../stores';
import { useSearchStore } from '../stores/searchStore';
import PDFViewer from '../components/PDFViewer';
import NotesPanel from '../components/NotesPanel';
import OverviewPanel from '../components/OverviewPanel';
import GenerationProgress from '../components/GenerationProgress';
import ThemeToggle from '../components/ThemeToggle';
import { SearchBar } from '../components/SearchBar';
import { generateNotes, logCacheHits, integrateEmphasis } from '../api/client';
import { generateMarkdownExport, downloadMarkdown, getExportFilename } from '../utils';
import { useToast } from '../hooks/useToast';
import { useResizablePanes } from '../hooks/useResizablePanes';
import { useNavigationGuard } from '../hooks/useNavigationGuard';
import ResizeDivider from '../components/ResizeDivider';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { HelpModal } from '../components/HelpModal';

export default function StudyPage() {
  const parsedPDF = usePDFStore((state) => state.parsedPDF);
  const pdfFileUrl = usePDFStore((state) => state.pdfFileUrl);
  const currentPage = usePDFStore((state) => state.currentPage);
  const setCurrentPage = usePDFStore((state) => state.setCurrentPage);
  const notesCache = usePDFStore((state) => state.notesCache);
  const cacheNotes = usePDFStore((state) => state.cacheNotes);
  const generationProgress = usePDFStore((state) => state.generationProgress);
  const setGenerationProgress = usePDFStore((state) => state.setGenerationProgress);
  const clearSession = usePDFStore((state) => state.clearSession);
  const uploadState = usePDFStore((state) => state.uploadState);
  const clearUploadError = usePDFStore((state) => state.clearUploadError);
  const cachedTotalPages = usePDFStore((state) => state.cachedTotalPages);
  const cachedFilename = usePDFStore((state) => state.cachedFilename);
  const cachedContentHash = usePDFStore((state) => state.cachedContentHash);

  // Computed values with fallback to cached metadata (for cache-only resume)
  const totalPages = parsedPDF?.total_pages ?? cachedTotalPages ?? 0;
  const filename = parsedPDF?.original_filename ?? cachedFilename ?? 'Unknown';

  const profile = useUserStore((state) => state.profile);
  const clearProfile = useUserStore((state) => state.clearProfile);
  const failedPages = usePDFStore((state) => state.failedPages);
  const markPageFailed = usePDFStore((state) => state.markPageFailed);
  const clearPageFailure = usePDFStore((state) => state.clearPageFailure);
  const addExpansion = usePDFStore((state) => state.addExpansion);
  const removeExpansion = usePDFStore((state) => state.removeExpansion);
  const updateExpansion = usePDFStore((state) => state.updateExpansion);
  const getExpansionsForPage = usePDFStore((state) => state.getExpansionsForPage);
  const updateNotesMarkdown = usePDFStore((state) => state.updateNotesMarkdown);
  // Emphasis state
  const emphasisDrafts = usePDFStore((state) => state.emphasisDrafts);
  const setEmphasisDraft = usePDFStore((state) => state.setEmphasisDraft);
  const clearEmphasisDraft = usePDFStore((state) => state.clearEmphasisDraft);

  // Search state
  const isSearchOpen = useSearchStore((state) => state.isOpen);
  const openSearch = useSearchStore((state) => state.openSearch);
  const highlightTerm = useSearchStore((state) => state.highlightTerm);
  const setHighlightTerm = useSearchStore((state) => state.setHighlightTerm);
  const highlightInPDF = useSearchStore((state) => state.highlightInPDF);
  const highlightInNotes = useSearchStore((state) => state.highlightInNotes);
  const setHighlightSources = useSearchStore((state) => state.setHighlightSources);

  // Track if we've logged cache hits for this PDF to avoid duplicate logs
  const cacheHitsLoggedRef = useRef<string | null>(null);

  // Track header shadow on scroll
  const [headerShadow, setHeaderShadow] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  // Refs for notes scroll containers (separate for desktop and mobile since both are in DOM)
  const desktopNotesScrollRef = useRef<HTMLDivElement>(null);
  const mobileNotesScrollRef = useRef<HTMLDivElement>(null);

  // Mobile tab state
  const [mobileActiveTab, setMobileActiveTab] = useState<'pdf' | 'notes'>('notes');

  // Emphasis integration state
  const [isIntegratingEmphasis, setIsIntegratingEmphasis] = useState(false);

  // Edit mode state (controlled at page level for keyboard shortcut)
  const [isEditMode, setIsEditMode] = useState(false);

  // Help modal state
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  // Resizable panes for desktop layout
  const {
    leftWidthPercent,
    isDragging,
    handleMouseDown: handleDividerMouseDown,
    handleDoubleClick: handleDividerDoubleClick,
    containerRef: resizableContainerRef,
  } = useResizablePanes();

  // Navigation guard to prevent accidental data loss
  // Use clearSession (not clearPDF) to preserve cached notes for resume
  const handleReset = useCallback(() => {
    clearSession();
    clearProfile();
  }, [clearSession, clearProfile]);

  const {
    showModal: showLeaveModal,
    handleStay,
    handleLeave,
    requestLeave,
  } = useNavigationGuard({
    enabled: !!(parsedPDF || pdfFileUrl),
    onConfirmLeave: handleReset,
  });

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

  // Get cached overview (may exist from previous upload or persistence)
  const cachedOverview = usePDFStore((state) => state.cachedOverview);
  const hasOverview = !!(parsedPDF?.overview || cachedOverview);

  const handlePageChange = useCallback(
    (page: number) => {
      // Allow page 0 (overview) if overview exists, otherwise start at 1
      const minPage = hasOverview ? 0 : 1;
      if (totalPages > 0 && page >= minPage && page <= totalPages) {
        setCurrentPage(page);
      }
    },
    [totalPages, setCurrentPage, hasOverview]
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

  // Keyboard navigation (arrow keys + Cmd/Ctrl+F for search)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Handle Cmd+F / Ctrl+F for search (works even in input fields)
      // Check both metaKey (Cmd on Mac) and ctrlKey (Ctrl on Windows/Linux)
      // Avoid navigator.platform which is deprecated and unreliable in production
      if ((event.metaKey || event.ctrlKey) && event.key === 'f') {
        event.preventDefault();
        openSearch();
        return;
      }

      // Handle Cmd+E / Ctrl+E for edit mode toggle (works even in input fields)
      if ((event.metaKey || event.ctrlKey) && event.key === 'e') {
        event.preventDefault();
        setIsEditMode((prev) => !prev);
        return;
      }

      // Ignore other keys if user is typing in an input field
      if (
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        // Allow going to page 0 (overview) from page 1 if overview exists
        const minPage = hasOverview ? 0 : 1;
        if (currentPage > minPage) {
          handlePageChange(currentPage - 1);
        }
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        handlePageChange(currentPage + 1);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        desktopNotesScrollRef.current?.scrollBy({ top: -100, behavior: 'smooth' });
        mobileNotesScrollRef.current?.scrollBy({ top: -100, behavior: 'smooth' });
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        desktopNotesScrollRef.current?.scrollBy({ top: 100, behavior: 'smooth' });
        mobileNotesScrollRef.current?.scrollBy({ top: 100, behavior: 'smooth' });
      } else if (event.key === '?') {
        event.preventDefault();
        setIsHelpOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, handlePageChange, openSearch, hasOverview]);

  // Reset notes scroll position and edit mode when page changes
  useEffect(() => {
    desktopNotesScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    mobileNotesScrollRef.current?.scrollTo({ top: 0, behavior: 'instant' });
    setIsEditMode(false);
  }, [currentPage]);

  // Clear search highlight after 5 seconds
  useEffect(() => {
    if (highlightTerm) {
      const timer = setTimeout(() => {
        setHighlightTerm(null);
        setHighlightSources(false, false);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [highlightTerm, setHighlightTerm, setHighlightSources]);

  // Export functionality
  const { toast } = useToast();

  const isExportReady = totalPages > 0 && Object.keys(notesCache).length >= totalPages;

  const handleExport = useCallback(() => {
    // Allow export with either parsedPDF or cached metadata (for cache-only sessions)
    if (!isExportReady || !cachedContentHash || !cachedFilename || !totalPages) return;

    // Build metadata from parsedPDF if available, otherwise use cached values
    const metadata = parsedPDF
      ? { original_filename: parsedPDF.original_filename, total_pages: parsedPDF.total_pages }
      : { original_filename: cachedFilename, total_pages: totalPages };

    const markdown = generateMarkdownExport({
      metadata,
      notesCache,
      contentHash: cachedContentHash,
      emphasisDrafts,
    });
    const exportFilename = getExportFilename(metadata.original_filename);
    downloadMarkdown(markdown, exportFilename);

    toast.success(`Exported ${exportFilename}`);
  }, [parsedPDF, notesCache, isExportReady, cachedContentHash, cachedFilename, totalPages, emphasisDrafts, toast]);

  // Handle emphasis integration
  const handleIntegrateEmphasis = useCallback(async () => {
    const currentNotes = notesCache[currentPage];
    const draft = emphasisDrafts[currentPage];
    // pageContent is optional - may not exist for cached sessions
    const pageContent = parsedPDF?.pages[currentPage - 1];

    if (!currentNotes || !draft?.trim() || !profile) return;

    setIsIntegratingEmphasis(true);
    try {
      const result = await integrateEmphasis({
        pageNumber: currentPage,
        existingNotes: currentNotes.notes.markdown,
        emphasisContent: draft,
        pageContent, // Can be undefined for cached sessions
        userProfile: profile,
        sessionId: parsedPDF?.session_id,
      });

      // Update notes with integrated markdown
      cacheNotes(currentPage, result);
      // Clear the draft after successful integration
      clearEmphasisDraft(currentPage);
      toast.success('Emphasis integrated');
    } catch (error) {
      console.error('Failed to integrate emphasis:', error);
      toast.error('Failed to integrate emphasis');
    } finally {
      setIsIntegratingEmphasis(false);
    }
  }, [currentPage, notesCache, emphasisDrafts, parsedPDF, profile, cacheNotes, clearEmphasisDraft, toast]);

  const handleGoBack = useCallback(() => {
    clearUploadError();
    clearSession();
  }, [clearUploadError, clearSession]);

  // Handle navigation from search results
  const handleSearchNavigate = useCallback(
    (pageNumber: number, source: 'pdf' | 'notes' | 'expansion') => {
      setCurrentPage(pageNumber);
      // On mobile, switch to the appropriate tab based on source
      if (source === 'pdf') {
        setMobileActiveTab('pdf');
      } else {
        setMobileActiveTab('notes');
      }
    },
    [setCurrentPage]
  );

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
            // Loading state with progress
            <>
              <div className="w-12 h-12 mx-auto mb-4 border-4 border-blue-200 dark:border-blue-900 border-t-blue-600 dark:border-t-blue-400 rounded-full animate-spin" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Processing Your PDF
              </h2>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 mb-3 overflow-hidden">
                <div
                  className="bg-blue-600 dark:bg-blue-500 h-2.5 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${uploadState.progressPercent}%` }}
                />
              </div>

              {/* Progress percentage */}
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                {uploadState.progressPercent}%
              </p>

              {/* Step message */}
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {uploadState.stepMessage || 'Preparing upload...'}
              </p>

              {/* Step indicators */}
              <div className="flex justify-center items-center gap-2">
                {(['validating', 'extracting', 'parsing', 'generating_overview'] as const).map((step, index) => {
                  const steps = ['validating', 'extracting', 'parsing', 'generating_overview'];
                  const currentStepIndex = uploadState.currentStep
                    ? steps.indexOf(uploadState.currentStep)
                    : -1;
                  const isCompleted = currentStepIndex > index;
                  const isActive = uploadState.currentStep === step;

                  return (
                    <div
                      key={step}
                      className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                        isCompleted
                          ? 'bg-blue-600 dark:bg-blue-500'
                          : isActive
                          ? 'bg-blue-600 dark:bg-blue-500 ring-4 ring-blue-200 dark:ring-blue-900'
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                      title={step.replace('_', ' ')}
                    />
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Guard: need profile and either parsedPDF or cached metadata
  if (!profile || totalPages === 0) {
    return null;
  }

  const currentNotes = notesCache[currentPage];
  // currentPageContent may be undefined in cache-only mode (parsedPDF is null)
  const currentPageContent = parsedPDF?.pages[currentPage - 1];
  const currentExpansions = getExpansionsForPage(currentPage);

  // Compute conditional highlight terms based on which sources were selected when clicking result
  const pdfHighlightTerm = highlightInPDF ? highlightTerm : null;
  const notesHighlightTerm = highlightInNotes ? highlightTerm : null;

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
            {filename}
          </span>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          {generationProgress.isGenerating && (
            <GenerationProgress
              completed={generationProgress.completedPages}
              total={totalPages}
            />
          )}

          <ThemeToggle />

          {/* Help button */}
          <button
            onClick={() => setIsHelpOpen(true)}
            className="p-2 rounded-lg transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400"
            aria-label="Keyboard shortcuts"
            title="Keyboard shortcuts (?)"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>

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
            onClick={requestLeave}
            className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors hidden sm:block"
          >
            Upload New PDF
          </button>

          {/* Mobile: icon button for reset */}
          <button
            onClick={requestLeave}
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
        <div
          ref={resizableContainerRef}
          className={`hidden md:flex flex-1 ${isDragging ? 'select-none' : ''}`}
        >
          {currentPage === 0 ? (
            /* Full-width Overview Panel when on page 0 */
            <OverviewPanel
              overview={parsedPDF?.overview ?? cachedOverview}
              isLoading={uploadState.isUploading}
            />
          ) : (
            /* Normal dual-pane layout for pages 1+ */
            <>
              {/* Left Pane - PDF Viewer */}
              <div
                className="bg-gray-200 dark:bg-gray-950 overflow-hidden"
                style={{ width: `${leftWidthPercent}%` }}
              >
                <PDFViewer
                  pdfUrl={pdfFileUrl}
                  totalPages={totalPages}
                  currentPage={currentPage}
                  onPageChange={handlePageChange}
                  highlightTerm={pdfHighlightTerm}
                  hasOverview={hasOverview}
                />
              </div>

              {/* Resizable Divider */}
              <ResizeDivider
                onMouseDown={handleDividerMouseDown}
                onDoubleClick={handleDividerDoubleClick}
                isDragging={isDragging}
              />

              {/* Right Pane - Notes */}
              <div ref={desktopNotesScrollRef} className="flex-1 bg-white dark:bg-gray-800 overflow-auto">
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
                  onUpdateExpansion={(expansionId, selectedText, content) =>
                    updateExpansion(currentPage, expansionId, selectedText, content)
                  }
                  pageContent={currentPageContent}
                  userProfile={profile}
                  sessionId={parsedPDF?.session_id}
                  onUpdateNotes={(markdown) => updateNotesMarkdown(currentPage, markdown)}
                  highlightTerm={notesHighlightTerm}
                  emphasisDraft={emphasisDrafts[currentPage] ?? ''}
                  onEmphasisDraftChange={(draft) => setEmphasisDraft(currentPage, draft)}
                  onIntegrateEmphasis={handleIntegrateEmphasis}
                  isIntegratingEmphasis={isIntegratingEmphasis}
                  isEditMode={isEditMode}
                  onToggleEditMode={() => setIsEditMode((prev) => !prev)}
                />
              </div>
            </>
          )}
        </div>

        {/* Mobile Layout - Tab-based */}
        <div className="md:hidden flex-1 flex flex-col">
          {/* Content area */}
          <div className="flex-1 overflow-hidden">
            {currentPage === 0 ? (
              /* Full-screen Overview Panel on mobile */
              <OverviewPanel
                overview={parsedPDF?.overview ?? cachedOverview}
                isLoading={uploadState.isUploading}
              />
            ) : mobileActiveTab === 'pdf' ? (
              <div className="h-full bg-gray-200 dark:bg-gray-950">
                <PDFViewer
                  pdfUrl={pdfFileUrl}
                  totalPages={totalPages}
                  currentPage={currentPage}
                  onPageChange={handlePageChange}
                  highlightTerm={pdfHighlightTerm}
                  hasOverview={hasOverview}
                />
              </div>
            ) : (
              <div ref={mobileNotesScrollRef} className="h-full bg-white dark:bg-gray-800 overflow-auto">
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
                  onUpdateExpansion={(expansionId, selectedText, content) =>
                    updateExpansion(currentPage, expansionId, selectedText, content)
                  }
                  pageContent={currentPageContent}
                  userProfile={profile}
                  sessionId={parsedPDF?.session_id}
                  onUpdateNotes={(markdown) => updateNotesMarkdown(currentPage, markdown)}
                  highlightTerm={notesHighlightTerm}
                  emphasisDraft={emphasisDrafts[currentPage] ?? ''}
                  onEmphasisDraftChange={(draft) => setEmphasisDraft(currentPage, draft)}
                  onIntegrateEmphasis={handleIntegrateEmphasis}
                  isIntegratingEmphasis={isIntegratingEmphasis}
                  isEditMode={isEditMode}
                  onToggleEditMode={() => setIsEditMode((prev) => !prev)}
                />
              </div>
            )}
          </div>

          {/* Mobile Tab Bar - hidden when on overview page */}
          {currentPage !== 0 && (
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
          )}
        </div>
      </main>

      {/* Footer - Page Navigation */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-2 flex items-center justify-center gap-4">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= (hasOverview ? 0 : 1)}
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
          {currentPage === 0 ? 'Overview' : `Page ${currentPage} of ${totalPages}`}
        </span>

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
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

      {/* Navigation confirmation modal */}
      <ConfirmationModal
        isOpen={showLeaveModal}
        title="Leave Study Session?"
        message="You'll lose your current study session. Generated notes are cached, but you'll need to re-upload the PDF to continue."
        confirmLabel="Leave"
        cancelLabel="Stay"
        onConfirm={handleLeave}
        onCancel={handleStay}
        variant="warning"
      />

      {/* Help modal (triggered by ?) */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* Search bar (triggered by Cmd+F) */}
      {isSearchOpen && <SearchBar onNavigateToResult={handleSearchNavigate} />}
    </div>
  );
}
