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

logger = logging.getLogger(__name__)

router = APIRouter()


class PDFExtractionResponse(BaseModel):
    """Structure for the LLM response."""

    pages: list[PageContent]


class ParsedPDF(BaseModel):
    """Response containing extracted content from all pages."""

    original_filename: str
    total_pages: int
    pages: list[PageContent]
    session_id: str
    content_hash: str
    overview: DocumentOverview | None = None


EXTRACTION_PROMPT = """Analyze this PDF document and extract the content from each page.

For each page, provide:
1. The page number (1-indexed)
2. The full text content
3. Whether the page contains images (true/false)
4. Whether the page contains tables (true/false)

Extract ALL pages. Preserve paragraph structure. Include all text, headings, captions, and footnotes."""


def _load_overview_prompt() -> str:
    """Load the document overview prompt template."""
    prompt_path = Path(__file__).parent.parent.parent / "prompts" / "document_overview.md"
    return prompt_path.read_text()


def _format_sse(event: UploadProgressEvent) -> str:
    """Format an event as an SSE data line."""
    return f"data: {event.model_dump_json()}\n\n"


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

    if len(pdf_bytes) > 50 * 1024 * 1024:
        yield _format_sse(
            UploadProgressEvent(
                step=UploadStep.ERROR,
                message="PDF exceeds 50MB limit. Please upload a smaller file.",
                progress_percent=0,
            )
        )
        return

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

    # Step 2: Extracting with Gemini
    yield _format_sse(
        UploadProgressEvent(
            step=UploadStep.EXTRACTING,
            message="Extracting text with Gemini AI...",
            progress_percent=15,
        )
    )

    prompt_contents = [
        types.Part.from_bytes(
            data=pdf_bytes,
            mime_type="application/pdf",
        ),
        EXTRACTION_PROMPT,
    ]

    start_time = time.time()

    # Run synchronous Gemini call in a thread
    def sync_extract():
        return client.models.generate_content(
            model=settings.gemini_model,
            contents=prompt_contents,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=PDFExtractionResponse,
            ),
        )

    try:
        response = await asyncio.to_thread(sync_extract)
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
        debug_logger.log_interaction(
            name="pdf_extraction",
            prompt=f"Extract text/tables/images from {file.filename}",
            response=None,
            start_time=start_time,
            end_time=end_time,
            error=str(e),
            session_id=session_id,
        )
        logger.error(
            f"[upload-stream] FAILED file={file.filename} size={file_size_mb:.2f}MB "
            f"session={session_id} duration={end_time - start_time:.2f}s error={e}"
        )
        yield _format_sse(
            UploadProgressEvent(
                step=UploadStep.ERROR,
                message=f"Gemini API error: {e}",
                progress_percent=0,
            )
        )
        return

    # Step 3: Parsing response
    yield _format_sse(
        UploadProgressEvent(
            step=UploadStep.PARSING,
            message="Parsing extracted content...",
            progress_percent=75,
        )
    )

    try:
        parsed_response: PDFExtractionResponse = response.parsed
        pages = parsed_response.pages
    except Exception as e:
        yield _format_sse(
            UploadProgressEvent(
                step=UploadStep.ERROR,
                message=f"Failed to parse Gemini response: {e}",
                progress_percent=0,
            )
        )
        return

    # Step 4: Generate overview (if profile provided)
    overview = None
    if parsed_profile:
        yield _format_sse(
            UploadProgressEvent(
                step=UploadStep.GENERATING_OVERVIEW,
                message="Generating document overview...",
                progress_percent=80,
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

    # Step 5: Complete
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
