from enum import Enum

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
    additional_context: str | None = Field(None, description="Free-text context about the user")

class TopicMastery(BaseModel):
    """Tracking score for a specific topic."""
    score: float
    attempts: int
    last_updated: str

# --- Notes Generation API Models ---

class NotesRequest(BaseModel):
    """Request payload for generating notes for a specific page."""
    current_page: PageContent
    previous_page: PageContent | None = Field(None, description="Previous page (N-1) for continuity context")
    user_profile: UserProfile
    topic_mastery: dict[str, TopicMastery] = Field(default_factory=dict, description="Map of topic IDs to mastery scores")
    previous_notes_context: str | None = Field(None, description="Summary or text of previous notes for continuity")
    document_name: str | None = Field(None, description="Name of the document/PDF being processed (for logging)")
    session_id: str | None = Field(None, description="Session ID from upload (for grouping debug logs)")

class NotesResponse(BaseModel):
    """Markdown notes with metadata for tracking.

    The LLM returns rich markdown content with Obsidian-style callouts,
    plus structured metadata for topic mastery tracking.
    """
    markdown: str = Field(..., description="Full markdown content of the notes with Obsidian-style callouts")
    topic_labels: list[str] = Field(default_factory=list, description="Topics covered for mastery tracking (lowercase, hyphenated)")
    page_references: list[int] = Field(default_factory=list, description="Page numbers referenced in these notes")


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
    session_id: str | None = Field(None, description="Session ID for debug log grouping")


class InlineCommandResponse(BaseModel):
    """Response from inline text transformation."""
    content: str = Field(..., description="Transformed markdown content")
    command_type: InlineCommandType = Field(..., description="The command type that was executed")


# --- Emphasis Integration API Models ---

class IntegrateEmphasisRequest(BaseModel):
    """Request payload for integrating user emphasis into existing notes."""
    page_number: int = Field(..., description="Page number of the notes")
    existing_notes: str = Field(..., description="Current markdown notes content")
    emphasis_content: str = Field(..., description="User's key points to integrate")
    page_content: PageContent | None = Field(None, description="Page content for context (optional for cached sessions)")
    user_profile: UserProfile = Field(..., description="User profile for personalization")
    session_id: str | None = Field(None, description="Session ID for debug log grouping")


# Response uses existing NotesResponse model


# --- Document Overview API Models ---


class DocumentOverview(BaseModel):
    """LLM-generated document overview visualization.

    The content is Markdown that can include ASCII diagrams, tables,
    concept maps, outlines, or timelines depending on document type.
    """

    content: str = Field(..., description="Markdown visualization of document structure")
    visualization_type: str = Field(
        ...,
        description="Type of visualization used: executive_summary, table, concept_map, outline, timeline",
    )
    document_type: str = Field(
        ...,
        description="Detected document type: academic_paper, presentation, textbook, manual, report, other",
    )


# --- Upload Progress SSE Models ---


class UploadStep(str, Enum):
    """Steps in the upload/processing pipeline."""

    VALIDATING = "validating"
    EXTRACTING = "extracting"
    PARSING = "parsing"
    GENERATING_OVERVIEW = "generating_overview"
    COMPLETE = "complete"
    ERROR = "error"


class UploadProgressEvent(BaseModel):
    """SSE event for upload progress updates.

    Sent as `data: {json}` in the SSE stream.
    """

    step: UploadStep = Field(..., description="Current processing step")
    message: str = Field(..., description="Human-readable progress message")
    progress_percent: int = Field(..., ge=0, le=100, description="Progress percentage (0-100)")
    data: dict | None = Field(None, description="Additional data (e.g., ParsedPDF on complete)")
