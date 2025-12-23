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

    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    debug: bool = False

    # Retrieval settings
    chunk_size_tokens: int = 250
    chunk_overlap_percent: float = 0.2
    top_k_retrieval: int = 5

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
    }


@lru_cache
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
