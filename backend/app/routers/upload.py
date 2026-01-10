"""
PDF Upload and Parsing Router.

Handles PDF file uploads and extracts page-wise text using Gemini 3 Flash.
Uses inline upload (no Files API) for simplicity.
"""

import hashlib
import logging
import time
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from google import genai
from google.genai import types
from pydantic import BaseModel

from app.config import Settings, get_gemini_client, get_settings
from app.debug import DebugLogger
from app.schemas import PageContent

logger = logging.getLogger(__name__)

# Log startup message to indicate logging behavior
logger.info(
    "[upload] Router initialized. Only errors will be logged; successful uploads are silent."
)


def log_upload_request(
    filename: str,
    file_size_mb: float,
    session_id: str,
    duration_seconds: float,
    success: bool,
    error: str | None = None,
) -> None:
    """
    Log upload request to stdout for production visibility.

    Only errors are logged to keep production logs clean.
    Successful uploads are silent.
    """
    if not success and error:
        logger.error(
            f"[upload] FAILED file={filename} size={file_size_mb:.2f}MB "
            f"session={session_id} duration={duration_seconds:.2f}s error={error}"
        )


router = APIRouter()


class PDFExtractionResponse(BaseModel):
    """Structure for the LLM response."""

    pages: list[PageContent]


class ParsedPDF(BaseModel):
    """Response containing extracted content from all pages."""

    original_filename: str
    total_pages: int
    pages: list[PageContent]
    session_id: str  # Unique ID for this upload session (used for debug log grouping)
    content_hash: str  # SHA-256 hash of PDF bytes (first 16 hex chars) for import matching


EXTRACTION_PROMPT = """Analyze this PDF document and extract the content from each page.

For each page, provide:
1. The page number (1-indexed)
2. The full text content
3. Whether the page contains images (true/false)
4. Whether the page contains tables (true/false)

Extract ALL pages. Preserve paragraph structure. Include all text, headings, captions, and footnotes."""


@router.post("/upload", response_model=ParsedPDF)
async def upload_and_parse_pdf(
    file: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
    client: genai.Client = Depends(get_gemini_client),
) -> ParsedPDF:
    """
    Upload a PDF and extract page-wise content using Gemini 3 Flash.

    The PDF is sent inline to Gemini (no Files API), parsed in a single call,
    and structured content is returned for each page.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    pdf_bytes = await file.read()
    file_size_mb = len(pdf_bytes) / (1024 * 1024)

    # Generate content hash for import matching (first 16 hex chars of SHA-256)
    content_hash = hashlib.sha256(pdf_bytes).hexdigest()[:16]

    # Check size limit (50MB)
    if len(pdf_bytes) > 50 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="PDF exceeds 50MB limit. Please upload a smaller file.",
        )

    # Generate a unique session ID for this upload (used to group all related logs)
    session_id = datetime.now().strftime("%Y%m%d_%H%M%S")

    debug_logger = DebugLogger()
    start_time = time.time()
    prompt_contents = [
        types.Part.from_bytes(
            data=pdf_bytes,
            mime_type="application/pdf",
        ),
        EXTRACTION_PROMPT,
    ]

    try:
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt_contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=PDFExtractionResponse,
            ),
        )
        # Log successful interaction
        debug_logger.log_interaction(
            name="pdf_extraction",
            prompt=[f"Extract text/tables/images from {file.filename}", EXTRACTION_PROMPT],
            response=response,
            start_time=start_time,
            end_time=time.time(),
            session_id=session_id,
        )
    except Exception as e:
        end_time = time.time()
        # Log failed interaction
        debug_logger.log_interaction(
            name="pdf_extraction",
            prompt=f"Extract text/tables/images from {file.filename}",
            response=None,
            start_time=start_time,
            end_time=end_time,
            error=str(e),
            session_id=session_id,
        )
        log_upload_request(
            filename=file.filename,
            file_size_mb=file_size_mb,
            session_id=session_id,
            duration_seconds=end_time - start_time,
            success=False,
            error=str(e),
        )
        raise HTTPException(status_code=500, detail=f"Gemini API error: {e}")

    # Parse the JSON response
    end_time = time.time()
    try:
        parsed_response: PDFExtractionResponse = response.parsed
        pages = parsed_response.pages
    except Exception as e:
        log_upload_request(
            filename=file.filename,
            file_size_mb=file_size_mb,
            session_id=session_id,
            duration_seconds=end_time - start_time,
            success=False,
            error=f"Parse error: {e}",
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse Gemini response: {e}",
        )

    return ParsedPDF(
        original_filename=file.filename,
        total_pages=len(pages),
        pages=pages,
        session_id=session_id,
        content_hash=content_hash,
    )
