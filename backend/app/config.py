"""
Application configuration loaded from environment variables.

Uses pydantic-settings for validation and type coercion.
API keys can come from:
1. X-API-Key header (for BYOK in production)
2. .env file (for local development)
"""

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from fastapi import Depends, Header, HTTPException
from google import genai
from google.genai import types
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    # Gemini API - optional from .env (can be provided via header instead)
    google_api_key: str = ""
    gemini_model: str = "gemini-3-flash-preview"
    gemini_timeout: int = 30000  # Timeout in milliseconds for Gemini API calls (30 seconds)

    # Note: Context for notes generation is handled at the API layer
    # (previous_page passed explicitly in NotesRequest)

    model_config = {
        "env_file": Path(__file__).resolve().parents[2] / ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()


def get_gemini_client(
    settings: Annotated[Settings, Depends(get_settings)],
    x_api_key: Annotated[str | None, Header()] = None,
) -> genai.Client:
    """
    Dependency that returns a configured Gemini Client.

    Priority:
    1. X-API-Key header (BYOK for production)
    2. GOOGLE_API_KEY from .env (local development)
    3. Error if neither available
    """
    # Priority 1: Header-provided key (BYOK)
    api_key = x_api_key

    # Priority 2: .env key (local dev fallback)
    if not api_key:
        api_key = settings.google_api_key

    # Neither available - error
    if not api_key:
        raise HTTPException(
            status_code=401,
            detail="API key required. Please provide your Gemini API key."
        )

    return genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(timeout=settings.gemini_timeout),
    )
