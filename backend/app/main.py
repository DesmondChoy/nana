"""
NANA Backend - FastAPI Application Entry Point.

This module initializes the FastAPI app, registers routers,
and sets up middleware. Run with: uvicorn app.main:app --reload
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import upload, notes


app = FastAPI(
    title="NANA Study Assistant API",
    description="Backend API for PDF processing, note generation, and quizzes",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(notes.router, prefix="/api", tags=["notes"])


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy"}


@app.get("/test-text")
async def test_text():
    """Simple test endpoint for playwright checks."""
    return {"message": "NANA backend is running"}
