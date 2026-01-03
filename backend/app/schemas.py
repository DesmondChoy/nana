from enum import Enum
from typing import Dict, List, Optional
from pydantic import BaseModel, Field

# --- Shared Models ---

class PageContent(BaseModel):
    """Content extracted from a single PDF page."""
    page_number: int
    text: str
    has_images: bool = False
    has_tables: bool = False

# --- User Profile & Mastery ---

class UserProfile(BaseModel):
    """User profile settings to customize generation."""
    prior_expertise: str = Field(..., description="User's background knowledge (e.g., 'Novice', 'Expert')")
    math_comfort: str = Field(..., description="Comfort level with math (e.g., 'No equations', 'Equation-heavy')")
    detail_level: str = Field(..., description="Desired verbosity (e.g., 'Concise', 'Comprehensive')")
    primary_goal: str = Field(..., description="Learning goal (e.g., 'Exam prep', 'Deep understanding')")
    additional_context: Optional[str] = Field(None, description="Free-text context about the user")

class TopicMastery(BaseModel):
    """Tracking score for a specific topic."""
    score: float
    attempts: int
    last_updated: str

# --- Notes Generation API Models ---

class NotesRequest(BaseModel):
    """Request payload for generating notes for a specific page."""
    current_page: PageContent
    previous_page: Optional[PageContent] = Field(None, description="Previous page (N-1) for continuity context")
    user_profile: UserProfile
    topic_mastery: Dict[str, TopicMastery] = Field(default_factory=dict, description="Map of topic IDs to mastery scores")
    previous_notes_context: Optional[str] = Field(None, description="Summary or text of previous notes for continuity")
    document_name: Optional[str] = Field(None, description="Name of the document/PDF being processed (for logging)")
    session_id: Optional[str] = Field(None, description="Session ID from upload (for grouping debug logs)")

class NotesResponse(BaseModel):
    """Markdown notes with metadata for tracking.

    The LLM returns rich markdown content with Obsidian-style callouts,
    plus structured metadata for topic mastery tracking.
    """
    markdown: str = Field(..., description="Full markdown content of the notes with Obsidian-style callouts")
    topic_labels: List[str] = Field(default_factory=list, description="Topics covered for mastery tracking (lowercase, hyphenated)")
    page_references: List[int] = Field(default_factory=list, description="Page numbers referenced in these notes")


# --- Inline Command API Models ---

class InlineCommandType(str, Enum):
    """Types of inline text transformations available."""
    ELABORATE = "elaborate"
    SIMPLIFY = "simplify"
    ANALOGY = "analogy"


class InlineCommandRequest(BaseModel):
    """Request payload for inline text transformation."""
    command_type: InlineCommandType = Field(..., description="Type of transformation to apply")
    selected_text: str = Field(..., description="Text selected by the user for transformation")
    page_number: int = Field(..., description="Page number where the selection occurred")
    page_text: str = Field(..., description="Full text of the page for context")
    user_profile: UserProfile = Field(..., description="User profile for personalization")
    session_id: Optional[str] = Field(None, description="Session ID for debug log grouping")


class InlineCommandResponse(BaseModel):
    """Response from inline text transformation."""
    content: str = Field(..., description="Transformed markdown content")
    command_type: InlineCommandType = Field(..., description="The command type that was executed")
