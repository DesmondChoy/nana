import { useEffect, useCallback } from 'react';
import { usePDFStore, useUserStore } from '../stores';
import PDFViewer from '../components/PDFViewer';
import NotesPanel from '../components/NotesPanel';
import GenerationProgress from '../components/GenerationProgress';
import { generateNotes } from '../api/client';

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
  const topicMastery = useUserStore((state) => state.topicMastery);
  const clearProfile = useUserStore((state) => state.clearProfile);

  // Eager sequential notes generation
  useEffect(() => {
    if (!parsedPDF || !profile) return;

    let isMounted = true;

    const generateAllNotes = async () => {
      // Check if already generating to avoid duplicate progress updates
      // Note: In StrictMode, this might still trigger twice initially without the check
      // but the isMounted flag will stop the unmounted one.
      setGenerationProgress({ isGenerating: true, completedPages: 0 });

      for (let i = 0; i < parsedPDF.pages.length; i++) {
        if (!isMounted) break;

        const pageNum = i + 1;

        // Skip if already cached
        if (notesCache[pageNum]) {
          if (isMounted) {
            setGenerationProgress({ completedPages: Object.keys(notesCache).length });
          }
          continue;
        }

        const currentPageContent = parsedPDF.pages[i];
        const previousPageContent = i > 0 ? parsedPDF.pages[i - 1] : undefined;

        try {
          // Double check before expensive API call
          if (!isMounted) break;
          
          const notes = await generateNotes({
            currentPage: currentPageContent,
            previousPage: previousPageContent,
            userProfile: profile,
            topicMastery,
            filename: parsedPDF.original_filename,
          });

          if (isMounted) {
            cacheNotes(pageNum, notes);
          }
        } catch (error) {
          console.error(`Failed to generate notes for page ${pageNum}:`, error);
          // Continue with next page on error
        }
      }

      if (isMounted) {
        setGenerationProgress({ isGenerating: false });
      }
    };

    // Only start generation if we haven't completed all pages
    const cachedCount = Object.keys(notesCache).length;
    if (cachedCount < parsedPDF.total_pages) {
      generateAllNotes();
    }

    return () => {
      isMounted = false;
    };
  }, [parsedPDF, profile, notesCache, topicMastery, setGenerationProgress, cacheNotes]); // Only run when PDF changes

  const handlePageChange = useCallback(
    (page: number) => {
      if (parsedPDF && page >= 1 && page <= parsedPDF.total_pages) {
        setCurrentPage(page);
      }
    },
    [parsedPDF, setCurrentPage]
  );

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
          />
        </div>
      </main>

      {/* Footer - Page Navigation */}
      <footer className="bg-white border-t px-4 py-2 flex items-center justify-center gap-4">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="px-3 py-1 rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Previous
        </button>

        <span className="text-sm text-gray-600">
          Page {currentPage} of {parsedPDF.total_pages}
        </span>

        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage >= parsedPDF.total_pages}
          className="px-3 py-1 rounded border disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
        >
          Next
        </button>
      </footer>
    </div>
  );
}
