import type {
  ParsedPDF,
  PageContent,
  UserProfile,
  TopicMastery,
  NotesResponse,
  InlineCommandType,
  InlineCommandResponse,
  UploadProgressEvent,
} from '../types';
import { useApiKeyStore } from '../stores/apiKeyStore';

// Use environment variable for API base, fallback to localhost for development
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api';

// Helper to get headers with API key
function getHeaders(contentType?: string): HeadersInit {
  const apiKey = useApiKeyStore.getState().apiKey;
  const headers: HeadersInit = {};

  if (contentType) {
    headers['Content-Type'] = contentType;
  }

  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  return headers;
}

// Callbacks for SSE streaming upload
export interface UploadProgressCallbacks {
  onProgress: (event: UploadProgressEvent) => void;
  onComplete: (data: ParsedPDF) => void;
  onError: (error: string) => void;
}

/**
 * Parse SSE stream from a ReadableStream.
 *
 * SSE format: each event is "data: {json}\n\n"
 * The challenge: data arrives in arbitrary chunks that may split across event boundaries.
 * We buffer incoming data and extract complete events as they arrive.
 */
function parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  callbacks: UploadProgressCallbacks,
  signal?: AbortSignal
): void {
  const decoder = new TextDecoder();
  let buffer = '';

  async function processStream(): Promise<void> {
    try {
      while (true) {
        // Check if aborted
        if (signal?.aborted) {
          reader.cancel();
          return;
        }

        const { done, value } = await reader.read();

        if (done) {
          // Stream ended - process any remaining buffer
          if (buffer.trim()) {
            processBufferedEvents();
          }
          return;
        }

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete events from buffer
        processBufferedEvents();
      }
    } catch (error) {
      if (signal?.aborted) return;
      callbacks.onError(error instanceof Error ? error.message : 'Stream read error');
    }
  }

  function processBufferedEvents(): void {
    // SSE events are separated by double newlines
    // Split and process complete events, keep incomplete data in buffer
    const events = buffer.split('\n\n');

    // Last element might be incomplete (no trailing \n\n yet)
    buffer = events.pop() || '';

    for (const eventText of events) {
      if (!eventText.trim()) continue;

      // Each line in an event starts with a field name
      // We only care about "data:" lines
      const lines = eventText.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const jsonStr = line.slice(6); // Remove "data: " prefix
          try {
            const event: UploadProgressEvent = JSON.parse(jsonStr);

            // Route to appropriate callback based on step
            if (event.step === 'complete' && event.data) {
              callbacks.onComplete(event.data as ParsedPDF);
            } else if (event.step === 'error') {
              callbacks.onError(event.message);
            } else {
              callbacks.onProgress(event);
            }
          } catch (parseError) {
            console.warn('Failed to parse SSE event:', parseError);
          }
        }
      }
    }
  }

  processStream();
}

/**
 * Upload PDF with SSE progress streaming.
 *
 * Instead of waiting for the entire response, this streams progress updates
 * as the server processes the PDF through each step.
 */
export async function uploadPDFWithProgress(
  file: File,
  userProfile: UserProfile | undefined,
  callbacks: UploadProgressCallbacks,
  signal?: AbortSignal
): Promise<void> {
  const formData = new FormData();
  formData.append('file', file);

  if (userProfile) {
    formData.append('user_profile', JSON.stringify(userProfile));
  }

  const apiKey = useApiKeyStore.getState().apiKey;
  const headers: HeadersInit = {};
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  try {
    const response = await fetch(`${API_BASE}/upload-stream`, {
      method: 'POST',
      headers,
      body: formData,
      signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
      callbacks.onError(error.detail || 'Failed to upload PDF');
      return;
    }

    if (!response.body) {
      callbacks.onError('No response body');
      return;
    }

    // Get the reader and start parsing SSE events
    const reader = response.body.getReader();
    parseSSEStream(reader, callbacks, signal);
  } catch (error) {
    if (signal?.aborted) return;
    callbacks.onError(error instanceof Error ? error.message : 'Upload failed');
  }
}

// Upload and parse PDF (original non-streaming version)
export async function uploadPDF(file: File, userProfile?: UserProfile): Promise<ParsedPDF> {
  const formData = new FormData();
  formData.append('file', file);

  // Include user profile for overview generation
  if (userProfile) {
    formData.append('user_profile', JSON.stringify(userProfile));
  }

  // Note: Don't set Content-Type for FormData - browser sets it with boundary
  const apiKey = useApiKeyStore.getState().apiKey;
  const headers: HeadersInit = {};
  if (apiKey) {
    headers['X-API-Key'] = apiKey;
  }

  const response = await fetch(`${API_BASE}/upload`, {
    method: 'POST',
    headers,
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
    headers: getHeaders('application/json'),
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
    headers: getHeaders('application/json'),
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

// Timeout for inline commands (in milliseconds)
// Set slightly higher than backend (60s) to let backend timeout first with better error message
const INLINE_COMMAND_TIMEOUT = 65000;

// Execute inline command (elaborate, simplify, analogy, diagram)
export interface ExecuteInlineCommandParams {
  commandType: InlineCommandType;
  selectedText: string;
  pageNumber: number;
  pageText: string;
  userProfile: UserProfile;
  sessionId?: string;
  signal?: AbortSignal;
}

export async function executeInlineCommand(
  params: ExecuteInlineCommandParams
): Promise<InlineCommandResponse> {
  // Create timeout controller
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), INLINE_COMMAND_TIMEOUT);

  // If user provides a signal, abort on either timeout or user cancellation
  const userSignal = params.signal;
  const abortHandler = () => timeoutController.abort();
  if (userSignal) {
    userSignal.addEventListener('abort', abortHandler);
  }

  try {
    const response = await fetch(`${API_BASE}/inline-command`, {
      method: 'POST',
      headers: getHeaders('application/json'),
      body: JSON.stringify({
        command_type: params.commandType,
        selected_text: params.selectedText,
        page_number: params.pageNumber,
        page_text: params.pageText,
        user_profile: params.userProfile,
        session_id: params.sessionId ?? null,
      }),
      signal: timeoutController.signal,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Command failed' }));
      throw new Error(error.detail || 'Failed to execute inline command');
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      // Check if it was user cancellation or timeout
      if (userSignal?.aborted) {
        throw new Error('Request was cancelled');
      }
      throw new Error('Request timed out. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
    if (userSignal) {
      userSignal.removeEventListener('abort', abortHandler);
    }
  }
}

// Integrate emphasis into existing notes
export interface IntegrateEmphasisParams {
  pageNumber: number;
  existingNotes: string;
  emphasisContent: string;
  pageContent?: PageContent; // Optional for cached sessions
  userProfile: UserProfile;
  sessionId?: string;
  signal?: AbortSignal;
}

export async function integrateEmphasis(
  params: IntegrateEmphasisParams
): Promise<NotesResponse> {
  const response = await fetch(`${API_BASE}/integrate-emphasis`, {
    method: 'POST',
    headers: getHeaders('application/json'),
    body: JSON.stringify({
      page_number: params.pageNumber,
      existing_notes: params.existingNotes,
      emphasis_content: params.emphasisContent,
      page_content: params.pageContent,
      user_profile: params.userProfile,
      session_id: params.sessionId ?? null,
    }),
    signal: params.signal,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Integration failed' }));
    throw new Error(error.detail || 'Failed to integrate emphasis');
  }

  return response.json();
}

// Validate API key
export async function validateApiKey(apiKey: string): Promise<{ valid: boolean; message: string }> {
  const response = await fetch(`${API_BASE}/validate-key`, {
    method: 'POST',
    headers: {
      'X-API-Key': apiKey,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Validation failed' }));
    throw new Error(error.detail || 'Failed to validate API key');
  }

  return response.json();
}
