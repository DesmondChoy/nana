"""
Emphasis Integration Router.

Integrates user emphasis points into existing AI-generated notes.
The emphasis is woven naturally into the notes with [!emphasis] callouts.
"""

import logging
import time
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from google import genai
from google.genai import types

from app.config import Settings, get_gemini_client, get_settings
from app.debug import DebugLogger
from app.schemas import IntegrateEmphasisRequest, NotesResponse

logger = logging.getLogger(__name__)

router = APIRouter()

# Resolve prompts directory once at module load
PROMPTS_DIR = Path(__file__).resolve().parents[2] / "prompts"


def load_prompt_template() -> str:
    """Load the emphasis integration prompt template."""
    prompt_path = PROMPTS_DIR / "integrate_emphasis.md"
    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt file not found: {prompt_path}")
    return prompt_path.read_text(encoding="utf-8")


@router.post("/integrate-emphasis", response_model=NotesResponse)
async def integrate_emphasis(
    request: IntegrateEmphasisRequest,
    settings: Settings = Depends(get_settings),
    client: genai.Client = Depends(get_gemini_client),
) -> NotesResponse:
    """
    Integrate user emphasis points into existing notes.

    Takes current notes + user emphasis and reorganizes content to naturally
    weave in the emphasis with [!emphasis] callouts for visual distinction.
    """
    try:
        prompt_template = load_prompt_template()
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Fill prompt template
    # Handle optional page_content for cached sessions
    page_text = request.page_content.text if request.page_content else "(Original page content not available - use existing notes for context)"
    try:
        filled_prompt = prompt_template.format(
            prior_expertise=request.user_profile.prior_expertise,
            math_comfort=request.user_profile.math_comfort,
            detail_level=request.user_profile.detail_level,
            primary_goal=request.user_profile.primary_goal,
            page_number=request.page_number,
            existing_notes=request.existing_notes,
            emphasis_content=request.emphasis_content,
            page_text=page_text,
        )
    except KeyError as e:
        raise HTTPException(status_code=500, detail=f"Prompt formatting error: Missing key {e}")

    debug_logger = DebugLogger()
    start_time = time.time()

    try:
        # Use same temperature as notes generation for consistency
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
            name="integrate_emphasis",
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
            name="integrate_emphasis",
            prompt=filled_prompt,
            response=None,
            start_time=start_time,
            end_time=end_time,
            error=str(e),
            session_id=request.session_id,
        )
        logger.error(
            f"[emphasis] FAILED page={request.page_number} session={request.session_id} "
            f"duration={end_time - start_time:.2f}s error={e}"
        )
        raise HTTPException(status_code=500, detail=f"Gemini API error: {e}")

    parsed = response.parsed
    if not isinstance(parsed, NotesResponse):
        logger.error(
            f"[emphasis] Schema validation failed: got {type(parsed).__name__}"
        )
        raise HTTPException(
            status_code=500, detail="Gemini response did not match expected schema"
        )

    return parsed
