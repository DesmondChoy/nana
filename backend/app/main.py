"""
NANA Backend - FastAPI Application Entry Point.

This module initializes the FastAPI app, registers routers,
and sets up middleware. Run with: uvicorn app.main:app --reload
"""

from fastapi import FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from app.routers import debug, emphasis, inline_commands, notes, upload, upload_stream

app = FastAPI(
    title="NANA Study Assistant API",
    description="Backend API for PDF processing, note generation, and quizzes",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        # Railway production domains (update these after deployment)
        "https://*.up.railway.app",
    ],
    allow_origin_regex=r"https://.*\.up\.railway\.app",  # Match any Railway subdomain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(upload_stream.router, prefix="/api", tags=["upload-stream"])
app.include_router(notes.router, prefix="/api", tags=["notes"])
app.include_router(inline_commands.router, prefix="/api", tags=["inline-commands"])
app.include_router(emphasis.router, prefix="/api", tags=["emphasis"])
app.include_router(debug.router, prefix="/api", tags=["debug"])


@app.get("/")
async def root():
    """Root endpoint to confirm server is running."""
    return {"message": "Welcome to NANA Backend API", "docs": "/docs"}


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.post("/api/validate-key")
async def validate_api_key(x_api_key: str = Header(...)):
    """
    Validate a Gemini API key by making a test call.
    Returns success if key is valid, error details if not.
    """
    from google import genai
    from google.genai import types

    try:
        client = genai.Client(api_key=x_api_key)
        # Make a minimal API call to validate the key
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents="Say 'ok'",
            config=types.GenerateContentConfig(
                max_output_tokens=5,
            ),
        )
        return {"valid": True, "message": "API key is valid"}
    except Exception as e:
        error_msg = str(e)
        # Provide user-friendly error messages
        if "API_KEY_INVALID" in error_msg or "401" in error_msg:
            detail = "Invalid API key. Please check your key and try again."
        elif "QUOTA" in error_msg or "429" in error_msg:
            detail = "API quota exceeded. Please wait or check your usage limits."
        else:
            detail = f"API key validation failed: {error_msg}"

        raise HTTPException(status_code=401, detail=detail)


@app.get("/test-text")
async def test_text():
    """Simple test endpoint for playwright checks."""
    return {"message": "NANA backend is running"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
