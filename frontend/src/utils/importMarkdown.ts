/**
 * Markdown Import Utility
 *
 * Parses exported NANA Markdown files back into structured PageNotes format.
 * Handles YAML frontmatter for validation and page sections for notes content.
 */

import type { PageNotes, NotesResponse, Expansion, InlineCommandType } from '../types';

// Types for parsed frontmatter
export interface MarkdownFrontmatter {
  nana_version: number;
  content_hash: string;
  original_filename: string;
  total_pages: number;
  exported_at: string;
}

export interface ImportValidation {
  isValid: boolean;
  hashMatches: boolean;
  pageCountMatches: boolean;
  frontmatter: MarkdownFrontmatter | null;
  error?: string;
}

/**
 * Map human-readable labels back to command types
 */
const LABEL_TO_COMMAND_TYPE: Record<string, InlineCommandType> = {
  Elaboration: 'elaborate',
  Simplified: 'simplify',
  Analogy: 'analogy',
};

/**
 * Parse YAML frontmatter from Markdown content.
 * Simple parser that handles our specific format without external dependencies.
 */
function parseFrontmatter(content: string): MarkdownFrontmatter | null {
  // Match frontmatter block: starts with ---, ends with ---
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yaml = match[1];
  const lines = yaml.split('\n');
  const result: Record<string, string | number> = {};

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();

    // Parse numbers for specific fields
    if (key === 'nana_version' || key === 'total_pages') {
      result[key] = parseInt(value, 10);
    } else {
      result[key] = value;
    }
  }

  // Validate required fields
  if (
    !result.nana_version ||
    !result.content_hash ||
    !result.original_filename ||
    !result.total_pages ||
    !result.exported_at
  ) {
    return null;
  }

  return result as unknown as MarkdownFrontmatter;
}

/**
 * Validate imported Markdown against current PDF.
 */
export function validateImport(
  content: string,
  currentHash: string,
  currentPageCount: number
): ImportValidation {
  const frontmatter = parseFrontmatter(content);

  if (!frontmatter) {
    return {
      isValid: false,
      hashMatches: false,
      pageCountMatches: false,
      frontmatter: null,
      error: 'No valid frontmatter found. This file may not be a NANA export.',
    };
  }

  if (frontmatter.nana_version !== 1) {
    return {
      isValid: false,
      hashMatches: false,
      pageCountMatches: false,
      frontmatter,
      error: `Unsupported version: ${frontmatter.nana_version}. Expected version 1.`,
    };
  }

  const hashMatches = frontmatter.content_hash === currentHash;
  const pageCountMatches = frontmatter.total_pages === currentPageCount;

  return {
    isValid: true,
    hashMatches,
    pageCountMatches,
    frontmatter,
  };
}

/**
 * Parse an expansion blockquote back to structured format.
 *
 * Expansion format in export:
 * > **Label** on "selected text..."
 * >
 * > expansion content here
 */
function parseExpansion(blockquote: string): Expansion | null {
  // Match header: > **Label** on "selected text"
  const headerMatch = blockquote.match(/^>\s*\*\*(\w+)\*\*\s+on\s+"(.+?)"/);
  if (!headerMatch) return null;

  const [, label, selectedText] = headerMatch;
  const commandType = LABEL_TO_COMMAND_TYPE[label];
  if (!commandType) return null;

  // Extract content: lines after the header (skipping empty > line)
  const lines = blockquote.split('\n');
  const contentLines: string[] = [];
  let startContent = false;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    // Skip the empty > line after header
    if (!startContent && line.trim() === '>') {
      startContent = true;
      continue;
    }
    if (startContent) {
      // Remove > prefix and optional space
      contentLines.push(line.replace(/^>\s?/, ''));
    }
  }

  const content = contentLines.join('\n').trim();
  if (!content) return null;

  return {
    id: `imported-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    command_type: commandType,
    selected_text: selectedText,
    content,
    created_at: new Date().toISOString(),
  };
}

/**
 * Parse a page section into PageNotes.
 *
 * Page section format:
 * ## Page N
 *
 * [main notes markdown]
 *
 * ---
 *
 * ### Expansions
 *
 * [expansion blockquotes]
 */
function parsePageSection(section: string, pageNumber: number): PageNotes | null {
  // Check for placeholder
  if (section.includes('*Notes not available for this page.*')) {
    return null;
  }

  // Split at expansions section if present
  const expansionsSplit = section.split(/\n---\n\n### Expansions\n\n/);
  const mainContent = expansionsSplit[0].trim();
  const expansionsContent = expansionsSplit[1] || '';

  if (!mainContent) return null;

  // Parse expansions from blockquotes
  const expansions: Expansion[] = [];
  if (expansionsContent) {
    // Split by double newline between blockquotes (each starts with >)
    const blockquotes = expansionsContent.split(/\n\n(?=>)/);
    for (const bq of blockquotes) {
      if (bq.trim()) {
        const expansion = parseExpansion(bq.trim());
        if (expansion) {
          expansions.push(expansion);
        }
      }
    }
  }

  const notes: NotesResponse = {
    markdown: mainContent,
    topic_labels: [], // Not preserved in export
    page_references: [pageNumber],
  };

  return {
    page_number: pageNumber,
    notes,
    generated_at: new Date().toISOString(),
    expansions: expansions.length > 0 ? expansions : undefined,
  };
}

/**
 * Parse complete Markdown import into notes cache format.
 */
export function parseMarkdownImport(content: string): Record<number, PageNotes> {
  const result: Record<number, PageNotes> = {};

  // Remove frontmatter
  const withoutFrontmatter = content.replace(/^---\n[\s\S]*?\n---\n\n/, '');

  // Find all page sections using regex
  // Each page starts with "## Page N" followed by two newlines
  const pageRegex = /## Page (\d+)\n\n/g;
  const sections: { pageNum: number; startIndex: number }[] = [];
  let match;

  while ((match = pageRegex.exec(withoutFrontmatter)) !== null) {
    sections.push({
      pageNum: parseInt(match[1], 10),
      startIndex: match.index + match[0].length,
    });
  }

  // Extract content for each page
  for (let i = 0; i < sections.length; i++) {
    const { pageNum, startIndex } = sections[i];

    // Find end: either the next "## Page" or end of string
    let endIndex: number;
    if (i + 1 < sections.length) {
      // Find where the next section header starts
      const nextSectionStart = sections[i + 1].startIndex;
      // Go back to find "## Page" before it
      endIndex = withoutFrontmatter.lastIndexOf('## Page', nextSectionStart);
    } else {
      endIndex = withoutFrontmatter.length;
    }

    const sectionContent = withoutFrontmatter.slice(startIndex, endIndex).trim();
    const pageNotes = parsePageSection(sectionContent, pageNum);

    if (pageNotes) {
      result[pageNum] = pageNotes;
    }
  }

  return result;
}

/**
 * Get frontmatter from content (for display purposes)
 */
export function getFrontmatter(content: string): MarkdownFrontmatter | null {
  return parseFrontmatter(content);
}
