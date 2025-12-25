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

class BulletPoint(BaseModel):
    """A single bullet point in the notes."""
    text: str
    importance: str = Field(..., description="key|supporting|detail")

class NoteSection(BaseModel):
    """A section of the generated notes."""
    title: str
    summary: str
    bullets: List[BulletPoint]
    topic_labels: List[str]
    # Simple page reference as list of page numbers relevant to this section
    page_references: List[int]

class NotesResponse(BaseModel):
    """The structured response from the notes generation API."""
    sections: List[NoteSection]
