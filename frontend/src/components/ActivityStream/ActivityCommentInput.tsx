import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Paperclip, ChevronDown, Mail, MessageSquare, AlertCircle, Sparkles, Loader2, Lock } from 'lucide-react';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
import { SimpleRichEditor, MentionUser } from '../editor/SimpleRichEditor';
import { ActivityAuthor } from './ActivityStream';
import { EmailRecipientInput } from './EmailRecipientInput';
import http from '../../services/http';
import { APIS } from '../../services/apis';
import { useCopilotStore } from '../../stores/copilotStore';
import type { CopilotSuggestion } from '../../types/copilot';
import { getCopilotFailureCopy } from '../../utils/copilotFailure';

interface User {
  id: number;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email: string;
  avatar_url?: string;
  role?: string;
}

interface TicketInfo {
  id: number;
  title?: string;
  creator_email: string;
  creator_name: string;
  source: 'email' | 'portal' | 'customer_portal' | 'api' | 'phone' | 'chat' | 'web';
}

interface ActivityCommentInputProps {
  currentUser: ActivityAuthor;
  onSubmit: (content: string, isInternal: boolean, attachments?: File[]) => Promise<void>;
  onSendEmail?: (data: {
    to: string[];
    cc?: string[];
    bcc?: string[];
    subject?: string;
    content: string;
    closeTicket?: boolean;
    attachments?: File[];
  }) => Promise<void>;
  onMarkStatus?: (status: 'pending' | 'resolved') => Promise<void>;
  ticket?: TicketInfo;
  loading?: boolean;
  isPublic?: boolean;
  customerMode?: boolean;
  defaultMode?: 'comment' | 'email';
  defaultIsInternal?: boolean;
  forceInternalOnly?: boolean;
  submitButtonText?: string;
  placeholderText?: string;
}

const EMPTY_EMAIL_BODY_HTML = '<p><br></p><p><br></p>';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildEmailSignatureHtml = (signature: { greeting: string; name: string } | null): string => {
  if (!signature) {
    return '';
  }

  const parts = [`<p>${escapeHtml(signature.greeting)}</p>`];
  if (signature.name.trim()) {
    parts.push(`<p><strong>${escapeHtml(signature.name.trim())}</strong></p>`);
  }

  return parts.join('');
};

const buildEmailDraftHtml = (bodyHtml: string, signatureHtml: string): string => {
  const normalizedBody = bodyHtml.trim() || EMPTY_EMAIL_BODY_HTML;
  if (!signatureHtml) {
    return normalizedBody;
  }
  return `${normalizedBody}${signatureHtml}`;
};

const stripAutoEmailSignature = (content: string, signatureHtml: string): string => {
  const normalizedContent = (content || '').trim();
  const normalizedSignature = (signatureHtml || '').trim();

  if (!normalizedContent || !normalizedSignature) {
    return isEmptyEditorHtml(normalizedContent) ? '' : normalizedContent;
  }

  if (normalizedContent.endsWith(normalizedSignature)) {
    const stripped = normalizedContent.slice(0, -normalizedSignature.length).trim();
    return isEmptyEditorHtml(stripped) ? '' : stripped;
  }

  return isEmptyEditorHtml(normalizedContent) ? '' : normalizedContent;
};

const isEmptyEditorHtml = (value: string): boolean => {
  const normalized = (value || '').trim();
  if (!normalized) {
    return true;
  }

  return /^(?:<p>(?:\s|&nbsp;|<br\s*\/?>)*<\/p>\s*)+$/i.test(normalized);
};

export const ActivityCommentInput: React.FC<ActivityCommentInputProps> = ({
  currentUser,
  onSubmit,
  onSendEmail,
  onMarkStatus,
  ticket,
  loading = false,
  isPublic: _isPublic = false,
  customerMode = false,
  defaultMode = 'email',
  defaultIsInternal = false,
  forceInternalOnly = false,
  submitButtonText,
  placeholderText,
}) => {
  const allowEmailMode = Boolean(onSendEmail) && !customerMode;
  const [mode, setMode] = useState<'comment' | 'email'>(defaultMode);
  const isEmailMode = allowEmailMode && mode === 'email';
  const messageLabel = submitButtonText || (customerMode ? 'Message' : 'Comment');
  const messagePlaceholder = placeholderText || (customerMode ? 'Write your message...' : 'Add a comment...');

  const [content, setContent] = useState('');
  const [isInternal, setIsInternal] = useState(defaultIsInternal);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [fileSizeError, setFileSizeError] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Email mode state
  const [toEmails, setToEmails] = useState<string[]>([]);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [bccEmails, setBccEmails] = useState<string[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [showSendDropdown, setShowSendDropdown] = useState(false);
  const [showNoteTypeDropdown, setShowNoteTypeDropdown] = useState(false);
  const effectiveIsInternal = forceInternalOnly || isInternal;

  // Subject field (email mode)
  const [emailSubject, setEmailSubject] = useState('');

  // Email signature fetched from settings
  const [signature, setSignature] = useState<{ greeting: string; name: string } | null>(null);
  const [signatureLoaded, setSignatureLoaded] = useState(false);

  // AI compose bar
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [pendingSuggestionId, setPendingSuggestionId] = useState<number | null>(null);
  const [pendingSuggestionKind, setPendingSuggestionKind] = useState<'reply' | 'note' | null>(null);

  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const pendingDraft = useCopilotStore((state) => state.pendingDraft);
  const clearPendingDraft = useCopilotStore((state) => state.clearPendingDraft);

  const emailSignatureHtml = useMemo(
    () => buildEmailSignatureHtml(signature),
    [signature]
  );

  const switchToEmailMode = useCallback(() => {
    if (!allowEmailMode) return;
    setMode('email');
    setIsInternal(false);
    setContent((currentContent) => (
      isEmptyEditorHtml(currentContent)
        ? buildEmailDraftHtml('', emailSignatureHtml)
        : currentContent
    ));
  }, [allowEmailMode, emailSignatureHtml]);

  const switchToCommentMode = useCallback(() => {
    setMode('comment');
    setContent((currentContent) => stripAutoEmailSignature(currentContent, emailSignatureHtml));
  }, [emailSignatureHtml]);

  useEffect(() => {
    if (allowEmailMode) {
      return;
    }

    setMode('comment');
    setIsInternal(forceInternalOnly || defaultIsInternal);
    setToEmails([]);
    setCcEmails([]);
    setBccEmails([]);
    setShowCc(false);
    setShowBcc(false);
    setEmailSubject('');
    setContent((currentContent) => stripAutoEmailSignature(currentContent, emailSignatureHtml));
  }, [allowEmailMode, defaultIsInternal, emailSignatureHtml, forceInternalOnly]);

  useEffect(() => {
    if (!forceInternalOnly) {
      return;
    }
    setMode('comment');
    setIsInternal(true);
    setShowNoteTypeDropdown(false);
  }, [forceInternalOnly]);

  // Initialize email mode with ticket data
  useEffect(() => {
    if (!isEmailMode || !ticket) {
      return;
    }

    if (toEmails.length === 0) {
      setToEmails([ticket.creator_email]);
    }

    if (!emailSubject && ticket.title) {
      setEmailSubject(`Re: ${ticket.title}`);
    }

    if (!signatureLoaded) {
      return;
    }

    if (isEmptyEditorHtml(content)) {
      setContent(buildEmailDraftHtml('', emailSignatureHtml));
    }
  }, [
    isEmailMode,
    ticket,
    toEmails.length,
    emailSubject,
    content,
    signatureLoaded,
    emailSignatureHtml,
  ]);

  // Fetch email signature from settings
  useEffect(() => {
    if (!allowEmailMode) {
      return;
    }
    const fetchSignature = async () => {
      try {
        const res = await http.get(APIS.EMAIL_SIGNATURE);
        setSignature({
          greeting: res.data.signature_greeting || 'Regards,',
          name: res.data.signature_name || '',
        });
      } catch {
        // silently ignore — signature is optional
      }
    };
    fetchSignature().finally(() => {
      setSignature((current) => current ?? { greeting: 'Regards,', name: '' });
      setSignatureLoaded(true);
    });
  }, [allowEmailMode]);

  // Load users for mentions
  useEffect(() => {
    if (customerMode) {
      setAvailableUsers([]);
      return;
    }
    const fetchUsers = async () => {
      try {
        const agentsResponse = await http.get(`${APIS.LIST_AGENTS}?pagination=no`);
        let users = Array.isArray(agentsResponse.data)
          ? agentsResponse.data
          : (agentsResponse.data?.data || agentsResponse.data?.results || []);
        setAvailableUsers(Array.isArray(users) ? users : []);
      } catch (error) {
        console.error('Failed to fetch users for mentions:', error);
        setAvailableUsers([]);
      }
    };
    fetchUsers();
  }, [customerMode]);

  useEffect(() => {
    if (!pendingDraft || !ticket || pendingDraft.ticketId !== ticket.id) {
      return;
    }

    if (pendingDraft.kind === 'reply' && allowEmailMode) {
      setMode('email');
      setContent(buildEmailDraftHtml(pendingDraft.content || '', emailSignatureHtml));
      if (pendingDraft.subject) {
        setEmailSubject(pendingDraft.subject);
      }
    } else {
      setMode('comment');
      setIsInternal(forceInternalOnly || (customerMode ? false : true));
      setContent(pendingDraft.content || '');
    }

    clearPendingDraft();
  }, [pendingDraft, ticket, emailSignatureHtml, clearPendingDraft, allowEmailMode, customerMode, forceInternalOnly]);

  useEffect(() => {
    setPendingSuggestionId(null);
    setPendingSuggestionKind(null);
    setAiLoading(false);
  }, [ticket?.id]);

  useEffect(() => {
    if (!ticket || !pendingSuggestionId) {
      return undefined;
    }

    const handleTicketEvent = (event: Event) => {
      const detail = (event as CustomEvent).detail as {
        ticket_id?: number;
        copilot_suggestion?: CopilotSuggestion;
      };
      const suggestion = detail?.copilot_suggestion;

      if (!suggestion || detail.ticket_id !== ticket.id || suggestion.id !== pendingSuggestionId) {
        return;
      }

      if (suggestion.status === 'failed') {
        setAiError(getCopilotFailureCopy(suggestion).message);
        setAiLoading(false);
        setPendingSuggestionId(null);
        setPendingSuggestionKind(null);
        return;
      }

      if (suggestion.status !== 'pending_review') {
        return;
      }

      const payload = suggestion.payload || {};
      if (pendingSuggestionKind === 'reply' && allowEmailMode) {
        setContent(buildEmailDraftHtml(String(payload.content || ''), emailSignatureHtml));
        if (typeof payload.subject === 'string' && payload.subject.trim()) {
          setEmailSubject(payload.subject.trim());
        }
      } else {
        setContent(String(payload.content || ''));
      }
      setAiPrompt('');
      setAiError('');
      setAiLoading(false);
      setPendingSuggestionId(null);
      setPendingSuggestionKind(null);
    };

    window.addEventListener('ticket_event', handleTicketEvent);
    return () => window.removeEventListener('ticket_event', handleTicketEvent);
  }, [ticket, pendingSuggestionId, pendingSuggestionKind, emailSignatureHtml, allowEmailMode]);

  const getUserName = (user: User): string => {
    return user.full_name || `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email.split('@')[0] || 'User';
  };

  const mentionUsers: MentionUser[] = useMemo(
    () =>
      availableUsers.map((user) => ({
        id: user.id,
        displayName: getUserName(user),
        email: user.email,
        avatarUrl: user.avatar_url,
      })),
    [availableUsers]
  );

  const handleSubmit = async (closeTicket = false, markStatus?: 'pending' | 'resolved') => {
    if (!content.trim() && attachments.length === 0) return;

    setSubmitting(true);
    try {
      if (isEmailMode && onSendEmail) {
        await onSendEmail({
          to: toEmails,
          cc: ccEmails.length > 0 ? ccEmails : undefined,
          bcc: bccEmails.length > 0 ? bccEmails : undefined,
          subject: emailSubject || undefined,
          content,
          closeTicket,
          attachments: attachments.length > 0 ? attachments : undefined,
        });
      } else {
        await onSubmit(
          content,
          customerMode ? false : forceInternalOnly || isInternal,
          attachments.length > 0 ? attachments : undefined
        );
      }

      // Mark status after submitting if requested
      if (markStatus && onMarkStatus) {
        await onMarkStatus(markStatus);
      }

      // Reset form
      setContent('');
      setAttachments([]);
      setIsInternal(forceInternalOnly || defaultIsInternal);
      setToEmails([]);
      setCcEmails([]);
      setBccEmails([]);
      setShowCc(false);
      setShowBcc(false);
      setEmailSubject('');
      setAiPrompt('');
      setAiError('');
    } catch (error) {
      console.error('Failed to submit:', error);
    } finally {
      setSubmitting(false);
      setShowSendDropdown(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const all = Array.from(e.target.files);
      const oversized = all.filter(f => f.size > MAX_FILE_SIZE);
      if (oversized.length > 0) {
        setFileSizeError(oversized.map(f => f.name));
      }
      setAttachments(all.filter(f => f.size <= MAX_FILE_SIZE));
    }
  };

  const handleAiCompose = useCallback(async (rewriteCurrent = false) => {
    if (!ticket || (!aiPrompt.trim() && !rewriteCurrent)) return;
    setAiLoading(true);
    setAiError('');
    const requestedKind: 'reply' | 'note' = isEmailMode ? 'reply' : 'note';
    let keepLoading = false;
    try {
      const res = await http.post(APIS.COPILOT_INVOKE, {
        ticket_id: ticket.id,
        command: requestedKind === 'reply' ? 'draft-reply' : 'draft-note',
        query: aiPrompt.trim() || (rewriteCurrent ? 'Rewrite the current draft to be clearer and more concise.' : ''),
        surface: 'activity_stream',
        extra_input: rewriteCurrent ? content : '',
      });
      const suggestion = res.data.suggestion as CopilotSuggestion;
      if (suggestion.status === 'queued') {
        keepLoading = true;
        setPendingSuggestionId(suggestion.id);
        setPendingSuggestionKind(requestedKind);
        return;
      }
      if (suggestion.status === 'failed') {
        setAiError(getCopilotFailureCopy(suggestion).message);
        setPendingSuggestionId(null);
        setPendingSuggestionKind(null);
        return;
      }
      const payload = suggestion.payload || {};
      if (requestedKind === 'reply') {
        setContent(buildEmailDraftHtml(String(payload.content || ''), emailSignatureHtml));

        if ((!emailSubject.trim() || rewriteCurrent) && typeof payload.subject === 'string' && payload.subject.trim()) {
          setEmailSubject(payload.subject.trim());
        }
      } else {
        setContent(String(payload.content || ''));
      }
      setAiPrompt('');
      setPendingSuggestionId(null);
      setPendingSuggestionKind(null);
    } catch {
      setAiError('Failed to generate. Please try again.');
      setPendingSuggestionId(null);
      setPendingSuggestionKind(null);
    } finally {
      if (!keepLoading) {
        setAiLoading(false);
      }
    }
  }, [aiPrompt, ticket, isEmailMode, emailSignatureHtml, emailSubject, content]);

  const _canSendEmail = isEmailMode && toEmails.length > 0 && onSendEmail;

  return (
    <div className="relative">
      {/* Avatar */}
      <div className="absolute -left-8 top-3 transform -translate-x-1/2">
        <img
          className="size-8 rounded-full ring-2 ring-white dark:ring-gray-900"
          src={currentUser.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser.name)}&background=06A561&color=fff`}
          alt="Current user's avatar"
        />
      </div>

      {/* Input Card - Subtle background differentiation */}
      <div className={`rounded-lg shadow-sm border ${mode === 'comment' && effectiveIsInternal && !forceInternalOnly
        ? 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800/50'  // Yellow tint for private notes
        : 'bg-white dark:bg-surface-elevated border-gray-200 dark:border-subtle'    // Clean white/dark for normal
        }`}>

        {/* Mode Toggle (show if email sending is available) */}
        {ticket && allowEmailMode && (
          <div className="flex gap-2 px-4 pt-3">
            <button
              type="button"
              onClick={switchToEmailMode}
              className={`flex items-center gap-1.5 px-3 py-1 text-sm rounded-full transition-colors ${mode === 'email'
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                : 'text-gray-500 dark:text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-surface-hover'
                }`}
            >
              <Mail size={14} />
              Reply
            </button>
            <button
              type="button"
              onClick={switchToCommentMode}
              className={`flex items-center gap-1.5 px-3 py-1 text-sm rounded-full transition-colors ${mode === 'comment'
                ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400'
                : 'text-gray-500 dark:text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-surface-hover'
                }`}
            >
              <MessageSquare size={14} />
              Note
            </button>
          </div>
        )}

        {/* Email Fields (only in email mode) */}
        {isEmailMode && (
          <div className="mx-4 mt-2 mb-2 border border-[var(--border-color)] rounded-[var(--shell-radius)]">
            {/* Subject */}
            <div className="flex items-center px-3 py-2 border-b border-[var(--border-color)]">
              <span className="text-[length:var(--font-meta)] font-semibold text-[var(--text-secondary)] w-16 shrink-0">Subject:</span>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder={ticket?.title ? `Re: ${ticket.title}` : 'Subject'}
                className="flex-1 text-[length:var(--font-body)] bg-transparent text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
                disabled={submitting}
              />
            </div>

            {/* To */}
            <div className="flex items-center px-3 py-2 border-b border-[var(--border-color)]">
              <div className="flex-1">
                <EmailRecipientInput
                  label="To"
                  emails={toEmails}
                  onChange={setToEmails}
                  placeholder="recipient@example.com"
                  disabled={submitting}
                />
              </div>
              <div className="flex gap-2 text-[length:var(--font-meta)] shrink-0 ml-2">
                {!showCc && (
                  <button type="button" onClick={() => setShowCc(true)} className="text-[var(--color-primary)] hover:underline">Cc</button>
                )}
                {!showBcc && (
                  <button type="button" onClick={() => setShowBcc(true)} className="text-[var(--color-primary)] hover:underline">Bcc</button>
                )}
              </div>
            </div>

            {/* CC */}
            {showCc && (
              <div className="px-3 py-2 border-b border-[var(--border-color)]">
                <EmailRecipientInput label="Cc" emails={ccEmails} onChange={setCcEmails} disabled={submitting} />
              </div>
            )}

            {/* BCC */}
            {showBcc && (
              <div className="px-3 py-2">
                <EmailRecipientInput label="Bcc" emails={bccEmails} onChange={setBccEmails} disabled={submitting} />
              </div>
            )}
          </div>
        )}

        {/* Content Area - Rich Text Editor */}
        <div className="px-4 py-2">
          <SimpleRichEditor
            content={content}
            onChange={setContent}
            onSubmitShortcut={() => {
              if ((content.trim() || attachments.length > 0) && !submitting && !loading) {
                void handleSubmit();
              }
            }}
            placeholder={isEmailMode ? 'Write your reply...' : placeholderText || (forceInternalOnly ? 'Add an internal note...' : messagePlaceholder)}
            disabled={submitting || loading}
            onAttachmentClick={() => fileInputRef.current?.click()}
            showAttachment={true}
            mentionUsers={customerMode ? [] : mentionUsers}
          />
          <input
            type="file"
            ref={fileInputRef}
            multiple
            className="hidden"
            aria-label="Attach files"
            title="Attach files"
            onChange={handleFileChange}
            disabled={submitting || loading}
          />

        </div>

        {/* Attachments */}
        {attachments.length > 0 && (
          <div className="px-4 pb-2 flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <div key={index} className="px-2 py-1 bg-gray-100 dark:bg-surface-hover rounded text-sm text-gray-700 dark:text-[var(--text-primary)] flex items-center gap-1">
                <Paperclip size={12} />
                <span>{file.name}</span>
                <button onClick={() => setAttachments(attachments.filter((_, i) => i !== index))} className="text-gray-400 hover:text-red-500">×</button>
              </div>
            ))}
          </div>
        )}

        {/* AI Compose Bar */}
        {ticket && !customerMode && (
          <div className="px-4 py-2 border-t border-gray-100 dark:border-subtle-50">
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-surface-50 rounded-lg px-3 py-2">
              <button
                type="button"
                onClick={() => void handleAiCompose(false)}
                disabled={aiLoading || !aiPrompt.trim()}
                className="shrink-0 text-primary-500 hover:text-primary-600 disabled:opacity-40 transition-colors"
                title="Generate with AI"
              >
                {aiLoading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              </button>
              <input
                type="text"
                value={aiPrompt}
                onChange={(e) => { setAiPrompt(e.target.value); setAiError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void handleAiCompose(false); } }}
                placeholder="What do you want to write? e.g. apologize for the delay"
                className="flex-1 text-sm bg-transparent text-gray-700 dark:text-[var(--text-primary)] outline-none placeholder-gray-400 dark:placeholder-gray-500"
                disabled={aiLoading}
              />
              {content.trim() && (
                <button
                  type="button"
                  onClick={() => void handleAiCompose(true)}
                  disabled={aiLoading}
                  className="rounded-md border border-gray-200 px-2 py-1 text-[11px] font-medium text-gray-600 transition-colors hover:bg-white disabled:opacity-40 dark:border-subtle dark:text-[var(--text-secondary)] dark:hover:bg-surface-elevated"
                >
                  Rewrite
                </button>
              )}
            </div>
            {aiError && <p className="text-xs text-red-500 mt-1 px-1">{aiError}</p>}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end items-center px-4 py-3 bg-gray-50 dark:bg-surface-50 rounded-b-lg border-t border-gray-100 dark:border-subtle-50">

          {/* Right: Actions */}
          <div className="flex items-center gap-3">
            {/* Note Type Dropdown (for comment mode) */}
            {mode === 'comment' && !customerMode && forceInternalOnly && (
              <span className="flex items-center gap-1.5 rounded-md border border-[var(--border-color)] bg-[var(--card-bg)] px-3 py-1.5 text-sm font-medium text-[var(--text-secondary)]">
                <Lock size={14} />
                Internal
              </span>
            )}
            {mode === 'comment' && !customerMode && !forceInternalOnly && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowNoteTypeDropdown(!showNoteTypeDropdown)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border transition-colors ${isInternal
                    ? 'border-amber-300 bg-amber-100 text-amber-700 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-400'
                    : 'border-gray-300 bg-white text-gray-700 dark:border-subtle dark:bg-surface-hover dark:text-[var(--text-primary)]'
                    }`}
                  disabled={submitting || loading}
                >
                  {isInternal ? '🔒 Private' : '🌐 Public'}
                  <ChevronDown size={14} />
                </button>
                {showNoteTypeDropdown && (
                  <div className="absolute bottom-full mb-1 right-0 w-56 bg-white dark:bg-surface-elevated border border-gray-200 dark:border-subtle rounded-lg shadow-lg z-50">
                    <div className="px-3 py-2 text-xs text-gray-500 dark:text-[var(--text-primary)] font-medium border-b border-gray-100 dark:border-subtle">
                      Mark note as
                    </div>
                    <button
                      type="button"
                      onClick={() => { setIsInternal(false); setShowNoteTypeDropdown(false); }}
                      className={`w-full px-3 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-surface-hover-50 flex items-center justify-between ${!isInternal ? 'text-primary-600 dark:text-primary-400' : 'text-gray-700 dark:text-[var(--text-primary)]'}`}
                    >
                      <span>🌐 <strong>Public</strong> <span className="text-gray-400 text-xs ml-1">Visible to contact</span></span>
                      {!isInternal && <span>✓</span>}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setIsInternal(true); setShowNoteTypeDropdown(false); }}
                      className={`w-full px-3 py-2.5 text-left text-sm hover:bg-gray-50 dark:hover:bg-surface-hover-50 flex items-center justify-between ${isInternal ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-[var(--text-primary)]'}`}
                    >
                      <span>🔒 <strong>Private</strong> <span className="text-gray-400 text-xs ml-1">Internal only</span></span>
                      {isInternal && <span>✓</span>}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Send Button with Dropdown */}
            <div className="relative">
              <div className="flex">
                <button
                  onClick={() => handleSubmit(false)}
                  className={`flex items-center justify-center h-9 px-4 bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed ${onMarkStatus ? 'rounded-l-lg' : 'rounded-lg'}`}
                  disabled={(!content.trim() && attachments.length === 0) || (isEmailMode && toEmails.length === 0) || submitting || loading}
                >
                  {submitting ? 'Sending...' : (isEmailMode ? 'Send' : messageLabel)}
                </button>
                {/* Show dropdown arrow if onMarkStatus is provided or email mode */}
                {(onMarkStatus || isEmailMode) && (
                  <button
                    type="button"
                    onClick={() => setShowSendDropdown(!showSendDropdown)}
                    title="Send options"
                    aria-label="Send options"
                    className="flex items-center justify-center rounded-r-lg h-9 px-2 bg-primary-700 text-white hover:bg-primary-800 border-l border-primary-600"
                    disabled={submitting || loading}
                  >
                    <ChevronDown size={14} />
                  </button>
                )}
              </div>

              {/* Dropdown */}
              {showSendDropdown && (
                <div className="absolute left-0 top-full mt-1 min-w-full bg-white dark:bg-surface-elevated border border-gray-200 dark:border-subtle rounded-md shadow-lg z-50">
                  {isEmailMode && (
                    <button
                      type="button"
                      onClick={() => handleSubmit(true)}
                      className="w-full px-3 py-1.5 text-left text-sm text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-surface-hover whitespace-nowrap"
                    >
                      Send & <span className="font-semibold">Close Ticket</span>
                    </button>
                  )}
                  {onMarkStatus && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSubmit(false, 'pending')}
                        className="w-full px-3 py-1.5 text-left text-sm text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-surface-hover whitespace-nowrap"
                      >
                        {isEmailMode ? 'Send' : messageLabel} & <span className="font-semibold">Mark Pending</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSubmit(false, 'resolved')}
                        className="w-full px-3 py-1.5 text-left text-sm text-gray-700 dark:text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-surface-hover whitespace-nowrap"
                      >
                        {isEmailMode ? 'Send' : messageLabel} & <span className="font-semibold">Mark Resolved</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* File Size Error Modal */}
      {fileSizeError.length > 0 && (
        <div className="fixed inset-0 bg-black/50 dark:bg-[var(--overlay-bg)] flex items-center justify-center z-50 p-4" onClick={() => setFileSizeError([])}>
          <div className="bg-white dark:bg-surface-elevated rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-4 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-[var(--text-primary)]">File size limit exceeded</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-[var(--text-muted)]">
                  The following {fileSizeError.length === 1 ? 'file exceeds' : 'files exceed'} the 10 MB upload limit and {fileSizeError.length === 1 ? 'was' : 'were'} not attached:
                </p>
                <ul className="mt-2 space-y-1">
                  {fileSizeError.map((name, i) => (
                    <li key={i} className="text-sm text-red-600 dark:text-red-400 font-medium truncate">{name}</li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => setFileSizeError([])}
                className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
