// User Profile types - mirrors backend schemas
export interface UserProfile {
  prior_expertise: PriorExpertise;
  math_comfort: MathComfort;
  detail_level: DetailLevel;
  primary_goal: PrimaryGoal;
  additional_context?: string;
}

export type PriorExpertise =
  | 'Data Science/ML'
  | 'Software Engineering'
  | 'Statistics'
  | 'Domain Novice';

export type MathComfort =
  | 'No equations (words/intuition only)'
  | 'Light notation ok'
  | 'Equation-heavy is fine';

export type DetailLevel =
  | 'Concise (bullets only)'
  | 'Balanced (paragraphs + bullets)'
  | 'Comprehensive (textbook depth)';

export type PrimaryGoal =
  | 'Exam prep'
  | 'Deep understanding'
  | 'Quick reference';

// Topic Mastery tracking
export interface TopicMastery {
  score: number;
  attempts: number;
  last_updated: string;
}

// PDF Content types
export interface PageContent {
  page_number: number;
  text: string;
  has_images: boolean;
  has_tables: boolean;
}

export interface ParsedPDF {
  original_filename: string;
  total_pages: number;
  pages: PageContent[];
  session_id: string; // Unique ID for this upload session (for debug log grouping)
}

// Notes types - mirrors backend NotesResponse (markdown format)
export interface NotesResponse {
  markdown: string;
  topic_labels: string[];
  page_references: number[];
}

// Page notes cache entry
export interface PageNotes {
  page_number: number;
  notes: NotesResponse;
  generated_at: string;
}
