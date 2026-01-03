"""
Inline Commands Router.

Handles text transformation commands (elaborate, simplify, analogy)
that operate on user-selected text within the notes panel.
"""

from pathlib import Path
import time

from fastapi import APIRouter, Depends, HTTPException
from google import genai
from google.genai import types

from app.config import Settings, get_gemini_client, get_settings
from app.schemas import InlineCommandRequest, InlineCommandResponse, InlineCommandType
from app.debug import DebugLogger

router = APIRouter()

# Resolve prompts directory once at module load
PROMPTS_DIR = Path(__file__).resolve().parents[3] / "prompts" / "inline_commands"

# Mapping from command type to prompt file
COMMAND_PROMPT_FILES = {
    InlineCommandType.ELABORATE: "elaborate.md",
    InlineCommandType.SIMPLIFY: "simplify.md",
    InlineCommandType.ANALOGY: "analogy.md",
}



def load_prompt_template(command_type: InlineCommandType) -> str:
    """Load the prompt template for a specific command type."""
    filename = COMMAND_PROMPT_FILES.get(command_type)
    if not filename:
        raise ValueError(f"Unknown command type: {command_type}")

    prompt_path = PROMPTS_DIR / filename
    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt file not found: {prompt_path}")
    return prompt_path.read_text(encoding="utf-8")


@router.post("/inline-command", response_model=InlineCommandResponse)
async def execute_inline_command(
    request: InlineCommandRequest,
    settings: Settings = Depends(get_settings),
    client: genai.Client = Depends(get_gemini_client),
) -> InlineCommandResponse:
    """
    Execute an inline text transformation command.

    Supports: elaborate, simplify, analogy
    """
    try:
        prompt_template = load_prompt_template(request.command_type)
    except (FileNotFoundError, ValueError) as e:
        raise HTTPException(status_code=500, detail=str(e))

    # Build format kwargs
    format_kwargs = {
        "prior_expertise": request.user_profile.prior_expertise,
        "math_comfort": request.user_profile.math_comfort,
        "detail_level": request.user_profile.detail_level,
        "selected_text": request.selected_text,
        "page_number": request.page_number,
        "page_text": request.page_text,
    }

    # Add analogy-specific instruction based on user's expertise (dynamic, not hardcoded)
    if request.command_type == InlineCommandType.ANALOGY:
        format_kwargs["analogy_instruction"] = (
            f"Create an analogy that explains this concept using examples from the learner's "
            f"background: {request.user_profile.prior_expertise}. Draw from concepts, tools, "
            f"processes, or situations that someone with this background would immediately "
            f"recognize and understand."
        )

    # Fill prompt template with request data
    try:
        filled_prompt = prompt_template.format(**format_kwargs)
    except KeyError as e:
        raise HTTPException(status_code=500, detail=f"Prompt formatting error: Missing key {e}")

    debug_logger = DebugLogger()
    start_time = time.time()

    try:
        # Use structured output to guarantee valid JSON response
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=filled_prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=InlineCommandResponse,
                temperature=0.3,  # Slightly higher for creative transformations
            ),
        )

        # Log successful interaction
        debug_logger.log_interaction(
            name=f"inline_command_{request.command_type.value}",
            prompt=filled_prompt,
            response=response,
            start_time=start_time,
            end_time=time.time(),
            session_id=request.session_id,
        )
    except Exception as e:
        # Log failed interaction
        debug_logger.log_interaction(
            name=f"inline_command_{request.command_type.value}",
            prompt=filled_prompt,
            response=None,
            start_time=start_time,
            end_time=time.time(),
            error=str(e),
            session_id=request.session_id,
        )
        raise HTTPException(status_code=500, detail=f"Gemini API error: {e}")

    parsed = response.parsed
    if not isinstance(parsed, InlineCommandResponse):
        raise HTTPException(status_code=500, detail="Gemini response did not match expected schema")

    # Ensure the response has the correct command type
    return InlineCommandResponse(
        content=parsed.content,
        command_type=request.command_type,
    )
