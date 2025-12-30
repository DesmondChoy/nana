import json
import logging
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from google.genai import types

# Configure standard logging to console/file if needed
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DebugLogger:
    def __init__(self, debug_dir: str = "debug"):
        """
        Initialize the DebugLogger.
        
        Args:
            debug_dir: Relative path to the debug directory. 
                       Defaults to 'debug' in the project root.
        """
        # Resolve path relative to the project root (assuming backend/app/debug.py location)
        # We want the debug folder to be at the root of the project (parent of backend)
        # Current file: .../nana/backend/app/debug.py
        # Project root: .../nana/
        
        self.project_root = Path(__file__).resolve().parents[2]
        self.debug_path = self.project_root / debug_dir
        self.debug_path.mkdir(exist_ok=True, parents=True)

    def log_interaction(
        self,
        name: str,
        prompt: str | list[Any],
        response: Any,
        start_time: float,
        end_time: float,
        error: Optional[str] = None,
        session_id: Optional[str] = None
    ) -> None:
        """
        Log a Gemini interaction to timestamped Markdown files.

        Args:
            name: A descriptive name for the interaction (e.g., 'notes_gen', 'pdf_parse').
            prompt: The input prompt (string or list of parts).
            response: The raw response object from Gemini or the parsed output.
            start_time: Timestamp before the call.
            end_time: Timestamp after the call.
            error: Optional error message if the call failed.
            session_id: Optional session identifier (timestamp from upload).
                        All interactions with the same session_id are appended to the same log files.
        """
        current_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        readable_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        duration = end_time - start_time
        
        # --- Extract Telemetry ---
        token_usage = {}
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            # Handle both object attributes and potential dictionary access
            meta = response.usage_metadata
            try:
                token_usage = {
                    "prompt_token_count": getattr(meta, "prompt_token_count", None),
                    "candidates_token_count": getattr(meta, "candidates_token_count", None),
                    "total_token_count": getattr(meta, "total_token_count", None),
                }
            except Exception:
                token_usage = {"error": "Could not parse usage_metadata"}

        # --- Format Prompt ---
        prompt_text = ""
        if isinstance(prompt, str):
            prompt_text = prompt
        elif isinstance(prompt, list):
            # Handle list of parts (e.g. PDF bytes + text)
            for part in prompt:
                if isinstance(part, str):
                    # Plain string - common case for text prompts
                    prompt_text += f"{part}\n\n"
                elif hasattr(part, "text") and part.text:
                    # Gemini Part object with text attribute
                    prompt_text += f"[Text Part]:\n{part.text}\n\n"
                elif hasattr(part, "inline_data") or hasattr(part, "file_data"):
                    # Binary data (PDF, image, etc.)
                    prompt_text += f"[Binary/File Part]: (Data hidden)\n\n"
                else:
                    prompt_text += f"[Unknown Part]: {str(part)}\n\n"
        else:
            prompt_text = str(prompt)

        # --- Format Response ---
        response_text = ""
        if error:
            response_text = f"## Error Occurred\n\n```\n{error}\n```"
        else:
            # Try to get text content
            if hasattr(response, "text"):
                response_text += f"## Raw Text Response\n\n{response.text}\n\n"
            
            # Try to get parsed content (if it's a structured object)
            if hasattr(response, "parsed"):
                try:
                    # If it's a Pydantic model
                    if hasattr(response.parsed, "model_dump_json"):
                        response_text += f"## Parsed JSON\n\n```json\n{response.parsed.model_dump_json(indent=2)}\n```\n\n"
                    else:
                        response_text += f"## Parsed Output\n\n{response.parsed}\n\n"
                except Exception:
                     response_text += f"## Parsed Output (Raw)\n\n{response.parsed}\n\n"

        # --- Determine Filenames and Modes ---
        # When session_id is provided, all interactions in that session go to the same file pair
        # Different sessions (different uploads) create new file pairs

        if session_id:
            prompt_file = self.debug_path / f"prompts_{session_id}.md"
            response_file = self.debug_path / f"responses_{session_id}.md"

            # Check if files already exist (append) or need to be created (write)
            if prompt_file.exists():
                mode = "a"
                header_prefix = f"\n\n---\n\n# Interaction: {name} ({current_timestamp})\n"
            else:
                mode = "w"
                header_prefix = f"# Session: {session_id}\n\n---\n\n# Interaction: {name} ({current_timestamp})\n"
        else:
            # No session_id - create standalone files with timestamp
            prompt_file = self.debug_path / f"prompt_{current_timestamp}_{name}.md"
            response_file = self.debug_path / f"response_{current_timestamp}_{name}.md"
            mode = "w"
            header_prefix = f"# Prompt: {name}\n"
            header_prefix += f"**Timestamp:** {current_timestamp}\n"

        # --- Write Prompt File ---
        with open(prompt_file, mode, encoding="utf-8") as f:
            f.write(header_prefix)
            f.write(f"**Time:** {readable_time}\n")
            f.write("\n---\n\n")
            f.write(prompt_text)
            
        # --- Write Response File ---
        with open(response_file, mode, encoding="utf-8") as f:
            if mode == "a":
                f.write(f"\n\n---\n\n# Interaction: {name} ({current_timestamp})\n")
            elif session_id:
                f.write(f"# Session: {session_id}\n\n---\n\n# Interaction: {name} ({current_timestamp})\n")
            else:
                f.write(f"# Response: {name} ({current_timestamp})\n")

            f.write(f"**Duration:** {duration:.4f} seconds\n")
            if token_usage:
                f.write(f"**Token Usage:**\n")
                f.write(f"- Prompt: {token_usage.get('prompt_token_count')}\n")
                f.write(f"- Candidates: {token_usage.get('candidates_token_count')}\n")
                f.write(f"- Total: {token_usage.get('total_token_count')}\n")
            f.write("\n---\n\n")
            f.write(response_text)
            
        logger.info(f"Logged interaction to {self.debug_path}")

    def log_cache_hit(
        self,
        document_name: str,
        summary: str,
        session_id: Optional[str] = None,
    ) -> None:
        """
        Log a cache hit event (no LLM call was made).

        If session_id is provided, appends to that session's log files.
        Otherwise, creates a standalone timestamped file.

        Args:
            document_name: The document/PDF name.
            summary: Human-readable summary of the cache hit.
            session_id: Optional session ID to append to existing logs.
        """
        current_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        readable_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        if session_id:
            # Append to session's existing log files
            prompt_file = self.debug_path / f"prompts_{session_id}.md"
            response_file = self.debug_path / f"responses_{session_id}.md"
            mode = "a" if prompt_file.exists() else "w"
            header = f"\n\n---\n\n# Cache Hit ({current_timestamp})\n" if mode == "a" else f"# Session: {session_id}\n\n---\n\n# Cache Hit ({current_timestamp})\n"
        else:
            # Standalone file for cache hits without session context
            prompt_file = self.debug_path / f"cache_hit_{current_timestamp}.md"
            response_file = None  # No response file for cache hits without session
            mode = "w"
            header = f"# Cache Hit ({current_timestamp})\n"

        # Write to prompt file
        with open(prompt_file, mode, encoding="utf-8") as f:
            f.write(header)
            f.write(f"**Time:** {readable_time}\n")
            f.write(f"**Document:** {document_name}\n")
            f.write("\n---\n\n")
            f.write("*No LLM prompt sent - notes served from client-side cache.*\n\n")
            f.write(summary)

        # Write to response file (only if we have a session)
        if response_file:
            with open(response_file, mode, encoding="utf-8") as f:
                f.write(header)
                f.write(f"**Duration:** 0.0000 seconds (cached)\n")
                f.write(f"**Token Usage:** None (served from cache)\n")
                f.write("\n---\n\n")
                f.write("*No LLM response - notes served from client-side cache.*\n\n")
                f.write(summary)

        logger.info(f"Logged cache hit to {self.debug_path}")
