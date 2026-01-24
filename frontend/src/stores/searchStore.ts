import { create } from 'zustand';

export interface SearchResult {
  pageNumber: number;
  source: 'pdf' | 'notes' | 'expansion';
  matchText: string; // Text with ~50 char context on each side
  highlightStart: number; // Start position of match within matchText
  highlightEnd: number; // End position of match within matchText
  expansionId?: string; // For expansion matches, track which expansion
}

interface SearchFilters {
  searchPDF: boolean;
  searchNotes: boolean;
  scope: 'current' | 'all';
}

interface SearchState {
  isOpen: boolean;
  query: string;
  filters: SearchFilters;
  results: SearchResult[];
  selectedResultIndex: number; // For keyboard navigation
  highlightTerm: string | null; // Term to highlight in content after navigation
  highlightInPDF: boolean; // Whether to highlight in PDF pane
  highlightInNotes: boolean; // Whether to highlight in Notes pane

  // Actions
  openSearch: () => void;
  closeSearch: () => void;
  setQuery: (query: string) => void;
  setFilters: (filters: Partial<SearchFilters>) => void;
  setResults: (results: SearchResult[]) => void;
  setSelectedResultIndex: (index: number) => void;
  setHighlightTerm: (term: string | null) => void;
  setHighlightSources: (inPDF: boolean, inNotes: boolean) => void;
  clearSearch: () => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  isOpen: false,
  query: '',
  filters: {
    searchPDF: true,
    searchNotes: true,
    scope: 'all',
  },
  results: [],
  selectedResultIndex: -1,
  highlightTerm: null,
  highlightInPDF: false,
  highlightInNotes: false,

  openSearch: () => set({ isOpen: true, highlightTerm: null }), // Clear highlight when opening new search

  closeSearch: () =>
    set({
      isOpen: false,
      query: '',
      results: [],
      selectedResultIndex: -1,
      // Note: highlightTerm is NOT cleared here - it persists to highlight content
    }),

  setQuery: (query) => set({ query, selectedResultIndex: -1 }),

  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
      selectedResultIndex: -1,
    })),

  setResults: (results) => set({ results }),

  setSelectedResultIndex: (index) => set({ selectedResultIndex: index }),

  setHighlightTerm: (term) => set({ highlightTerm: term }),

  setHighlightSources: (inPDF, inNotes) =>
    set({ highlightInPDF: inPDF, highlightInNotes: inNotes }),

  clearSearch: () =>
    set({
      query: '',
      results: [],
      selectedResultIndex: -1,
      highlightTerm: null,
      highlightInPDF: false,
      highlightInNotes: false,
    }),
}));
