"""
PDF Upload Router.

Handles PDF file uploads and streams them directly to Gemini API.
"""

import io

import google.generativeai as genai
from fastapi import APIRouter, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.config import get_settings


router = APIRouter()


class UploadResponse(BaseModel):
    """Response returned after successful PDF upload to Gemini."""

    gemini_file_name: str
    original_filename: str
    message: str


@router.post("/upload", response_model=UploadResponse)
async def upload_pdf(file: UploadFile = File(...)) -> UploadResponse:
    """
    Upload a PDF file directly to Gemini API.

    Returns the Gemini file reference for subsequent API calls.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    settings = get_settings()
    if not settings.gemini_api_key:
        raise HTTPException(status_code=500, detail="Gemini API key not configured")

    genai.configure(api_key=settings.gemini_api_key)

    content = await file.read()
    file_stream = io.BytesIO(content)

    try:
        gemini_file = genai.upload_file(
            file=file_stream,
            mime_type="application/pdf",
            display_name=file.filename,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to upload to Gemini: {e}")

    return UploadResponse(
        gemini_file_name=gemini_file.name,
        original_filename=file.filename,
        message="PDF uploaded to Gemini successfully.",
    )
