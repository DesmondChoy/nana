import type {
  ParsedPDF,
  PageNotes,
  Expansion,
  InlineCommandType,
} from '../types';

interface ExportOptions {
  parsedPDF: ParsedPDF;
  notesCache: Record<number, PageNotes>;
  contentHash: string;
  emphasisDrafts?: Record<number, string>;
}

/**
 * Map command types to human-readable labels for export
 */
const EXPANSION_LABELS: Record<InlineCommandType, string> = {
  elaborate: 'Elaboration',
  simplify: 'Simplified',
  analogy: 'Analogy',
};

/**
 * Format a single expansion as Markdown blockquote
 */
function formatExpansion(expansion: Expansion): string {
  const label = EXPANSION_LABELS[expansion.command_type];
  const truncatedText =
    expansion.selected_text.length > 100
      ? `${expansion.selected_text.slice(0, 100)}...`
      : expansion.selected_text;

  // Indent each line of the expansion content for blockquote
  const quotedContent = expansion.content
    .split('\n')
    .map((line) => `> ${line}`)
    .join('\n');

  return `> **${label}** on "${truncatedText}"
>
${quotedContent}`;
}

/**
 * Format expansions section for a page
 */
function formatExpansionsSection(expansions: Expansion[]): string {
  if (!expansions || expansions.length === 0) return '';

  const formatted = expansions.map(formatExpansion).join('\n\n');
  return `\n---\n\n### Expansions\n\n${formatted}`;
}

/**
 * Format unintegrated emphasis draft for a page
 */
function formatEmphasisDraft(draft: string): string {
  if (!draft?.trim()) return '';

  // Format each line as a bullet point in a warning callout
  const lines = draft
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => `> - ${line.trim()}`)
    .join('\n');

  return `\n---\n\n### Emphasis Draft (Not Yet Integrated)\n\n> [!warning] Unintegrated\n${lines}`;
}

/**
 * Generate YAML frontmatter for import matching
 */
function generateFrontmatter(
  parsedPDF: ParsedPDF,
  contentHash: string
): string {
  return `---
nana_version: 1
content_hash: ${contentHash}
original_filename: ${parsedPDF.original_filename}
total_pages: ${parsedPDF.total_pages}
exported_at: ${new Date().toISOString()}
---`;
}

/**
 * Generate table of contents with anchor links
 */
function generateTOC(totalPages: number): string {
  const links = Array.from({ length: totalPages }, (_, i) => {
    const pageNum = i + 1;
    return `- [Page ${pageNum}](#page-${pageNum})`;
  });

  return `## Table of Contents\n\n${links.join('\n')}`;
}

/**
 * Generate complete Markdown export from notes cache
 */
export function generateMarkdownExport({
  parsedPDF,
  notesCache,
  contentHash,
  emphasisDrafts = {},
}: ExportOptions): string {
  const parts: string[] = [];

  // YAML frontmatter for import matching
  parts.push(generateFrontmatter(parsedPDF, contentHash));

  // Title
  parts.push(`# Study Notes: ${parsedPDF.original_filename}\n`);

  // Table of Contents
  parts.push(generateTOC(parsedPDF.total_pages));

  // Each page's notes
  for (let pageNum = 1; pageNum <= parsedPDF.total_pages; pageNum++) {
    const pageNotes = notesCache[pageNum];
    const emphasisDraft = emphasisDrafts[pageNum];

    // Page divider (H2 heading only)
    parts.push(`## Page ${pageNum}`);

    if (pageNotes) {
      // Main notes content
      parts.push(pageNotes.notes.markdown);

      // Unintegrated emphasis draft if any
      if (emphasisDraft?.trim()) {
        parts.push(formatEmphasisDraft(emphasisDraft));
      }

      // Expansions if any
      if (pageNotes.expansions && pageNotes.expansions.length > 0) {
        parts.push(formatExpansionsSection(pageNotes.expansions));
      }
    } else {
      parts.push('*Notes not available for this page.*');
    }
  }

  return parts.join('\n\n');
}

/**
 * Trigger file download in browser using Blob API
 */
export function downloadMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up blob URL to prevent memory leak
  URL.revokeObjectURL(url);
}

/**
 * Generate export filename from original PDF name
 */
export function getExportFilename(originalFilename: string): string {
  // Remove .pdf extension if present, then add _study_notes.md
  const baseName = originalFilename.replace(/\.pdf$/i, '');
  return `${baseName}_study_notes.md`;
}
