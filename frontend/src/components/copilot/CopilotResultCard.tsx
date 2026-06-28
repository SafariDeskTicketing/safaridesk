import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpRight, Check, FileText, Info, Lightbulb, Loader2, Sparkles, X } from 'lucide-react';

import { sanitizeHTML } from '../../utils/sanitize';
import { getCopilotFailureCopy } from '../../utils/copilotFailure';
import { errorNotification, successNotification } from '../ui/Toast';
import http from '../../services/http';
import { APIS } from '../../services/apis';
import { useCopilotStore } from '../../stores/copilotStore';
import type {
  CopilotConfidenceLabel,
  CopilotPayloadBase,
  CopilotRecommendedAction,
  CopilotSource,
  CopilotSuggestion,
  DraftPayload,
  KBSuggestionItem,
  SimilarItem,
  SuggestKBPayload,
  SummaryPayload,
  TriagePayload,
  TriageSuggestedUpdates,
} from '../../types/copilot';

interface CopilotResultCardProps {
  suggestion: CopilotSuggestion;
  onSuggestionUpdate: (suggestion: CopilotSuggestion) => void;
}

type ErrorWithResponse = {
  response?: {
    data?: {
      message?: string;
    };
  };
};

const ResultSectionTitle: React.FC<{ title: string }> = ({ title }) => (
  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">{title}</p>
);

const ResultSection: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({
  title,
  children,
  className = '',
}) => (
  <div className={className}>
    <ResultSectionTitle title={title} />
    <div className="mt-2">{children}</div>
  </div>
);

const EmptyResultMessage: React.FC<{ message: string }> = ({ message }) => (
  <p className="text-[12px] leading-5 text-[var(--text-secondary)]">{message}</p>
);

const extractErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null) {
    const candidate = error as ErrorWithResponse;
    if (candidate.response?.data?.message) {
      return candidate.response.data.message;
    }
  }
  return fallback;
};

const getConfidenceLabel = (
  payload: CopilotPayloadBase,
  score: number | null,
): CopilotConfidenceLabel => {
  if (payload.confidence_label === 'high' || payload.confidence_label === 'medium' || payload.confidence_label === 'low') {
    return payload.confidence_label;
  }
  if (score == null) return 'medium';
  if (score >= 0.78) return 'high';
  if (score >= 0.58) return 'medium';
  return 'low';
};

const shouldDisplayConfidence = (
  suggestion: CopilotSuggestion,
  payload: CopilotPayloadBase,
  sources: CopilotSource[],
): boolean => {
  if (suggestion.status === 'queued' || suggestion.status === 'failed' || suggestion.status === 'rejected') {
    return false;
  }
  if (payload.confidence_label === 'high' || payload.confidence_label === 'medium' || payload.confidence_label === 'low') {
    return sources.length > 0;
  }
  return suggestion.confidence_score != null && sources.length > 0;
};

const escapeHTML = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getDraftContentValue = (content: unknown): string => {
  if (typeof content !== 'string') return '';

  const raw = content.trim();
  if (!raw) return '';

  if ((raw.startsWith('{') && raw.endsWith('}')) || (raw.startsWith('[') && raw.endsWith(']'))) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown> | unknown[];
      if (!Array.isArray(parsed) && parsed && typeof parsed === 'object') {
        const candidateFields = ['content', 'body', 'draft', 'message', 'html'];
        for (const field of candidateFields) {
          if (typeof parsed[field] === 'string' && parsed[field].trim()) {
            return getDraftContentValue(parsed[field]);
          }
        }
      }
    } catch {
      return raw;
    }
  }

  return raw;
};

const getDraftContentHTML = (content: unknown): string => {
  const normalized = getDraftContentValue(content);
  if (!normalized) return '';
  if (/<[a-z][\s\S]*>/i.test(normalized)) {
    return sanitizeHTML(normalized);
  }

  return sanitizeHTML(
    normalized
      .split(/\n{2,}/)
      .map((block) => `<p>${escapeHTML(block).replace(/\n/g, '<br />')}</p>`)
      .join(''),
  );
};

const confidenceClasses: Record<CopilotConfidenceLabel, string> = {
  high: 'border-[hsl(var(--primary-600-hsl)_/_0.18)] bg-[var(--card-bg)] text-[hsl(var(--primary-600-hsl))]',
  medium: 'border-[var(--border-color)] bg-[var(--surface-subtle)] text-[var(--text-secondary)]',
  low: 'border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]',
};

const renderSourceChips = (sources: CopilotSource[]) => {
  if (sources.length === 0) return null;

  return (
    <ResultSection title="Based On">
      <div className="space-y-2">
        {sources.map((source, index) => (
          <div
            key={`${source.type}-${source.label}-${index}`}
            className="flex items-start gap-2 text-[12px] leading-5 text-[var(--text-primary)]"
            title={source.detail || source.label}
          >
            <ArrowUpRight size={14} className="mt-0.5 shrink-0 text-[hsl(var(--primary-600-hsl))]" />
            <div className="min-w-0">
              <p className="break-words font-semibold text-[var(--text-primary)] [overflow-wrap:anywhere]">{source.label}</p>
              {source.detail && (
                <p className="break-words text-[var(--text-secondary)] [overflow-wrap:anywhere]">{source.detail}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </ResultSection>
  );
};

const buildUpdateEntries = (updates: TriageSuggestedUpdates | undefined) => {
  if (!updates) return [];

  const entries: Array<{ key: string; value: string }> = [];
  if (updates.priority) entries.push({ key: 'priority', value: updates.priority });
  if (updates.status) entries.push({ key: 'status', value: updates.status });
  if (updates.category_id) {
    entries.push({ key: 'category', value: updates.category_label || `Category #${updates.category_id}` });
  }
  if (updates.assignee_id) {
    entries.push({ key: 'assignee', value: updates.assignee_label || `User #${updates.assignee_id}` });
  }
  if (updates.department_id) {
    entries.push({ key: 'department', value: updates.department_label || `Department #${updates.department_id}` });
  }
  if (updates.tags && updates.tags.length > 0) {
    entries.push({ key: 'tags', value: updates.tags.join(', ') });
  }
  return entries;
};

const renderRecommendedAction = (action: CopilotRecommendedAction, index: number) => (
  <div
    key={`${action.type}-${index}`}
    className={`${index > 0 ? 'pt-2' : ''} pl-4 text-[12px]`}
  >
    <div className="flex items-start gap-2">
      <ArrowUpRight size={14} className="mt-0.5 shrink-0 text-[hsl(var(--primary-600-hsl))]" />
      <div className="min-w-0">
        <p className="break-words text-[13px] font-semibold text-[var(--text-primary)] [overflow-wrap:anywhere]">{action.label}</p>
        {action.reason && <p className="mt-1 leading-5 text-[var(--text-secondary)]">{action.reason}</p>}
      </div>
    </div>

    {action.type === 'create_follow_up_task' && action.task && (
      <div className="mt-3 pl-6 text-[12px]">
        <p className="font-semibold text-[var(--text-primary)]">{action.task.title}</p>
        {action.task.description && (
          <p className="mt-1 leading-5 text-[var(--text-secondary)]">{action.task.description}</p>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {action.task.priority && (
            <span className="text-[11px] text-[var(--text-secondary)]">
              Priority: {action.task.priority}
            </span>
          )}
          {action.task.department_label && (
            <span className="text-[11px] text-[var(--text-secondary)]">
              Department: {action.task.department_label}
            </span>
          )}
          {action.task.assignee_label && (
            <span className="text-[11px] text-[var(--text-secondary)]">
              Assignee: {action.task.assignee_label}
            </span>
          )}
          {action.task.due_date && (
            <span className="text-[11px] text-[var(--text-secondary)]">
              Due: {action.task.due_date}
            </span>
          )}
        </div>
      </div>
    )}
  </div>
);

export const CopilotResultCard: React.FC<CopilotResultCardProps> = ({ suggestion, onSuggestionUpdate }) => {
  const { activeTicket, stageDraft } = useCopilotStore();
  const [confirming, setConfirming] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [applyingDraft, setApplyingDraft] = useState(false);

  const typedPayload = suggestion.payload as CopilotPayloadBase;
  const failureCopy = useMemo(() => getCopilotFailureCopy(suggestion), [suggestion]);
  const confidenceLabel = useMemo(
    () => getConfidenceLabel(typedPayload, suggestion.confidence_score),
    [typedPayload, suggestion.confidence_score],
  );
  const sources = Array.isArray(typedPayload.sources) ? typedPayload.sources : [];
  const displayConfidence = useMemo(
    () => shouldDisplayConfidence(suggestion, typedPayload, sources),
    [suggestion, typedPayload, sources],
  );
  const isLowEvidenceAction = suggestion.suggestion_type === 'suggested_action' && (confidenceLabel === 'low' || sources.length === 0);
  const draftContentHTML = useMemo(
    () =>
      suggestion.command === 'draft-reply' || suggestion.command === 'draft-note'
        ? getDraftContentHTML((suggestion.payload as DraftPayload).content)
        : '',
    [suggestion.command, suggestion.payload],
  );

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      const response = await http.post(`${APIS.COPILOT_CONFIRM}${suggestion.id}/`, {});
      onSuggestionUpdate(response.data.suggestion);
      successNotification('Copilot suggestion applied');
    } catch (error: unknown) {
      errorNotification(extractErrorMessage(error, 'Failed to confirm suggestion'));
    } finally {
      setConfirming(false);
    }
  };

  const handleReject = async () => {
    setRejecting(true);
    try {
      const response = await http.post(`${APIS.COPILOT_REJECT}${suggestion.id}/`, {});
      onSuggestionUpdate(response.data.suggestion);
    } catch (error: unknown) {
      errorNotification(extractErrorMessage(error, 'Failed to reject suggestion'));
    } finally {
      setRejecting(false);
    }
  };

  const applyDraft = async (kind: 'reply' | 'note') => {
    if (!activeTicket) return;

    const draftPayload = suggestion.payload as DraftPayload;
    setApplyingDraft(true);
    try {
      stageDraft({
        ticketId: activeTicket.id,
        kind,
        content: getDraftContentValue(draftPayload.content),
        subject: typeof draftPayload.subject === 'string' ? draftPayload.subject : undefined,
        sourceSuggestionId: suggestion.id,
      });
      successNotification(kind === 'reply' ? 'Reply draft sent to activity stream' : 'Note draft sent to activity stream');
    } finally {
      setApplyingDraft(false);
    }
  };

  const renderBody = () => {
    if (suggestion.status === 'failed') {
      return (
        <div className="mt-3 rounded-[12px] border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3.5 py-3">
          <p className="text-[13px] font-semibold text-[var(--status-warning-text)]">{failureCopy.title}</p>
          <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">{failureCopy.message}</p>
        </div>
      );
    }

    if (suggestion.status === 'queued') {
      const queuedPayload = suggestion.payload as Record<string, unknown>;
      const queuedMessage =
        typeof queuedPayload.message === 'string'
          ? queuedPayload.message
          : 'Ticket context is being gathered and processed.';
      return (
        <div className="mt-3 rounded-[14px] border border-[hsl(var(--primary-600-hsl)_/_0.18)] bg-[var(--card-bg)] px-3.5 py-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--primary-600-hsl))] text-white">
              <Loader2 size={15} className="animate-spin" />
            </div>
            <div>
              <p className="text-[13px] font-semibold text-[var(--text-primary)]">Copilot is preparing a response</p>
              <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
                {queuedMessage}
              </p>
            </div>
          </div>
        </div>
      );
    }

    if (suggestion.command === 'summarize') {
      const payload = suggestion.payload as SummaryPayload;
      return (
        <div className="mt-3 space-y-3">
          <ResultSection title="Summary">
            <p className="mt-1 text-[13px] leading-6 text-[var(--text-primary)]">{String(payload.summary || '')}</p>
          </ResultSection>

          {Array.isArray(payload.key_facts) && payload.key_facts.length > 0 && (
            <ResultSection title="Key Facts">
              <ul className="space-y-1.5 pl-4 text-[13px] leading-6 text-[var(--text-primary)]">
                {payload.key_facts.slice(0, 4).map((item, index) => (
                  <li key={index} className="list-disc marker:text-[hsl(var(--primary-600-hsl))]">
                    {item}
                  </li>
                ))}
              </ul>
            </ResultSection>
          )}

          {payload.thread_recap && (
            <ResultSection title="Thread Recap">
              <p className="text-[13px] leading-6 text-[var(--text-secondary)]">{payload.thread_recap}</p>
            </ResultSection>
          )}

          {renderSourceChips(sources)}
        </div>
      );
    }

    if (suggestion.command === 'draft-reply' || suggestion.command === 'draft-note') {
      const payload = suggestion.payload as DraftPayload;
      return (
        <div className="mt-3 space-y-3">
          {payload.subject && (
            <ResultSection title="Subject">
              <p className="text-[14px] font-semibold break-words text-[var(--text-primary)] [overflow-wrap:anywhere]">
                {payload.subject}
              </p>
            </ResultSection>
          )}

          <ResultSection title="Draft">
            {draftContentHTML ? (
              <div
                className="prose prose-sm max-w-none break-words text-[var(--text-primary)] [overflow-wrap:anywhere] [&_p]:my-0 [&_ul]:my-0 [&_ol]:my-0 [&_li]:my-1"
                dangerouslySetInnerHTML={{ __html: sanitizeHTML(draftContentHTML) }}
              />
            ) : (
              <EmptyResultMessage message="Copilot did not return draft text for this request." />
            )}
          </ResultSection>

          {renderSourceChips(sources)}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void applyDraft(suggestion.command === 'draft-reply' ? 'reply' : 'note')}
              disabled={applyingDraft}
              className="inline-flex items-center gap-2 rounded-[10px] border border-[hsl(var(--primary-600-hsl))] bg-[hsl(var(--primary-600-hsl))] px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[hsl(var(--primary-700-hsl))] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {applyingDraft ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              Apply to activity stream
            </button>
          </div>
        </div>
      );
    }

    if (suggestion.command === 'similar') {
      const payload = suggestion.payload as { items?: SimilarItem[] };
      const items = payload.items || [];
      return (
        <div className="mt-3 space-y-3">
          <ResultSection title="Related Tickets">
            {items.length > 0 ? (
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={String(item.id)} className="flex items-start gap-2 text-[13px]">
                    <ArrowUpRight size={15} className="mt-0.5 shrink-0 text-[hsl(var(--primary-600-hsl))]" />
                    <div className="min-w-0">
                      <p className="font-semibold break-words text-[var(--text-primary)] [overflow-wrap:anywhere]">
                        #{String(item.ticket_id)} - {String(item.title)}
                      </p>
                      <p className="mt-1 break-words text-[12px] text-[var(--text-secondary)] [overflow-wrap:anywhere]">
                        {String(item.status)}
                        {item.reason ? ` - ${String(item.reason)}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyResultMessage message="No similar resolved tickets matched this ticket yet." />
            )}
          </ResultSection>
          {renderSourceChips(sources)}
        </div>
      );
    }

    if (suggestion.command === 'suggest-kb') {
      const payload = suggestion.payload as SuggestKBPayload;
      const items = payload.items || [];
      return (
        <div className="mt-3 space-y-3">
          <ResultSection title="Knowledge Suggestions">
            {items.length > 0 ? (
              <div className="space-y-3">
                {items.map((item: KBSuggestionItem) => (
                  <div key={String(item.article_id)} className="flex items-start gap-2">
                    <ArrowUpRight size={15} className="mt-0.5 shrink-0 text-[hsl(var(--primary-600-hsl))]" />
                    <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-semibold break-words text-[var(--text-primary)] [overflow-wrap:anywhere]">{String(item.title)}</p>
                        <p className="mt-1 text-[12px] leading-5 break-words text-[var(--text-secondary)] [overflow-wrap:anywhere]">{String(item.excerpt || '')}</p>
                      </div>
                      <span className="text-[11px] font-medium text-[hsl(var(--primary-600-hsl))]">
                        {Math.round(Number(item.score || 0) * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyResultMessage message="No knowledge articles matched this ticket yet." />
            )}
          </ResultSection>
          {renderSourceChips(sources)}
        </div>
      );
    }

    if (suggestion.command === 'triage') {
      const payload = suggestion.payload as TriagePayload;
      const updateEntries = buildUpdateEntries(payload.suggested_updates);
      const recommendedActions = payload.recommended_actions || [];

      return (
        <div className="mt-3 space-y-3">
          <div className="rounded-[12px] border border-[hsl(var(--primary-600-hsl))] bg-[hsl(var(--primary-600-hsl))] px-3 py-3 text-white shadow-[0_12px_24px_rgba(7,95,51,0.14)]">
            <ResultSectionTitle title="Next Step" />
            <p className="mt-1 text-[14px] font-semibold text-white">{String(payload.next_step || '')}</p>
            <p className="mt-1 text-[12px] leading-5 text-white/80">{String(payload.summary || '')}</p>
          </div>

          {isLowEvidenceAction && (
            <div className="flex items-start gap-2 text-[12px]">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-[var(--status-warning-text)]" />
              <div>
                <p className="font-semibold text-[var(--status-warning-text)]">Low evidence suggestion</p>
                <p className="mt-1 leading-5 text-[var(--text-secondary)]">
                  Confirm is disabled until the suggestion is regenerated with stronger evidence.
                </p>
              </div>
            </div>
          )}

          {Array.isArray(payload.missing_info) && payload.missing_info.length > 0 && (
            <ResultSection title="Missing Info">
              <div className="space-y-2">
                {payload.missing_info.map((item, index) => (
                  <div key={index} className="flex items-start gap-2 text-[12px] leading-5">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0 text-[var(--status-warning-text)]" />
                    <p className="text-[var(--status-warning-text)]">{item}</p>
                  </div>
                ))}
              </div>
            </ResultSection>
          )}

          {updateEntries.length > 0 && (
            <ResultSection title="Suggested Updates">
              <div className="space-y-2 pl-4">
                {updateEntries.map((entry) => (
                  <div key={entry.key} className="flex items-start gap-2 text-[12px]">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[hsl(var(--primary-600-hsl))]" />
                    <p className="break-words text-[var(--text-primary)] [overflow-wrap:anywhere]">
                      <span className="font-semibold text-[var(--text-primary)]">{entry.key}:</span> {entry.value}
                    </p>
                  </div>
                ))}
              </div>
            </ResultSection>
          )}

          {recommendedActions.length > 0 && (
            <ResultSection title="Recommended Actions">
              <div className="space-y-2">
                {recommendedActions.map((action, index) => renderRecommendedAction(action, index))}
              </div>
            </ResultSection>
          )}

          {Array.isArray(payload.rationale) && payload.rationale.length > 0 && (
            <ResultSection title="Why This">
              <ul className="space-y-2 text-[12px] text-[var(--text-secondary)]">
                {payload.rationale.map((item, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Lightbulb size={14} className="mt-0.5 shrink-0 text-[hsl(var(--primary-600-hsl))]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </ResultSection>
          )}

          {renderSourceChips(sources)}

          {suggestion.status === 'pending_review' && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void handleConfirm()}
                disabled={confirming || rejecting || isLowEvidenceAction}
                className="inline-flex items-center gap-2 rounded-[10px] border border-[hsl(var(--primary-600-hsl))] bg-[hsl(var(--primary-600-hsl))] px-3 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-[hsl(var(--primary-700-hsl))] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {confirming ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                Confirm updates
              </button>
              <button
                type="button"
                onClick={() => void handleReject()}
                disabled={confirming || rejecting}
                className="inline-flex items-center gap-2 rounded-[10px] border border-[var(--border-color)] px-3 py-2 text-[12px] font-semibold text-[var(--text-secondary)] transition-colors hover:border-[hsl(var(--primary-600-hsl)_/_0.18)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {rejecting ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
                Reject
              </button>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <article className="rounded-[18px] border border-[hsl(var(--primary-600-hsl)_/_0.22)] bg-[var(--shell-field-bg)] p-4 shadow-[0_14px_28px_rgba(7,95,51,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold capitalize break-words text-[var(--text-primary)]">
            {suggestion.command === 'suggest-kb' ? 'Knowledge suggestions' : suggestion.command.replace('-', ' ')}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
            <span className="text-[var(--text-secondary)]">{suggestion.suggestion_type.replace('_', ' ')}</span>
            {displayConfidence && (
              <>
                <span className={`whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${confidenceClasses[confidenceLabel]}`}>
                  {confidenceLabel} confidence
                </span>
                {suggestion.confidence_score != null && (
                  <span className="text-[var(--text-secondary)]">{Math.round(suggestion.confidence_score * 100)}%</span>
                )}
              </>
            )}
            <span className="inline-flex items-center gap-1 whitespace-nowrap font-semibold text-[hsl(var(--primary-600-hsl))]">
              <span className="flex h-4 w-4 items-center justify-center rounded-full border border-[hsl(var(--primary-600-hsl)_/_0.24)]">
                <Info size={10} />
              </span>
              {suggestion.status.replace('_', ' ')}
            </span>
          </div>
        </div>
        {sources.length > 0 && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--surface-subtle)] text-[hsl(var(--primary-600-hsl))] shadow-[0_4px_10px_rgba(7,95,51,0.08)]" title="Grounded suggestion">
            <Sparkles size={14} />
          </span>
        )}
      </div>

      {renderBody()}
    </article>
  );
};
