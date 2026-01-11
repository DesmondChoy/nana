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

  // Upload state (for immediate navigation)
  uploadState: {
    isUploading: boolean;
    error: string | null;
    pendingFileUrl: string | null; // Blob URL created before upload starts
    pendingFileSize: number | null; // File.size for cache validation
    pendingFileModified: number | null; // File.lastModified for cache validation
  };

  // Cached notes per page (keyed by page number)
  notesCache: Record<number, PageNotes>;
  // Emphasis drafts per page (keyed by page number) - persisted
  emphasisDrafts: Record<number, string>;
  cachedFilename: string | null; // Track which file the cache belongs to (persisted)
  cachedFileSize: number | null; // File.size for cache validation (persisted)
  cachedFileModified: number | null; // File.lastModified for cache validation (persisted)
  cachedTotalPages: number | null; // Total pages for completeness check (persisted)
  cachedContentHash: string | null; // SHA-256 hash of PDF bytes for import matching (persisted)

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
  startUpload: (fileUrl: string, fileSize: number, fileModified: number) => void;
  uploadSuccess: (pdf: ParsedPDF) => void;
  uploadFailed: (error: string) => void;
  clearUploadError: () => void;
  resumeFromCache: (fileUrl: string) => void; // Skip API when cache is complete
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
  updateExpansion: (pageNumber: number, expansionId: string, selectedText: string, content: string) => void;
  getExpansionsForPage: (pageNumber: number) => Expansion[];
  // Note editing
  updateNotesMarkdown: (pageNumber: number, markdown: string) => void;
  // Import notes from markdown file
  importNotesFromMarkdown: (importedNotes: Record<number, PageNotes>) => void;
  // Emphasis draft actions
  setEmphasisDraft: (pageNumber: number, draft: string) => void;
  clearEmphasisDraft: (pageNumber: number) => void;
  // Clear session but preserve cache (for "Leave Study Session")
  clearSession: () => void;
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
      uploadState: {
        isUploading: false,
        error: null,
        pendingFileUrl: null,
        pendingFileSize: null,
        pendingFileModified: null,
      },
      notesCache: {},
      emphasisDrafts: {},
      cachedFilename: null,
      cachedFileSize: null,
      cachedFileModified: null,
      cachedTotalPages: null,
      cachedContentHash: null,
      failedPages: new Set<number>(),
      generationProgress: {
        isGenerating: false,
        completedPages: 0,
        totalPages: 0,
      },
      storageWarning: false,

      startUpload: (fileUrl, fileSize, fileModified) =>
        set({
          uploadState: {
            isUploading: true,
            error: null,
            pendingFileUrl: fileUrl,
            pendingFileSize: fileSize,
            pendingFileModified: fileModified,
          },
        }),

      uploadSuccess: (pdf) => {
        const state = get();
        const fileUrl = state.uploadState.pendingFileUrl;
        const fileSize = state.uploadState.pendingFileSize;
        const fileModified = state.uploadState.pendingFileModified;
        // Keep cache if re-uploading the same file, otherwise clear it
        const isSameFile = state.cachedFilename === pdf.original_filename;
        const preservedCache = isSameFile ? state.notesCache : {};
        const preservedPage = isSameFile ? state.currentPage : 1;

        set({
          parsedPDF: pdf,
          pdfFileUrl: fileUrl,
          currentPage: preservedPage,
          notesCache: preservedCache,
          cachedFilename: pdf.original_filename,
          cachedFileSize: fileSize,
          cachedFileModified: fileModified,
          cachedTotalPages: pdf.total_pages,
          cachedContentHash: pdf.content_hash,
          failedPages: isSameFile ? state.failedPages : new Set<number>(),
          uploadState: {
            isUploading: false,
            error: null,
            pendingFileUrl: null,
            pendingFileSize: null,
            pendingFileModified: null,
          },
          generationProgress: {
            isGenerating: false,
            completedPages: Object.keys(preservedCache).length,
            totalPages: pdf.total_pages,
          },
        });
      },

      uploadFailed: (error) =>
        set((state) => {
          // Revoke the pending URL on failure
          if (state.uploadState.pendingFileUrl) {
            URL.revokeObjectURL(state.uploadState.pendingFileUrl);
          }
          return {
            uploadState: {
              isUploading: false,
              error,
              pendingFileUrl: null,
              pendingFileSize: null,
              pendingFileModified: null,
            },
          };
        }),

      clearUploadError: () =>
        set((state) => ({
          uploadState: { ...state.uploadState, error: null },
        })),

      // Resume from complete cache without API call
      resumeFromCache: (fileUrl) =>
        set((state) => ({
          pdfFileUrl: fileUrl,
          // parsedPDF stays null - not needed when all notes are cached
          generationProgress: {
            isGenerating: false,
            completedPages: Object.keys(state.notesCache).length,
            totalPages: state.cachedTotalPages ?? 0,
          },
        })),

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
        const state = get();
        if (state.pdfFileUrl) {
          URL.revokeObjectURL(state.pdfFileUrl);
        }
        if (state.uploadState.pendingFileUrl) {
          URL.revokeObjectURL(state.uploadState.pendingFileUrl);
        }
        set({
          parsedPDF: null,
          pdfFileUrl: null,
          currentPage: 1,
          uploadState: {
            isUploading: false,
            error: null,
            pendingFileUrl: null,
            pendingFileSize: null,
            pendingFileModified: null,
          },
          notesCache: {},
          emphasisDrafts: {},
          cachedFilename: null,
          cachedFileSize: null,
          cachedFileModified: null,
          cachedTotalPages: null,
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

      clearNotesCache: () => set({
        notesCache: {},
        emphasisDrafts: {},
        cachedFilename: null,
        cachedFileSize: null,
        cachedFileModified: null,
        cachedTotalPages: null,
        cachedContentHash: null,
        failedPages: new Set<number>(),
      }),

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
            id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
            command_type: response.command_type,
            selected_text: selectedText,
            content: response.content,
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

      updateExpansion: (pageNumber, expansionId, selectedText, content) =>
        set((state) => {
          const existingNotes = state.notesCache[pageNumber];
          if (!existingNotes || !existingNotes.expansions) return state;

          return {
            notesCache: {
              ...state.notesCache,
              [pageNumber]: {
                ...existingNotes,
                expansions: existingNotes.expansions.map((exp) =>
                  exp.id === expansionId
                    ? { ...exp, selected_text: selectedText, content }
                    : exp
                ),
              },
            },
          };
        }),

      getExpansionsForPage: (pageNumber) => {
        const notes = get().notesCache[pageNumber];
        return notes?.expansions || [];
      },

      updateNotesMarkdown: (pageNumber, markdown) =>
        set((state) => {
          const existingNotes = state.notesCache[pageNumber];
          if (!existingNotes) return state;
          return {
            notesCache: {
              ...state.notesCache,
              [pageNumber]: {
                ...existingNotes,
                notes: { ...existingNotes.notes, markdown },
              },
            },
          };
        }),

      importNotesFromMarkdown: (importedNotes) =>
        set((state) => ({
          notesCache: importedNotes,
          failedPages: new Set<number>(),
          generationProgress: {
            ...state.generationProgress,
            completedPages: Object.keys(importedNotes).length,
          },
        })),

      setEmphasisDraft: (pageNumber, draft) =>
        set((state) => ({
          emphasisDrafts: {
            ...state.emphasisDrafts,
            [pageNumber]: draft,
          },
        })),

      clearEmphasisDraft: (pageNumber) =>
        set((state) => {
          const { [pageNumber]: _, ...rest } = state.emphasisDrafts;
          return { emphasisDrafts: rest };
        }),

      // Clear session but preserve cache (for "Leave Study Session")
      clearSession: () => {
        const state = get();
        // Revoke blob URLs to free memory
        if (state.pdfFileUrl) {
          URL.revokeObjectURL(state.pdfFileUrl);
        }
        if (state.uploadState.pendingFileUrl) {
          URL.revokeObjectURL(state.uploadState.pendingFileUrl);
        }
        // Only clear session-specific state, preserve cache
        set({
          parsedPDF: null,
          pdfFileUrl: null,
          uploadState: {
            isUploading: false,
            error: null,
            pendingFileUrl: null,
            pendingFileSize: null,
            pendingFileModified: null,
          },
          generationProgress: {
            isGenerating: false,
            completedPages: Object.keys(state.notesCache).length,
            totalPages: state.cachedTotalPages ?? 0,
          },
        });
      },
    }),
    {
      name: 'nana-pdf-storage',
      storage: createJSONStorage(() => safeStorage),
      // Only persist notes cache and metadata - parsedPDF is too large and can be re-extracted
      // pdfFileUrl is session-only (blob URLs don't survive refresh)
      partialize: (state) => ({
        notesCache: state.notesCache,
        emphasisDrafts: state.emphasisDrafts,
        cachedFilename: state.cachedFilename,
        cachedFileSize: state.cachedFileSize,
        cachedFileModified: state.cachedFileModified,
        cachedTotalPages: state.cachedTotalPages,
        cachedContentHash: state.cachedContentHash,
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
