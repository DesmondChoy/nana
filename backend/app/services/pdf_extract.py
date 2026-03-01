"""
Shared Gemini extraction helpers for PDF upload routes.
"""

from __future__ import annotations

import asyncio
import logging
import time

from google import genai
from google.genai import types
from pydantic import BaseModel

from app.debug import DebugLogger
from app.schemas import PageContent
from app.services.pdf_preprocess import PDFPart, PreparedPDF

logger = logging.getLogger(__name__)


EXTRACTION_PROMPT = """Analyze this PDF document and extract the content from each page.

For each page, provide:
1. The page number (1-indexed)
2. The full text content
3. Whether the page contains images (true/false)
4. Whether the page contains tables (true/false)

Extract ALL pages. Preserve paragraph structure. Include all text, headings, captions, and footnotes."""


class PDFExtractionResponse(BaseModel):
    """Structured Gemini extraction response."""

    pages: list[PageContent]


async def extract_pages_for_prepared_pdf(
    *,
    prepared_pdf: PreparedPDF,
    client: genai.Client,
    model: str,
    timeout_ms: int,
    filename: str,
    session_id: str,
    debug_logger: DebugLogger,
) -> list[PageContent]:
    """Extract and merge pages for an already-prepared PDF payload."""
    pages: list[PageContent] = []
    total_parts = len(prepared_pdf.parts)

    for part_index, part in enumerate(prepared_pdf.parts, start=1):
        extracted = await extract_pages_for_part(
            part=part,
            part_index=part_index,
            total_parts=total_parts,
            client=client,
            model=model,
            timeout_ms=timeout_ms,
            filename=filename,
            session_id=session_id,
            debug_logger=debug_logger,
        )
        pages.extend(extracted)

    return sorted(pages, key=lambda page: page.page_number)


async def extract_pages_for_part(
    *,
    part: PDFPart,
    part_index: int,
    total_parts: int,
    client: genai.Client,
    model: str,
    timeout_ms: int,
    filename: str,
    session_id: str,
    debug_logger: DebugLogger,
) -> list[PageContent]:
    """Extract pages from a single prepared PDF part."""
    part_label = f"part {part_index}/{total_parts} pages {part.start_page}-{part.end_page}"
    prompt_contents = [
        types.Part.from_bytes(data=part.bytes_data, mime_type="application/pdf"),
        EXTRACTION_PROMPT,
    ]

    start_time = time.time()

    def sync_extract():
        return client.models.generate_content(
            model=model,
            contents=prompt_contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=PDFExtractionResponse,
                http_options=types.HttpOptions(timeout=timeout_ms),
            ),
        )

    try:
        response = await asyncio.to_thread(sync_extract)
        debug_logger.log_interaction(
            name=f"pdf_extraction_{part_index}_of_{total_parts}",
            prompt=[f"Extract text/tables/images from {filename} ({part_label})", EXTRACTION_PROMPT],
            response=response,
            start_time=start_time,
            end_time=time.time(),
            session_id=session_id,
        )
    except Exception as error:
        debug_logger.log_interaction(
            name=f"pdf_extraction_{part_index}_of_{total_parts}",
            prompt=f"Extract text/tables/images from {filename} ({part_label})",
            response=None,
            start_time=start_time,
            end_time=time.time(),
            error=str(error),
            session_id=session_id,
        )
        raise

    parsed_response: PDFExtractionResponse = response.parsed
    extracted_pages = parsed_response.pages

    # Reindex to canonical global page numbers to ensure contiguous ordering
    # when processing split PDF chunks.
    global_pages: list[PageContent] = []
    for offset, page in enumerate(extracted_pages):
        global_page_number = part.start_page + offset
        global_pages.append(page.model_copy(update={"page_number": global_page_number}))

    expected_page_count = part.page_count
    if expected_page_count != len(extracted_pages):
        logger.warning(
            "[pdf-extract] %s returned %d pages but expected %d; "
            "continuing with sequential global reindexing",
            part_label,
            len(extracted_pages),
            expected_page_count,
        )

    return global_pages
