"""
PDF Upload and Parsing Router.

Handles PDF file uploads and extracts page-wise text using Gemini 3 Flash.
Uses inline upload (no Files API) for simplicity.
"""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from google import genai
from google.genai import types
from pydantic import BaseModel

from app.config import Settings, get_gemini_client, get_settings
from app.schemas import PageContent


router = APIRouter()


class PDFExtractionResponse(BaseModel):
    """Structure for the LLM response."""
    pages: list[PageContent]


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

Extract ALL pages. Preserve paragraph structure. Include all text, headings, captions, and footnotes."""


@router.post("/upload", response_model=ParsedPDF)
async def upload_and_parse_pdf(
    file: UploadFile = File(...),
    settings: Settings = Depends(get_settings),
    client: genai.Client = Depends(get_gemini_client),
) -> ParsedPDF:
    """
    Upload a PDF and extract page-wise content using Gemini 3 Flash.

    The PDF is sent inline to Gemini (no Files API), parsed in a single call,
    and structured content is returned for each page.
    """
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted")

    pdf_bytes = await file.read()

    # Check size limit (50MB)
    if len(pdf_bytes) > 50 * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail="PDF exceeds 50MB limit. Please upload a smaller file.",
        )

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
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=PDFExtractionResponse,
            ),
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Gemini API error: {e}")

    # Parse the JSON response
    try:
        parsed_response: PDFExtractionResponse = response.parsed
        pages = parsed_response.pages
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to parse Gemini response: {e}",
        )

    return ParsedPDF(
        original_filename=file.filename,
        total_pages=len(pages),
        pages=pages,
    )
