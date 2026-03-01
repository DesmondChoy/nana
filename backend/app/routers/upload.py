"""
PDF Upload and Parsing Router.

Handles PDF file uploads and extracts page-wise text using Gemini 3 Flash.
Uses inline upload (no Files API) for simplicity.
"""

import hashlib
import json
import logging
import time
from datetime import datetime
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from google import genai
from google.genai import types
from pydantic import BaseModel, ValidationError

from app.config import Settings, get_gemini_client, get_settings
from app.debug import DebugLogger
from app.schemas import DocumentOverview, PageContent, UserProfile
from app.services.pdf_extract import extract_pages_for_prepared_pdf
from app.services.pdf_preprocess import PDFPreprocessError, PreparedPDF, prepare_pdf_for_gemini

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


class ParsedPDF(BaseModel):
    """Response containing extracted content from all pages."""

    original_filename: str
    total_pages: int
    pages: list[PageContent]
    session_id: str  # Unique ID for this upload session (used for debug log grouping)
    content_hash: str  # SHA-256 hash of PDF bytes (first 16 hex chars) for import matching
    overview: DocumentOverview | None = None  # Optional LLM-generated document overview


def _is_timeout_error(error: Exception) -> bool:
    """Detect timeout/deadline errors from Gemini or HTTP stack."""
    error_text = str(error)
    return (
        isinstance(error, httpx.TimeoutException)
        or "DEADLINE_EXCEEDED" in error_text
        or "timed out" in error_text.lower()
    )


def _user_friendly_upload_error(error: Exception) -> str:
    """Return a concise upload error message for end users."""
    if isinstance(error, PDFPreprocessError):
        return error.user_message
    if _is_timeout_error(error):
        return (
            "PDF processing timed out while extracting text. "
            "Please retry, or try a smaller/simpler PDF."
        )
    return f"Gemini API error: {error}"


def _load_overview_prompt() -> str:
    """Load the document overview prompt template."""
    prompt_path = Path(__file__).parent.parent.parent / "prompts" / "document_overview.md"
    return prompt_path.read_text()


def _summarize_preprocess(prepared_pdf: PreparedPDF) -> str:
    """Return a short summary string for logs."""
    if prepared_pdf.mode == "original":
        return "mode=original"
    if prepared_pdf.mode == "compressed":
        return (
            f"mode=compressed size={prepared_pdf.total_output_bytes / (1024 * 1024):.2f}MB "
            f"attempts={len(prepared_pdf.compression_attempts)}"
        )
    return (
        f"mode=split chunks={prepared_pdf.parts_count} "
        f"total_chunk_bytes={prepared_pdf.total_output_bytes / (1024 * 1024):.2f}MB "
        f"attempts={len(prepared_pdf.compression_attempts)}"
    )


async def generate_document_overview(
    pages: list[PageContent],
    user_profile: UserProfile | None,
    client: genai.Client,
    settings: Settings,
    session_id: str,
    debug_logger: DebugLogger,
) -> DocumentOverview | None:
    """Generate a document overview using extracted page text.

    Returns None if user_profile is not provided (overview requires profile for adaptation).
    """
    if not user_profile:
        return None

    # Combine all page text for the overview
    document_text = "\n\n".join(
        f"--- Page {page.page_number} ---\n{page.text}" for page in pages
    )

    # Load and format the prompt with full user profile
    prompt_template = _load_overview_prompt()
    prompt = prompt_template.format(
        prior_expertise=user_profile.prior_expertise,
        math_comfort=user_profile.math_comfort,
        detail_level=user_profile.detail_level,
        primary_goal=user_profile.primary_goal,
        additional_context=user_profile.additional_context or "None provided",
        document_text=document_text,
    )

    start_time = time.time()
    try:
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=DocumentOverview,
                http_options=types.HttpOptions(timeout=settings.gemini_upload_timeout_ms),
            ),
        )
        debug_logger.log_interaction(
            name="document_overview",
            prompt=["Generate document overview", prompt[:500] + "..."],  # Truncate for logging
            response=response,
            start_time=start_time,
            end_time=time.time(),
            session_id=session_id,
        )
        return response.parsed
    except Exception as e:
        debug_logger.log_interaction(
            name="document_overview",
            prompt="Generate document overview",
            response=None,
            start_time=start_time,
            end_time=time.time(),
            error=str(e),
            session_id=session_id,
        )
        logger.warning(f"[upload] Overview generation failed: {e}")
        # Don't fail the upload if overview fails - it's optional
        return None


@router.post("/upload", response_model=ParsedPDF)
async def upload_and_parse_pdf(
    file: UploadFile = File(...),
    user_profile: str | None = Form(None),  # JSON string of UserProfile
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

    # Parse user profile if provided
    parsed_profile: UserProfile | None = None
    if user_profile:
        try:
            profile_data = json.loads(user_profile)
            parsed_profile = UserProfile(**profile_data)
        except (json.JSONDecodeError, ValidationError) as e:
            logger.warning(f"[upload] Invalid user_profile JSON: {e}")
            # Continue without profile - overview will be skipped

    # Generate a unique session ID for this upload (used to group all related logs)
    session_id = datetime.now().strftime("%Y%m%d_%H%M%S")

    debug_logger = DebugLogger()
    start_time = time.time()

    try:
        prepared_pdf = prepare_pdf_for_gemini(
            pdf_bytes,
            max_bytes=settings.pdf_max_bytes,
            split_target_bytes=settings.pdf_split_target_bytes,
            enable_preprocess=settings.pdf_enable_preprocess,
            compression_profile=settings.pdf_compression_profile,
        )
        logger.info(
            "[upload] preprocess file=%s size=%.2fMB session=%s %s",
            file.filename,
            file_size_mb,
            session_id,
            _summarize_preprocess(prepared_pdf),
        )
    except PDFPreprocessError as e:
        log_upload_request(
            filename=file.filename,
            file_size_mb=file_size_mb,
            session_id=session_id,
            duration_seconds=time.time() - start_time,
            success=False,
            error=e.internal_message,
        )
        raise HTTPException(status_code=400, detail=e.user_message) from e

    try:
        pages = await extract_pages_for_prepared_pdf(
            prepared_pdf=prepared_pdf,
            client=client,
            model=settings.gemini_model,
            timeout_ms=settings.gemini_upload_timeout_ms,
            filename=file.filename,
            session_id=session_id,
            debug_logger=debug_logger,
        )
    except Exception as e:
        end_time = time.time()
        log_upload_request(
            filename=file.filename,
            file_size_mb=file_size_mb,
            session_id=session_id,
            duration_seconds=end_time - start_time,
            success=False,
            error=str(e),
        )
        status_code = 504 if _is_timeout_error(e) else 500
        raise HTTPException(status_code=status_code, detail=_user_friendly_upload_error(e))

    if not pages:
        log_upload_request(
            filename=file.filename,
            file_size_mb=file_size_mb,
            session_id=session_id,
            duration_seconds=time.time() - start_time,
            success=False,
            error="Gemini extraction returned no pages",
        )
        raise HTTPException(status_code=500, detail="Gemini extraction returned no pages.")

    # Generate document overview if user profile is provided
    overview = await generate_document_overview(
        pages=pages,
        user_profile=parsed_profile,
        client=client,
        settings=settings,
        session_id=session_id,
        debug_logger=debug_logger,
    )

    return ParsedPDF(
        original_filename=file.filename,
        total_pages=len(pages),
        pages=pages,
        session_id=session_id,
        content_hash=content_hash,
        overview=overview,
    )
