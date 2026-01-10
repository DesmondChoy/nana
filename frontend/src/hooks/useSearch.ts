import { useEffect, useMemo, useCallback } from 'react';
import { usePDFStore } from '../stores/pdfStore';
import { useSearchStore, type SearchResult } from '../stores/searchStore';

const DEBOUNCE_MS = 300;
const CONTEXT_SIZE = 50;
const MAX_RESULTS = 100;

/**
 * Extracts context around a match for display in search results.
 * Shows ~50 characters before and after the match.
 */
function extractContext(
  text: string,
  matchStart: number,
  matchLength: number
): { matchText: string; highlightStart: number; highlightEnd: number } {
  const start = Math.max(0, matchStart - CONTEXT_SIZE);
  const end = Math.min(text.length, matchStart + matchLength + CONTEXT_SIZE);

  const prefix = start > 0 ? '...' : '';
  const suffix = end < text.length ? '...' : '';

  return {
    matchText: prefix + text.slice(start, end) + suffix,
    highlightStart: matchStart - start + prefix.length,
    highlightEnd: matchStart - start + prefix.length + matchLength,
  };
}

/**
 * Finds all occurrences of a query in the given text with context.
 */
function findMatches(
  text: string,
  query: string,
  pageNumber: number,
  source: 'pdf' | 'notes' | 'expansion',
  expansionId?: string
): SearchResult[] {
  if (!text || text.length < query.length) {
    return [];
  }

  const results: SearchResult[] = [];
  const lowerText = text.toLowerCase();
  let searchStart = 0;

  // Find all occurrences using indexOf in a loop
  while (searchStart < lowerText.length) {
    const matchIndex = lowerText.indexOf(query, searchStart);

    if (matchIndex === -1) {
      break; // No more matches
    }

    // Extract context around the match
    const context = extractContext(text, matchIndex, query.length);

    results.push({
      pageNumber,
      source,
      matchText: context.matchText,
      highlightStart: context.highlightStart,
      highlightEnd: context.highlightEnd,
      expansionId,
    });

    // Move past this match to find the next one (non-overlapping)
    searchStart = matchIndex + query.length;
  }

  return results;
}

/**
 * Custom hook that provides debounced search functionality across PDF and notes content.
 *
 * @returns Object with search execution function and loading state
 */
export function useSearch() {
  const parsedPDF = usePDFStore((state) => state.parsedPDF);
  const notesCache = usePDFStore((state) => state.notesCache);
  const currentPage = usePDFStore((state) => state.currentPage);

  const query = useSearchStore((state) => state.query);
  const filters = useSearchStore((state) => state.filters);
  const setResults = useSearchStore((state) => state.setResults);

  // Determine which pages to search based on scope
  const pagesToSearch = useMemo(() => {
    if (filters.scope === 'current') {
      return [currentPage];
    }

    // 'all' scope: determine total pages from available sources
    if (parsedPDF) {
      return Array.from({ length: parsedPDF.total_pages }, (_, i) => i + 1);
    }

    // Fallback when resuming from cache (parsedPDF is null)
    // Use notesCache keys to determine which pages exist
    const cachedPages = Object.keys(notesCache).map(Number).sort((a, b) => a - b);
    return cachedPages.length > 0 ? cachedPages : [];
  }, [parsedPDF, notesCache, filters.scope, currentPage]);

  // The main search function
  const executeSearch = useCallback(() => {
    const trimmedQuery = query.trim().toLowerCase();

    if (!trimmedQuery || trimmedQuery.length < 2) {
      setResults([]);
      return;
    }

    const allResults: SearchResult[] = [];

    for (const pageNum of pagesToSearch) {
      // Search PDF text if filter is enabled
      if (filters.searchPDF && parsedPDF) {
        const pageContent = parsedPDF.pages.find((p) => p.page_number === pageNum);
        if (pageContent?.text) {
          const pdfMatches = findMatches(
            pageContent.text,
            trimmedQuery,
            pageNum,
            'pdf'
          );
          allResults.push(...pdfMatches);
        }
      }

      // Search notes if filter is enabled
      if (filters.searchNotes) {
        const pageNotes = notesCache[pageNum];

        // Search main notes markdown
        if (pageNotes?.notes?.markdown) {
          const notesMatches = findMatches(
            pageNotes.notes.markdown,
            trimmedQuery,
            pageNum,
            'notes'
          );
          allResults.push(...notesMatches);
        }

        // Search expansions
        if (pageNotes?.expansions) {
          for (const expansion of pageNotes.expansions) {
            const expansionMatches = findMatches(
              expansion.content,
              trimmedQuery,
              pageNum,
              'expansion',
              expansion.id
            );
            allResults.push(...expansionMatches);
          }
        }
      }

      // Stop if we've hit the result limit
      if (allResults.length >= MAX_RESULTS) {
        break;
      }
    }

    // Limit results and update store
    setResults(allResults.slice(0, MAX_RESULTS));
  }, [query, pagesToSearch, filters, parsedPDF, notesCache, setResults]);

  // Debounced search execution
  useEffect(() => {
    const timer = setTimeout(executeSearch, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [executeSearch]);

  return { executeSearch };
}
