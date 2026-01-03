import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { ParsedPDF, PageNotes, NotesResponse, Expansion, InlineCommandResponse } from '../types';

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

  // Failed pages (generation attempted but failed)
  failedPages: Set<number>;

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
  markPageFailed: (pageNumber: number) => void;
  clearPageFailure: (pageNumber: number) => void;
  // Expansion actions
  addExpansion: (pageNumber: number, selectedText: string, response: InlineCommandResponse) => void;
  removeExpansion: (pageNumber: number, expansionId: string) => void;
  getExpansionsForPage: (pageNumber: number) => Expansion[];
}

// Check if cached notes are in the old format (sections-based) vs new format (markdown-based)
function isOldNotesFormat(notesCache: Record<number, PageNotes>): boolean {
  const entries = Object.values(notesCache);
  if (entries.length === 0) return false;

  // Old format has notes.sections array, new format has notes.markdown string
  const firstEntry = entries[0];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return 'sections' in (firstEntry.notes as any) && !('markdown' in firstEntry.notes);
}

export const usePDFStore = create<PDFState>()(
  persist(
    (set, get) => ({
      parsedPDF: null,
      pdfFileUrl: null,
      currentPage: 1,
      notesCache: {},
      cachedFilename: null,
      failedPages: new Set<number>(),
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
          failedPages: isSameFile ? state.failedPages : new Set<number>(),
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
          failedPages: new Set<number>(),
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
        set((state) => {
          // Clear any failure status for this page on successful cache
          const newFailedPages = new Set(state.failedPages);
          newFailedPages.delete(pageNumber);
          return {
            notesCache: {
              ...state.notesCache,
              [pageNumber]: {
                page_number: pageNumber,
                notes,
                generated_at: new Date().toISOString(),
              },
            },
            failedPages: newFailedPages,
            generationProgress: {
              ...state.generationProgress,
              completedPages: Object.keys(state.notesCache).length + 1,
            },
          };
        }),

      getNotesForPage: (pageNumber) => get().notesCache[pageNumber] ?? null,

      setGenerationProgress: (progress) =>
        set((state) => ({
          generationProgress: { ...state.generationProgress, ...progress },
        })),

      clearNotesCache: () => set({ notesCache: {}, cachedFilename: null, failedPages: new Set<number>() }),

      setStorageWarning: (warning) => set({ storageWarning: warning }),

      markPageFailed: (pageNumber) =>
        set((state) => {
          const newFailedPages = new Set(state.failedPages);
          newFailedPages.add(pageNumber);
          return { failedPages: newFailedPages };
        }),

      clearPageFailure: (pageNumber) =>
        set((state) => {
          const newFailedPages = new Set(state.failedPages);
          newFailedPages.delete(pageNumber);
          return { failedPages: newFailedPages };
        }),

      addExpansion: (pageNumber, selectedText, response) =>
        set((state) => {
          const existingNotes = state.notesCache[pageNumber];
          if (!existingNotes) return state;

          const newExpansion: Expansion = {
            id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            command_type: response.command_type,
            selected_text: selectedText,
            content: response.content,
            is_diagram: response.is_diagram,
            created_at: new Date().toISOString(),
          };

          return {
            notesCache: {
              ...state.notesCache,
              [pageNumber]: {
                ...existingNotes,
                expansions: [...(existingNotes.expansions || []), newExpansion],
              },
            },
          };
        }),

      removeExpansion: (pageNumber, expansionId) =>
        set((state) => {
          const existingNotes = state.notesCache[pageNumber];
          if (!existingNotes || !existingNotes.expansions) return state;

          return {
            notesCache: {
              ...state.notesCache,
              [pageNumber]: {
                ...existingNotes,
                expansions: existingNotes.expansions.filter(
                  (exp) => exp.id !== expansionId
                ),
              },
            },
          };
        }),

      getExpansionsForPage: (pageNumber) => {
        const notes = get().notesCache[pageNumber];
        return notes?.expansions || [];
      },
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
      // Migrate old format cache on rehydration
      onRehydrateStorage: () => (state) => {
        if (state && isOldNotesFormat(state.notesCache)) {
          console.log('[NANA] Detected old notes format in cache, clearing for migration to markdown format');
          state.notesCache = {};
          state.cachedFilename = null;
        }
      },
    }
  )
);
