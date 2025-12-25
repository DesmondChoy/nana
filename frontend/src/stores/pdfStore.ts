import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { ParsedPDF, PageNotes, NotesResponse } from '../types';

// Custom storage with quota error handling
const createSafeStorage = (): StateStorage => ({
  getItem: (name) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded. Data will not persist across sessions.');
        // Emit custom event for UI to catch
        window.dispatchEvent(new CustomEvent('storage-quota-exceeded'));
      }
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      // Ignore errors
    }
  },
});

const safeStorage = createSafeStorage();

interface PDFState {
  // Current PDF data
  parsedPDF: ParsedPDF | null;
  pdfFileUrl: string | null; // Blob URL for rendering - not persisted
  currentPage: number;

  // Cached notes per page (keyed by page number)
  notesCache: Record<number, PageNotes>;
  cachedFilename: string | null; // Track which file the cache belongs to (persisted)

  // Generation progress
  generationProgress: {
    isGenerating: boolean;
    completedPages: number;
    totalPages: number;
  };

  // Storage warning
  storageWarning: boolean;

  // Actions
  setParsedPDF: (pdf: ParsedPDF, fileUrl?: string) => void;
  setPdfFileUrl: (url: string) => void;
  clearPDF: () => void;
  setCurrentPage: (page: number) => void;
  cacheNotes: (pageNumber: number, notes: NotesResponse) => void;
  getNotesForPage: (pageNumber: number) => PageNotes | null;
  setGenerationProgress: (progress: Partial<PDFState['generationProgress']>) => void;
  clearNotesCache: () => void;
  setStorageWarning: (warning: boolean) => void;
}

export const usePDFStore = create<PDFState>()(
  persist(
    (set, get) => ({
      parsedPDF: null,
      pdfFileUrl: null,
      currentPage: 1,
      notesCache: {},
      cachedFilename: null,
      generationProgress: {
        isGenerating: false,
        completedPages: 0,
        totalPages: 0,
      },
      storageWarning: false,

      setParsedPDF: (pdf, fileUrl) => {
        const state = get();
        // Keep cache if re-uploading the same file, otherwise clear it
        const isSameFile = state.cachedFilename === pdf.original_filename;
        const preservedCache = isSameFile ? state.notesCache : {};
        const preservedPage = isSameFile ? state.currentPage : 1;

        set({
          parsedPDF: pdf,
          pdfFileUrl: fileUrl ?? null,
          currentPage: preservedPage,
          notesCache: preservedCache,
          cachedFilename: pdf.original_filename,
          generationProgress: {
            isGenerating: false,
            completedPages: Object.keys(preservedCache).length,
            totalPages: pdf.total_pages,
          },
        });
      },

      setPdfFileUrl: (url) => set({ pdfFileUrl: url }),

      clearPDF: () => {
        // Revoke the blob URL to free memory
        const currentUrl = get().pdfFileUrl;
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
        }
        set({
          parsedPDF: null,
          pdfFileUrl: null,
          currentPage: 1,
          notesCache: {},
          cachedFilename: null,
          generationProgress: {
            isGenerating: false,
            completedPages: 0,
            totalPages: 0,
          },
          storageWarning: false,
        });
      },

      setCurrentPage: (page) => set({ currentPage: page }),

      cacheNotes: (pageNumber, notes) =>
        set((state) => ({
          notesCache: {
            ...state.notesCache,
            [pageNumber]: {
              page_number: pageNumber,
              notes,
              generated_at: new Date().toISOString(),
            },
          },
          generationProgress: {
            ...state.generationProgress,
            completedPages: Object.keys(state.notesCache).length + 1,
          },
        })),

      getNotesForPage: (pageNumber) => get().notesCache[pageNumber] ?? null,

      setGenerationProgress: (progress) =>
        set((state) => ({
          generationProgress: { ...state.generationProgress, ...progress },
        })),

      clearNotesCache: () => set({ notesCache: {}, cachedFilename: null }),

      setStorageWarning: (warning) => set({ storageWarning: warning }),
    }),
    {
      name: 'nana-pdf-storage',
      storage: createJSONStorage(() => safeStorage),
      // Only persist notes cache - parsedPDF is too large and can be re-extracted
      // pdfFileUrl is session-only (blob URLs don't survive refresh)
      partialize: (state) => ({
        notesCache: state.notesCache,
        cachedFilename: state.cachedFilename,
        currentPage: state.currentPage,
      }),
    }
  )
);
