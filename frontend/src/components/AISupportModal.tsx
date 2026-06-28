import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Search, Sparkles, Wand2, X } from 'lucide-react';

import http from '../services/http';
import { APIS } from '../services/apis';
import { useCopilotStore } from '../stores/copilotStore';
import { errorNotification } from './ui/Toast';
import { COPILOT_COMMANDS, extractCommandArgument, resolveNaturalLanguageCommand } from './copilot/commandConfig';
import { CopilotResultCard } from './copilot/CopilotResultCard';
import type { CopilotCommand, CopilotSuggestion } from '../types/copilot';

interface AISupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const formatCommandLabel = (command: CopilotCommand) => `/${command}`;
const COPILOT_RAIL_WIDTH_KEY = 'safaridesk:copilot-rail-width';
const DEFAULT_RAIL_WIDTH = 460;
const MIN_RAIL_WIDTH = 400;
const MAX_RAIL_WIDTH = 640;

const clampRailWidth = (width: number) => {
  if (typeof window === 'undefined') {
    return Math.min(MAX_RAIL_WIDTH, Math.max(MIN_RAIL_WIDTH, width));
  }
  const viewportLimit = Math.floor(window.innerWidth * 0.45);
  const maxWidth = Math.min(MAX_RAIL_WIDTH, Math.max(MIN_RAIL_WIDTH, viewportLimit));
  return Math.min(maxWidth, Math.max(MIN_RAIL_WIDTH, width));
};

const COMMAND_BUTTON_CLASS =
  'inline-flex items-center gap-2 rounded-full border border-[hsl(var(--primary-600-hsl)_/_0.22)] bg-[var(--card-bg)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-primary)] transition-all hover:-translate-y-[1px] hover:border-[hsl(var(--primary-600-hsl))] hover:bg-[var(--surface-subtle)] hover:text-[hsl(var(--primary-600-hsl))] disabled:cursor-not-allowed disabled:opacity-50';

const mergeSuggestion = (items: CopilotSuggestion[], nextSuggestion: CopilotSuggestion) => [
  nextSuggestion,
  ...items.filter((item) => item.id !== nextSuggestion.id),
];

const AISupportModal: React.FC<AISupportModalProps> = ({ isOpen, onClose }) => {
  const { activeTicket } = useCopilotStore();
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<CopilotSuggestion[]>([]);
  const [runningCommand, setRunningCommand] = useState<CopilotCommand | null>(null);
  const [railWidth, setRailWidth] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_RAIL_WIDTH;
    const stored = window.localStorage.getItem(COPILOT_RAIL_WIDTH_KEY);
    const parsed = stored ? Number(stored) : DEFAULT_RAIL_WIDTH;
    return clampRailWidth(Number.isFinite(parsed) ? parsed : DEFAULT_RAIL_WIDTH);
  });
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{ x: number; width: number } | null>(null);

  const resolvedCommand = useMemo<CopilotCommand>(() => resolveNaturalLanguageCommand(input), [input]);
  const commandArgument = useMemo(() => extractCommandArgument(input, resolvedCommand), [input, resolvedCommand]);
  const slashFilter = input.startsWith('/') ? input.slice(1).toLowerCase() : '';
  const slashMatches = input.startsWith('/')
    ? COPILOT_COMMANDS.filter((item) => item.command.includes(slashFilter) || item.label.toLowerCase().includes(slashFilter))
    : [];

  const proactiveCards = useMemo(() => {
    if (!activeTicket) return [];
    const cards: Array<{ id: string; title: string; body: string }> = [];
    if (activeTicket.breached) {
      cards.push({
        id: 'sla-risk',
        title: 'SLA risk',
        body: 'This ticket is already breached. Run /triage or draft a reply before taking action.',
      });
    }
    if (!activeTicket.creatorEmail) {
      cards.push({
        id: 'missing-email',
        title: 'Missing contact info',
        body: 'Requester email is missing. Use /triage to see which details should be requested next.',
      });
    }
    if (!activeTicket.categoryName) {
      cards.push({
        id: 'missing-category',
        title: 'Needs classification',
        body: 'This ticket has no category yet. /triage can suggest category, status, and priority.',
      });
    }
    if (activeTicket.hasNewReply) {
      cards.push({
        id: 'new-reply',
        title: 'New customer reply',
        body: 'There is unread customer activity. /summarize or /draft-reply is likely the fastest next step.',
      });
    }
    return cards.slice(0, 3);
  }, [activeTicket]);

  useEffect(() => {
    setSuggestions([]);
    setInput('');
    setRunningCommand(null);
  }, [activeTicket?.id]);

  useEffect(() => {
    if (!activeTicket) return undefined;

    const handleTicketEvent = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        ticket_id?: number;
        copilot_suggestion?: CopilotSuggestion;
      };
      if (detail?.ticket_id !== activeTicket.id || !detail.copilot_suggestion) {
        return;
      }
      setSuggestions((prev) => {
        const alreadyTracked = prev.some((item) => item.id === detail.copilot_suggestion.id);
        if (detail.copilot_suggestion.surface !== 'rail' && !alreadyTracked) {
          return prev;
        }
        return mergeSuggestion(prev, detail.copilot_suggestion);
      });
    };

    window.addEventListener('ticket_event', handleTicketEvent);
    return () => window.removeEventListener('ticket_event', handleTicketEvent);
  }, [activeTicket]);

  useEffect(() => {
    const handleResize = () => {
      setRailWidth((current) => clampRailWidth(current));
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(COPILOT_RAIL_WIDTH_KEY, String(railWidth));
  }, [railWidth]);

  useEffect(() => {
    if (!isResizing) return undefined;

    const handlePointerMove = (event: PointerEvent) => {
      if (!resizeStartRef.current) return;
      const delta = resizeStartRef.current.x - event.clientX;
      setRailWidth(clampRailWidth(resizeStartRef.current.width + delta));
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      resizeStartRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isResizing]);

  const runCommand = async (command: CopilotCommand, query = '') => {
    if (!activeTicket) return;
    setSubmitting(true);
    setRunningCommand(command);
    try {
      const response = await http.post(APIS.COPILOT_INVOKE, {
        ticket_id: activeTicket.id,
        command,
        query,
        surface: 'rail',
      });
      const nextSuggestion = response.data.suggestion as CopilotSuggestion;
      setSuggestions((prev) => mergeSuggestion(prev, nextSuggestion));
      setInput('');
    } catch (error: any) {
      errorNotification(error?.response?.data?.message || 'Copilot request failed');
    } finally {
      setSubmitting(false);
      setRunningCommand(null);
    }
  };

  const handleSubmit = async () => {
    if (!activeTicket || submitting || !input.trim()) return;
    await runCommand(resolvedCommand, commandArgument);
  };

  const handleSuggestionUpdate = (updated: CopilotSuggestion) => {
    setSuggestions((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
  };

  const handleResizeStart = (event: React.PointerEvent<HTMLButtonElement>) => {
    resizeStartRef.current = { x: event.clientX, width: railWidth };
    setIsResizing(true);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  if (!isOpen) return null;

  return (
    <aside
      className="relative hidden h-full flex-col border-l border-[var(--border-color)] bg-[var(--card-bg)] shadow-[-10px_0_26px_rgba(16,24,40,0.06)] lg:flex"
      style={{ width: `${railWidth}px`, minWidth: `${MIN_RAIL_WIDTH}px`, maxWidth: `min(${MAX_RAIL_WIDTH}px, 45vw)` }}
    >
      <button
        type="button"
        aria-label="Resize Ask AI panel"
        onPointerDown={handleResizeStart}
        className={`absolute left-0 top-0 z-20 h-full w-3 -translate-x-1/2 cursor-col-resize transition-colors ${
          isResizing ? 'bg-[hsl(var(--primary-600-hsl)_/_0.14)]' : 'hover:bg-[hsl(var(--primary-600-hsl)_/_0.08)]'
        }`}
      >
        <span className="absolute left-1/2 top-1/2 h-16 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[hsl(var(--primary-600-hsl)_/_0.4)]" />
      </button>
      <div className="flex h-full flex-col">
        <div className="border-b border-[var(--border-color)] bg-[var(--card-bg)] px-5 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[hsl(var(--primary-600-hsl))] text-white">
                <Sparkles size={16} />
              </div>
              <div>
                <h2 className="text-[length:var(--font-section-title)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-title)' }}>
                  Ask AI
                </h2>
                <p className="text-[length:var(--font-meta)] text-[var(--text-secondary)]">
                  {activeTicket ? `Ticket #${activeTicket.ticketId}` : 'Ticket copilot'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-[var(--shell-radius)] p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[hsl(var(--primary-600-hsl)_/_0.08)] hover:text-[hsl(var(--primary-600-hsl))]"
              aria-label="Close Ask AI panel"
            >
              <X size={16} />
            </button>
          </div>

          {activeTicket && (
            <div className="mt-3 rounded-[16px] border border-[hsl(var(--primary-600-hsl)_/_0.22)] bg-[var(--card-bg)] px-4 py-3.5 shadow-[0_10px_24px_rgba(7,95,51,0.08)]">
              <p className="text-[13px] font-semibold break-words text-[var(--text-primary)]">{activeTicket.title}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                <span className="rounded-full border border-[hsl(var(--primary-600-hsl)_/_0.22)] bg-[var(--shell-field-bg)] px-2.5 py-1 text-[hsl(var(--primary-600-hsl))]">
                  {activeTicket.status}
                </span>
                <span className="rounded-full border border-[hsl(var(--primary-600-hsl)_/_0.22)] bg-[var(--shell-field-bg)] px-2.5 py-1 text-[hsl(var(--primary-600-hsl))]">
                  {activeTicket.priority}
                </span>
                {activeTicket.categoryName && (
                  <span className="rounded-full border border-[hsl(var(--primary-600-hsl)_/_0.22)] bg-[var(--shell-field-bg)] px-2.5 py-1 text-[hsl(var(--primary-600-hsl))]">
                    {activeTicket.categoryName}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {!activeTicket ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-[20px] bg-[hsl(var(--primary-600-hsl))] text-white shadow-[0_12px_28px_rgba(7,95,51,0.18)]">
              <Wand2 size={28} />
            </div>
            <h3 className="mt-4 text-[length:var(--font-section-title)] text-[var(--text-primary)]" style={{ fontWeight: 'var(--font-weight-title)' }}>
              Open a ticket to use SafariDesk AI
            </h3>
            <p className="mt-2 max-w-[280px] text-[length:var(--font-body)] leading-6 text-[var(--text-secondary)]">
              The docked rail is ticket-aware in V1. Select a ticket, then run commands like `/summarize` or `/triage`.
            </p>
          </div>
        ) : (
          <>
            <div className="border-b border-[var(--border-color)] px-5 py-4">
              <div className="flex flex-wrap gap-2">
                {COPILOT_COMMANDS.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.command}
                      type="button"
                      onClick={() => void runCommand(item.command)}
                      disabled={submitting}
                      className={COMMAND_BUTTON_CLASS}
                    >
                      {submitting && runningCommand === item.command ? <Loader2 size={13} className="animate-spin" /> : <Icon size={13} />}
                      {item.label}
                    </button>
                  );
                })}
              </div>

              {proactiveCards.length > 0 && (
                <div className="mt-4 space-y-2.5">
                  {proactiveCards.map((card) => (
                    <div key={card.id} className="rounded-[14px] border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] px-3.5 py-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle size={15} className="mt-0.5 text-[var(--status-warning-text)]" />
                        <div>
                          <p className="text-[12px] font-semibold text-[var(--status-warning-text)]">{card.title}</p>
                          <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">{card.body}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <div className="space-y-4">
                {submitting && (
                  <div className="rounded-[16px] border border-[hsl(var(--primary-600-hsl)_/_0.22)] bg-[var(--card-bg)] px-4 py-3.5 shadow-[0_10px_24px_rgba(7,95,51,0.08)]">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[hsl(var(--primary-600-hsl))] text-white">
                        <Loader2 size={15} className="animate-spin" />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-[var(--text-primary)]">
                          Running {runningCommand ? formatCommandLabel(runningCommand) : 'copilot command'}
                        </p>
                        <p className="mt-1 text-[12px] leading-5 text-[var(--text-secondary)]">
                          SafariDesk AI is gathering ticket context and preparing a response.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {suggestions.length > 0 && (
                  suggestions.map((suggestion) => (
                    <CopilotResultCard
                      key={suggestion.id}
                      suggestion={suggestion}
                      onSuggestionUpdate={handleSuggestionUpdate}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="border-t border-[var(--border-color)] px-5 py-4">
              <div className="rounded-[20px] border border-[hsl(var(--primary-600-hsl)_/_0.22)] bg-[var(--card-bg)] p-3.5 shadow-[0_12px_28px_rgba(7,95,51,0.08)]">
                <div className="flex items-center gap-2">
                  <Search size={14} className="text-[var(--text-secondary)]" />
                  <input
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    disabled={submitting}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        void handleSubmit();
                      }
                    }}
                    placeholder="Try /summarize or ask in plain language"
                    className="w-full bg-transparent text-[13px] text-[var(--text-primary)] outline-none placeholder:text-[var(--text-secondary)] disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={submitting || !input.trim()}
                    className="inline-flex h-8 items-center justify-center rounded-[10px] border border-[hsl(var(--primary-600-hsl))] bg-[hsl(var(--primary-600-hsl))] px-3 text-[12px] font-semibold text-white transition-colors hover:bg-[hsl(var(--primary-700-hsl))] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? <Loader2 size={14} className="animate-spin" /> : 'Run'}
                  </button>
                </div>

                {input.trim() && (
                  <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-[var(--text-secondary)]">
                    <span className="rounded-full border border-[hsl(var(--primary-600-hsl)_/_0.22)] bg-[var(--card-bg)] px-2 py-0.5 text-[hsl(var(--primary-600-hsl))]">
                      Will run {formatCommandLabel(resolvedCommand)}
                    </span>
                    {!!commandArgument && <span className="truncate break-words pl-3">{commandArgument}</span>}
                  </div>
                )}

                {slashMatches.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {slashMatches.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.command}
                          type="button"
                          onClick={() => setInput(`${item.slashLabel} `)}
                          className="flex w-full items-start gap-3 rounded-[12px] border border-[hsl(var(--primary-600-hsl)_/_0.22)] bg-[var(--card-bg)] px-3 py-2 text-left transition-all hover:-translate-y-[1px] hover:border-[hsl(var(--primary-600-hsl))] hover:bg-[var(--surface-subtle)]"
                        >
                          <Icon size={14} className="mt-0.5 text-[hsl(var(--primary-600-hsl))]" />
                          <div>
                            <p className="text-[12px] font-semibold text-[var(--text-primary)]">{item.slashLabel}</p>
                            <p className="mt-0.5 text-[12px] leading-5 text-[var(--text-secondary)]">{item.description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </aside>
  );
};

export default AISupportModal;
