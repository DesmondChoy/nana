import { pdfjs } from 'react-pdf';

/**
 * Extracts text content from all pages of a PDF using pdf.js.
 * Used as a fallback for PDF search when parsedPDF is not available
 * (e.g., skip-API scenarios like combined PDF+MD import or resume from cache).
 *
 * @param pdfUrl - Blob URL or file URL of the PDF
 * @param totalPages - Total number of pages to extract
 * @returns Record mapping page numbers (1-indexed) to their text content
 */
export async function extractAllPagesText(
  pdfUrl: string,
  totalPages: number
): Promise<Record<number, string>> {
  const pdf = await pdfjs.getDocument(pdfUrl).promise;
  const result: Record<number, string> = {};

  for (let i = 1; i <= totalPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    result[i] = textContent.items.map((item: any) => item.str).join(' ');
  }

  return result;
}
