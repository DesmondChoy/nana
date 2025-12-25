"""
Debug Router.

Provides endpoints for debug logging, including cache-hit tracking.
These endpoints don't call the LLM - they only log for observability.
"""

from datetime import datetime
from typing import List

from fastapi import APIRouter
from pydantic import BaseModel

from app.debug import DebugLogger

router = APIRouter()


class CacheHitRequest(BaseModel):
    """Request payload for logging cache hits."""
    document_name: str
    cached_pages: List[int]
    total_pages: int


class CacheHitResponse(BaseModel):
    """Response confirming cache hit was logged."""
    logged: bool
    message: str


@router.post("/debug/cache-hits", response_model=CacheHitResponse)
async def log_cache_hits(request: CacheHitRequest) -> CacheHitResponse:
    """
    Log which pages used cached notes (no LLM calls made).

    This endpoint is called by the frontend when notes generation
    detects pages already in cache. It appends to the debug log
    for complete traceability.
    """
    if not request.cached_pages:
        return CacheHitResponse(logged=False, message="No cached pages to log")

    debug_logger = DebugLogger()

    # Build a human-readable summary
    pages_str = ", ".join(str(p) for p in sorted(request.cached_pages))
    summary = (
        f"**Cache Hit Summary**\n\n"
        f"- Document: `{request.document_name}`\n"
        f"- Pages served from cache: [{pages_str}]\n"
        f"- Total cached: {len(request.cached_pages)} of {request.total_pages} pages\n"
        f"- No LLM calls made for these pages\n"
    )

    debug_logger.log_cache_hit(
        document_name=request.document_name,
        summary=summary,
    )

    return CacheHitResponse(
        logged=True,
        message=f"Logged {len(request.cached_pages)} cached pages for {request.document_name}"
    )
