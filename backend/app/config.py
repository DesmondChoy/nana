"""
Application configuration loaded from environment variables.

Uses pydantic-settings for validation and type coercion.
All sensitive values (API keys) should be set via .env file.
"""

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from fastapi import Depends, HTTPException
from google import genai
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    # Gemini API
    google_api_key: str = ""
    gemini_model: str = "gemini-3-flash-preview"

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
    settings: Annotated[Settings, Depends(get_settings)]
) -> genai.Client:
    """
    Dependency that returns a configured Gemini Client.
    Validates that the API key is present.
    """
    if not settings.google_api_key:
        raise HTTPException(
            status_code=500, 
            detail="GOOGLE_API_KEY not configured in .env file"
        )
    return genai.Client(api_key=settings.google_api_key)
