import { useEffect, useCallback, useRef } from 'react';
import { useSearchStore, type SearchResult } from '../stores/searchStore';
import { useSearch } from '../hooks/useSearch';
import { usePDFStore } from '../stores/pdfStore';

interface SearchBarProps {
  onNavigateToResult: (pageNumber: number, source: 'pdf' | 'notes' | 'expansion') => void;
}

export function SearchBar({ onNavigateToResult }: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const isOpen = useSearchStore((state) => state.isOpen);
  const query = useSearchStore((state) => state.query);
  const filters = useSearchStore((state) => state.filters);
  const results = useSearchStore((state) => state.results);
  const selectedResultIndex = useSearchStore((state) => state.selectedResultIndex);
  const closeSearch = useSearchStore((state) => state.closeSearch);
  const setQuery = useSearchStore((state) => state.setQuery);
  const setFilters = useSearchStore((state) => state.setFilters);
  const setSelectedResultIndex = useSearchStore((state) => state.setSelectedResultIndex);
  const setHighlightTerm = useSearchStore((state) => state.setHighlightTerm);

  // Hook that performs the actual search
  useSearch();

  // Focus input when search opens
  useEffect(() => {
    if (isOpen) {
      // Small delay to ensure the input is rendered
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle Escape key to close
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeSearch();
      }
    },
    [closeSearch]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Keyboard navigation within search
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const newIndex = Math.min(selectedResultIndex + 1, results.length - 1);
      setSelectedResultIndex(newIndex);
      scrollResultIntoView(newIndex);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const newIndex = Math.max(selectedResultIndex - 1, 0);
      setSelectedResultIndex(newIndex);
      scrollResultIntoView(newIndex);
    } else if (e.key === 'Enter' && results.length > 0) {
      e.preventDefault();
      const resultIndex = selectedResultIndex >= 0 ? selectedResultIndex : 0;
      const result = results[resultIndex];
      if (result) {
        handleResultClick(result);
      }
    }
  };

  const scrollResultIntoView = (index: number) => {
    const resultElements = resultsRef.current?.querySelectorAll('[data-result-item]');
    resultElements?.[index]?.scrollIntoView({ block: 'nearest' });
  };

  const handleResultClick = (result: SearchResult) => {
    // Set the highlight term before closing so content can highlight matches
    setHighlightTerm(query.trim());
    onNavigateToResult(result.pageNumber, result.source);
    closeSearch();
  };

  if (!isOpen) return null;

  const sourceColors = {
    pdf: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
    notes: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
    expansion: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
  };

  const sourceLabels = {
    pdf: 'PDF',
    notes: 'Notes',
    expansion: 'Expansion',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center pt-20 bg-black/20"
      onClick={closeSearch}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-xl mx-4 h-fit max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              ref={inputRef}
              type="text"
              placeholder="Search PDF and notes..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              className="w-full pl-10 pr-10 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-gray-900 dark:text-gray-100 placeholder-gray-500"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-4 mt-3">
            {/* Source checkboxes */}
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.searchPDF}
                  onChange={(e) => setFilters({ searchPDF: e.target.checked })}
                  className="w-4 h-4 accent-blue-600 dark:accent-blue-400 cursor-pointer"
                />
                PDF
              </label>
              <label className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.searchNotes}
                  onChange={(e) => setFilters({ searchNotes: e.target.checked })}
                  className="w-4 h-4 accent-blue-600 dark:accent-blue-400 cursor-pointer"
                />
                Notes
              </label>
            </div>

            {/* Scope toggle */}
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-sm text-gray-500 dark:text-gray-400">Scope:</span>
              <div className="flex rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
                <button
                  onClick={() => setFilters({ scope: 'current' })}
                  className={`px-3 py-1 text-sm transition-colors ${
                    filters.scope === 'current'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  Current Page
                </button>
                <button
                  onClick={() => setFilters({ scope: 'all' })}
                  className={`px-3 py-1 text-sm transition-colors ${
                    filters.scope === 'all'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  All Pages
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Results */}
        <div ref={resultsRef} className="overflow-y-auto flex-1">
          {query.length >= 2 && results.length === 0 && (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              No results found for "{query}"
            </div>
          )}

          {query.length > 0 && query.length < 2 && (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              Type at least 2 characters to search
            </div>
          )}

          {results.length > 0 && (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {results.map((result, index) => (
                <li
                  key={`${result.pageNumber}-${result.source}-${index}`}
                  data-result-item
                  onClick={() => handleResultClick(result)}
                  className={`px-4 py-3 cursor-pointer transition-colors ${
                    index === selectedResultIndex
                      ? 'bg-blue-50 dark:bg-blue-900/30'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-2 py-0.5 text-xs font-medium rounded ${sourceColors[result.source]}`}>
                      {sourceLabels[result.source]}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Page {result.pageNumber}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
                    <HighlightedText
                      text={result.matchText}
                      highlightStart={result.highlightStart}
                      highlightEnd={result.highlightEnd}
                    />
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-4">
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-mono">↑↓</kbd> to navigate
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-mono">Enter</kbd> to select
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-[10px] font-mono">Esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Renders text with the matched portion highlighted.
 */
function HighlightedText({
  text,
  highlightStart,
  highlightEnd,
}: {
  text: string;
  highlightStart: number;
  highlightEnd: number;
}) {
  const before = text.slice(0, highlightStart);
  const match = text.slice(highlightStart, highlightEnd);
  const after = text.slice(highlightEnd);

  return (
    <>
      {before}
      <mark className="bg-yellow-300 dark:bg-yellow-500/60 text-gray-900 dark:text-gray-100 rounded px-0.5">
        {match}
      </mark>
      {after}
    </>
  );
}
