"""
Notes Generation Router.

Generates study notes for a specific PDF page using Gemini 3 Flash.
Uses 'Direct Context' (current page + previous page for continuity) instead of RAG.
Returns rich markdown content with Obsidian-style callouts plus metadata for topic tracking.
"""

import logging
import time
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from google import genai
from google.genai import types

from app.config import Settings, get_gemini_client, get_settings
from app.debug import DebugLogger
from app.schemas import NotesRequest, NotesResponse

logger = logging.getLogger(__name__)

# Log startup message to indicate logging behavior
logger.info(
    "[notes] Router initialized. Only errors will be logged; successful requests are silent."
)


def log_notes_request(
    page_number: int,
    session_id: str | None,
    duration_seconds: float,
    success: bool,
    _token_count: int | None = None,
    error: str | None = None,
) -> None:
    """
    Log notes generation request to stdout for production visibility.

    Only errors are logged to keep production logs clean.
    Successful requests are silent.
    """
    if not success and error:
        logger.error(
            f"[notes] FAILED page={page_number} session={session_id} "
            f"duration={duration_seconds:.2f}s error={error}"
        )


router = APIRouter()

# Resolve prompts directory once at module load
PROMPTS_DIR = Path(__file__).resolve().parents[2] / "prompts"


def load_prompt_template(filename: str) -> str:
    """Load a prompt template from the prompts directory."""
    prompt_path = PROMPTS_DIR / filename
    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt file not found: {prompt_path}")
    return prompt_path.read_text(encoding="utf-8")


@router.post("/notes", response_model=NotesResponse)
async def generate_notes(
    request: NotesRequest,
    settings: Settings = Depends(get_settings),
    client: genai.Client = Depends(get_gemini_client),
) -> NotesResponse:
    """
    Generate study notes for a page using user profile and context.
    """
    try:
        prompt_template = load_prompt_template("notes_generation.md")
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Format Previous Page Context
    previous_page_text = ""
    if request.previous_page:
        previous_page_text = (
            f"--- Page {request.previous_page.page_number} ---\n{request.previous_page.text}"
        )
    else:
        previous_page_text = "(No previous page - this is page 1)"

    # Format Topic Mastery
    mastery_text = ""
    if request.topic_mastery:
        for topic, data in request.topic_mastery.items():
            mastery_text += f"- {topic}: Score {data.score:.2f} (Attempts: {data.attempts})\n"
    else:
        mastery_text = "(No prior mastery data)"

    # Fill Prompt
    try:
        filled_prompt = prompt_template.format(
            prior_expertise=request.user_profile.prior_expertise,
            math_comfort=request.user_profile.math_comfort,
            detail_level=request.user_profile.detail_level,
            primary_goal=request.user_profile.primary_goal,
            additional_context=request.user_profile.additional_context or "None",
            topic_mastery_text=mastery_text,
            page_number=request.current_page.page_number,
            page_text=request.current_page.text,
            previous_page_text=previous_page_text,
            previous_notes_text=request.previous_notes_context or "(None)",
        )
    except KeyError as e:
        raise HTTPException(status_code=500, detail=f"Prompt formatting error: Missing key {e}")

    debug_logger = DebugLogger()
    start_time = time.time()

    try:
        # We use a lower temperature for structured generation to be consistent
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=filled_prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=NotesResponse,
                temperature=0.2,
            ),
        )
        # Log successful interaction
        debug_logger.log_interaction(
            name="notes_generation",
            prompt=filled_prompt,
            response=response,
            start_time=start_time,
            end_time=time.time(),
            session_id=request.session_id,
        )
    except Exception as e:
        end_time = time.time()
        # Log failed interaction
        debug_logger.log_interaction(
            name="notes_generation",
            prompt=filled_prompt,
            response=None,
            start_time=start_time,
            end_time=end_time,
            error=str(e),
            session_id=request.session_id,
        )
        log_notes_request(
            page_number=request.current_page.page_number,
            session_id=request.session_id,
            duration_seconds=end_time - start_time,
            success=False,
            error=str(e),
        )
        raise HTTPException(status_code=500, detail=f"Gemini API error: {e}")

    end_time = time.time()
    parsed = response.parsed
    if not isinstance(parsed, NotesResponse):
        log_notes_request(
            page_number=request.current_page.page_number,
            session_id=request.session_id,
            duration_seconds=end_time - start_time,
            success=False,
            error=f"Schema validation failed: got {type(parsed).__name__}",
        )
        raise HTTPException(status_code=500, detail="Gemini response did not match expected schema")

    # Extract token count for logging
    token_count = None
    if hasattr(response, "usage_metadata") and response.usage_metadata:
        token_count = getattr(response.usage_metadata, "total_token_count", None)

    log_notes_request(
        page_number=request.current_page.page_number,
        session_id=request.session_id,
        duration_seconds=end_time - start_time,
        success=True,
        _token_count=token_count,
    )
    return parsed
