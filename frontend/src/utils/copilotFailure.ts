import type { CopilotCommand, CopilotFailurePayload, CopilotSuggestion } from '../types/copilot';

const DEFAULT_FAILURE_COPY: Record<CopilotCommand, { title: string; message: string }> = {
  summarize: {
    title: 'Summary unavailable',
    message: 'Copilot could not summarize this ticket right now. Try again.',
  },
  'draft-reply': {
    title: 'Reply draft unavailable',
    message: 'Copilot could not draft a reply right now. Try again.',
  },
  'draft-note': {
    title: 'Note draft unavailable',
    message: 'Copilot could not draft a note right now. Try again.',
  },
  'draft-call-log': {
    title: 'Call log draft unavailable',
    message: 'Copilot could not draft a call log right now. Try again.',
  },
  similar: {
    title: 'Similar tickets unavailable',
    message: 'Copilot could not find similar tickets right now. Try again.',
  },
  'suggest-kb': {
    title: 'Knowledge suggestions unavailable',
    message: 'Copilot could not find knowledge suggestions right now. Try again.',
  },
  triage: {
    title: 'Triage recommendation unavailable',
    message: 'Copilot could not prepare a triage recommendation right now. Try again.',
  },
};

export const getCopilotFailureCopy = (suggestion: Pick<CopilotSuggestion, 'command' | 'payload' | 'metadata'>) => {
  const payload = suggestion.payload as CopilotFailurePayload;
  const metadata = suggestion.metadata as Record<string, unknown>;
  const base = DEFAULT_FAILURE_COPY[suggestion.command];

  if (payload.error_type === 'blocked_response' || metadata.error_type === 'blocked_response') {
    return {
      title: 'Request needs a safer prompt',
      message: 'Copilot could not safely complete that request. Try narrowing or rephrasing it.',
    };
  }

  const payloadTitle = typeof payload.title === 'string' ? payload.title.trim() : '';
  const payloadMessage =
    typeof payload.message === 'string'
      ? payload.message.trim()
      : typeof payload.error === 'string'
        ? payload.error.trim()
        : '';
  return {
    title: payloadTitle || base.title,
    message: payloadMessage || base.message,
  };
};
