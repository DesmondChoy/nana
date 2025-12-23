"""
PDF Upload and Parsing Router.

Handles PDF file uploads and extracts page-wise text using Gemini 3 Flash.
Uses inline upload (no Files API) for simplicity.
"""

import json

from fastapi import APIRouter, File, HTTPException, UploadFile
from google import genai
from google.genai import types
from pydantic import BaseModel

from app.config import get_settings


router = APIRouter()


class PageContent(BaseModel):
    """Content extracted from a single PDF page."""

    page_number: int
    text: str
    has_images: bool = False
    has_tables: bool = False


class ParsedPDF(BaseModel):
    """Response containing extracted content from all pages."""

    original_filename: str
    total_pages: int
    pages: list[PageContent]


EXTRACTION_PROMPT = """Analyze this PDF document and extract the content from each page.

For each page, provide:
1. The page number (1-indexed)
2. The full text content
3. Whether the page contains images (true/false)
4. Whether the page contains tables (true/false)

Return ONLY valid JSON in this exact format, with no additional text:
{
  "pages": [
    {
      "page_number": 1,
      "text": "The extracted text content...",
      "has_images": false,
      "has_tables": false
    }
  ]
}

Extract ALL pages. Preserve paragraph structure. Include all text, headings, captions, and footnotes."""


@router.post("/upload", response_model=ParsedPDF)
async def upload_and_parse_pdf(file: UploadFile = File(...)) -> ParsedPDF:
    """
    Upload a PDF and extract page-wise content using Gemini 3 Flash.

    The PDF is sent inline to Gemini (no Files API), parsed in a single call,
    and structured content is returned for each page.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    settings = get_settings()
    if not settings.google_api_key:
        raise HTTPException(status_code=500, detail="GOOGLE_API_KEY not configured in .env")

    pdf_bytes = await file.read()

    # Check size limit (50MB)
    if len(pdf_bytes) > 50 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="PDF exceeds 50MB limit. Please upload a smaller file.",
        )

    client = genai.Client(api_key=settings.google_api_key)

    try:
        response = client.models.generate_content(
            model=settings.gemini_model,
            contents=[
                types.Part.from_bytes(
                    data=pdf_bytes,
                    mime_type="application/pdf",
                ),
                EXTRACTION_PROMPT,
            ],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini API error: {e}")

    # Parse the JSON response
    try:
        response_text = response.text.strip()
        # Handle potential markdown code blocks in response
        if response_text.startswith("```"):
            response_text = response_text.split("```")[1]
            if response_text.startswith("json"):
                response_text = response_text[4:]
            response_text = response_text.strip()

        parsed = json.loads(response_text)
        pages = [
            PageContent(
                page_number=p["page_number"],
                text=p["text"],
                has_images=p.get("has_images", False),
                has_tables=p.get("has_tables", False),
            )
            for p in parsed["pages"]
        ]
    except (json.JSONDecodeError, KeyError) as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse Gemini response: {e}",
        )

    return ParsedPDF(
        original_filename=file.filename,
        total_pages=len(pages),
        pages=pages,
    )
