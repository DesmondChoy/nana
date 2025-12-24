"""
Application configuration loaded from environment variables.

Uses pydantic-settings for validation and type coercion.
All sensitive values (API keys) should be set via .env file.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    # Gemini API
    google_api_key: str = ""
    gemini_model: str = "gemini-3-flash-preview"

    # Note: Context for notes generation is handled at the API layer
    # (previous_page passed explicitly in NotesRequest)

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
