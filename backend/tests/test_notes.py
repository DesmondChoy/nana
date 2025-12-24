from unittest.mock import MagicMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.schemas import NotesResponse, NoteSection, BulletPoint

client = TestClient(app)

# Mock Data
VALID_PAYLOAD = {
    "current_page": {
        "page_number": 2,
        "text": "Transformers are deep learning models...",
        "has_images": False,
        "has_tables": False
    },
    "previous_page": {
        "page_number": 1,
        "text": "Introduction to neural networks...",
        "has_images": False,
        "has_tables": False
    },
    "user_profile": {
        "prior_expertise": "Novice",
        "math_comfort": "No equations",
        "detail_level": "Concise",
        "primary_goal": "Exam prep"
    },
    "topic_mastery": {
        "transformer": {"score": 0.2, "attempts": 1, "last_updated": "2023-10-27"}
    },
    "previous_notes_context": "Previous intro..."
}

MOCKED_RESPONSE = NotesResponse(
    sections=[
        NoteSection(
            title="Introduction to Transformers",
            summary="Basic overview.",
            bullets=[
                BulletPoint(text="Self-attention mechanism.", importance="key")
            ],
            topic_labels=["transformer", "attention"],
            page_references=[1]
        )
    ]
)

@patch("app.routers.notes.genai.Client")
@patch("app.routers.notes.get_settings")
def test_generate_notes_success(mock_settings, mock_client_cls):
    # Setup Mocks
    mock_settings.return_value.google_api_key = "fake_key"
    mock_settings.return_value.gemini_model = "gemini-3-flash-preview"
    
    mock_client_instance = mock_client_cls.return_value
    mock_response = MagicMock()
    mock_response.parsed = MOCKED_RESPONSE
    mock_client_instance.models.generate_content.return_value = mock_response

    # Execute Request
    response = client.post("/api/notes", json=VALID_PAYLOAD)

    # Assertions
    assert response.status_code == 200
    data = response.json()
    assert len(data["sections"]) == 1
    assert data["sections"][0]["title"] == "Introduction to Transformers"
    
    # Verify Gemini Call
    mock_client_instance.models.generate_content.assert_called_once()
    call_kwargs = mock_client_instance.models.generate_content.call_args[1]
    assert call_kwargs["model"] == "gemini-3-flash-preview"
    assert call_kwargs["config"].response_schema == NotesResponse
