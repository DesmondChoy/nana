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
  filename?: string;
  sessionId?: string; // Session ID for debug log grouping
  signal?: AbortSignal; // For cancelling in-flight requests
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
      document_name: params.filename ?? null,
      session_id: params.sessionId ?? null,
    }),
    signal: params.signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Generation failed' }));
    throw new Error(error.detail || 'Failed to generate notes');
  }

  return response.json();
}

// Log cache hits to backend for debug tracing
export interface LogCacheHitsParams {
  documentName: string;
  cachedPages: number[];
  totalPages: number;
}

export async function logCacheHits(params: LogCacheHitsParams): Promise<void> {
  // Fire and forget - don't block on this
  fetch(`${API_BASE}/debug/cache-hits`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      document_name: params.documentName,
      cached_pages: params.cachedPages,
      total_pages: params.totalPages,
    }),
  }).catch((error) => {
    // Silent fail - this is just for debugging
    console.warn('Failed to log cache hits:', error);
  });
}
