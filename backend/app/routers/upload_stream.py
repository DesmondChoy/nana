"""
PDF Upload with SSE Progress Streaming.

Provides real-time progress updates during PDF upload and processing
using Server-Sent Events (SSE). This replaces the static loading spinner
with step-by-step progress feedback.
"""

import asyncio
import hashlib
import json
import logging
import time
from datetime import datetime
from pathlib import Path

import httpx
from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import StreamingResponse
from google import genai
from google.genai import types
from pydantic import BaseModel, ValidationError

from app.config import Settings, get_gemini_client, get_settings
from app.debug import DebugLogger
from app.schemas import (
    DocumentOverview,
    PageContent,
    UploadProgressEvent,
    UploadStep,
    UserProfile,
)
from app.services.pdf_extract import extract_pages_for_part
from app.services.pdf_preprocess import PDFPreprocessError, PreparedPDF, prepare_pdf_for_gemini

logger = logging.getLogger(__name__)

router = APIRouter()


class ParsedPDF(BaseModel):
    """Response containing extracted content from all pages."""

    original_filename: str
    total_pages: int
    pages: list[PageContent]
    session_id: str
    content_hash: str
    overview: DocumentOverview | None = None


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


def _format_sse(event: UploadProgressEvent) -> str:
    """Format an event as an SSE data line."""
    return f"data: {event.model_dump_json()}\n\n"


def _summarize_preprocess(prepared_pdf: PreparedPDF) -> str:
    """Return a concise preprocess summary for logs."""
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


async def _generate_overview_async(
    pages: list[PageContent],
    user_profile: UserProfile,
    client: genai.Client,
    settings: Settings,
    session_id: str,
    debug_logger: DebugLogger,
) -> DocumentOverview | None:
    """Generate document overview in a thread to avoid blocking."""
    document_text = "\n\n".join(
        f"--- Page {page.page_number} ---\n{page.text}" for page in pages
    )

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

    def sync_generate():
        return client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=DocumentOverview,
                http_options=types.HttpOptions(timeout=settings.gemini_upload_timeout_ms),
            ),
        )

    try:
        response = await asyncio.to_thread(sync_generate)
        debug_logger.log_interaction(
            name="document_overview",
            prompt=["Generate document overview", prompt[:500] + "..."],
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
        logger.warning(f"[upload-stream] Overview generation failed: {e}")
        return None


async def process_pdf_with_progress(
    file: UploadFile,
    user_profile_json: str | None,
    settings: Settings,
    client: genai.Client,
):
    """Generator that yields SSE progress events during PDF processing."""

    # Step 1: Validating
    yield _format_sse(
        UploadProgressEvent(
            step=UploadStep.VALIDATING,
            message="Validating PDF file...",
            progress_percent=5,
        )
    )

    if not file.filename or not file.filename.lower().endswith(".pdf"):
        yield _format_sse(
            UploadProgressEvent(
                step=UploadStep.ERROR,
                message="Only PDF files are accepted",
                progress_percent=0,
            )
        )
        return

    pdf_bytes = await file.read()
    file_size_mb = len(pdf_bytes) / (1024 * 1024)

    content_hash = hashlib.sha256(pdf_bytes).hexdigest()[:16]

    # Parse user profile if provided
    parsed_profile: UserProfile | None = None
    if user_profile_json:
        try:
            profile_data = json.loads(user_profile_json)
            parsed_profile = UserProfile(**profile_data)
        except (json.JSONDecodeError, ValidationError) as e:
            logger.warning(f"[upload-stream] Invalid user_profile JSON: {e}")

    session_id = datetime.now().strftime("%Y%m%d_%H%M%S")
    debug_logger = DebugLogger()

    # Step 2: PDF optimization / splitting prep (for large files)
    prepared_pdf: PreparedPDF | None = None
    if len(pdf_bytes) > settings.pdf_max_bytes:
        yield _format_sse(
            UploadProgressEvent(
                step=UploadStep.OPTIMIZING_PDF,
                message=(
                    f"Large PDF detected ({file_size_mb:.1f}MB). "
                    "Optimizing for Gemini upload..."
                ),
                progress_percent=15,
            )
        )

    preprocess_start = time.time()
    try:
        prepared_pdf = prepare_pdf_for_gemini(
            pdf_bytes,
            max_bytes=settings.pdf_max_bytes,
            split_target_bytes=settings.pdf_split_target_bytes,
            enable_preprocess=settings.pdf_enable_preprocess,
            compression_profile=settings.pdf_compression_profile,
        )
        logger.info(
            "[upload-stream] preprocess file=%s size=%.2fMB session=%s %s",
            file.filename,
            file_size_mb,
            session_id,
            _summarize_preprocess(prepared_pdf),
        )
    except PDFPreprocessError as error:
        logger.error(
            "[upload-stream] preprocess failed file=%s size=%.2fMB session=%s duration=%.2fs error=%s",
            file.filename,
            file_size_mb,
            session_id,
            time.time() - preprocess_start,
            error.internal_message,
        )
        yield _format_sse(
            UploadProgressEvent(
                step=UploadStep.ERROR,
                message=error.user_message,
                progress_percent=0,
            )
        )
        return

    if prepared_pdf.mode == "split":
        yield _format_sse(
            UploadProgressEvent(
                step=UploadStep.SPLITTING_PDF,
                message=f"Split PDF into {prepared_pdf.parts_count} chunks for extraction.",
                progress_percent=25,
            )
        )

    # Step 3: Extracting with Gemini (single or chunked)
    start_time = time.time()
    pages: list[PageContent] = []
    total_parts = prepared_pdf.parts_count

    try:
        if prepared_pdf.mode == "split":
            for part_index, part in enumerate(prepared_pdf.parts, start=1):
                progress = 35 + int((part_index - 1) * 40 / max(total_parts, 1))
                yield _format_sse(
                    UploadProgressEvent(
                        step=UploadStep.EXTRACTING_CHUNKS,
                        message=(
                            f"Extracting chunk {part_index}/{total_parts} "
                            f"(pages {part.start_page}-{part.end_page})..."
                        ),
                        progress_percent=progress,
                    )
                )

                part_pages = await extract_pages_for_part(
                    part=part,
                    part_index=part_index,
                    total_parts=total_parts,
                    client=client,
                    model=settings.gemini_model,
                    timeout_ms=settings.gemini_upload_timeout_ms,
                    filename=file.filename,
                    session_id=session_id,
                    debug_logger=debug_logger,
                )
                pages.extend(part_pages)
        else:
            yield _format_sse(
                UploadProgressEvent(
                    step=UploadStep.EXTRACTING,
                    message="Extracting text with Gemini AI...",
                    progress_percent=35,
                )
            )
            part_pages = await extract_pages_for_part(
                part=prepared_pdf.parts[0],
                part_index=1,
                total_parts=1,
                client=client,
                model=settings.gemini_model,
                timeout_ms=settings.gemini_upload_timeout_ms,
                filename=file.filename,
                session_id=session_id,
                debug_logger=debug_logger,
            )
            pages.extend(part_pages)
    except Exception as e:
        end_time = time.time()
        logger.error(
            f"[upload-stream] FAILED file={file.filename} size={file_size_mb:.2f}MB "
            f"session={session_id} duration={end_time - start_time:.2f}s error={e}"
        )
        yield _format_sse(
            UploadProgressEvent(
                step=UploadStep.ERROR,
                message=_user_friendly_upload_error(e),
                progress_percent=0,
            )
        )
        return

    # Step 4: Parsing response
    yield _format_sse(
        UploadProgressEvent(
            step=UploadStep.PARSING,
            message="Parsing extracted content...",
            progress_percent=80,
        )
    )

    pages = sorted(pages, key=lambda page: page.page_number)
    if not pages:
        yield _format_sse(
            UploadProgressEvent(
                step=UploadStep.ERROR,
                message="Gemini extraction returned no pages.",
                progress_percent=0,
            )
        )
        return

    # Step 5: Generate overview (if profile provided)
    overview = None
    if parsed_profile:
        yield _format_sse(
            UploadProgressEvent(
                step=UploadStep.GENERATING_OVERVIEW,
                message="Generating document overview...",
                progress_percent=90,
            )
        )
        overview = await _generate_overview_async(
            pages=pages,
            user_profile=parsed_profile,
            client=client,
            settings=settings,
            session_id=session_id,
            debug_logger=debug_logger,
        )

    # Step 6: Complete
    result = ParsedPDF(
        original_filename=file.filename,
        total_pages=len(pages),
        pages=pages,
        session_id=session_id,
        content_hash=content_hash,
        overview=overview,
    )

    yield _format_sse(
        UploadProgressEvent(
            step=UploadStep.COMPLETE,
            message="Upload complete!",
            progress_percent=100,
            data=result.model_dump(),
        )
    )


@router.post("/upload-stream")
async def upload_and_parse_pdf_stream(
    file: UploadFile = File(...),
    user_profile: str | None = Form(None),
    settings: Settings = Depends(get_settings),
    client: genai.Client = Depends(get_gemini_client),
) -> StreamingResponse:
    """
    Upload a PDF and extract page-wise content with SSE progress updates.

    Returns a Server-Sent Events stream with progress updates during processing.
    Each event is a JSON object with step, message, progress_percent, and optional data.
    The final 'complete' event includes the full ParsedPDF in the data field.
    """
    return StreamingResponse(
        process_pdf_with_progress(file, user_profile, settings, client),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        },
    )
