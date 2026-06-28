export type CopilotCommand =
  | 'summarize'
  | 'draft-reply'
  | 'draft-note'
  | 'draft-call-log'
  | 'similar'
  | 'suggest-kb'
  | 'triage';

export type CopilotSuggestionType = 'informational' | 'draft' | 'suggested_action';
export type CopilotSuggestionStatus = 'queued' | 'pending_review' | 'approved' | 'executed' | 'rejected' | 'failed';
export type CopilotSurface = 'rail' | 'activity_stream';
export type CopilotConfidenceLabel = 'high' | 'medium' | 'low';

export interface CopilotFailurePayload {
  title?: string;
  message?: string;
  retryable?: boolean;
  error_type?: string;
  error?: string;
}

export interface CopilotSource {
  type: string;
  label: string;
  detail?: string;
}

export interface TriageSuggestedUpdates {
  priority?: string | null;
  status?: string | null;
  category_id?: number | null;
  category_label?: string | null;
  assignee_id?: number | null;
  assignee_label?: string | null;
  department_id?: number | null;
  department_label?: string | null;
  tags?: string[];
}

export interface CopilotTaskDraft {
  title: string;
  description?: string;
  priority?: string | null;
  assignee_id?: number | null;
  assignee_label?: string | null;
  department_id?: number | null;
  department_label?: string | null;
  due_date?: string | null;
  link_to_ticket?: boolean;
}

export interface CopilotRecommendedAction {
  type: 'create_follow_up_task' | 'close_ticket' | 'reopen_ticket';
  label: string;
  reason?: string;
  task?: CopilotTaskDraft | null;
  requires_confirmation: boolean;
}

export interface CopilotPayloadBase {
  sources?: CopilotSource[];
  confidence_label?: CopilotConfidenceLabel | null;
}

export interface CopilotTicketContext {
  id: number;
  ticketId: string;
  title: string;
  status: string;
  priority: string;
  creatorName?: string;
  creatorEmail?: string;
  categoryName?: string;
  hasNewReply?: boolean;
  breached?: boolean;
  linkedTasksCount?: number;
  commentsCount?: number;
}

export interface SummaryPayload extends CopilotPayloadBase {
  summary?: string;
  key_facts?: string[];
  thread_recap?: string;
}

export interface DraftPayload extends CopilotPayloadBase {
  subject?: string;
  content?: string;
}

export interface SimilarItem {
  id: number;
  ticket_id: string;
  title: string;
  status: string;
  priority?: string | null;
  reason?: string;
}

export interface SimilarPayload extends CopilotPayloadBase {
  items?: SimilarItem[];
}

export interface KBSuggestionItem {
  article_id: number;
  title: string;
  score?: number;
  excerpt?: string;
}

export interface SuggestKBPayload extends CopilotPayloadBase {
  items?: KBSuggestionItem[];
}

export interface TriagePayload extends CopilotPayloadBase {
  summary?: string;
  next_step?: string;
  missing_info?: string[];
  suggested_updates?: TriageSuggestedUpdates;
  rationale?: string[];
  recommended_actions?: CopilotRecommendedAction[];
}

export interface CopilotSuggestion {
  id: number;
  ticket_id: number | null;
  command: CopilotCommand;
  request_text: string;
  suggestion_type: CopilotSuggestionType;
  status: CopilotSuggestionStatus;
  surface: CopilotSurface;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  confidence_score: number | null;
  approved_at?: string | null;
  rejected_at?: string | null;
  created_at: string;
}

export interface PendingCopilotDraft {
  ticketId: number;
  kind: 'reply' | 'note';
  content: string;
  subject?: string;
  sourceSuggestionId?: number;
}
