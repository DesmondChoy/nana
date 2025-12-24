"""
Notes Generation Router.

Generates study notes for a specific PDF page using Gemini 3 Flash.
Uses 'Direct Context' (current page + previous page for continuity) instead of RAG.
Enforces structured JSON output via Pydantic schemas.
"""

from pathlib import Path

from fastapi import APIRouter, HTTPException
from google import genai
from google.genai import types

from app.config import get_settings
from app.schemas import NotesRequest, NotesResponse

router = APIRouter()

# Resolve prompts directory once at module load
PROMPTS_DIR = Path(__file__).resolve().parents[3] / "prompts"


def load_prompt_template(filename: str) -> str:
    """Load a prompt template from the prompts directory."""
    prompt_path = PROMPTS_DIR / filename
    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt file not found: {prompt_path}")
    return prompt_path.read_text(encoding="utf-8")

@router.post("/notes", response_model=NotesResponse)
async def generate_notes(request: NotesRequest) -> NotesResponse:
    """
    Generate study notes for a page using user profile and context.
    """
    settings = get_settings()
    if not settings.google_api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured")

    try:
        prompt_template = load_prompt_template("notes_generation.md")
    except FileNotFoundError as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Format Previous Page Context
    previous_page_text = ""
    if request.previous_page:
        previous_page_text = f"--- Page {request.previous_page.page_number} ---\n{request.previous_page.text}"
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
    # Note: We use .format() but need to be careful with JSON braces in the prompt if any.
    # The prompt template was updated to remove the explicit JSON example and rely on response_schema,
    # so we should be safe. If the prompt has other curly braces, we might need to escape them or use jinja2.
    # Looking at the file, it has standard text.
    
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
            previous_notes_text=request.previous_notes_context or "(None)"
        )
    except KeyError as e:
         raise HTTPException(status_code=500, detail=f"Prompt formatting error: Missing key {e}")

    client = genai.Client(api_key=settings.google_api_key)

    try:
        # We use a lower temperature for structured generation to be consistent
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=filled_prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=NotesResponse,
                temperature=0.2 
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini API error: {e}")

    parsed = response.parsed
    if not isinstance(parsed, NotesResponse):
        raise HTTPException(status_code=500, detail="Gemini response did not match expected schema")
    return parsed
