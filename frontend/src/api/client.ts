import type {
  ParsedPDF,
  PageContent,
  UserProfile,
  TopicMastery,
  NotesResponse,
} from '../types';

const API_BASE = 'http://localhost:8000/api';

// Upload and parse PDF
export async function uploadPDF(file: File): Promise<ParsedPDF> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
    throw new Error(error.detail || 'Failed to upload PDF');
  }

  return response.json();
}

// Generate notes for a single page
export interface GenerateNotesParams {
  currentPage: PageContent;
  previousPage?: PageContent;
  userProfile: UserProfile;
  topicMastery: Record<string, TopicMastery>;
  previousNotesContext?: string;
}

export async function generateNotes(params: GenerateNotesParams): Promise<NotesResponse> {
  const response = await fetch(`${API_BASE}/notes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      current_page: params.currentPage,
      previous_page: params.previousPage ?? null,
      user_profile: params.userProfile,
      topic_mastery: params.topicMastery,
      previous_notes_context: params.previousNotesContext ?? null,
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Generation failed' }));
    throw new Error(error.detail || 'Failed to generate notes');
  }

  return response.json();
}
